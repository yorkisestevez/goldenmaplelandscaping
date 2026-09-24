import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';
import {sceneBounds} from './components/viewer3d/sceneBounds';
import type {YardModel} from './yardModel';
import {getHouseContact} from './houseContact';
import {getHousePlacement} from './housePlacement';
import {activeWrap} from './lib/wrapGeometry';
import {isChamferEdgeId} from './lib/cornerChamfers';
import {getHouseBlocks,hasHouseBlocks,houseOutline} from './houseFootprint';
import {polygonCut} from './lib/polygonCuts';
import {boardFinishPlan} from './boardFinishes';

/** Plan tones for accent-colour groups; the legend names the real product colours. */
const ACCENT_TONES=['#6f4e37','#3f5c5a','#8c5a3c','#4f4a6b','#5d6b3a','#7a3f3f'];

const HOUSE_BAND=36;// inches of house drawn behind the deck-facing wall
// The site plan shows more of the house (8 ft behind the wall, and up to 8 ft past each end of the deck, cut off with
// drafting break lines) and keeps room under the deck for its width figure, the scale bar and the notes.
const SITE_BAND=96,SITE_REACH=96,SITE_FOOT=84;
const ft=(inches:number)=>`${(inches/12).toFixed(1)} ft`;
/** A site-plan figure, in the size heading's format: "16 ft", "16.5 ft". */
export const feet=(inches:number)=>`${Math.round(inches/12*100)/100} ft`;

/**
 * 'contractor' (the default) is the framing plan: the PDF's picture, the printable proposal's plan and the Framing tab.
 * 'site' is the plan the customer draws on: no framing, a 1 ft grid, 8 ft of house cut off with break lines, and
 * dimension strings for the deck's width and depth.
 */
export type PlanVariant='contractor'|'site';

/** Where a plan sheet sits, in plan inches (x along the deck-facing wall from the deck's left end, y out from the wall;
 * the house is y < 0). The plan and the editor drawn over it share it, so the two always line up. */
export interface PlanFrame{
  x:number;y:number;w:number;h:number;viewBox:string;
  /** The drawing's extent: every level and stair, and any yard drawn. */
  b:ReturnType<typeof sceneBounds>;
  house:ReturnType<typeof getHousePlacement>|null|undefined;wrap:ReturnType<typeof activeWrap>;
  band:number;top:number;left:number;right:number;reach:number;
  /** Site plan only: the centre of the width and depth figures, and the lengths they give. */
  dims?:{width:{x:number;y:number;inches:number};depth:{x:number;y:number;inches:number}};
}

/** The sheet's frame (its viewBox) for a design, as ConstructionPlan draws it. `legendRows` is the contractor plan's
 * accent-board legend (the site plan always keeps room for it). */
export function planFrame(model:DeckTakeoff,{data,yard,variant='contractor',legendRows=0,wholeHouse=false}:{data?:DeckData;yard?:YardModel;variant?:PlanVariant;legendRows?:number;
  /** Site plan only (its House tool, R5): draw the house's whole deck-facing wall, so both wall ends show. */
  wholeHouse?:boolean}={}):PlanFrame{
  const b=sceneBounds(model);
  for(const p of yard?.features.filter(f=>!f.excluded).flatMap(f=>f.footprints.flat())??[]){b.minX=Math.min(b.minX,p.x);b.maxX=Math.max(b.maxX,p.x);b.minZ=Math.min(b.minZ,p.y);b.maxZ=Math.max(b.maxZ,p.y);}
  const site=variant==='site',house=data&&data.houseVisible!==false?getHousePlacement(data):null,wrap=data?activeWrap(data):null;
  const reach=site?Math.max(SITE_REACH,...(wholeHouse&&house?[b.minX-house.x0,house.x1-b.maxX]:[])):48;
  // A wrap-around runs back along the house side walls, so draw the house deep enough to show them.
  const band=house?Math.min(house.depthIn,Math.max(site?SITE_BAND:HOUSE_BAND,...(wrap?[wrap.left?.runIn??0,wrap.right?.runIn??0].map(r=>r+24):[]))):site?SITE_BAND:HOUSE_BAND;
  const top=house?Math.min(b.minZ,-band):b.minZ;
  const left=Math.min(b.minX,house?Math.max(house.x0,b.minX-reach):b.minX),right=Math.max(b.maxX,house?Math.min(house.x1,b.maxX+reach):b.maxX);
  if(!site){const x=left-40,y=top-44,w=right-left+80,h=b.maxZ-top+128+legendRows*12;return {x,y,w,h,viewBox:`${x} ${y} ${w} ${h}`,b,house,wrap,band,top,left,right,reach};}
  // The site plan measures the main deck: its width along the wall and its depth out from it (a curved front's
  // depth is the deck's own, to the ends of the curve).
  const main=model.levels[0],fp=main.footprint,W=fp.bounds.w,D=fp.isCurved&&data?Number(data.length)*12:fp.bounds.h;
  const x=left-40,y=top-20,w=right-left+80,h=b.maxZ+SITE_FOOT-y;
  return {x,y,w,h,viewBox:`${x} ${y} ${w} ${h}`,b,house,wrap,band,top,left,right,reach,
    dims:{width:{x:main.offset.x+W/2,y:b.maxZ+30,inches:W},depth:{x:b.minX-29,y:main.offset.z+D/2,inches:D}}};
}

