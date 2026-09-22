import {clipToConvex,type BoardRun,type PlanPoint,type FootprintPlan} from './lib/deckGeometry';
import type {DeckLevel,Member,V3} from './deckTakeoff';

const len=(m:Member)=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y,m.b.z-m.a.z);
/** A stock joint may only occur over a physical bearing, never at an arbitrary cut length. */
export function splitOnBearings(member:Member,bearings:number[],axis:'x'|'z',stock=192):Member[]{
  const low=Math.min(member.a[axis],member.b[axis]),high=Math.max(member.a[axis],member.b[axis]);
  const points=[low,...bearings.filter(v=>v>low+.1&&v<high-.1),high].sort((a,b)=>a-b);
  const out:Member[]=[];let from=low;
  while(high-from>stock+.001){const next=points.filter(p=>p>from+.1&&p-from<=stock).at(-1);if(next===undefined)throw new Error('Framing span has no bearing within available 16 ft stock');out.push({...member,a:{...member.a,[axis]:from},b:{...member.b,[axis]:next},spliceStart:from>low,spliceEnd:true});from=next;}
  out.push({...member,a:{...member.a,[axis]:from},b:{...member.b,[axis]:high},spliceStart:from>low});return out;
}

export function addConstructionDetails(level:DeckLevel,boardWidth:number){
  const {offset,footprint,top}=level,depth=level.joists[0]?.depth||9.25;
  const framingY=top-1-depth/2;
  // Every clipped beam interval needs bearing near BOTH ends. Reference supports
  // are retained when valid; notches create new beam ends and thus new supports.
  for(const b of level.beams){
    const same=level.supports.filter(p=>Math.abs(p.z-(b.a.z+b.b.z)/2)<6);
    for(const x of [b.a.x+Math.min(12,len(b)/4),b.b.x-Math.min(12,len(b)/4)])if(!same.some(p=>Math.abs(p.x-x)<24)){
      const row=level.reference.beamRows.find((r:{z:number})=>Math.abs(r.z*12+offset.z-b.a.z)<6);
      const p={x,y:Math.max(0,b.a.y-b.depth/2),z:row?row.z*12+offset.z:(b.a.z+b.b.z)/2};level.supports.push(p);same.push(p);
    }
  }
  level.beams=level.beams.flatMap(b=>splitOnBearings(b,level.supports.filter(p=>Math.abs(p.z-b.a.z)<6).map(p=>p.x),'x'));
  level.joists=level.joists.flatMap(j=>splitOnBearings(j,level.beams.filter(b=>j.a.x>=b.a.x-.1&&j.a.x<=b.b.x+.1).map(b=>b.a.z),'z'));
  const rim:Member[]=[];
  for(let i=0;i<footprint.outline.length;i++){
    const a=footprint.outline[i],b=footprint.outline[(i+1)%footprint.outline.length],length=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/length,uz=(b.y-a.y)/length;
    // Perimeter pieces end at backing blocks; short arc chords are actual faceted framing.
    const pieces=Math.ceil(length/192);
    for(let k=0;k<pieces;k++)rim.push({a:{x:a.x+offset.x+ux*length*k/pieces,y:framingY,z:a.y+offset.z+uz*length*k/pieces},b:{x:a.x+offset.x+ux*length*(k+1)/pieces,y:framingY,z:a.y+offset.z+uz*length*(k+1)/pieces},width:1.5,depth,role:'rim',spliceStart:k>0,spliceEnd:k<pieces-1});
    for(let k=1;k<pieces;k++){
      const x=a.x+offset.x+ux*length*k/pieces-uz*1.5,z=a.y+offset.z+uz*length*k/pieces+ux*1.5;
      level.blocking.push({a:{x:x-ux*12,y:framingY,z:z-uz*12},b:{x:x+ux*12,y:framingY,z:z+uz*12},width:1.5,depth,role:'rim-splice-backing'});
    }
  }
  level.rim=rim;
  const keys=new Set<string>();
  const interiorSpans=(z:number)=>{
    const xs:number[]=[];
    for(let i=0;i<footprint.outline.length;i++){const a=footprint.outline[i],b=footprint.outline[(i+1)%footprint.outline.length];if((a.y<=z&&b.y>z)||(b.y<=z&&a.y>z))xs.push(a.x+(z-a.y)*(b.x-a.x)/(b.y-a.y));}
    xs.sort((a,b)=>a-b);const out:[number,number][]=[];for(let i=0;i+1<xs.length;i+=2)out.push([xs[i]+offset.x,xs[i+1]+offset.x]);return out;
  };
  // Back every individual board end (including diagonal/parquet cuts and butt joints)
  // with a full-width block between actual neighboring joists. A doubled block
  // gives independent fastening zones on either side of the joint.
  for(const board of level.boards){
    const angle=board.angleDeg*Math.PI/180,ux=Math.cos(angle),uz=Math.sin(angle);
    for(const sign of [-1,1]){
      const x=board.cx+ux*board.length/2*sign+offset.x,z=board.cy+uz*board.length/2*sign+offset.z;
      const onJoist=level.joists.some(j=>Math.abs(j.a.x-x)<.76&&z>=j.a.z-.1&&z<=j.b.z+.1);
      if(onJoist)continue;
      for(const shift of [-.9375,.9375]){
        const zz=z+shift,interval=interiorSpans(zz-offset.z).find(([a,b])=>x>=a-.01&&x<=b+.01);if(!interval)continue;
        const active=[...new Set(level.joists.filter(j=>zz>=j.a.z&&zz<=j.b.z).map(j=>j.a.x))].sort((a,b)=>a-b);
        const left=Math.max(interval[0],active.filter(v=>v<x).at(-1)??interval[0]),right=Math.min(interval[1],active.find(v=>v>x)??interval[1]);if(right-left<=1.5)continue;
        const key=`${left.toFixed(3)}:${right.toFixed(3)}:${zz.toFixed(2)}`;if(keys.has(key))continue;keys.add(key);
        level.blocking.push({a:{x:left+.75,y:framingY,z:zz},b:{x:right-.75,y:framingY,z:zz},width:1.5,depth,role:'board-end'});
      }
    }
  }
}

