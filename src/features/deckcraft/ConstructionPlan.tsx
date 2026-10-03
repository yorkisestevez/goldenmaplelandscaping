import {buildSkirting} from './skirting';
import {buildDrySpace} from './drySpace';
import {boardFinishStatus} from './boardFinishes';
import type {DeckTakeoff} from './deckTakeoff';
import {sceneBounds} from './components/viewer3d/sceneBounds';
import type {YardModel} from './yardModel';
import type {DeckData} from './types';
import {privacyScreenLayout} from './privacyScreens';
import {extrasLayout} from './extrasLayout';
export default function ConstructionPlan({model,yard,data}:{model:DeckTakeoff;yard?:YardModel;data?:DeckData}){
 const b=sceneBounds(model);
 for(const p of yard?.features.filter(f=>!f.excluded).flatMap(f=>f.footprints.flat())??[]){b.minX=Math.min(b.minX,p.x);b.maxX=Math.max(b.maxX,p.x);b.minZ=Math.min(b.minZ,p.y);b.maxZ=Math.max(b.maxZ,p.y);}
 const fixtures=data?extrasLayout(data,model).fixtures:[],screens=data?privacyScreenLayout(data,model):undefined;
 for(const p of fixtures){b.minX=Math.min(b.minX,p.x);b.maxX=Math.max(b.maxX,p.x);b.minZ=Math.min(b.minZ,p.z);b.maxZ=Math.max(b.maxZ,p.z);}
 const skirt=data?buildSkirting(data,model):undefined,dry=data?buildDrySpace(data,model):undefined,finishes=data?boardFinishStatus(data,model):undefined;
 const colours=new Map(finishes?.matched.map(o=>[o.id,o.color])??[]);
 const colouredBoards=finishes?.boards.filter(p=>colours.has(p.id))??[];
 const skirtPlan=skirt?[...skirt.framing,...skirt.boards]:[];
 for(const p of skirtPlan){const c=Math.abs(Math.cos(p.angle??0)),s=Math.abs(Math.sin(p.angle??0)),dx=(c*p.w+s*p.d)/2,dz=(s*p.w+c*p.d)/2;b.minX=Math.min(b.minX,p.x-dx);b.maxX=Math.max(b.maxX,p.x+dx);b.minZ=Math.min(b.minZ,p.z-dz);b.maxZ=Math.max(b.maxZ,p.z+dz);}
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
     {l.blocking.map((j,k)=><line key={`block-${k}`} data-role={j.role??'blocking'} x1={j.a.x} y1={j.a.z} x2={j.b.x} y2={j.b.z} stroke={j.role==='breaker-ladder'?'#155f55':'#96998f'} strokeWidth={j.role==='breaker-ladder'?1.2:.6}/>)}
     {l.joists.filter(j=>j.role==='breaker-field-support').map((j,k)=><line key={`divider-support-${k}`} x1={j.a.x} y1={j.a.z} x2={j.b.x} y2={j.b.z} stroke="#155f55" strokeWidth="1.2"/>)}
     {(l.breakerAssemblies??[]).map(a=><text key={a.id} x={a.x+l.offset.x+4} y={l.offset.z-6} fontSize="5" paintOrder="stroke" stroke="#faf8f1" strokeWidth="1.5" fill="#155f55">{a.id}</text>)}
     {l.beams.map((j,k)=><line key={k} x1={j.a.x} y1={j.a.z} x2={j.b.x} y2={j.b.z} stroke="#826947" strokeWidth="1"/>)}
     {l.supports.map((p,k)=><circle key={k} cx={p.x} cy={p.z} r={4} fill="#545b54"/>)}
     <text x={l.offset.x+10} y={l.offset.z+15} fontSize="7" paintOrder="stroke" stroke="#faf8f1" strokeWidth="2" fill="#444">{`${l.kind==='landing'?'Landing':l.kind==='winder'?'Winder':'Deck '+((l.index??i)+1)} · ${l.top.toFixed(1)} in above grade`}</text>
   </g>)}
   {model.treads.map((t,i)=>{const polygon=(t as typeof t&{polygon?:{x:number;y:number}[]}).polygon;return polygon?<polygon key={i} points={polygon.map(p=>`${p.x},${p.y}`).join(' ')} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>:<rect key={i} x={t.x-t.w/2} y={t.z-t.d/2} width={t.w} height={t.d} transform={`rotate(${-(t.angle||0)*180/Math.PI} ${t.x} ${t.z})`} fill="#ddccb1" stroke="#897354" strokeWidth=".7"/>;})}
   {skirtPlan.map((p,i)=><rect key={`skirt-${i}`} data-component="skirting" x={p.x-p.w/2} y={p.z-p.d/2} width={p.w} height={p.d} transform={`rotate(${-(p.angle??0)*180/Math.PI} ${p.x} ${p.z})`} fill={p.role.startsWith('skirting-')?(data?.skirting?.color??'#89715B'):'#a1a88b'} stroke="#56654e" strokeWidth=".3"><title>{`${p.role} · non-load-bearing backing; flat grade assumption`}</title></rect>)}
   {colouredBoards.map(p=>p.polygon?<polygon key={p.id} data-component="board-colour" points={p.polygon.map(v=>`${v.x},${v.y}`).join(' ')} fill={colours.get(p.id)} stroke="#71644e" strokeWidth=".3"><title>{`${p.label} · custom colour preview`}</title></polygon>:<rect key={p.id} data-component="board-colour" x={p.x-p.w/2} y={p.z-p.d/2} width={p.w} height={p.d} transform={`rotate(${-(p.angle??0)*180/Math.PI} ${p.x} ${p.z})`} fill={colours.get(p.id)} stroke="#71644e" strokeWidth=".3"><title>{`${p.label} · custom colour preview`}</title></rect>)}
   {dry?.members.filter(p=>p.role==='collection-gutter'||p.role==='discharge-outlet').map((p,i)=><line key={`dry-${i}`} data-component="dry-space" x1={p.a.x} y1={p.a.z} x2={p.b.x} y2={p.b.z} stroke="#795292" strokeWidth="1" strokeDasharray="3 2"><title>{`${dry.product.name} · ${p.role} · schematic, see system warnings`}</title></line>)}
   {model.railing.posts.map((p,i)=><rect key={i} x={p.x-2} y={p.z-2} width={4} height={4} fill="#272e2c"/>)}
   {model.railing.sections.map(s=>{const unresolved=model.railing.unmodeledSectionIds.includes(s.id);if(model.railing.frameless&&s.enabled&&!unresolved)return null;return <line key={s.id} x1={s.a.x} y1={s.a.z} x2={s.b.x} y2={s.b.z} stroke={!s.enabled||unresolved?'#ae4935':'#272e2c'} strokeWidth="1.5" strokeDasharray={!s.enabled||unresolved?'4 3':undefined}><title>{`${s.label}: ${!s.enabled?'removed - safety review required':unresolved?'UNRESOLVED frameless guard / handrail - not modeled':'present'}`}</title></line>;})}
   {model.railing.frameless&&model.railing.glass.map((p,i)=><line key={`frameless-panel-${i}`} data-component="frameless-glass-panel" x1={p.a.x} y1={p.a.z} x2={p.b.x} y2={p.b.z} stroke="#458b97" strokeWidth="1.5"><title>Schematic glass panel - manufacturer dimensions and engineering review required</title></line>)}
   {model.railing.mounts.map((p,i)=><rect key={`frameless-mount-${i}`} data-component="frameless-glass-mount" x={p.x-p.w/2} y={p.z-p.d/2} width={p.w} height={p.d} transform={`rotate(${-(p.angle??0)*180/Math.PI} ${p.x} ${p.z})`} fill="#404b51"><title>Schematic frameless mounting envelope - anchorage not designed</title></rect>)}
   {screens?.boxes.filter(p=>p.role!=='bracket').map((p,i)=><rect key={`screen-${i}`} data-component="privacy-screen" x={p.x-p.w/2} y={p.z-Math.max(1,p.d)/2} width={p.w} height={Math.max(1,p.d)} transform={`rotate(${-(p.angle??0)*180/Math.PI} ${p.x} ${p.z})`} fill="#34695f" stroke="#17463e" strokeWidth=".6"><title>{`${p.productId} · independent screen ${p.role}, mounting review required`}</title></rect>)}
   {fixtures.map((p,i)=><circle key={`light-${i}`} data-component="lighting" cx={p.x} cy={p.z} r={2.2} fill="#e5a542" stroke="#83511c" strokeWidth=".5"><title>{`${p.productId} · ${p.zone}, schematic location`}</title></circle>)}
   <path d={`M${b.minX} ${b.minZ-18}H${b.maxX}M${b.minX} ${b.minZ-23}v10M${b.maxX} ${b.minZ-23}v10`} stroke="#625d54" fill="none"/>
   <text x={(b.minX+b.maxX)/2} y={b.minZ-25} textAnchor="middle" fontSize="8" fill="#514b41">{(w/12).toFixed(1)} ft {fixtures.length?'plan extent including accessories':'overall width'}</text>
   <text x={b.minX} y={b.maxZ+24} fontSize="6" fill="#514b41">Footings / posts · Dashed: joists · Green: breaker supports / ladder blocks</text>
   <text x={b.minX} y={b.maxZ+38} fontSize="6" fill="#716a5e">{model.railing.frameless?'Blue: frameless glass preview · Red dashed: removed / unresolved guard · Anchors not designed':'Gold dots: lights · Green strips: screens · Connections and sizing require site review'}</text>
 </svg>;
}

