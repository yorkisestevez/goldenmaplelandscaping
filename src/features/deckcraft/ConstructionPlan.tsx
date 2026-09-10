import type {DeckTakeoff} from './deckTakeoff';
import {sceneBounds} from './components/viewer3d/sceneBounds';
import type {YardModel} from './yardModel';
export default function ConstructionPlan({model,yard}:{model:DeckTakeoff;yard?:YardModel}){
 const b=sceneBounds(model);
 for(const p of yard?.features.filter(f=>!f.excluded).flatMap(f=>f.footprints.flat())??[]){b.minX=Math.min(b.minX,p.x);b.maxX=Math.max(b.maxX,p.x);b.minZ=Math.min(b.minZ,p.y);b.maxZ=Math.max(b.maxZ,p.y);}
 const w=b.maxX-b.minX,d=b.maxZ-b.minZ;
 return <svg viewBox={`${b.minX-36} ${b.minZ-42} ${w+72} ${d+100}`} role="img" aria-label="Deck construction plan from the shared model" style={{width:'100%',height:'100%',background:'#faf8f1'}}>
   <title>{`Deck plan · ${model.quantities.joists} joists · ${model.quantities.footings} footings`}</title>
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
   {model.treads.map((t,i)=>{const polygon=(t as typeof t&{polygon?:{x:number;y:number}[]}).polygon;return polygon?<polygon key={i} points={polygon.map(p=>`${p.x},${p.y}`).join(' ')} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>:<rect key={i} x={t.x-t.w/2} y={t.z-t.d/2} width={t.w} height={t.d} transform={`rotate(${-(t.angle||0)*180/Math.PI} ${t.x} ${t.z})`} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>;})}
   {model.railing.posts.map((p,i)=><rect key={i} x={p.x-2} y={p.z-2} width={4} height={4} fill="#272e2c"/>)}
   <path d={`M${b.minX} ${b.minZ-18}H${b.maxX}M${b.minX} ${b.minZ-23}v10M${b.maxX} ${b.minZ-23}v10`} stroke="#625d54" fill="none"/>
   <text x={(b.minX+b.maxX)/2} y={b.minZ-25} textAnchor="middle" fontSize="8" fill="#514b41">{(w/12).toFixed(1)} ft overall width</text>
   <text x={b.minX} y={b.maxZ+24} fontSize="7" fill="#514b41">● Footings · ■ Railing posts · Dashed: joists · Solid: beams</text>
   <text x={b.minX} y={b.maxZ+38} fontSize="6" fill="#716a5e">Design illustration · final connections and sizing require site review</text>
 </svg>;
}

