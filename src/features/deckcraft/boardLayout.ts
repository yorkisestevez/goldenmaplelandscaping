import ClipperLib from 'clipper-lib';
import type {BoardLayoutConfig,BoardLayoutPiece,DeckData} from './types';
import type {BoardRun,FootprintPlan,PlanPoint} from './lib/deckGeometry';
import {boardOutline,polygonBoard,signedArea} from './lib/polygonCuts';
import {DECKING_CATALOGUE} from './manufacturerRuntimeCatalogue';

/** Explicit bounds keep imported edits finite and the interactive clipping work bounded. */
export const BOARD_LAYOUT_LIMITS={regions:32,breakers:64,pieces:300,polygonPoints:64,coordinateIn:2400,pieceLengthIn:240,minPieceLengthIn:1,minWidthIn:.125} as const;
const SCALE=1000000,EPS=.00001,MIN_AREA=.05;
const area=(polys:PlanPoint[][])=>polys.reduce((n,p)=>n+signedArea(p),0);
const toPath=(p:PlanPoint[])=>p.map(v=>({X:Math.round(v.x*SCALE),Y:Math.round(v.y*SCALE)}));
const fromPath=(p:{X:number;Y:number}[])=>p.map(v=>({x:v.X/SCALE,y:v.Y/SCALE}));
const bounds=(polys:PlanPoint[][])=>{const p=polys.flat();return {x0:Math.min(...p.map(v=>v.x)),x1:Math.max(...p.map(v=>v.x)),y0:Math.min(...p.map(v=>v.y)),y1:Math.max(...p.map(v=>v.y))};};
const rect=(x0:number,y0:number,x1:number,y1:number):PlanPoint[]=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
/** Preserve negative hole contours until the final physical board is decomposed into simple cut polygons. */
function booleanPolygons(subject:PlanPoint[][],clip:PlanPoint[][],difference=false):PlanPoint[][] {
  if(!subject.length)return [];if(!clip.length)return difference?subject.map(p=>p.map(v=>({...v}))):[];
  const c=new ClipperLib.Clipper(),out=[];
  c.AddPaths(subject.map(toPath),ClipperLib.PolyType.ptSubject,true);c.AddPaths(clip.map(toPath),ClipperLib.PolyType.ptClip,true);
  c.Execute(difference?ClipperLib.ClipType.ctDifference:ClipperLib.ClipType.ctIntersection,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
  return out.map(fromPath).filter(p=>Math.abs(signedArea(p))>EPS);
}
function grow(polys:PlanPoint[][],distance:number):PlanPoint[][] {
  if(!polys.length||!distance)return polys;
  const offset=new ClipperLib.ClipperOffset(4,.01*SCALE),out=[];
  offset.AddPaths(polys.map(toPath),ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);offset.Execute(out,distance*SCALE);
  return out.map(fromPath).filter(p=>Math.abs(signedArea(p))>EPS);
}
function projected(p:PlanPoint,angleDeg:number):PlanPoint {const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:p.x*c+p.y*s,y:-p.x*s+p.y*c};}
function unprojected(p:PlanPoint,angleDeg:number):PlanPoint {const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:p.x*c-p.y*s,y:p.x*s+p.y*c};}
/** A hole cannot be drawn as a filled positive contour. Slice in the board's own axes at every hole vertex so
 * each resulting positive polygon has an open notch rather than a hidden hole. No artificial overlay is emitted. */
