import type {DeckLevel,DeckTakeoff} from '../deckTakeoff';
import type {BoardPattern} from '../types';
import type {BoardRun,PlanPoint} from './deckGeometry';

/**
 * Where a deck board sits, for accent colours (boardFinishes.ts). Worked out from the finished model and never
 * stored in it, so a design without accent boards builds and prices exactly as before. A board is named by its
 * place on the deck, not by its place in the model's lists (those shift with almost any edit):
 * - straight rows (Straight and Picture Frame decks, not wrap-arounds): `r{n}`, the row counted from the house
 *   side. A row keeps its number when the deck is resized or its collection (and so its board gap) changes.
 * - other field rows (diagonal, wrap-around zones): `a{angle}:{line}`, where the row's line lies. Anything that
 *   moves the lines leaves the colour unmatched instead of putting it on another board.
 * - herringbone: `h{angle}:{x}:{y}`, the piece itself.
 * - breakers: `k{n}`, counted from the left.
 * - border boards: `e{row}.{side}{k}`, the border row (0 = outer) along the k-th edge facing that side
 *   (f front, b back, l left, r right, or a corner pair such as fl for a 45° edge).
 * `at` is the board's centre along its own length (plan inches); `from`..`to` is its extent there, so a single
 * board is the piece of its row that spans a saved `at`. Plan inches, level-local; pure data, no three.js.
 */
export type BoardRole='field'|'border'|'breaker';
export interface BoardAddress{lv:1|2|3;role:BoardRole;course:string;at:number;from:number;to:number;
  /** A whole row can be painted (not herringbone, whose pieces make no row). */
  rowPaint:boolean}

const quarter=(v:number)=>String(Math.round(v*4)/4);
const angleOf=(b:BoardRun)=>Math.round(((b.angleDeg%180)+180)%180);

/** The piece's corners (its cut polygon, or its rectangle). */
function corners(b:BoardRun,boardWidth:number):PlanPoint[]{
  if(b.polygon?.length)return b.polygon;
  const a=b.angleDeg*Math.PI/180,u={x:Math.cos(a),y:Math.sin(a)},n={x:-u.y,y:u.x},hl=b.length/2,hw=(b.width??boardWidth)/2;
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>({x:b.cx+u.x*hl*s+n.x*hw*t,y:b.cy+u.y*hl*s+n.y*hw*t}));
}
interface Frame{u:number;v:number;umin:number;umax:number;vmin:number}
function frameOf(b:BoardRun,boardWidth:number):Frame{
  const a=b.angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),pts=corners(b,boardWidth);
  const us=pts.map(p=>p.x*c+p.y*s),vs=pts.map(p=>-p.x*s+p.y*c);
  return {u:us.reduce((n,x)=>n+x,0)/us.length,v:vs.reduce((n,x)=>n+x,0)/vs.length,umin:Math.min(...us),umax:Math.max(...us),vmin:Math.min(...vs)};
}

/** The side a border edge faces, from its outward normal. */
function sideOf(o:PlanPoint){
  const fb=o.y>.38?'f':o.y<-.38?'b':'',lr=o.x>.38?'r':o.x<-.38?'l':'';
  return fb+lr||'f';
}

/** The deck level a model level is (1 to 3), or null for landings, winders and levels past the third. */
export function deckLevelNumber(level:DeckLevel):1|2|3|null{
  if(level.kind&&level.kind!=='deck')return null;
  const n=(level.index??0)+1;
  return n>=1&&n<=3?n as 1|2|3:null;
}

/**
 * The address of every board on a level, in the level's board order (null for the legacy centre inlay and for
 * levels that take no accent colours). `pitch` is the board width plus its gap.
 */
