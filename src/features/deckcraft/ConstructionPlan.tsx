import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';
import {sceneBounds} from './components/viewer3d/sceneBounds';
import type {YardModel} from './yardModel';
import {getHouseContact} from './houseContact';
import {getHousePlacement} from './housePlacement';

const HOUSE_BAND=36;// inches of house drawn behind the deck-facing wall
const ft=(inches:number)=>`${(inches/12).toFixed(1)} ft`;

/** Contractor plan from the shared model. With `data` it also shows the house, ledgers and edge lengths. */
export default function ConstructionPlan({model,yard,data}:{model:DeckTakeoff;yard?:YardModel;data?:DeckData}){
 const b=sceneBounds(model);
 for(const p of yard?.features.filter(f=>!f.excluded).flatMap(f=>f.footprints.flat())??[]){b.minX=Math.min(b.minX,p.x);b.maxX=Math.max(b.maxX,p.x);b.minZ=Math.min(b.minZ,p.y);b.maxZ=Math.max(b.maxZ,p.y);}
 const main=model.levels[0],outline=main.footprint.outline;
 const contact=data?getHouseContact(data,main.footprint):null;
 const house=data&&data.houseVisible!==false?getHousePlacement(data):null;
 const top=house?Math.min(b.minZ,-HOUSE_BAND):b.minZ;
 const w=b.maxX-b.minX,d=b.maxZ-b.minZ,left=Math.min(b.minX,house?Math.max(house.x0,b.minX-48):b.minX),right=Math.max(b.maxX,house?Math.min(house.x1,b.maxX+48):b.maxX);
 // Edge labels sit just outside each main-deck edge; curve facets under 2 ft are left unlabelled.
 const edgeLabels=data?outline.map((a,i)=>{const q=outline[(i+1)%outline.length],len=Math.hypot(q.x-a.x,q.y-a.y);if(len<24)return null;const nx=(q.y-a.y)/len,ny=-(q.x-a.x)/len,ledger=contact?.isContactEdge(i);return {x:(a.x+q.x)/2+nx*(ledger?5:11),y:(a.y+q.y)/2+ny*(ledger?5:11)+2.5,text:ledger?`Ledger ${ft(len)}`:ft(len),ledger};}).filter(Boolean) as {x:number;y:number;text:string;ledger:boolean}[]:[];
 const scale=48;
 return <svg viewBox={`${left-40} ${top-44} ${right-left+80} ${b.maxZ-top+112}`} role="img" aria-label="Deck construction plan from the shared model" style={{width:'100%',height:'100%',background:'#faf8f1'}}>
   <title>{`Deck plan · ${model.quantities.joists} joists · ${model.quantities.footings} footings`}</title>
   <defs><pattern id="dd-house-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#b9b1a2" strokeWidth="1"/></pattern></defs>
   {house&&<g aria-label="House">
     <rect x={house.x0} y={-HOUSE_BAND} width={house.x1-house.x0} height={HOUSE_BAND} fill="url(#dd-house-hatch)" stroke="#6d675c" strokeWidth=".8"/>
     <line x1={house.x0} y1={0} x2={house.x1} y2={0} stroke="#3d3a34" strokeWidth="2"/>
     <text x={(Math.max(house.x0,left-40)+Math.min(house.x1,right+40))/2} y={-HOUSE_BAND+11} textAnchor="middle" fontSize="8" fontWeight="600" fill="#3d3a34" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2.5">{`HOUSE · deck-facing wall · ${ft(house.x1-house.x0)} wide`}</text>
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
   {contact?.contacts.map((c,i)=><line key={i} x1={c.a.x} y1={c.a.y+1.5} x2={c.b.x} y2={c.b.y+1.5} stroke="#9a6a32" strokeWidth="3" aria-label={`Ledger ${ft(c.lengthIn)}`}/>)}
   {model.treads.map((t,i)=>{const polygon=(t as typeof t&{polygon?:{x:number;y:number}[]}).polygon;return polygon?<polygon key={i} points={polygon.map(p=>`${p.x},${p.y}`).join(' ')} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>:<rect key={i} x={t.x-t.w/2} y={t.z-t.d/2} width={t.w} height={t.d} transform={`rotate(${-(t.angle||0)*180/Math.PI} ${t.x} ${t.z})`} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>;})}
   {model.railing.rails.filter((r,i)=>i%2===1&&r.a.y===r.b.y).map((r,i)=><line key={i} x1={r.a.x} y1={r.a.z} x2={r.b.x} y2={r.b.z} stroke="#272e2c" strokeWidth="1.4"/>)}
   {model.railing.posts.map((p,i)=><rect key={i} x={p.x-2} y={p.z-2} width={4} height={4} fill="#272e2c"/>)}
   {edgeLabels.map((e,i)=><text key={i} x={e.x} y={e.y} textAnchor="middle" fontSize="6.5" fontWeight={e.ledger?600:400} fill={e.ledger?'#7a4f1f':'#3f3a33'} paintOrder="stroke" stroke="#faf8f1" strokeWidth="2">{e.text}</text>)}
   <path d={`M${b.minX} ${top-18}H${b.maxX}M${b.minX} ${top-23}v10M${b.maxX} ${top-23}v10`} stroke="#625d54" fill="none"/>
   <text x={(b.minX+b.maxX)/2} y={top-25} textAnchor="middle" fontSize="8" fill="#514b41">{ft(w)} overall width</text>
   <path d={`M${left-22} ${b.minZ}V${b.maxZ}M${left-27} ${b.minZ}h10M${left-27} ${b.maxZ}h10`} stroke="#625d54" fill="none"/>
   <text x={left-29} y={(b.minZ+b.maxZ)/2} textAnchor="middle" fontSize="8" fill="#514b41" transform={`rotate(-90 ${left-29} ${(b.minZ+b.maxZ)/2})`}>{ft(d)} overall depth</text>
   <g aria-label="Scale bar, 4 feet">
     <path d={`M${b.minX} ${b.maxZ+16}h${scale}M${b.minX} ${b.maxZ+12}v8M${b.minX+scale/2} ${b.maxZ+14}v4M${b.minX+scale} ${b.maxZ+12}v8`} stroke="#514b41" fill="none"/>
     <text x={b.minX+scale+6} y={b.maxZ+19} fontSize="6.5" fill="#514b41">4 ft</text>
   </g>
   <text x={b.minX} y={b.maxZ+34} fontSize="7" fill="#514b41">● Footings · ■ Railing posts · Dark line: railing</text>
   <text x={b.minX} y={b.maxZ+44} fontSize="7" fill="#514b41">{`Dashed: joists · Solid: beams${contact?.contacts.length?' · Bronze: ledger on the house':''}`}</text>
   <text x={b.minX} y={b.maxZ+56} fontSize="6" fill="#716a5e">Design illustration · final connections and sizing require site review</text>
 </svg>;
}