export function memberLength(m:Member){return len(m);}

/** Joist ends that sit on neither a ledger contact nor within cantilever reach of a beam under
 * that joist. Joists run along z; beams run along x. */
export function unsupportedJoistEnds(level:DeckLevel,contact?:{onContact(a:{x:number;y:number},b:{x:number;y:number}):boolean}):V3[]{
  const reach=(level.reference?.cant??2)*12+1,loose:V3[]=[];
  for(const j of level.joists)for(const end of [j.a,j.b]){
    const plan={x:end.x-level.offset.x,y:end.z-level.offset.z};
    if(contact?.onContact(plan,plan))continue;
    const onBeam=level.beams.some(b=>end.x>=Math.min(b.a.x,b.b.x)-.1&&end.x<=Math.max(b.a.x,b.b.x)+.1&&Math.abs(b.a.z-end.z)<=reach);
    if(!onBeam)loose.push(end);
  }
  return loose;
}

function boardPolygon(b:BoardRun,width:number):PlanPoint[]{
  if(b.polygon)return b.polygon;const a=b.angleDeg*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),w=b.width||width;
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:b.cx+ux*x*b.length/2-uy*y*w/2,y:b.cy+uy*x*b.length/2+ux*y*w/2}));
}
function withPolygon(b:BoardRun,polygon:PlanPoint[]):BoardRun|null{
  polygon=polygon.filter((p,i)=>{const q=polygon[(i+polygon.length-1)%polygon.length];return Math.hypot(p.x-q.x,p.y-q.y)>.000001;});
  if(polygon.length<3)return null;const a=b.angleDeg*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),u=polygon.map(p=>p.x*ux+p.y*uy),v=polygon.map(p=>-p.x*uy+p.y*ux),lo=Math.min(...u),hi=Math.max(...u),vl=Math.min(...v),vh=Math.max(...v),uc=(lo+hi)/2,vc=(vl+vh)/2;
  const area=Math.abs(polygon.reduce((s,p,i)=>{const q=polygon[(i+1)%polygon.length];return s+p.x*q.y-q.x*p.y},0))/2;if(area<.05)return null;
  return {...b,cx:uc*ux-vc*uy,cy:uc*uy+vc*ux,length:hi-lo,width:vh-vl,polygon};
}
const rect=(x0:number,y0:number,x1:number,y1:number)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
/** Perimeter cuts and inlay are physical board substitutions, with no overlay/double quantity. */
export function finishBoards(boards:BoardRun[],fp:FootprintPlan,width:number,gap:number,inlayIn:number,stock:number,inset:number):BoardRun[]{
  const out:BoardRun[]=[],x0=fp.bounds.w/2-width/2-gap,x1=x0+width+2*gap,y0=inset,y1=Math.min(fp.bounds.h-inset,y0+inlayIn),limit=100000;
  for(const b of boards){
    const clipped=b.polygon||clipToConvex(fp.outline,boardPolygon(b,width));
    const pieces=inlayIn>0?[
      clipToConvex(clipped,rect(-limit,-limit,x0,limit)),clipToConvex(clipped,rect(x1,-limit,limit,limit)),
      clipToConvex(clipped,rect(x0,-limit,x1,y0-gap)),clipToConvex(clipped,rect(x0,y1+gap,x1,limit))
    ]:[clipped];
    for(const poly of pieces){const next=withPolygon(b,poly);if(next)out.push(next);}
  }
  if(inlayIn>0)for(let y=y0;y<y1;y+=stock+gap){const length=Math.min(stock,y1-y),b:BoardRun={cx:fp.bounds.w/2,cy:y+length/2,length,angleDeg:90,width,role:'inlay'},next=withPolygon(b,clipToConvex(fp.outline,boardPolygon(b,width)));if(next)out.push(next);}
  return out;
}
