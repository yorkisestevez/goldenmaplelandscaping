import {clipToConvex,type BoardRun,type PlanPoint,type FootprintPlan} from './lib/deckGeometry';
import type {DeckLevel,Member,V3} from './deckTakeoff';
import {inSolidInlay,onInlaySupport} from './inlayFraming';
import {distanceToSegment} from './lib/wrapGeometry';
import {angledBeamZAt} from './angledFraming';
import {insidePolygon as pointInPolygon,offsetPolygons,polygonCut} from './lib/polygonCuts';

const len=(m:Member)=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y,m.b.z-m.a.z);
/** A stock joint may only occur over a physical bearing, never at an arbitrary cut length. */
export function splitOnBearings(member:Member,bearings:number[],axis:'x'|'z',stock=192):Member[]{
  const low=Math.min(member.a[axis],member.b[axis]),high=Math.max(member.a[axis],member.b[axis]);
  const points=[low,...bearings.filter(v=>v>low+.1&&v<high-.1),high].sort((a,b)=>a-b);
  const out:Member[]=[];let from=low;
  while(high-from>stock+.001){const next=points.filter(p=>p>from+.1&&p-from<=stock).at(-1);if(next===undefined)throw new Error('Framing span has no bearing within available 16 ft stock');out.push({...member,a:{...member.a,[axis]:from},b:{...member.b,[axis]:next},spliceStart:from>low,spliceEnd:true});from=next;}
  out.push({...member,a:{...member.a,[axis]:from},b:{...member.b,[axis]:high},spliceStart:from>low});return out;
}

/** Framing that runs along plan z (joists) and x (beams) in its own frame. */
export type FramedSet={offset:V3;beams:Member[];supports:V3[];joists:Member[]};
/** Every clipped beam interval needs bearing near BOTH ends. Reference supports are retained when
 * valid; notches create new beam ends and thus new supports. Stock joints then fall only over
 * bearings. `rowZs` are the beam-row centre lines (plan z, before the level offset). */
export function addBearings(level:FramedSet,rowZs:number[]){
  const {offset}=level;
  // Angled beams (angled corners) carry their own posts and split along their length.
  const angled=level.beams.filter(b=>b.role==='angled-beam');
  level.beams=level.beams.filter(b=>b.role!=='angled-beam');
  for(const b of level.beams){
    const same=level.supports.filter(p=>Math.abs(p.z-(b.a.z+b.b.z)/2)<6);
    for(const x of [b.a.x+Math.min(12,len(b)/4),b.b.x-Math.min(12,len(b)/4)])if(!same.some(p=>Math.abs(p.x-x)<24)){
      const rowZ=rowZs.find(z=>Math.abs(z+offset.z-b.a.z)<6);
      const p={x,y:Math.max(0,b.a.y-b.depth/2),z:rowZ!==undefined?rowZ+offset.z:(b.a.z+b.b.z)/2};level.supports.push(p);same.push(p);
    }
  }
  level.beams=level.beams.flatMap(b=>splitOnBearings(b,level.supports.filter(p=>Math.abs(p.z-b.a.z)<6).map(p=>p.x),'x'));
  const along=(b:Member)=>{const l=len(b);return level.supports.filter(p=>distanceToSegment({x:p.x,y:p.z},{x:b.a.x,y:b.a.z},{x:b.b.x,y:b.b.z})<3).map(p=>((p.x-b.a.x)*(b.b.x-b.a.x)+(p.z-b.a.z)*(b.b.z-b.a.z))/l);};
  const angledSplit=angled.flatMap(b=>splitOnBearingsAlong(b,along(b)));
  level.joists=level.joists.flatMap(j=>splitOnBearings(j,[...level.beams.filter(b=>j.a.x>=b.a.x-.1&&j.a.x<=b.b.x+.1).map(b=>b.a.z),...angled.flatMap(b=>{const z=angledBeamZAt(b,j.a.x);return z===null?[]:[z];})],'z'));
  level.beams.push(...angledSplit);
}

