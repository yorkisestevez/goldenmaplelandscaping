import type {DeckData} from './types';
import type {Box,DeckTakeoff,V3} from './deckTakeoff';

export interface SkirtingSelection {enabled:boolean;orientation:'Horizontal'|'Vertical';color:string;gapIn:number;groundClearanceIn:number;frameSpacingIn:number;excludedEdgeIds:string[]}
export const DEFAULT_SKIRTING:SkirtingSelection={enabled:false,orientation:'Horizontal',color:'#8c7765',gapIn:.25,groundClearanceIn:6,frameSpacingIn:16,excludedEdgeIds:[]};
export const SKIRTING_REVIEW='Non-load-bearing skirting concept on assumed flat grade (y = 0). Confirm surveyed grade, drainage, ventilation, service access, manufacturer cladding approval, expansion gaps, corrosion-compatible fasteners, backing spans and attachments before construction. Frame sizes and spacing are preview allowances, not engineered connections.';
const ID=/^sk_[0-9:.|\-]+$/;
export function validateSkirting(value:unknown):SkirtingSelection|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const v=value as Record<string,unknown>,num=(k:string,min:number,max:number)=>typeof v[k]==='number'&&Number.isFinite(v[k])&&(v[k] as number)>=min&&(v[k] as number)<=max;
 if(typeof v.enabled!=='boolean'||!['Horizontal','Vertical'].includes(v.orientation as string)||typeof v.color!=='string'||!/^#[0-9a-f]{6}$/i.test(v.color)||!num('gapIn',.125,2)||!num('groundClearanceIn',2,36)||!num('frameSpacingIn',8,24)||!Array.isArray(v.excludedEdgeIds)||v.excludedEdgeIds.length>256||!v.excludedEdgeIds.every(x=>typeof x==='string'&&x.length<180&&ID.test(x)))return;
 return {enabled:v.enabled,orientation:v.orientation as SkirtingSelection['orientation'],color:v.color,gapIn:v.gapIn as number,groundClearanceIn:v.groundClearanceIn as number,frameSpacingIn:v.frameSpacingIn as number,excludedEdgeIds:[...new Set(v.excludedEdgeIds as string[])]};
}
export interface SkirtingEdge {id:string;label:string;levelIndex:number;edgeIndex:number;a:V3;b:V3;lengthIn:number;inward:{x:number;z:number};available:[number,number][]}
export interface SkirtingBox extends Box {id:string;edgeId:string;role:string}
const key=(p:V3)=>[p.x,p.y,p.z].map(n=>Number(n.toFixed(3))).join(':');
const cut=(spans:[number,number][],lo:number,hi:number):[number,number][]=>spans.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[...(lo>a?[[a,lo]]:[]),...(hi<b?[[hi,b]]:[])] as [number,number][]);
const fillSpacing=(stations:number[],max:number)=>{const sorted=[...new Set(stations.map(n=>Number(n.toFixed(4))))].sort((a,b)=>a-b),out:number[]=[];sorted.forEach((a,i)=>{out.push(a);const b=sorted[i+1];if(b!==undefined){const n=Math.ceil((b-a)/max);for(let j=1;j<n;j++)out.push(a+(b-a)*j/n);}});return out;};

