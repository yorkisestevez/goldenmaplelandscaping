import {buildSkirting} from './skirting';
import {buildDrySpace} from './drySpace';
import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';
import {sceneBounds} from './components/viewer3d/sceneBounds';

/** Vector plan generated from the same members that feed 3D, CAD and takeoff. */
export function exportFramingPlanSVG(data:DeckData,model:DeckTakeoff):string{
  if(data.installation&&data.installation.framing!=='Pressure-treated lumber')throw new Error('Non-timber framing plan is not implemented.');
  const b=sceneBounds(model),w=b.maxX-b.minX,d=b.maxZ-b.minZ;
  const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
  const txt=(x:number,y:number,s:string,size=5)=>`<text x="${x}" y="${y}" font-size="${size}" paint-order="stroke" stroke="white" stroke-width="1.2" fill="black">${esc(s)}</text>`;
  const groups=model.levels.map(l=>{
    const members=[...l.joists,...l.blocking,...l.beams,...(l.rim??[])].map(m=>`<line data-role="${esc(m.role??'framing')}" x1="${m.a.x}" y1="${m.a.z}" x2="${m.b.x}" y2="${m.b.z}" stroke="${m.role?.startsWith('breaker-')?'#155f55':'#555'}" stroke-width="${m.width}"/>`).join('');
    const dividers=l.boards.filter(p=>p.role==='breaker'||(p.role==='inlay'&&l.breakerAssemblies?.some(a=>Math.abs(a.x-p.cx)<.01))).map(p=>`<rect data-role="breaker-board" x="${p.cx+l.offset.x-p.length/2}" y="${p.cy+l.offset.z-(p.width??data.boardWidth)/2}" width="${p.length}" height="${p.width??data.boardWidth}" transform="rotate(${p.angleDeg} ${p.cx+l.offset.x} ${p.cy+l.offset.z})" fill="none" stroke="#aa6010" stroke-width=".65" stroke-dasharray="2 1"/>`).join('');
    const labels=(l.breakerAssemblies??[]).map(a=>txt(a.x+l.offset.x+5,l.offset.z-9,`${a.id}: x=${a.x.toFixed(2)} in`,4.5)).join('');
    const supports=l.supports.map(p=>`<circle cx="${p.x}" cy="${p.z}" r="4" fill="white" stroke="black" stroke-width=".75"/>`).join('');
    return `<g>${members}${dividers}${supports}${labels}</g>`;
  }).join('');
  const skirt=buildSkirting(data,model),dry=buildDrySpace(data,model);
  const finishSupport=skirt.framing.map(p=>`<rect data-role="skirting-backing" x="${p.x-p.w/2}" y="${p.z-p.d/2}" width="${p.w}" height="${p.d}" transform="rotate(${-(p.angle??0)*180/Math.PI} ${p.x} ${p.z})" fill="none" stroke="#675c85" stroke-width=".5"><title>${esc(p.role)} — non-load-bearing concept</title></rect>`).join('');
  const drainage=dry.members.filter(p=>p.role==='collection-gutter'||p.role==='discharge-outlet').map(p=>`<line data-role="drainage-coordination" x1="${p.a.x}" y1="${p.a.z}" x2="${p.b.x}" y2="${p.b.z}" stroke="#795292" stroke-width=".7" stroke-dasharray="3 2"><title>${esc(dry.product.name)} — schematic route; unresolved scope in installation package</title></line>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX-24} ${b.minZ-42} ${w+48} ${d+94}" role="img" aria-label="Shared-model framing coordination plan"><title>DeckCraft framing coordination plan - not for construction</title><rect x="${b.minX-24}" y="${b.minZ-42}" width="${w+48}" height="${d+94}" fill="white"/>${txt(b.minX,b.minZ-29,'DECKCRAFT | FRAMING COORDINATION',7)}${groups}${finishSupport}${drainage}<path d="M${b.minX} ${b.maxZ+12}H${b.maxX}M${b.minX} ${b.maxZ+8}v8M${b.maxX} ${b.maxZ+8}v8" fill="none" stroke="black" stroke-width=".4"/>${txt(b.minX+w/2-16,b.maxZ+20,`${w.toFixed(2)} in overall`)}${txt(b.minX,b.maxZ+32,'GREEN: divider support. PURPLE: skirting backing / drainage coordination.',4.5)}${txt(b.minX,b.maxZ+43,'NOT FOR CONSTRUCTION. Nominal inches; verify gaps, bearing and connections.',4.5)}</svg>`;
}