/** Perimeter rim along every outline edge; pieces end at backing blocks, and short arc chords are actual faceted framing. */
export function addRim(level:DeckLevel){
  const {offset,footprint,top}=level,depth=level.joists[0]?.depth||9.25;
  const framingY=top-1-depth/2;
  const rim:Member[]=[];
  for(let i=0;i<footprint.outline.length;i++){
    const a=footprint.outline[i],b=footprint.outline[(i+1)%footprint.outline.length],length=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/length,uz=(b.y-a.y)/length;
    const pieces=Math.ceil(length/192);
    for(let k=0;k<pieces;k++)rim.push({a:{x:a.x+offset.x+ux*length*k/pieces,y:framingY,z:a.y+offset.z+uz*length*k/pieces},b:{x:a.x+offset.x+ux*length*(k+1)/pieces,y:framingY,z:a.y+offset.z+uz*length*(k+1)/pieces},width:1.5,depth,role:'rim',spliceStart:k>0,spliceEnd:k<pieces-1});
    for(let k=1;k<pieces;k++){
      const x=a.x+offset.x+ux*length*k/pieces-uz*1.5,z=a.y+offset.z+uz*length*k/pieces+ux*1.5;
      level.blocking.push({a:{x:x-ux*12,y:framingY,z:z-uz*12},b:{x:x+ux*12,y:framingY,z:z+uz*12},width:1.5,depth,role:'rim-splice-backing'});
    }
  }
  level.rim=rim;
}

/** Back one board end at (x, z) with a full-width block between the actual neighbouring joists
 * (joists run along z). A doubled block gives independent fastening zones on either side of the
 * joint. `spans(z)` gives the framed intervals across the level at z. */
export function blockBoardEnd(x:number,z:number,joists:Member[],spans:(z:number)=>[number,number][],keys:Set<string>,framingY:number,depth:number,out:Member[]){
  const onJoist=joists.some(j=>Math.abs(j.a.x-x)<.76&&z>=j.a.z-.1&&z<=j.b.z+.1);
  if(onJoist)return;
  for(const shift of [-.9375,.9375]){
    const zz=z+shift,interval=spans(zz).find(([a,b])=>x>=a-.01&&x<=b+.01);if(!interval)continue;
    const active=[...new Set(joists.filter(j=>zz>=j.a.z&&zz<=j.b.z).map(j=>j.a.x))].sort((a,b)=>a-b);
    const left=Math.max(interval[0],active.filter(v=>v<x).at(-1)??interval[0]),right=Math.min(interval[1],active.find(v=>v>x)??interval[1]);if(right-left<=1.5)continue;
    const key=`${left.toFixed(3)}:${right.toFixed(3)}:${zz.toFixed(2)}`;if(keys.has(key))continue;keys.add(key);
    out.push({a:{x:left+.75,y:framingY,z:zz},b:{x:right-.75,y:framingY,z:zz},width:1.5,depth,role:'board-end'});
  }
}

/** Like splitOnBearings for a member in any direction: `bearings` are distances along it from `a`. */
export function splitOnBearingsAlong(member:Member,bearings:number[],stock=192):Member[]{
  const total=len(member),at=(t:number):V3=>({x:member.a.x+(member.b.x-member.a.x)*t/total,y:member.a.y+(member.b.y-member.a.y)*t/total,z:member.a.z+(member.b.z-member.a.z)*t/total});
  const points=[0,...bearings.filter(v=>v>.1&&v<total-.1),total].sort((a,b)=>a-b);
  const out:Member[]=[];let from=0;
  while(total-from>stock+.001){const next=points.filter(p=>p>from+.1&&p-from<=stock).at(-1);if(next===undefined)throw new Error('Framing span has no bearing within available 16 ft stock');out.push({...member,a:at(from),b:at(next),spliceStart:from>0,spliceEnd:true});from=next;}
  out.push({...member,a:at(from),b:member.b,spliceStart:from>0});return out;
}