/** Contractor plan from the shared model. With `data` it also shows the house, ledgers and edge lengths. */
export default function ConstructionPlan({model,yard,data,variant='contractor',wholeHouse}:{model:DeckTakeoff;yard?:YardModel;data?:DeckData;variant?:PlanVariant;wholeHouse?:boolean}){
 const site=variant==='site';
 const main=model.levels[0],outline=main.footprint.outline;
 const contact=data?getHouseContact(data,main.footprint):null;
 // Accent-colour boards (boardFinishes.ts): each colour group gets a plan tone, named in the legend.
 const finish=data?.boardColours?.length||data?.inlays?.length?boardFinishPlan(data,model):null,tones=new Map(finish?.groups.map((g,k)=>[g.ref,ACCENT_TONES[k%ACCENT_TONES.length]]));
 const accentFill=(level:number,index:number)=>{const ref=finish?.colours[level]?.[index];return ref?tones.get(ref):undefined;};
 const legendRows=finish?.groups.length?1:0;
 const frame=planFrame(model,{data,yard,variant,legendRows,...(site&&wholeHouse?{wholeHouse}:{})}),{b,house,band,top,left,right,reach}=frame;
 const hips=main.hips??[],zones=main.wrapZones??[];
 // A house with bump-outs, wings or a garage is drawn as its outline, cut to the same band behind the deck.
 const blocks=house&&data&&hasHouseBlocks(data)?getHouseBlocks(data):null;
 const view=[{x:b.minX-reach,y:-band},{x:b.maxX+reach,y:-band},{x:b.maxX+reach,y:b.maxZ},{x:b.minX-reach,y:b.maxZ}];
 const blockPolys=blocks&&data?polygonCut(houseOutline(data,blocks),[view]):null;
 const blockLabels=(blocks??[]).slice(1).map(k=>{const r=k.rect,y0=Math.max(r.y0,-band),x0=Math.max(r.x0,b.minX-reach),x1=Math.min(r.x1,b.maxX+reach);return x1-x0<30||r.y1-y0<12?null:{id:k.id,x:(x0+x1)/2,y:(y0+r.y1)/2+2.5,text:k.kind==='garage'?'GARAGE':k.attachedTo==='Front'?'BUMP-OUT':'WING'};}).filter(Boolean) as {id:string;x:number;y:number;text:string}[];
 const w=b.maxX-b.minX,d=b.maxZ-b.minZ;
 // Edge labels sit just outside each main-deck edge; curve facets under 2 ft are left unlabelled. An angled
 // corner is always labelled, with the cut along the front and side it was entered as.
 const edgeLabels=data&&!site?outline.map((a,i)=>{const q=outline[(i+1)%outline.length],len=Math.hypot(q.x-a.x,q.y-a.y),angled=isChamferEdgeId(main.footprint.edgeIds?.[i]);if(len<24&&!angled)return null;const nx=(q.y-a.y)/len,ny=-(q.x-a.x)/len,ledger=contact?.isContactEdge(i),flush=contact?.contacts.find(c=>c.edgeIndex===i)?.kind==='flush';return {x:(a.x+q.x)/2+nx*(ledger?5:11),y:(a.y+q.y)/2+ny*(ledger?5:11)+2.5,text:angled?`45° corner · ${ft(len/Math.SQRT2)} cut`:flush?`Bolted flush wall ${ft(len)}`:ledger?`Ledger ${ft(len)}`:ft(len),ledger,flush};}).filter(Boolean) as {x:number;y:number;text:string;ledger:boolean;flush:boolean}[]:[];
 // The site plan's own edge lengths: only for an outline that is more than a rectangle (the dimension strings give a
 // rectangle's), and never along the house. On an edge 4 ft or longer the figure sits a quarter of the way along, clear
 // of the handle the plan editor puts at the edge's middle.
 const rectangular=outline.length===4&&outline.every((p,i)=>{const q=outline[(i+1)%4];return Math.abs(p.x-q.x)<.01||Math.abs(p.y-q.y)<.01;});
 const siteEdges=site&&data&&!rectangular?outline.map((a,i)=>{const q=outline[(i+1)%outline.length],len=Math.hypot(q.x-a.x,q.y-a.y),angled=isChamferEdgeId(main.footprint.edgeIds?.[i]);if((len<24&&!angled)||contact?.isContactEdge(i))return null;const nx=(q.y-a.y)/len,ny=-(q.x-a.x)/len,t=len>=48?.25:.5;return {x:a.x+(q.x-a.x)*t+nx*11,y:a.y+(q.y-a.y)*t+ny*11+2.5,text:angled?`45° · ${feet(len/Math.SQRT2)} cut`:feet(len)};}).filter(Boolean) as {x:number;y:number;text:string}[]:[];
 const scale=48;
 // Site plan: the house shown up to the frame, with break lines where the drawing cuts it off.
 const hx0=house?Math.max(house.x0,left):0,hx1=house?Math.min(house.x1,right):0,breaks:string[]=[];
 if(site&&house){
  if(band<house.depthIn-.5){const m=(hx0+hx1)/2;breaks.push(`M${hx0-6} ${-band}H${m-6}l3 -7l6 14l3 -7H${hx1+6}`);}
  for(const [x,cut] of [[left,house.x0<left-.5],[right,house.x1>right+.5]] as const)if(cut){const m=-band/2;breaks.push(`M${x} ${-band-6}V${m-6}l-7 3l14 6l-7 3V0`);}
 }
 const dims=frame.dims,ox=main.offset.x,oz=main.offset.z;
 return <svg viewBox={frame.viewBox} role="img" aria-label={site?'Site plan: the deck against the house':'Deck construction plan from the shared model'} className={site?'dd-site-plan':undefined} style={{width:'100%',height:'100%',background:site?'#fbfbf8':'#faf8f1'}}>
   <title>{site?`Site plan · ${data?.width} × ${data?.length} ft deck`:`Deck plan · ${model.quantities.joists} joists · ${model.quantities.footings} footings`}</title>
   <defs><marker id="dd-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6z" fill="#5f5a50"/></marker><pattern id="dd-house-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#b9b1a2" strokeWidth="1"/></pattern><pattern id="dd-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0V12H0" fill="none" stroke="#dde3da" strokeWidth=".6"/></pattern><pattern id="dd-grid-5" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="url(#dd-grid)"/><path d="M60 0V60H0" fill="none" stroke="#c6cfc3" strokeWidth="1"/></pattern></defs>
   {/* The contractor plan's grid shows on screen only (the page's CSS shows it; the PDF's picture has no CSS): a 1 ft
       grid, 5 ft lines bolder, over the yard. The site plan's is always drawn. */}
   {site?<rect className="dd-plan-grid" x={frame.x} y={0} width={frame.w} height={frame.y+frame.h} fill="url(#dd-grid-5)"/>:<rect className="dd-plan-grid" display="none" x={left-40} y={0} width={right-left+80} height={b.maxZ+18} fill="url(#dd-grid-5)"/>}
   {house&&!site&&<g aria-label="House">
     {blockPolys?blockPolys.map((poly,i)=><polygon key={i} points={poly.map(p=>`${p.x},${p.y}`).join(' ')} fill="url(#dd-house-hatch)" stroke="#6d675c" strokeWidth=".8"/>)
       :<rect x={house.x0} y={-band} width={house.x1-house.x0} height={band} fill="url(#dd-house-hatch)" stroke="#6d675c" strokeWidth=".8"/>}
     {blockLabels.map(l=><text key={l.id} x={l.x} y={l.y} textAnchor="middle" fontSize="7" fontWeight="600" fill="#3d3a34" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{l.text}</text>)}
     <line x1={house.x0} y1={0} x2={house.x1} y2={0} stroke="#3d3a34" strokeWidth="2"/>
     <text x={(Math.max(house.x0,left-40)+Math.min(house.x1,right+40))/2} y={-band+11} textAnchor="middle" fontSize="8" fontWeight="600" fill="#3d3a34" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{`HOUSE · deck-facing wall · ${ft(house.x1-house.x0)} wide`}</text>
   </g>}
   {house&&site&&<g aria-label="House">
     {blockPolys?blockPolys.map((poly,i)=><polygon key={i} points={poly.map(p=>`${p.x},${p.y}`).join(' ')} fill="url(#dd-house-hatch)" stroke="#6d675c" strokeWidth=".8"/>)
       :<rect x={hx0} y={-band} width={hx1-hx0} height={band} fill="url(#dd-house-hatch)" stroke="#6d675c" strokeWidth=".8"/>}
     {blockLabels.map(l=><text key={l.id} x={l.x} y={l.y} textAnchor="middle" fontSize="7" fontWeight="600" fill="#14261c" paintOrder="stroke" stroke="#fbfbf8" strokeWidth="2.5">{l.text}</text>)}
     <line x1={hx0} y1={0} x2={hx1} y2={0} stroke="#14261c" strokeWidth="2"/>
     {breaks.map((path,i)=><g key={i} className="dd-break"><path d={path} fill="none" stroke="#fbfbf8" strokeWidth="4"/><path d={path} fill="none" stroke="#14261c" strokeWidth="1"/></g>)}
     <text x={(hx0+hx1)/2} y={-band/2+3} textAnchor="middle" fontSize="9" fontWeight="600" fill="#14261c" paintOrder="stroke" stroke="#fbfbf8" strokeWidth="3">{`HOUSE · ${feet(house.widthIn)} wide`}</text>
   </g>}
   {yard?.boxes.filter(p=>['paver','wall-block','wall-cap','water'].includes(p.role)).map(p=><polygon key={p.id} points={p.polygon?.map(v=>`${v.x},${v.y}`).join(' ')} fill={p.color} stroke="#66695d" strokeWidth=".2"/>)}
   {yard?.features.filter(f=>!f.excluded).map(f=><text key={f.config.id} x={f.config.xFt*12} y={f.config.zFt*12} textAnchor="middle" fontSize="7" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2" fill="#333">{f.config.name}</text>)}
   {model.levels.map((l,i)=><g key={i}>
     <polygon points={l.footprint.outline.map(p=>`${p.x+l.offset.x},${p.y+l.offset.z}`).join(' ')} fill={l.kind==='winder'?'none':'#e5d7bb'} stroke="#7c6b51" strokeWidth="1"/>
     {l.boards.map((board,j)=>{const cut=board as typeof board&{width?:number;polygon?:{x:number;y:number}[];role?:string},width=cut.width??5.5;
       return cut.polygon?<polygon key={j} points={cut.polygon.map(p=>`${p.x+l.offset.x},${p.y+l.offset.z}`).join(' ')} fill={cut.role==='inlay'?'#71644e':accentFill(i,j)??'none'} stroke="#ac9572" strokeWidth=".3"/>:<rect key={j} x={board.cx+l.offset.x-board.length/2} y={board.cy+l.offset.z-width/2} width={board.length} height={width} transform={`rotate(${board.angleDeg} ${board.cx+l.offset.x} ${board.cy+l.offset.z})`} fill={cut.role==='inlay'?'#71644e':accentFill(i,j)??'none'} stroke="#ac9572" strokeWidth=".3"/>;
     })}
     {!site&&l.joists.map((j,k)=><line key={k} x1={j.a.x} y1={j.a.z} x2={j.b.x} y2={j.b.z} stroke="#787b72" strokeDasharray="3 2" strokeWidth=".6"/>)}
     {/* Decorative inlays: their outline, name and (on the contractor plan) the framing under them (inlayFraming.ts). */}
     {!site&&l.blocking.filter(m=>m.role?.startsWith('inlay-')).map((m,k)=><line key={`ib${k}`} x1={m.a.x} y1={m.a.z} x2={m.b.x} y2={m.b.z} stroke="#b27a2c" strokeWidth="1.1"/>)}
     {(l.inlays??[]).filter(p=>p.status==='ok').map((p,k)=>{const c=p.outline.reduce((s,v)=>({x:s.x+v.x/p.outline.length,y:s.y+v.y/p.outline.length}),{x:0,y:0});return <g key={`in${k}`} aria-label={`Inlay ${k+1}`}>{p.pieces.map((piece,j)=><polygon key={j} points={piece.map(v=>`${v.x+l.offset.x},${v.y+l.offset.z}`).join(' ')} fill="none" stroke="#6b4521" strokeWidth="1"/>)}<text x={c.x+l.offset.x} y={c.y+l.offset.z+2.5} textAnchor="middle" fontSize="7" fontWeight="600" fill="#3d2a1c" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{`Inlay ${k+1}`}</text></g>;})}
     {!site&&l.beams.map((j,k)=><line key={k} x1={j.a.x} y1={j.a.z} x2={j.b.x} y2={j.b.z} stroke="#826947" strokeWidth="1"/>)}
     {!site&&l.supports.map((p,k)=><circle key={k} cx={p.x} cy={p.z} r={4} fill="#545b54"/>)}
     <text x={l.offset.x+10} y={l.offset.z+15} fontSize="7" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2" fill="#444">{`${l.kind==='landing'?'Landing':l.kind==='winder'?'Winder':'Deck '+((l.index??i)+1)} · ${l.top.toFixed(1)} in above grade`}</text>
   </g>)}
   {!site&&hips.map((h,i)=>{const mx=(h.a.x+h.b.x)/2,my=(h.a.y+h.b.y)/2;return <g key={`hip${i}`} aria-label={`Hip at ${h.angleDeg.toFixed(0)} degrees`}><line x1={h.a.x} y1={h.a.y} x2={h.b.x} y2={h.b.y} stroke="#5b3d1c" strokeWidth="2.4" strokeDasharray="6 3"/><text x={mx+(h.side==='right'?6:-6)} y={my} textAnchor={h.side==='right'?'start':'end'} fontSize="6.5" fontWeight="600" fill="#5b3d1c" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{Math.abs(h.angleDeg-45)<.5?'Hip · 45° mitre':`Hip · ${h.angleDeg.toFixed(0)}° to back wall`}</text></g>;})}
   {!site&&zones.map(z=>{const cx=z.outline.reduce((n,p)=>n+p.x,0)/z.outline.length,cy=z.outline.reduce((n,p)=>n+p.y,0)/z.outline.length;return <g key={z.id} aria-label={`${z.label}: joist direction`}><line x1={cx-z.joistDir.x*14} y1={cy-z.joistDir.y*14} x2={cx+z.joistDir.x*14} y2={cy+z.joistDir.y*14} stroke="#5f5a50" strokeWidth="1.2" markerEnd="url(#dd-arrow)"/><text x={cx+Math.abs(z.joistDir.y)*8} y={cy+Math.abs(z.joistDir.x)*10+2} fontSize="6" fill="#4a453d" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2">{`${z.label} · joists`}</text></g>;})}
   {!site&&contact?.contacts.map((c,i)=><line key={i} x1={c.a.x+c.inward.x*1.5} y1={c.a.y+c.inward.y*1.5} x2={c.b.x+c.inward.x*1.5} y2={c.b.y+c.inward.y*1.5} stroke="#9a6a32" strokeWidth="3" strokeDasharray={c.kind==='flush'?'4 2':undefined} aria-label={`${c.kind==='flush'?'Bolted flush wall':'Ledger'} ${ft(c.lengthIn)}`}/>)}
   {model.treads.map((t,i)=>{const polygon=(t as typeof t&{polygon?:{x:number;y:number}[]}).polygon;return polygon?<polygon key={i} points={polygon.map(p=>`${p.x},${p.y}`).join(' ')} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>:<rect key={i} x={t.x-t.w/2} y={t.z-t.d/2} width={t.w} height={t.d} transform={`rotate(${-(t.angle||0)*180/Math.PI} ${t.x} ${t.z})`} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>;})}
   {model.railing.rails.filter((r,i)=>i%2===1&&r.a.y===r.b.y).map((r,i)=><line key={i} x1={r.a.x} y1={r.a.z} x2={r.b.x} y2={r.b.z} stroke="#272e2c" strokeWidth="1.4"/>)}
   {model.railing.posts.map((p,i)=><rect key={i} x={p.x-2} y={p.z-2} width={4} height={4} fill="#272e2c"/>)}
   {/* House blocks on the deck side are drawn over the deck, so any overlap with it shows. */}
   {(blocks??[]).filter(k=>k.rect.y1>0).map(k=><rect key={k.id} aria-label="House block over the deck" x={k.rect.x0} y={0} width={k.rect.x1-k.rect.x0} height={k.rect.y1} fill="#efe9dc" fillOpacity=".8" stroke="#3d3a34" strokeWidth="1.2"/>)}
   {blockLabels.filter(l=>(blocks?.find(k=>k.id===l.id)?.rect.y1??0)>0).map(l=><text key={l.id} x={l.x} y={l.y} textAnchor="middle" fontSize="7" fontWeight="600" fill="#3d3a34" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{l.text}</text>)}
   {site?siteEdges.map((e,i)=><text key={i} className="dd-plan-figure" x={e.x} y={e.y} textAnchor="middle" fontSize="7" fill="#3e4d43" paintOrder="stroke" stroke="#fbfbf8" strokeWidth="2">{e.text}</text>)
     :edgeLabels.map((e,i)=><text key={i} className="dd-plan-figure" x={e.x} y={e.y} transform={e.flush?`rotate(-90 ${e.x} ${e.y-2.5})`:undefined} textAnchor="middle" fontSize="6.5" fontWeight={e.ledger?600:400} fill={e.ledger?'#7a4f1f':'#3f3a33'} paintOrder="stroke" stroke="#faf8f1" strokeWidth="2">{e.text}</text>)}
   {!site&&<path className="dd-dim" d={`M${b.minX} ${top-18}H${b.maxX}M${b.minX} ${top-23}v10M${b.maxX} ${top-23}v10`} stroke="#625d54" fill="none"/>}
   {!site&&<path className="dd-dim-tick" display="none" d={`M${b.minX-4} ${top-14}l8 -8M${b.maxX-4} ${top-14}l8 -8M${left-26} ${b.minZ+4}l8 -8M${left-26} ${b.maxZ+4}l8 -8`}/>}
   {!site&&<text className="dd-dim-text" x={(b.minX+b.maxX)/2} y={top-25} textAnchor="middle" fontSize="8" fill="#514b41">{ft(w)} overall width</text>}
   {!site&&<path className="dd-dim" d={`M${left-22} ${b.minZ}V${b.maxZ}M${left-27} ${b.minZ}h10M${left-27} ${b.maxZ}h10`} stroke="#625d54" fill="none"/>}
   {!site&&<text className="dd-dim-text" x={left-29} y={(b.minZ+b.maxZ)/2} textAnchor="middle" fontSize="8" fill="#514b41" transform={`rotate(-90 ${left-29} ${(b.minZ+b.maxZ)/2})`}>{ft(d)} overall depth</text>}
   {/* Site plan: the deck's width under it and its depth beside it, from the house wall, with 45° ticks. */}
   {site&&dims&&<g aria-label={`Deck width ${feet(dims.width.inches)}`}>
     <path className="dd-dim" d={`M${ox} ${b.maxZ+20}H${ox+dims.width.inches}M${ox} ${oz+dims.depth.inches+6}V${b.maxZ+25}M${ox+dims.width.inches} ${oz+dims.depth.inches+6}V${b.maxZ+25}`} stroke="#9a731f" strokeWidth=".8" fill="none"/>
     <path className="dd-dim-tick" d={`M${ox-4} ${b.maxZ+24}l8 -8M${ox+dims.width.inches-4} ${b.maxZ+24}l8 -8`} stroke="#9a731f" strokeWidth="1.2" fill="none"/>
     <text className="dd-dim-text" x={dims.width.x} y={b.maxZ+33} textAnchor="middle" fontSize="9" fill="#7a5a14">{feet(dims.width.inches)}</text>
   </g>}
   {site&&dims&&<g aria-label={`Deck depth ${feet(dims.depth.inches)}`}>
     <path className="dd-dim" d={`M${b.minX-22} ${oz}V${oz+dims.depth.inches}M${b.minX-27} ${oz}H${ox-6}M${b.minX-27} ${oz+dims.depth.inches}H${ox-6}`} stroke="#9a731f" strokeWidth=".8" fill="none"/>
     <path className="dd-dim-tick" d={`M${b.minX-26} ${oz+4}l8 -8M${b.minX-26} ${oz+dims.depth.inches+4}l8 -8`} stroke="#9a731f" strokeWidth="1.2" fill="none"/>
     <text className="dd-dim-text" x={b.minX-26} y={dims.depth.y} textAnchor="middle" fontSize="9" fill="#7a5a14" transform={`rotate(-90 ${b.minX-26} ${dims.depth.y})`}>{feet(dims.depth.inches)}</text>
   </g>}
   {site?<g aria-label="Scale bar, 4 feet">
     <path d={`M${b.minX} ${b.maxZ+46}h${scale}M${b.minX} ${b.maxZ+42}v8M${b.minX+scale/2} ${b.maxZ+44}v4M${b.minX+scale} ${b.maxZ+42}v8`} stroke="#3e4d43" fill="none"/>
     <text x={b.minX+scale+6} y={b.maxZ+49} fontSize="6.5" fill="#3e4d43">4 ft</text>
   </g>:<g aria-label="Scale bar, 4 feet">
     <path d={`M${b.minX} ${b.maxZ+28}h${scale}M${b.minX} ${b.maxZ+24}v8M${b.minX+scale/2} ${b.maxZ+26}v4M${b.minX+scale} ${b.maxZ+24}v8`} stroke="#514b41" fill="none"/>
     <text x={b.minX+scale+6} y={b.maxZ+31} fontSize="6.5" fill="#514b41">4 ft</text>
   </g>}
   {!site&&<text x={b.minX} y={b.maxZ+46} fontSize="7" fill="#514b41">● Footings · ■ Railing posts · Dark line: railing</text>}
   {!site&&<text x={b.minX} y={b.maxZ+56} fontSize="7" fill="#514b41">{`Dashed: joists · Solid: beams${contact?.contacts.length?' · Bronze: ledger on the house':''}${contact?.flushLf?' · Bronze dashed: bolted flush wall':''}${hips.length?' · Heavy dashed: doubled hip':''}${model.levels.some(l=>l.inlays?.some(p=>p.status==='ok'))?' · Amber: inlay blocking':''}`}</text>}
   {finish&&finish.groups.length>0&&<text x={b.minX} y={site?b.maxZ+62:b.maxZ+80} fontSize="7" fill="#514b41" aria-label="Accent boards">Accent boards:{finish.groups.map(g=><tspan key={g.ref}> <tspan fill={tones.get(g.ref)}>■</tspan> {g.color.name} ({g.material.name}, {g.boards.length})</tspan>)}</text>}
   <text x={b.minX} y={site?b.maxZ+74:b.maxZ+68} fontSize="6" fill={site?'#3e4d43':'#716a5e'}>Design illustration · final connections and sizing require site review</text>
 </svg>;
}
