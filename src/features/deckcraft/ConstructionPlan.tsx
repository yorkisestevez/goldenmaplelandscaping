import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';
import {sceneBounds} from './components/viewer3d/sceneBounds';
import type {YardModel} from './yardModel';
import {getHouseContact} from './houseContact';
import {getHousePlacement} from './housePlacement';
import {activeWrap} from './lib/wrapGeometry';
import {getHouseBlocks,hasHouseBlocks,houseOutline} from './houseFootprint';
import {polygonCut} from './lib/polygonCuts';

const HOUSE_BAND=36;// inches of house drawn behind the deck-facing wall
const ft=(inches:number)=>`${(inches/12).toFixed(1)} ft`;

/** Contractor plan from the shared model. With `data` it also shows the house, ledgers and edge lengths. */
export default function ConstructionPlan({model,yard,data}:{model:DeckTakeoff;yard?:YardModel;data?:DeckData}){
 const b=sceneBounds(model);
 for(const p of yard?.features.filter(f=>!f.excluded).flatMap(f=>f.footprints.flat())??[]){b.minX=Math.min(b.minX,p.x);b.maxX=Math.max(b.maxX,p.x);b.minZ=Math.min(b.minZ,p.y);b.maxZ=Math.max(b.maxZ,p.y);}
 const main=model.levels[0],outline=main.footprint.outline;
 const contact=data?getHouseContact(data,main.footprint):null;
  const house=data&&data.houseVisible!==false?getHousePlacement(data):null,wrap=data?activeWrap(data):null;
  // A wrap-around runs back along the house side walls, so draw the house deep enough to show them.
  const band=house?Math.min(house.depthIn,Math.max(HOUSE_BAND,...(wrap?[wrap.left?.runIn??0,wrap.right?.runIn??0].map(r=>r+24):[]))):HOUSE_BAND;
  const top=house?Math.min(b.minZ,-band):b.minZ;
  const hips=main.hips??[],zones=main.wrapZones??[];
 // A house with bump-outs, wings or a garage is drawn as its outline, cut to the same band behind the deck.
 const blocks=house&&data&&hasHouseBlocks(data)?getHouseBlocks(data):null;
 const view=[{x:b.minX-48,y:-band},{x:b.maxX+48,y:-band},{x:b.maxX+48,y:b.maxZ},{x:b.minX-48,y:b.maxZ}];
 const blockPolys=blocks&&data?polygonCut(houseOutline(data,blocks),[view]):null;
 const blockLabels=(blocks??[]).slice(1).map(k=>{const r=k.rect,y0=Math.max(r.y0,-band),x0=Math.max(r.x0,b.minX-48),x1=Math.min(r.x1,b.maxX+48);return x1-x0<30||r.y1-y0<12?null:{id:k.id,x:(x0+x1)/2,y:(y0+r.y1)/2+2.5,text:k.kind==='garage'?'GARAGE':k.attachedTo==='Front'?'BUMP-OUT':'WING'};}).filter(Boolean) as {id:string;x:number;y:number;text:string}[];
 const w=b.maxX-b.minX,d=b.maxZ-b.minZ,left=Math.min(b.minX,house?Math.max(house.x0,b.minX-48):b.minX),right=Math.max(b.maxX,house?Math.min(house.x1,b.maxX+48):b.maxX);
 // Edge labels sit just outside each main-deck edge; curve facets under 2 ft are left unlabelled.
 const edgeLabels=data?outline.map((a,i)=>{const q=outline[(i+1)%outline.length],len=Math.hypot(q.x-a.x,q.y-a.y);if(len<24)return null;const nx=(q.y-a.y)/len,ny=-(q.x-a.x)/len,ledger=contact?.isContactEdge(i);return {x:(a.x+q.x)/2+nx*(ledger?5:11),y:(a.y+q.y)/2+ny*(ledger?5:11)+2.5,text:ledger?`Ledger ${ft(len)}`:ft(len),ledger};}).filter(Boolean) as {x:number;y:number;text:string;ledger:boolean}[]:[];
 const scale=48;
 return <svg viewBox={`${left-40} ${top-44} ${right-left+80} ${b.maxZ-top+128}`} role="img" aria-label="Deck construction plan from the shared model" style={{width:'100%',height:'100%',background:'#faf8f1'}}>
   <title>{`Deck plan · ${model.quantities.joists} joists · ${model.quantities.footings} footings`}</title>
   <defs><marker id="dd-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6z" fill="#5f5a50"/></marker><pattern id="dd-house-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#b9b1a2" strokeWidth="1"/></pattern></defs>
   {house&&<g aria-label="House">
     {blockPolys?blockPolys.map((poly,i)=><polygon key={i} points={poly.map(p=>`${p.x},${p.y}`).join(' ')} fill="url(#dd-house-hatch)" stroke="#6d675c" strokeWidth=".8"/>)
       :<rect x={house.x0} y={-band} width={house.x1-house.x0} height={band} fill="url(#dd-house-hatch)" stroke="#6d675c" strokeWidth=".8"/>}
     {blockLabels.map(l=><text key={l.id} x={l.x} y={l.y} textAnchor="middle" fontSize="7" fontWeight="600" fill="#3d3a34" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{l.text}</text>)}
     <line x1={house.x0} y1={0} x2={house.x1} y2={0} stroke="#3d3a34" strokeWidth="2"/>
     <text x={(Math.max(house.x0,left-40)+Math.min(house.x1,right+40))/2} y={-band+11} textAnchor="middle" fontSize="8" fontWeight="600" fill="#3d3a34" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{`HOUSE · deck-facing wall · ${ft(house.x1-house.x0)} wide`}</text>
   </g>}
   {yard?.boxes.filter(p=>['paver','wall-block','wall-cap','water'].includes(p.role)).map(p=><polygon key={p.id} points={p.polygon?.map(v=>`${v.x},${v.y}`).join(' ')} fill={p.color} stroke="#66695d" strokeWidth=".2"/>)}
   {yard?.features.filter(f=>!f.excluded).map(f=><text key={f.config.id} x={f.config.xFt*12} y={f.config.zFt*12} textAnchor="middle" fontSize="7" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2" fill="#333">{f.config.name}</text>)}
   {model.levels.map((l,i)=><g key={i}>
     <polygon points={l.footprint.outline.map(p=>`${p.x+l.offset.x},${p.y+l.offset.z}`).join(' ')} fill={l.kind==='winder'?'none':'#e5d7bb'} stroke="#7c6b51" strokeWidth="1"/>
     {l.boards.map((board,j)=>{const cut=board as typeof board&{width?:number;polygon?:{x:number;y:number}[];role?:string},width=cut.width??5.5;
       return cut.polygon?<polygon key={j} points={cut.polygon.map(p=>`${p.x+l.offset.x},${p.y+l.offset.z}`).join(' ')} fill={cut.role==='inlay'?'#71644e':'none'} stroke="#ac9572" strokeWidth=".3"/>:<rect key={j} x={board.cx+l.offset.x-board.length/2} y={board.cy+l.offset.z-width/2} width={board.length} height={width} transform={`rotate(${board.angleDeg} ${board.cx+l.offset.x} ${board.cy+l.offset.z})`} fill={cut.role==='inlay'?'#71644e':'none'} stroke="#ac9572" strokeWidth=".3"/>;
     })}
     {l.joists.map((j,k)=><line key={k} x1={j.a.x} y1={j.a.z} x2={j.b.x} y2={j.b.z} stroke="#787b72" strokeDasharray="3 2" strokeWidth=".6"/>)}
     {l.beams.map((j,k)=><line key={k} x1={j.a.x} y1={j.a.z} x2={j.b.x} y2={j.b.z} stroke="#826947" strokeWidth="1"/>)}
     {l.supports.map((p,k)=><circle key={k} cx={p.x} cy={p.z} r={4} fill="#545b54"/>)}
     <text x={l.offset.x+10} y={l.offset.z+15} fontSize="7" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2" fill="#444">{`${l.kind==='landing'?'Landing':l.kind==='winder'?'Winder':'Deck '+((l.index??i)+1)} · ${l.top.toFixed(1)} in above grade`}</text>
   </g>)}
   {hips.map((h,i)=>{const mx=(h.a.x+h.b.x)/2,my=(h.a.y+h.b.y)/2;return <g key={`hip${i}`} aria-label={`Hip at ${h.angleDeg.toFixed(0)} degrees`}><line x1={h.a.x} y1={h.a.y} x2={h.b.x} y2={h.b.y} stroke="#5b3d1c" strokeWidth="2.4" strokeDasharray="6 3"/><text x={mx+(h.side==='right'?6:-6)} y={my} textAnchor={h.side==='right'?'start':'end'} fontSize="6.5" fontWeight="600" fill="#5b3d1c" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{Math.abs(h.angleDeg-45)<.5?'Hip · 45° mitre':`Hip · ${h.angleDeg.toFixed(0)}° to back wall`}</text></g>;})}
   {zones.map(z=>{const cx=z.outline.reduce((n,p)=>n+p.x,0)/z.outline.length,cy=z.outline.reduce((n,p)=>n+p.y,0)/z.outline.length;return <g key={z.id} aria-label={`${z.label}: joist direction`}><line x1={cx-z.joistDir.x*14} y1={cy-z.joistDir.y*14} x2={cx+z.joistDir.x*14} y2={cy+z.joistDir.y*14} stroke="#5f5a50" strokeWidth="1.2" markerEnd="url(#dd-arrow)"/><text x={cx+Math.abs(z.joistDir.y)*8} y={cy+Math.abs(z.joistDir.x)*10+2} fontSize="6" fill="#4a453d" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2">{`${z.label} · joists`}</text></g>;})}
   {contact?.contacts.map((c,i)=><line key={i} x1={c.a.x} y1={c.a.y+1.5} x2={c.b.x} y2={c.b.y+1.5} stroke="#9a6a32" strokeWidth="3" aria-label={`Ledger ${ft(c.lengthIn)}`}/>)}
   {model.treads.map((t,i)=>{const polygon=(t as typeof t&{polygon?:{x:number;y:number}[]}).polygon;return polygon?<polygon key={i} points={polygon.map(p=>`${p.x},${p.y}`).join(' ')} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>:<rect key={i} x={t.x-t.w/2} y={t.z-t.d/2} width={t.w} height={t.d} transform={`rotate(${-(t.angle||0)*180/Math.PI} ${t.x} ${t.z})`} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>;})}
   {model.railing.rails.filter((r,i)=>i%2===1&&r.a.y===r.b.y).map((r,i)=><line key={i} x1={r.a.x} y1={r.a.z} x2={r.b.x} y2={r.b.z} stroke="#272e2c" strokeWidth="1.4"/>)}
   {model.railing.posts.map((p,i)=><rect key={i} x={p.x-2} y={p.z-2} width={4} height={4} fill="#272e2c"/>)}
   {/* House blocks on the deck side are drawn over the deck, so any overlap with it shows. */}
   {(blocks??[]).filter(k=>k.rect.y1>0).map(k=><rect key={k.id} aria-label="House block over the deck" x={k.rect.x0} y={0} width={k.rect.x1-k.rect.x0} height={k.rect.y1} fill="#efe9dc" fillOpacity=".8" stroke="#3d3a34" strokeWidth="1.2"/>)}
   {blockLabels.filter(l=>(blocks?.find(k=>k.id===l.id)?.rect.y1??0)>0).map(l=><text key={l.id} x={l.x} y={l.y} textAnchor="middle" fontSize="7" fontWeight="600" fill="#3d3a34" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{l.text}</text>)}
   {edgeLabels.map((e,i)=><text key={i} x={e.x} y={e.y} textAnchor="middle" fontSize="6.5" fontWeight={e.ledger?600:400} fill={e.ledger?'#7a4f1f':'#3f3a33'} paintOrder="stroke" stroke="#faf8f1" strokeWidth="2">{e.text}</text>)}
   <path d={`M${b.minX} ${top-18}H${b.maxX}M${b.minX} ${top-23}v10M${b.maxX} ${top-23}v10`} stroke="#625d54" fill="none"/>
   <text x={(b.minX+b.maxX)/2} y={top-25} textAnchor="middle" fontSize="8" fill="#514b41">{ft(w)} overall width</text>
   <path d={`M${left-22} ${b.minZ}V${b.maxZ}M${left-27} ${b.minZ}h10M${left-27} ${b.maxZ}h10`} stroke="#625d54" fill="none"/>
   <text x={left-29} y={(b.minZ+b.maxZ)/2} textAnchor="middle" fontSize="8" fill="#514b41" transform={`rotate(-90 ${left-29} ${(b.minZ+b.maxZ)/2})`}>{ft(d)} overall depth</text>
   <g aria-label="Scale bar, 4 feet">
     <path d={`M${b.minX} ${b.maxZ+28}h${scale}M${b.minX} ${b.maxZ+24}v8M${b.minX+scale/2} ${b.maxZ+26}v4M${b.minX+scale} ${b.maxZ+24}v8`} stroke="#514b41" fill="none"/>
     <text x={b.minX+scale+6} y={b.maxZ+31} fontSize="6.5" fill="#514b41">4 ft</text>
   </g>
   <text x={b.minX} y={b.maxZ+46} fontSize="7" fill="#514b41">● Footings · ■ Railing posts · Dark line: railing</text>
   <text x={b.minX} y={b.maxZ+56} fontSize="7" fill="#514b41">{`Dashed: joists · Solid: beams${contact?.contacts.length?' · Bronze: ledger on the house':''}${hips.length?' · Heavy dashed: doubled hip':''}`}</text>
   <text x={b.minX} y={b.maxZ+68} fontSize="6" fill="#716a5e">Design illustration · final connections and sizing require site review</text>
 </svg>;
}