export function addConstructionDetails(level:DeckLevel,boardWidth:number,borderRows=0){
  const {offset,footprint,top}=level,depth=level.joists[0]?.depth||9.25;
  const framingY=top-1-depth/2;
  // Beam-row centre lines of every framing zone (a single-zone level uses its own reference).
  const rowZs=(level.zones??[{zone:{origin:{x:0,y:0}},reference:level.reference}]).flatMap(z=>z.reference.beamRows.map(r=>r.z+z.zone.origin.y));
  addBearings(level,rowZs);
  addRim(level);
  const keys=new Set<string>();
  const interiorSpans=(z:number)=>{
    const xs:number[]=[];
    for(let i=0;i<footprint.outline.length;i++){const a=footprint.outline[i],b=footprint.outline[(i+1)%footprint.outline.length];if((a.y<=z&&b.y>z)||(b.y<=z&&a.y>z))xs.push(a.x+(z-a.y)*(b.x-a.x)/(b.y-a.y));}
    xs.sort((a,b)=>a-b);const out:[number,number][]=[];for(let i=0;i+1<xs.length;i+=2)out.push([xs[i]+offset.x,xs[i+1]+offset.x]);return out;
  };
  // Back every individual board end (including diagonal/parquet cuts and butt joints). On an angled-corner
  // level, an end cut along an angled edge over its rim or a nailer sits on that, and every other end is
  // blocked at the middle of its actual end face (a 45° cut's far tip can sit a bay away).
  // Board ends already resting on inlay framing (inlayFraming.ts), or over a medallion's solid blocking, need no block
  // of their own.
  const inlaySupport=level.blocking.filter(m=>m.role?.startsWith('inlay-'));
  for(const board of level.boards){
    const angle=board.angleDeg*Math.PI/180,ux=Math.cos(angle),uz=Math.sin(angle);
    for(const sign of [-1,1]){
      let x=board.cx+ux*board.length/2*sign,z=board.cy+uz*board.length/2*sign;
      // Tested at the middle of the end's actual face, so a piece cut on a slant is judged where it really ends.
      if(inlaySupport.length){const face=endFaces(board,sign,boardWidth).reduce<ReturnType<typeof endFaces>[number]|undefined>((best,f)=>!best||f.len>best.len?f:best,undefined);
        const fx=face?(face.p.x+face.q.x)/2:x,fz=face?(face.p.y+face.q.y)/2:z;
        if(onInlaySupport((face?(face.p.x+face.q.x)/2:x)+offset.x,(face?(face.p.y+face.q.y)/2:z)+offset.z,inlaySupport)||inSolidInlay(level,fx,fz))continue;}
      if(level.angledEdges?.length){
        const faces=endFaces(board,sign,boardWidth);
        if(onAngledSupport(level,faces,borderRows))continue;
        const face=faces.reduce<typeof faces[number]|undefined>((best,f)=>!best||f.len>best.len?f:best,undefined);
        if(face){x=(face.p.x+face.q.x)/2;z=(face.p.y+face.q.y)/2;}
      }
      blockBoardEnd(x+offset.x,z+offset.z,level.joists,y=>interiorSpans(y-offset.z),keys,framingY,depth,level.blocking);
    }
  }
  addAngledNailers(level,borderRows,framingY,depth);
}

/** Nailer lines under an angled corner, measured in from the angled rim: 3.875 in for the board ends, and
 * 6.25 in for border boards (where a square edge gets doubled build-up joists). */
const angledNailerOffsets=(borderRows:number)=>borderRows>0?[3.875,6.25]:[3.875];

/** The inward unit normal of an angled edge (toward the deck). */
function inwardNormal(e:{a:PlanPoint;b:PlanPoint},outline:PlanPoint[]){
  const len=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),n={x:-(e.b.y-e.a.y)/len,y:(e.b.x-e.a.x)/len},mid={x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2};
  return pointInPolygon({x:mid.x+n.x*6,y:mid.y+n.y*6},outline)?n:{x:-n.x,y:-n.y};
}

/** The end faces of a board at one end (sign ±1 along its length): its outline's edges within a board
 * width of that end that are not long sides. */
function endFaces(board:BoardRun,sign:number,boardWidth:number){
  const poly=board.polygon??boardPolygon(board,boardWidth),a=board.angleDeg*Math.PI/180,u={x:Math.cos(a),y:Math.sin(a)};
  // A face belongs to this end only if it lies within a board width of it and on its half of the piece
  // (a piece shorter than its width would otherwise borrow the other end's cut).
  const us=poly.map(p=>(p.x*u.x+p.y*u.y)*sign),end=Math.max(...us),half=(end+Math.min(...us))/2,reach=(board.width??boardWidth)+.01;
  return poly.flatMap((p,i)=>{
    const q=poly[(i+1)%poly.length],len=Math.hypot(q.x-p.x,q.y-p.y),j=(i+1)%poly.length;
    if(len<.5||us[i]<end-reach||us[j]<end-reach||(us[i]+us[j])/2<=half)return [];
    const f={x:(q.x-p.x)/len,y:(q.y-p.y)/len};
    return Math.abs(f.x*u.x+f.y*u.y)>.99?[]:[{p,q,len,f}];
  });
}

/** Whether one of a board's end faces is a cut along an angled edge that lies over the angled rim (the
 * edge's first 1.5 in, or anywhere outside it) or over one of its nailers, so it needs no block of its own. */