function simpleCuts(polys:PlanPoint[][],angleDeg:number):PlanPoint[][] {
  if(!polys.some(p=>signedArea(p)<0))return polys.filter(p=>signedArea(p)>EPS);
  const local=polys.map(p=>p.map(v=>projected(v,angleDeg))),b=bounds(local),xs=[...new Set(local.flat().map(p=>p.x))].sort((a,b)=>a-b),out:PlanPoint[][]=[];
  for(let i=0;i+1<xs.length;i++)if(xs[i+1]-xs[i]>EPS){
    const parts=booleanPolygons(local,[rect(xs[i],b.y0-1,xs[i+1],b.y1+1)]);
    for(const p of parts)if(signedArea(p)>EPS)out.push(p.map(v=>unprojected(v,angleDeg)));
  }
  return out;
}
export function boardRectangle(piece:Pick<BoardLayoutPiece,'cx'|'cy'|'lengthIn'|'widthIn'|'angleDeg'>):PlanPoint[] {
  return boardOutline({cx:piece.cx,cy:piece.cy,length:piece.lengthIn,width:piece.widthIn,angleDeg:piece.angleDeg},piece.widthIn);
}
/** The cut silhouette physically rotates; its stock envelope is never substituted for a mitre or wedge. */
export function boardLayoutPiecePolygon(piece:BoardLayoutPiece):PlanPoint[] {
  if(!piece.polygon)return boardRectangle(piece);
  const a=(piece.angleDeg-(piece.sourceAngleDeg??piece.angleDeg))*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return piece.polygon.map(p=>({x:piece.cx+(p.x-piece.cx)*c-(p.y-piece.cy)*s,y:piece.cy+(p.x-piece.cx)*s+(p.y-piece.cy)*c}));
}
/** Preserve selectable cut tips in a valid source blank without widening their rendered silhouette. */
export function boardLayoutPieceSource(run:BoardRun,nominalWidth:number):Omit<BoardLayoutPiece,'id'|'level'|'colour'> {
  if(run.layoutSource)return {...run.layoutSource,...(run.layoutSource.polygon?{polygon:run.layoutSource.polygon.map(p=>({...p}))}:{})};
  return {cx:run.cx,cy:run.cy,lengthIn:Math.max(1,run.length),widthIn:Math.min(nominalWidth,Math.max(.125,run.width??nominalWidth)),angleDeg:run.angleDeg,sourceAngleDeg:run.angleDeg,polygon:boardOutline(run,nominalWidth).map(p=>({...p}))};
}
function isRecord(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
function strictObject(value:unknown,allowed:string[],label:string):Record<string,unknown> {
  if(!isRecord(value))throw new Error(`Invalid ${label}.`);
  for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value)))if(!allowed.includes(key)||!('value' in descriptor)||!descriptor.enumerable)throw new Error(`Unknown or unsafe ${label} field: ${key}.`);
  if(Object.getOwnPropertySymbols(value).length)throw new Error(`Invalid ${label} fields.`);
  return value;
}
function strictArray(value:unknown,min:number,max:number,label:string):unknown[] {
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length<min||value.length>max||Object.getOwnPropertySymbols(value).length)throw new Error(`Invalid ${label} list.`);
  const descriptors=Object.getOwnPropertyDescriptors(value);
  for(const [key,d] of Object.entries(descriptors))if(key!=='length'&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length||!('value' in d)||!d.enumerable))throw new Error(`Unknown or unsafe ${label} list field.`);
  for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))throw new Error(`Sparse ${label} list.`);
  return value;
}
const numeric=(value:unknown,lo:number,hi:number,label:string):number=>{if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi)throw new Error(`${label} must be between ${lo} and ${hi}.`);return value;};
function point(value:unknown,label:string):PlanPoint {const p=strictObject(value,['x','y'],label);return {x:numeric(p.x,-2400,2400,`${label} x`),y:numeric(p.y,-2400,2400,`${label} y`)};}
const cross=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on=(a:PlanPoint,b:PlanPoint,p:PlanPoint)=>Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
function polygon(value:unknown,label:string):PlanPoint[] {
  const p=strictArray(value,3,64,label).map(v=>point(v,label));
  if(signedArea(p)<MIN_AREA)throw new Error(`${label} needs a positive, nonzero outline.`);
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],prev=p[(i+p.length-1)%p.length];
    if(Math.hypot(a.x-b.x,a.y-b.y)<.01)throw new Error(`${label} has repeated points.`);
    if(Math.abs(cross(prev,a,b))<EPS&&(a.x-prev.x)*(b.x-a.x)+(a.y-prev.y)*(b.y-a.y)<0)throw new Error(`${label} doubles back.`);
    for(let j=i+1;j<p.length;j++)if(j!==i+1&&!(i===0&&j===p.length-1)){
      const c=p[j],d=p[(j+1)%p.length],abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
      if(abC*abD<0&&cdA*cdB<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw new Error(`${label} crosses itself.`);
    }
  }
  return p;
}
/** Strict import/UI validation. No clamping, reordering, dropped entries or unknown/prototype fields. */
export function validateBoardLayout(input:unknown,boardWidth:number):BoardLayoutConfig {
  if(![3.5,5.5].includes(boardWidth))throw new Error('Unsupported nominal decking width.');
  const raw=strictObject(input,['regions','breakers','pieces'],'board layout'),ids=new Set<string>();
  const base=(entry:Record<string,unknown>)=>{
    if(typeof entry.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(entry.id)||ids.has(entry.id))throw new Error('Invalid or duplicate board-layout id.');ids.add(entry.id);
    if(![1,2,3].includes(entry.level as number))throw new Error('Board-layout level must be 1, 2 or 3.');
    let colour:string|undefined;
    if(entry.colour!==undefined){if(typeof entry.colour!=='string')throw new Error('Invalid board-layout colour.');const ref=entry.colour as string,colon=ref.indexOf(':'),m=DECKING_CATALOGUE.find(m=>m.id===ref.slice(0,colon));if(colon<1||!m?.colors.some(c=>c.name===ref.slice(colon+1)))throw new Error('Unknown board-layout product colour.');colour=ref;}
    return {id:entry.id,level:entry.level as 1|2|3,...(colour?{colour}:{})};
  };
  const list=(key:'regions'|'breakers'|'pieces',max:number)=>strictArray(raw[key],0,max,`Board layout ${key}`);
  const regions=list('regions',32).map(v=>{const r=strictObject(v,['id','level','polygon','angleDeg','colour','replaceBorder'],'layout region');if(r.replaceBorder!==undefined&&r.replaceBorder!==true)throw new Error('Border replacement must be true when supplied.');return {...base(r),polygon:polygon(r.polygon,'Layout region'),angleDeg:numeric(r.angleDeg,-360,360,'Region direction'),...(r.replaceBorder?{replaceBorder:true as const}:{})};});
  const breakers=list('breakers',64).map(v=>{const r=strictObject(v,['id','level','start','end','widthIn','colour'],'layout breaker'),start=point(r.start,'Breaker start'),end=point(r.end,'Breaker end');if(Math.hypot(end.x-start.x,end.y-start.y)<1)throw new Error('A breaker needs at least 1 inch of length.');return {...base(r),start,end,...(r.widthIn!==undefined?{widthIn:numeric(r.widthIn,.125,boardWidth,'Breaker width')}:{})};});
  const pieces=list('pieces',300).map(v=>{
    const r=strictObject(v,['id','level','cx','cy','lengthIn','widthIn','angleDeg','colour','polygon','sourceAngleDeg'],'layout piece');
    const piece:BoardLayoutPiece={...base(r),cx:numeric(r.cx,-2400,2400,'Piece centre x'),cy:numeric(r.cy,-2400,2400,'Piece centre y'),lengthIn:numeric(r.lengthIn,1,240,'Piece length'),widthIn:numeric(r.widthIn,.125,boardWidth,'Piece width'),angleDeg:numeric(r.angleDeg,-360,360,'Piece direction')};
    if(r.polygon!==undefined){piece.polygon=polygon(r.polygon,'Piece cut');piece.sourceAngleDeg=numeric(r.sourceAngleDeg,-360,360,'Source piece direction');
      const envelope=boardRectangle({...piece,angleDeg:piece.sourceAngleDeg});if(area(booleanPolygons([piece.polygon],[envelope],true))>.001)throw new Error('Piece cut extends beyond its source stock rectangle.');
    }else if(r.sourceAngleDeg!==undefined)throw new Error('A source direction requires a piece cut polygon.');
    return piece;
  });
  return {regions,breakers,pieces};
}
export function boardLayoutProblem(input:unknown,boardWidth=5.5):string {try{validateBoardLayout(input,boardWidth);return '';}catch(e){return e instanceof Error?e.message:'Invalid board layout.';}}