export function levelAddresses(level:DeckLevel,opts:{pattern:BoardPattern;boardWidth:number;pitch:number}):(BoardAddress|null)[]{
  const lv=deckLevelNumber(level);if(!lv)return level.boards.map(()=>null);
  const {pattern,boardWidth,pitch}=opts,wrap=!!level.wrapZones;
  const frames=level.boards.map(b=>frameOf(b,boardWidth)),roles=level.boards.map(b=>b.role??'field');
  // Straight rows are counted from the lowest row (the house side). Other rows are found by their line: a long
  // board's low edge lies exactly on its row's line (a wrap's zones can each have their own lines), and every
  // piece of that row, cut or not, sits between that line and the next.
  const rowsFromHouse=!wrap&&(pattern==='Straight'||pattern==='Picture Frame');
  const bottom=new Map<number,number>(),starts=new Map<number,number[]>();
  level.boards.forEach((b,i)=>{
    if(roles[i]!=='field')return;
    const ang=angleOf(b),f=frames[i];
    bottom.set(ang,Math.min(bottom.get(ang)??Infinity,f.vmin));
    if(f.umax-f.umin>3*boardWidth)starts.set(ang,[...(starts.get(ang)??[]),Math.round(f.vmin*1000)/1000]);
  });
  for(const [ang,list] of starts)starts.set(ang,[...new Set(list)].sort((a,b)=>a-b));
  const lineOf=(ang:number,v:number)=>{
    const found=(starts.get(ang)??[]).filter(s=>s<=v+1e-6).at(-1);
    if(found!==undefined)return found;
    const low=bottom.get(ang)??0;return low+Math.floor((v-low)/pitch+1e-6)*pitch;
  };
  const breakers=[...level.breakers].sort((a,b)=>a-b);
  // Border edges of the finished outline, each named by the side it faces and its order along that side.
  const outline=(level.deckingFootprint??level.footprint).outline,edges=outline.map((a,i)=>{
    const b=outline[(i+1)%outline.length],len=Math.hypot(b.x-a.x,b.y-a.y)||1,d={x:(b.x-a.x)/len,y:(b.y-a.y)/len};
    return {a,d,len,side:sideOf({x:d.y,y:-d.x}),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  });
  const edgeName=edges.map(e=>{
    const same=edges.filter(f=>f.side===e.side).sort((f,g)=>(e.side==='l'||e.side==='r')?f.mid.y-g.mid.y:f.mid.x-g.mid.x);
    return `${e.side}${same.indexOf(e)}`;
  });
  return level.boards.map((b,i)=>{
    const role=roles[i],f=frames[i],place={at:f.u,from:f.umin,to:f.umax};
    const layout=b as BoardRun&{layoutId?:string;layoutKind?:'region'|'breaker'|'piece'};
    if(layout.layoutId&&layout.layoutKind){
      // Keep the complete identity: a saved colour can never alias another region or inserted piece.
      const id=[...layout.layoutId].map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
      const a=String(Math.round((((b.angleDeg%180)+180)%180)*1e4)/1e4),line=String(Math.round(f.vmin*1e4)/1e4);
      const addressRole:BoardRole=role==='border'?'border':role==='breaker'?'breaker':'field';
      return {lv,role:addressRole,course:layout.layoutKind==='piece'?`lp:${id}`:`l${layout.layoutKind==='region'?'r':'b'}:${id}:${a}:${line}`,rowPaint:layout.layoutKind!=='piece',...place};
    }
    if(role==='breaker'){
      const x=b.cx,k=breakers.length?breakers.reduce((best,bx,j)=>Math.abs(bx-x)<Math.abs(breakers[best]-x)?j:best,0):-1;
      return {lv,role,course:k>=0?`k${k}`:`k:${quarter(x)}`,rowPaint:true,...place};
    }
    if(role==='border'){
      const a=b.angleDeg*Math.PI/180,u={x:Math.cos(a),y:Math.sin(a)},c={x:b.cx,y:b.cy};
      let best=-1,dist=Infinity;
      edges.forEach((e,j)=>{
        if(Math.abs(u.x*e.d.y-u.y*e.d.x)>.05)return;
        const t=(c.x-e.a.x)*e.d.x+(c.y-e.a.y)*e.d.y,off=Math.abs((c.x-e.a.x)*e.d.y-(c.y-e.a.y)*e.d.x);
        if(t<-12||t>e.len+12)return;
        if(off<dist){dist=off;best=j;}
      });
      if(best<0)return {lv,role,course:`e:${quarter(b.cx)}:${quarter(b.cy)}`,rowPaint:false,...place};
      return {lv,role,course:`e${Math.max(0,Math.floor(dist/pitch))}.${edgeName[best]}`,rowPaint:true,...place};
    }
    if(role!=='field')return null;
    const ang=angleOf(b);
    if(pattern==='Herringbone'&&!wrap)return {lv,role,course:`h${ang}:${quarter(b.cx)}:${quarter(b.cy)}`,rowPaint:false,...place};
    if(rowsFromHouse&&ang===0)return {lv,role,course:`r${Math.max(0,Math.floor((f.v-bottom.get(0)!)/pitch+1e-6))}`,rowPaint:true,...place};
    return {lv,role,course:`a${ang}:${quarter(lineOf(ang,f.v))}`,rowPaint:true,...place};
  });
}

/** Every board's address across the model, by model level then board. */
export function modelAddresses(model:DeckTakeoff,opts:{pattern:BoardPattern;boardWidth:number;pitch:number}){
  return model.levels.map(level=>levelAddresses(level,opts));
}