function onAngledSupport(level:DeckLevel,faces:ReturnType<typeof endFaces>,borderRows:number){
  const bands=[[-Infinity,1.55],...angledNailerOffsets(borderRows).map(d=>[d-.8,d+.8])];
  return faces.some(({p,q,f})=>{
    const mid={x:(p.x+q.x)/2,y:(p.y+q.y)/2};
    return level.angledEdges!.some(e=>{
      const el=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),d={x:(e.b.x-e.a.x)/el,y:(e.b.y-e.a.y)/el};
      if(Math.abs(f.x*d.y-f.y*d.x)>.02)return false;
      const n=inwardNormal(e,level.footprint.outline),dist=(mid.x-e.a.x)*n.x+(mid.y-e.a.y)*n.y;
      return bands.some(([lo,hi])=>dist>=lo&&dist<=hi);
    });
  });
}

/** Nailers along each angled corner at angledNailerOffsets, between neighbouring joists and from the end
 * joists to the rims, each line running the full length inside the rims. */
function addAngledNailers(level:DeckLevel,borderRows:number,framingY:number,depth:number){
  const {offset}=level,outline=level.footprint.outline;if(!outline.length)return;
  const inner=offsetPolygons([outline],1.5);
  for(const e of level.angledEdges??[]){
    const len=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y);if(len<1)continue;
    const n=inwardNormal(e,outline),dir={x:(e.b.x-e.a.x)/len,y:(e.b.y-e.a.y)/len};
    for(const d of angledNailerOffsets(borderRows)){
      // The line d in from the edge, clipped to the inside of the rims (its stretch nearest the edge's middle).
      const p0={x:e.a.x+n.x*d,y:e.a.y+n.y*d},span=lineSpanInside(inner,p0,dir,len);if(!span)continue;
      const at=(t:number)=>({x:p0.x+dir.x*t+offset.x,z:p0.y+dir.y*t+offset.z}),s=at(span[0]),f=at(span[1]);
      const zAt=(x:number)=>s.z+(x-s.x)*(f.z-s.z)/(f.x-s.x);
      const lo=Math.min(s.x,f.x),hi=Math.max(s.x,f.x);
      const crossing=level.joists.filter(j=>{const x=j.a.x;if(x<lo||x>hi)return false;const z=zAt(x);return z>=Math.min(j.a.z,j.b.z)-.1&&z<=Math.max(j.a.z,j.b.z)+.1;}).map(j=>j.a.x);
      const xs=[...new Set(crossing.map(x=>Math.round(x*1000)/1000))].sort((p,q)=>p-q);
      const stops=[{x:lo,joist:false},...xs.map(x=>({x,joist:true})),{x:hi,joist:false}];
      for(let i=0;i+1<stops.length;i++){
        const x0=stops[i].x+(stops[i].joist?.75:0),x1=stops[i+1].x-(stops[i+1].joist?.75:0);
        if(x1-x0<(stops[i].joist&&stops[i+1].joist?.5:1))continue;
        level.blocking.push({a:{x:x0,y:framingY,z:zAt(x0)},b:{x:x1,y:framingY,z:zAt(x1)},width:1.5,depth,role:'angled-nailer'});
      }
    }
  }
}

/** The stretch [t0, t1] of the line p0 + dir·t inside the polygons that contains the point nearest the
 * middle of [0, len], or null. */
function lineSpanInside(polys:PlanPoint[][],p0:PlanPoint,dir:PlanPoint,len:number):[number,number]|null{
  const ts:number[]=[];
  for(const poly of polys)for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ex=b.x-a.x,ey=b.y-a.y,den=dir.x*ey-dir.y*ex;if(Math.abs(den)<1e-12)continue;
    const t=((a.x-p0.x)*ey-(a.y-p0.y)*ex)/den,s=((a.x-p0.x)*dir.y-(a.y-p0.y)*dir.x)/den;if(s>=-1e-9&&s<=1+1e-9)ts.push(t);
  }
  ts.sort((p,q)=>p-q);
  const inside=(t:number)=>polys.some(poly=>pointInPolygon({x:p0.x+dir.x*t,y:p0.y+dir.y*t},poly));
  let best:[number,number]|null=null,bestDist=Infinity;
  for(let i=0;i+1<ts.length;i++){
    if(ts[i+1]-ts[i]<1e-6||!inside((ts[i]+ts[i+1])/2))continue;
    const dist=Math.max(0,ts[i]-len/2,len/2-ts[i+1]);
    if(dist<bestDist){best=[ts[i],ts[i+1]];bestDist=dist;}
  }
  return best;
}


export function memberLength(m:Member){return len(m);}

