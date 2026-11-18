import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {skirtingPlan,newSkirting,type SkirtingSlab} from '../src/features/deckcraft/skirting';
import {serializeDesign,parseDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {slabPlanPoint} from '../src/features/deckcraft/lib/mitredSlabs';
import {slabGeometry} from '../src/features/deckcraft/components/viewer3d/slabGeometry';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const near=(a:number,b:number)=>Math.abs(a-b)<1e-5;
const data:DeckData={...structuredClone(DEFAULT_DECK),width:16,length:12,height:48,deckType:'Freestanding',stairFlights:0,
  deckingMaterial:'tt_reserve',deckingColor:'Antique Leather',skirting:{...newSkirting(),accessPanels:0,cornerTreatment:'Folded solid boards'}};
const model=buildDeckTakeoff(data),plan=skirtingPlan(data,model)!;
ok(plan.foldedCorners&&plan.corners.length===0,'Folded corners have no applied vertical cover strip');
const plain={...data,skirting:{...data.skirting!,cornerTreatment:undefined}},standard=skirtingPlan(plain,model)!;
for(const key of ['lengthFt','faceSqft','backingLf','latticePanels'] as const)ok(plan[key]===standard[key],`${key}: custom folds preserve the takeoff quantity`);
const e=calculateEstimate(data,DECK_SETTINGS),ep=calculateEstimate(plain,DECK_SETTINGS);
ok(e.total===ep.total&&e.subtotal===ep.subtotal,'Folds never add an invented supply or installation price');
ok(e.sections.find(s=>s.title==='Deck skirting')!.items.every(i=>i.cost!==null&&Number(i.cost)>0),'Skirting rows stay priced; folds do not invent extra lines');
ok(parseDesign(serializeDesign(data)).skirting?.cornerTreatment==='Folded solid boards','The corner choice survives saving and sharing');
assert.throws(()=>validateDesign({...data,skirting:{...data.skirting,cornerTreatment:'Heat all boards'}}));checks++;
for(const patch of [{deckingMaterial:'cedar',deckingColor:'Western Red Cedar'},{deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk'},{deckingMaterial:'tt_terrain',deckingColor:'Silver Maple'},{skirting:{...data.skirting!,style:'Lattice' as const}},{skirting:{...data.skirting!,style:'Vertical boards' as const}}])
  ok(!skirtingPlan({...data,...patch},buildDeckTakeoff({...data,...patch}))!.foldedCorners,'Wood, lattice and vertical boards cannot silently receive heat-folded corners');

const key=(p:{x:number;y:number},top:number)=>`${p.x.toFixed(5)}:${p.y.toFixed(5)}:${top.toFixed(5)}`;
const joins=new Map<string,SkirtingSlab[]>();
for(const f of plan.faces)if(f.grainAnchor){for(const cap of [f.capA,f.capB])if(cap){const k=key(cap.outer,f.topA);joins.set(k,[...(joins.get(k)??[]),f]);}}
ok(joins.size>=4,'Every outside corner has folded board courses');
for(const [k,pair] of joins){
  ok(pair.length===2,`${k}: exactly two return legs reach the fold`);
  const [a,b]=pair,ca=a.capA??a.capB!,cb=b.capA??b.capB!;
  ok(near(ca.outer.x,cb.outer.x)&&near(ca.outer.y,cb.outer.y)&&near(ca.inner.x,cb.inner.x)&&near(ca.inner.y,cb.inner.y),'Both return legs meet at the same inner and outer points');
  ok(JSON.stringify(a.grainAnchor)===JSON.stringify(b.grainAnchor),'The folded legs use the same board grain strip');
  const phase=(s:SkirtingSlab)=>{const cap=s.capA??s.capB!,l=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y);return ((cap.outer.x-s.a.x)*(s.b.x-s.a.x)+(cap.outer.y-s.a.y)*(s.b.y-s.a.y))/l+(s.grainOffset??0);};
  ok(near(phase(a),phase(b))&&near(phase(a),0),'Grain phase continues through the exterior fold');
}
const volume=(m:ReturnType<typeof deckExportMeshes>[number])=>m.faces.reduce((sum,f)=>sum+f.slice(1,-1).reduce((s,_,i)=>{const a=m.vertices[f[0]],b=m.vertices[f[i+1]],c=m.vertices[f[i+2]];return s+(a.x*(b.y*c.z-b.z*c.y)+a.y*(b.z*c.x-b.x*c.z)+a.z*(b.x*c.y-b.y*c.x))/6;},0),0);
for(const patch of [{},{shape:'L-Shape' as const,cutoutWidth:6,cutoutLength:4},{cornerChamfers:{frontLeftFt:2,frontRightFt:3}},{terrainConfig:{widthFt:80,depthFt:80,elevationIn:0,slopePct:3}},{skirting:{...data.skirting!,openEdges:['deck1-left']}}]){
  const d={...data,...patch},m=buildDeckTakeoff(d),p=skirtingPlan(d,m)!;
  const parts=deckExportMeshes(d,m).filter(x=>x.name.startsWith('skirting_face_'));
  ok(parts.length===p.faces.length&&parts.every(x=>volume(x)>0&&x.vertices.every(v=>[v.x,v.y,v.z].every(Number.isFinite))),'Rectangle, L-shape, angles, slope and open side export closed positive-volume finish solids');
  p.faces.forEach((s,i)=>{const g=slabGeometry([s],'along'),pos=g.getAttribute('position');
    for(let end=0;end<2;end++)for(const side of [-1,1] as const){const q=slabPlanPoint(s,end as 0|1,side);ok(parts[i].vertices.some(v=>near(v.x,q.x)&&near(v.z,q.y)),'Export uses the authoritative mitred corner');
      ok(Array.from({length:pos.count},(_,j)=>j).some(j=>Math.abs(pos.getX(j)-q.x)<1e-4&&Math.abs(pos.getZ(j)-q.y)<1e-4),'Preview uses the same corner position');}
    g.dispose();});
}
console.log(`DECK FOLDED CORNERS OK — shared grain, actual mitres, quoted custom fabrication, persistence, profile guards, closed exports and preview parity; ${checks} checks.`);