export interface PlacedLayoutBreaker {id:string;start:PlanPoint;end:PlanPoint;widthIn:number;lengthIn:number;segments:{start:PlanPoint;end:PlanPoint;lengthIn:number}[]}
export interface BoardLayoutResult {boards:BoardRun[];breakers:PlacedLayoutBreaker[];issues:string[]}
/** Rendering can decompose a notched blank into several polygons. Count installed connected material,
 * not drawable records, while distinct stock tiles and their real joints remain separate pieces. */
export function physicalBoardPieceCount(boards:BoardRun[],boardWidth:number):number {
  if(!boards.some(b=>b.layoutStockId||b.layoutId))return boards.length;
  const groups=new Map<string,PlanPoint[][]>();
  boards.forEach((b,index)=>{const id=b.layoutStockId??(b.layoutKind==='piece'?`piece:${b.layoutId}`:`record:${index}`),polys=groups.get(id)??[];polys.push(boardOutline(b,boardWidth));groups.set(id,polys);});
  let count=0;
  for(const polys of groups.values()){
    if(polys.length===1){count++;continue;}
    const c=new ClipperLib.Clipper(),out=[];c.AddPaths(polys.map(toPath),ClipperLib.PolyType.ptSubject,true);
    c.Execute(ClipperLib.ClipType.ctUnion,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
    count+=out.map(fromPath).filter(p=>signedArea(p)>EPS).length;
  }
  return count;
}
function cuts(b:BoardRun,polys:PlanPoint[][]):BoardRun[] {
  return simpleCuts(polys,b.angleDeg).filter(p=>signedArea(p)>=MIN_AREA).map(p=>({...b,...polygonBoard(p,b.angleDeg,b.role,b.inlay)}));
}
function stockSource(b:BoardRun,boardWidth:number){return {cx:b.cx,cy:b.cy,lengthIn:b.length,widthIn:b.width??boardWidth,angleDeg:b.angleDeg};}
function withStock(b:BoardRun,id:string,boardWidth:number):BoardRun{return {...b,layoutStockId:id,layoutStockSource:stockSource(b,boardWidth)};}
function stockCuts(domain:PlanPoint[][],angleDeg:number,role:BoardRun['role'],id:string,stockLength:number,gap:number):BoardRun[] {
  const local=domain.map(p=>p.map(v=>projected(v,angleDeg))),b=bounds(local),count=Math.ceil((b.x1-b.x0)/stockLength),length=(b.x1-b.x0-gap*(count-1))/count,out:BoardRun[]=[];
  for(let i=0;i<count;i++){
    const x0=b.x0+i*(length+gap),tile=rect(x0,b.y0-1,x0+length,b.y1+1),parts=simpleCuts(booleanPolygons(local,[tile]),0).filter(p=>signedArea(p)>=MIN_AREA);
    if(!parts.length)continue;
    const actual=bounds(parts),centre=unprojected({x:(actual.x0+actual.x1)/2,y:(actual.y0+actual.y1)/2},angleDeg),source={cx:centre.x,cy:centre.y,lengthIn:actual.x1-actual.x0,widthIn:actual.y1-actual.y0,angleDeg};
    for(const part of parts)out.push({...polygonBoard(part.map(v=>unprojected(v,angleDeg)),angleDeg,role),layoutStockId:`${id}:segment:${i}`,layoutStockSource:source});
  }
  return out;
}
/** Split to purchasing stock using real axial cuts/joints while retaining source identity and silhouette. */
function splitStock(b:BoardRun,stockLength:number,gap:number,boardWidth:number):BoardRun[] {
  if(b.length<=stockLength+.001)return [b];
  const count=Math.ceil(b.length/stockLength),length=(b.length-gap*(count-1))/count,out:BoardRun[]=[],a=b.angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  for(let i=0;i<count;i++){const along=-b.length/2+length/2+i*(length+gap),tile=boardOutline({...b,cx:b.cx+c*along,cy:b.cy+s*along,length,width:(b.width??boardWidth)+.01,polygon:undefined},boardWidth),parts=cuts(b,booleanPolygons([boardOutline(b,boardWidth)],[tile]));
    for(const part of parts)out.push(withStock(part,`${b.layoutStockId??b.layoutId??'stock'}:segment:${i}`,boardWidth));}
  return out;
}
function carve(boards:BoardRun[],mask:PlanPoint[][],boardWidth:number,fieldOnly=false,keepUntouched=false):BoardRun[] {
  return boards.flatMap(b=>fieldOnly&&(b.role==='border'||b.role?.startsWith('inlay')||b.inlay)||keepUntouched&&area(booleanPolygons([boardOutline(b,boardWidth)],mask))<EPS?[b]:cuts(b,booleanPolygons([boardOutline(b,boardWidth)],mask,true)));
}
function regionBoards(domain:PlanPoint[][],source:PlanPoint[],angleDeg:number,width:number,gap:number,stock:number,id:string):BoardRun[] {
  if(!domain.length)return [];
  const b=bounds(source.map(p=>[projected(p,angleDeg)])),d=bounds(domain.map(poly=>poly.map(p=>projected(p,angleDeg)))),pitch=width+gap,out:BoardRun[]=[],firstRow=Math.max(0,Math.floor((d.y0-b.y0)/pitch));
  // Retain the source course phase while skipping off-deck rows of large imported selection polygons.
  for(let row=firstRow,y=b.y0+firstRow*pitch;y<Math.min(b.y1,d.y1)-EPS;row++,y+=pitch){
    let x=b.x0,first=true;
    while(x<b.x1-EPS){const length=Math.min(first&&row%2?stock/2:stock,b.x1-x),tile=rect(x,y,x+length,y+width).map(p=>unprojected(p,angleDeg)),clipped=booleanPolygons(domain,[tile]),parts=simpleCuts(clipped,angleDeg).filter(poly=>signedArea(poly)>=MIN_AREA),stockId=`region:${id}:${row}:${x}`;
      if(parts.length){const localBounds=bounds(parts.map(poly=>poly.map(p=>projected(p,angleDeg)))),centre=unprojected({x:(localBounds.x0+localBounds.x1)/2,y:(localBounds.y0+localBounds.y1)/2},angleDeg),sourceBlank={cx:centre.x,cy:centre.y,lengthIn:localBounds.x1-localBounds.x0,widthIn:localBounds.y1-localBounds.y0,angleDeg};
        for(const poly of parts)out.push({...polygonBoard(poly,angleDeg,'field'),layoutStockId:stockId,layoutStockSource:sourceBlank});}
      x+=length+gap;first=false;
    }
  }
  return out;
}
/** Apply only to real deck levels. Without edits for this level returns the exact original board-array reference. */
export function applyBoardLayout(data:DeckData,level:1|2|3,footprint:FootprintPlan,baseBoards:BoardRun[],options:{boardWidth:number;gap:number;stockLength:number;inset:number}):BoardLayoutResult {
  const layout=data.boardLayout,empty={boards:baseBoards,breakers:[],issues:[]};
  if(!layout)return empty;
  const regions=layout.regions.filter(r=>r.level===level),breakers=layout.breakers.filter(r=>r.level===level),pieces=layout.pieces.filter(r=>r.level===level);
  if(!regions.length&&!breakers.length&&!pieces.length)return empty;
  const {boardWidth,gap,stockLength,inset}=options;
  let boards=baseBoards.map((b,index)=>withStock(b,`base:${level}:${index}`,boardWidth)),field=grow([footprint.outline],-inset);
  // Preserve the whole built inlay domain, including its real joints. Borders are already excluded by the inset.
  const inlayMasks=baseBoards.filter(b=>b.inlay||b.role?.startsWith('inlay')).map(b=>boardOutline(b,boardWidth));
  if(inlayMasks.length)field=booleanPolygons(field,grow(inlayMasks,gap),true);
  const issues:string[]=[],built=new Set<string>();
  for(const r of regions){
    const editable=r.replaceBorder?booleanPolygons([footprint.outline],grow(inlayMasks,gap),true):field;
    const domain=booleanPolygons(editable,[r.polygon]);if(area(domain)<MIN_AREA){issues.push(`Board-layout region ${r.id} does not reach the editable field.`);continue;}
    boards=carve(boards,r.replaceBorder?domain:grow(domain,gap),boardWidth,!r.replaceBorder,!!r.replaceBorder);
    const next=regionBoards(domain,r.polygon,r.angleDeg,boardWidth,gap,stockLength,r.id).map(b=>({...b,layoutId:r.id,layoutKind:'region' as const,...(r.colour?{layoutColour:r.colour}:{})}));
    boards.push(...next);if(next.length)built.add(r.id);
  }
  for(const r of breakers){
    const angleDeg=Math.atan2(r.end.y-r.start.y,r.end.x-r.start.x)*180/Math.PI,widthIn=r.widthIn??boardWidth,lengthIn=Math.hypot(r.end.x-r.start.x,r.end.y-r.start.y),raw=boardRectangle({cx:(r.start.x+r.end.x)/2,cy:(r.start.y+r.end.y)/2,lengthIn,widthIn,angleDeg}),domain=booleanPolygons(field,[raw]);
    if(area(domain)<MIN_AREA){issues.push(`Board-layout breaker ${r.id} does not reach the editable field.`);continue;}
    boards=carve(boards,grow(domain,gap),boardWidth,true);
    const next=stockCuts(domain,angleDeg,'breaker',`breaker:${r.id}`,stockLength,gap).map(b=>({...b,layoutId:r.id,layoutKind:'breaker' as const,...(r.colour?{layoutColour:r.colour}:{})}));
    boards.push(...next);if(next.length)built.add(r.id);
  }
  for(const p of pieces){
    const polygon=boardLayoutPiecePolygon(p),domain=booleanPolygons([footprint.outline],[polygon]);
    if(area(domain)<MIN_AREA){issues.push(`Board-layout piece ${p.id} is outside its deck level.`);continue;}
    // Preserve the semantic finish of the destination's most-overlapped board; explicit layoutColour takes priority.
    const inherited=boards.map(b=>({b,overlap:area(booleanPolygons([boardOutline(b,boardWidth)],[polygon]))})).filter(v=>v.overlap>EPS).sort((a,b)=>b.overlap-a.overlap)[0]?.b;
    boards=carve(boards,grow(domain,gap),boardWidth);
    const source={cx:p.cx,cy:p.cy,lengthIn:p.lengthIn,widthIn:p.widthIn,angleDeg:p.angleDeg,...(p.polygon?{polygon:p.polygon.map(v=>({...v})),sourceAngleDeg:p.sourceAngleDeg}:{})};
    const next=simpleCuts(domain,p.angleDeg).filter(poly=>signedArea(poly)>=MIN_AREA).flatMap(poly=>splitStock({...polygonBoard(poly,p.angleDeg,inherited?.role??'field',inherited?.inlay),layoutId:p.id,layoutKind:'piece',layoutSource:source,...(p.colour?{layoutColour:p.colour}:inherited?.layoutColour?{layoutColour:inherited.layoutColour}:{})},stockLength,gap,boardWidth));
    boards.push(...next);if(next.length)built.add(p.id);
  }
  const placed=breakers.flatMap(r=>{
    const runs=boards.filter(b=>b.layoutKind==='breaker'&&b.layoutId===r.id);if(!runs.length)return [];
    const length=Math.hypot(r.end.x-r.start.x,r.end.y-r.start.y),ux=(r.end.x-r.start.x)/length,uy=(r.end.y-r.start.y)/length,intervals=runs.map(b=>{const centre=(b.cx-r.start.x)*ux+(b.cy-r.start.y)*uy;return [centre-b.length/2,centre+b.length/2];}).sort((a,b)=>a[0]-b[0]),merged:number[][]=[];
    for(const interval of intervals){const last=merged[merged.length-1];if(last&&interval[0]<=last[1]+EPS)last[1]=Math.max(last[1],interval[1]);else merged.push([...interval]);}
    // A contained notch can produce two side fragments over the same stock span; fitting LF counts it once.
    const segments=merged.map(([start,end])=>({start:{x:r.start.x+ux*start,y:r.start.y+uy*start},end:{x:r.start.x+ux*end,y:r.start.y+uy*end},lengthIn:end-start}));
    return [{id:r.id,start:{...r.start},end:{...r.end},widthIn:r.widthIn??boardWidth,lengthIn:segments.reduce((n,s)=>n+s.lengthIn,0),segments}];
  });
  // No invented support detail: real cuts/stock are modeled, and custom bearing/fastening remains a builder detail.
  if(built.size)issues.push('Custom board layout: the actual directions, cuts and stock pieces are modeled. Confirm joist spacing, end bearings and fastening beneath rotated regions, finite breakers and individual pieces before construction.');
  return {boards,breakers:placed,issues};
}