/** Joist ends that sit on neither a ledger contact, a hip nor a beam under that joist. A beam may sit
 * inside the joist by up to the cantilever allowance (the end overhangs it), never beyond the end
 * (the joist would stop short of it). Joists run along z (or along x in a wrap wing); beams run
 * across them. */
export function unsupportedJoistEnds(level:DeckLevel,contact?:{onContact(a:{x:number;y:number},b:{x:number;y:number}):boolean}):V3[]{
  // A joist end bears on a beam whose centre line is within the edge reach: the cantilever past a drop beam, or half
  // a flush edge beam's width. Zones of one level differ (each cantilever is held to a share of its own span), so
  // the largest applies.
  const reach=Math.max(level.reference?.edgeReachIn??24,...(level.zones??[]).map(z=>z.reference.edgeReachIn))+1,loose:V3[]=[],beams=level.beams.filter(b=>b.role!=='hip'),hips=level.hips??[];
  for(const j of level.joists){
    const k=Math.abs(j.b.z-j.a.z)<1e-6&&Math.abs(j.b.x-j.a.x)>1e-6?'x':'z',c=k==='z'?'x':'z';
    const [lo,hi]=j.a[k]<=j.b[k]?[j.a,j.b]:[j.b,j.a];
    const onHip=(p:V3)=>hips.some(h=>distanceToSegment({x:p.x-level.offset.x,y:p.z-level.offset.z},h.a,h.b)<2);
    for(const [end,inward] of [[lo,1],[hi,-1]] as const){
      const plan={x:end.x-level.offset.x,y:end.z-level.offset.z};
      if(contact?.onContact(plan,plan))continue;
      if(onHip(end))continue;
      // A jack hung off a hip beyond the last beam sits in the corner cantilever: its outer end is
      // within cantilever reach of a beam that itself ends on that hip.
      const jack=onHip(end===lo?hi:lo);
      // An angled beam (angled corner) carries joist ends that stop on the angled rim in front of it.
      if(k==='z'&&beams.some(b=>{if(b.role!=='angled-beam')return false;const zb=angledBeamZAt(b,end.x);if(zb===null)return false;const inset=(zb-end.z)*inward;return inset>=-1&&inset<=reach;}))continue;
      const bears=beams.some(b=>{if(Math.abs(b.a[k]-b.b[k])>1e-6)return false;const across=end[c]>=Math.min(b.a[c],b.b[c])-.1&&end[c]<=Math.max(b.a[c],b.b[c])+.1;if(!across&&!(jack&&(onHip(b.a)||onHip(b.b))))return false;const inset=(b.a[k]-end[k])*inward;return inset>=-1&&inset<=reach;});
      if(!bears)loose.push(end);
    }
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
/** Perimeter cuts and inlay are physical board substitutions, with no overlay/double quantity.
 * `inlayField` (angled-corner decks): the inlay stops at, and is cut to, the field inside the border rows. */
export function finishBoards(boards:BoardRun[],fp:FootprintPlan,width:number,gap:number,inlayIn:number,stock:number,inset:number,inlayField?:PlanPoint[][]):BoardRun[]{
  const limit=100000,x0=fp.bounds.w/2-width/2-gap,x1=x0+width+2*gap,y0=inset;
  const fieldEnd=inlayField?Math.max(y0,...polygonCut(inlayField,[rect(x0+gap,-limit,x1-gap,limit)]).flat().map(p=>p.y)):fp.bounds.h-inset;
  const out:BoardRun[]=[],y1=Math.min(fieldEnd,y0+inlayIn);
  for(const b of boards){
    const clipped=b.polygon||clipToConvex(fp.outline,boardPolygon(b,width));
    const pieces=inlayIn>0?[
      clipToConvex(clipped,rect(-limit,-limit,x0,limit)),clipToConvex(clipped,rect(x1,-limit,limit,limit)),
      clipToConvex(clipped,rect(x0,-limit,x1,y0-gap)),clipToConvex(clipped,rect(x0,y1+gap,x1,limit))
    ]:[clipped];
    for(const poly of pieces){const next=withPolygon(b,poly);if(next)out.push(next);}
  }
  if(inlayIn>0)for(let y=y0;y<y1;y+=stock+gap){
    const length=Math.min(stock,y1-y),b:BoardRun={cx:fp.bounds.w/2,cy:y+length/2,length,angleDeg:90,width,role:'inlay'};
    for(const poly of inlayField?polygonCut(inlayField,[boardPolygon(b,width)]):[clipToConvex(fp.outline,boardPolygon(b,width))]){const next=withPolygon(b,poly);if(next)out.push(next);}
  }
  return out;
}