/** Installed on real structural polygon edges, never derived from optional guard visibility. */
export function skirtingEdges(data:DeckData,model:DeckTakeoff):SkirtingEdge[]{
 const result:SkirtingEdge[]=[];
 model.levels.forEach((level,levelIndex)=>{
  if(level.kind==='winder')return;
  const fp=level.footprint,area=fp.outline.reduce((n,p,i)=>{const q=fp.outline[(i+1)%fp.outline.length];return n+p.x*q.y-q.x*p.y;},0),sign=area>=0?1:-1;
  fp.outline.forEach((p,edgeIndex)=>{
   const q=fp.outline[(edgeIndex+1)%fp.outline.length],dx=q.x-p.x,dz=q.y-p.y,len=Math.hypot(dx,dz);
   // Curves require a different cladding/bending detail; do not fill tessellated arcs with fake straight panels.
   if(len<6||fp.isCurved&&Math.abs(dx)>.001&&Math.abs(dz)>.001)return;
   if((data.deckType==='Attached'||data.deckType==='Add-on')&&Math.abs(p.y+level.offset.z)<.01&&Math.abs(q.y+level.offset.z)<.01)return;
   const ux=dx/len,uz=dz/len,a={x:p.x+level.offset.x,y:level.top,z:p.y+level.offset.z},b={x:q.x+level.offset.x,y:level.top,z:q.y+level.offset.z};
   let available:[number,number][]=[[0,len]];
   // Shared collinear platform boundaries are interior, including partial overlaps.
   for(const other of model.levels){if(other===level)continue;other.footprint.outline.forEach((op,i)=>{const oq=other.footprint.outline[(i+1)%other.footprint.outline.length],c={x:op.x+other.offset.x,z:op.y+other.offset.z},d={x:oq.x+other.offset.x,z:oq.y+other.offset.z};if(Math.abs((c.x-a.x)*uz-(c.z-a.z)*ux)<.01&&Math.abs((d.x-a.x)*uz-(d.z-a.z)*ux)<.01){const t=(c.x-a.x)*ux+(c.z-a.z)*uz,s=(d.x-a.x)*ux+(d.z-a.z)*uz;available=cut(available,Math.min(t,s),Math.max(t,s));}});}
   // Real flight entry/exit positions include the finished fascia offset.
   const exclude=(c:V3,width:number)=>{if(Math.abs(c.y-level.top)>.1||Math.abs((c.x-a.x)*uz-(c.z-a.z)*ux)>6)return;const t=(c.x-a.x)*ux+(c.z-a.z)*uz;available=cut(available,t-width/2-1,t+width/2+1);};
   for(const f of model.flights){exclude(f.start,f.width);exclude(f.end,f.width);}
   for(const c of model.connections){const source=model.levels[c.from],o=c.opening,center={x:source.offset.x+o.origin.x+o.along.x*o.width/2,y:source.top,z:source.offset.z+o.origin.y+o.along.y*o.width/2};exclude(center,o.width);exclude({x:center.x+o.outward.x*c.run,y:model.levels[c.to].top,z:center.z+o.outward.y*c.run},o.width);}
   available=available.filter(([a,b])=>b-a>=6);
   const inward={x:-uz*sign,z:ux*sign},side=Math.abs(dz)<.01?(inward.z>0?'Back':'Front'):Math.abs(dx)<.01?(inward.x>0?'Left':'Right'):'Angled';
   if(available.length)result.push({id:`sk_${[key(a),key(b)].sort().join('|')}`,label:`${level.kind==='landing'?'Landing':levelIndex===0?'Main deck':'Second section'} · ${side} edge ${edgeIndex+1}`,levelIndex,edgeIndex,a,b,lengthIn:len,inward,available});
  });
 });
 return result;
}

export function buildSkirting(data:DeckData,model:DeckTakeoff){
 const edges=skirtingEdges(data,model),boards:SkirtingBox[]=[],framing:SkirtingBox[]=[],issues:string[]=[],rows:{name:string;qty:number;unit:string;spec:string}[]=[],selection=validateSkirting(data.skirting),staleExclusions=(selection?.excludedEdgeIds??[]).filter(id=>!edges.some(e=>e.id===id));
 if(!selection?.enabled)return {boards,framing,edges,rows,issues,staleExclusions};
 const s=selection,boardWidth=Math.max(3,Math.min(8,data.boardWidth||5.5)),thickness=.75,stock=192,maxPieces=12000;
 issues.push(SKIRTING_REVIEW,'The lowest edge is left open above soil. Provide a removable service-access panel/door and cross-ventilation sized for the selected product; hiding an entire edge is only a layout opening, not a detailed access door.');
 if(model.levels.some(l=>l.footprint.isCurved||l.kind==='winder'))issues.push('Curved perimeter arcs and winder skirting are not modeled; supply a reviewed custom detail.');
 if(staleExclusions.length)issues.push(`${staleExclusions.length} saved hidden skirting edges no longer match this geometry. Review edge visibility after shape changes.`);
 const joistDepth=data.framingSize==='2x8'?7.25:data.framingSize==='2x12'?11.25:9.25;
 for(const edge of edges){
  if(s.excludedEdgeIds.includes(edge.id))continue;
  const top=edge.a.y-1-joistDepth-.25,bottom=s.groundClearanceIn,height=top-bottom;
  if(height<4){issues.push(`${edge.label}: insufficient space below fascia for skirting with the selected ground clearance.`);continue;}
  const ux=(edge.b.x-edge.a.x)/edge.lengthIn,uz=(edge.b.z-edge.a.z)/edge.lengthIn,angle=-Math.atan2(uz,ux);
  const box=(t:number,y:number,w:number,h:number,d:number,inset:number,role:string,id:string):SkirtingBox=>({id:`${edge.id}_${id}`,edgeId:edge.id,role,x:edge.a.x+ux*t+edge.inward.x*inset,y,z:edge.a.z+uz*t+edge.inward.z*inset,w,h,d,angle});
  for(const [lo,hi] of edge.available){
   const span=hi-lo,tag=`${Number(lo.toFixed(3))}:${Number(hi.toFixed(3))}`,addFrame=(t:number,y:number,w:number,h:number,d:number,role:string)=>framing.push(box(t,y,w,h,d,d/2,role,`${tag}_f${framing.length}`));
   // At square corners one wall runs through and backs its neighbour's board ends.
   // The returning backing frame stops at that wall instead of interpenetrating it.
   const cornerReturn=(point:V3)=>edges.some(other=>{
    if(other.id>=edge.id||s.excludedEdgeIds.includes(other.id)||Math.abs(other.a.y-edge.a.y)>.01||Math.abs(other.inward.x*edge.inward.x+other.inward.z*edge.inward.z)>.01)return false;
    const atA=Math.hypot(other.a.x-point.x,other.a.z-point.z)<.01&&other.available.some(([a])=>a<.01),atB=Math.hypot(other.b.x-point.x,other.b.z-point.z)<.01&&other.available.some(([,b])=>b>other.lengthIn-.01);
    if(!atA&&!atB)return false;
    const away=point===edge.a?1:-1,otherAway=atA?1:-1,ox=(other.b.x-other.a.x)/other.lengthIn,oz=(other.b.z-other.a.z)/other.lengthIn;
    const dx=ux*away*.75+edge.inward.x*1.75-ox*otherAway*.75-other.inward.x*1.75,dz=uz*away*.75+edge.inward.z*1.75-oz*otherAway*.75-other.inward.z*1.75;
    // Re-entrant corners already separate the two walls; only trim colliding convex returns.
    return Math.abs(dx*ux+dz*uz)<2.5-.01&&Math.abs(dx*edge.inward.x+dz*edge.inward.z)<2.5-.01;
   });
   const frameLo=lo+(lo<.01&&cornerReturn(edge.a)?3.5:0),frameHi=hi-(hi>edge.lengthIn-.01&&cornerReturn(edge.b)?3.5:0),frameSpan=frameHi-frameLo;
   if(frameSpan<=3){issues.push(`${edge.label}: a short corner return needs custom backing; this interval is not drawn.`);continue;}
   if(s.orientation==='Horizontal'){
    // 2x4 plates close each panel. Studs are behind the cladding; the assembly is not attached to earth.
    for(const y of [bottom+.75,top-.75])addFrame((frameLo+frameHi)/2,y,frameSpan,1.5,3.5,'skirting-plate');
    const studStations=[frameLo+.75,frameHi-.75];
    for(let x=frameLo+.75+s.frameSpacingIn;x<frameHi-2.25;x+=s.frameSpacingIn)studStations.push(x);
    const pieceCount=Math.ceil(span/stock),pieceSpan=span/pieceCount,joints=Array.from({length:pieceCount-1},(_,i)=>lo+pieceSpan*(i+1));
    // Each stock end has its own stud; nominal butt gaps must be selected against actual product/temperature rules.
    const stations=studStations.filter(x=>!joints.some(j=>Math.abs(x-j)<s.gapIn/2+2.25));
    for(const j of joints)stations.push(j-s.gapIn/2-.75,j+s.gapIn/2+.75);
    for(const x of fillSpacing(stations,s.frameSpacingIn))addFrame(x,(bottom+top)/2,1.5,height-3,3.5,'skirting-stud');
    for(let y=bottom;y<top-.001;y+=boardWidth+s.gapIn){const h=Math.min(boardWidth,top-y);if(h<.125)continue;for(let i=0;i<pieceCount;i++){const a=lo+pieceSpan*i+(i?s.gapIn/2:0),b=lo+pieceSpan*(i+1)-(i<pieceCount-1?s.gapIn/2:0);if(b>a)boards.push(box((a+b)/2,y+h/2,b-a,h,thickness,-thickness/2,'skirting-horizontal',`${tag}_h${Number(y.toFixed(3))}:${Number(a.toFixed(3))}`));}}
   }else{
    // Horizontal 2x4 rails support vertical boards, with vertical end stiles tying rail ends together.
    for(const x of [frameLo+.75,frameHi-.75])addFrame(x,(bottom+top)/2,1.5,height,3.5,'skirting-end-stile');
    const railYs=height<7?[(bottom+top)/2]:[bottom+1.75,top-1.75];for(let y=bottom+1.75+s.frameSpacingIn;y<top-5.25;y+=s.frameSpacingIn)railYs.push(y);
    const pieceCount=Math.ceil(height/stock),pieceSpan=height/pieceCount,joints=Array.from({length:pieceCount-1},(_,i)=>bottom+pieceSpan*(i+1));
    const ys=railYs.filter(y=>!joints.some(j=>Math.abs(j-y)<s.gapIn/2+5.25));for(const j of joints)ys.push(j-s.gapIn/2-1.75,j+s.gapIn/2+1.75);
    for(const y of fillSpacing(ys,s.frameSpacingIn))addFrame((frameLo+frameHi)/2,y,frameSpan-3,3.5,1.5,'skirting-rail');
    for(let x=lo;x<hi-.001;x+=boardWidth+s.gapIn){const w=Math.min(boardWidth,hi-x);if(w<.125)continue;for(let i=0;i<pieceCount;i++){const a=bottom+pieceSpan*i+(i?s.gapIn/2:0),b=bottom+pieceSpan*(i+1)-(i<pieceCount-1?s.gapIn/2:0);if(b>a)boards.push(box(x+w/2,(a+b)/2,w,b-a,thickness,-thickness/2,'skirting-vertical',`${tag}_v${Number(x.toFixed(3))}:${Number(a.toFixed(3))}`));}}
   }
   if(boards.length+framing.length>maxPieces){boards.length=0;framing.length=0;issues.push('Skirting exceeds the 12,000-piece preview limit. Reduce the layout; no partial assembly is drawn.');return {boards,framing,edges,rows,issues,staleExclusions};}
  }
 }
 if(boards.length){rows.push({name:`${s.orientation} skirting cladding`,qty:boards.length,unit:'cut pieces',spec:`${boardWidth} × 0.75 in schematic profile; 16 ft maximum stock; finish ${s.color}; product/fastener approval and waste not included`},{name:'Skirting cladding area',qty:Math.round(boards.reduce((n,b)=>n+b.w*b.h/144,0)*100)/100,unit:'sq ft',spec:'Installed face area only; supplier quote required'},{name:'Non-load-bearing skirting backing',qty:framing.length,unit:'members',spec:'Nominal 2×4 PT concept: backing orientation follows cladding; stock cuts, corrosion-compatible fasteners and structural attachment detail require review'},{name:'Skirting backing length',qty:Math.round(framing.reduce((n,b)=>n+Math.max(b.w,b.h)/12,0)*100)/100,unit:'linear ft',spec:'Installed length, no stock optimization, anchors or waste allowance'});}
 return {boards,framing,edges,rows,issues,staleExclusions};
}
