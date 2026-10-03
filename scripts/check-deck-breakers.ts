import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {breakerStations,breakerJointGap} from '../src/features/deckcraft/breakerLayout';
import {DEFAULT_INSTALLATION,exportInstallationHTML} from '../src/features/deckcraft/installationSystem';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {exportFramingPlanSVG} from '../src/features/deckcraft/framingPlanExport';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {deckBoardStock} from '../src/features/deckcraft/stockPlan';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;
function check(name:string,fn:()=>void){try{fn();checks++;}catch(e){throw new Error(name,{cause:e});}}
const fixture=(patch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),stairFlights:0,width:24,length:12,pattern:'Straight',pictureFrameRows:0,hasInlay:false,...patch});
check('stock threshold and centered preference',()=>{
  assert.equal(breakerStations(0,192,5.5,.125,192,false).length,0);
  assert.equal(breakerStations(0,193,5.5,.125,192,false).length,1);
  assert.deepEqual(breakerStations(0,120,5.5,.125,192,true),[60]);
  assert.equal(breakerStations(0,480,5.5,.125,192,true).length,3);
});
check('PVC and composite divider joints are not interchangeable',()=>{
  assert.equal(breakerJointGap(fixture({deckingMaterial:'tt_harvest'}),.1875),0);
  for(const [temperatureC,expected] of [[0,3/16],[20,1/8],[30,1/32]])assert.equal(breakerJointGap(fixture({deckingMaterial:'tt_terrain',installation:{...DEFAULT_INSTALLATION,temperatureC}}),.25),expected);
  assert.equal(breakerJointGap(fixture({deckingMaterial:'trex_transcend'}),.25),.25);
});
for(const boardStockLengthIn of [144,192,240] as const)for(const breakerLayout of ['Auto','Center'] as const)check('stock and layout persistence',()=>{
  const d=fixture({boardStockLengthIn,breakerLayout});const restored=parseDesign(serializeDesign(d));
  assert.equal(restored.boardStockLengthIn,boardStockLengthIn);assert.equal(restored.breakerLayout,breakerLayout);
  assert.equal(calculateEstimate(d,DECK_SETTINGS).breakerInfo?.standardLength,boardStockLengthIn/12);
});
check('invalid stock/layout refused',()=>{assert.throws(()=>validateDesign(fixture({boardStockLengthIn:999 as any})));assert.throws(()=>validateDesign(fixture({breakerLayout:'Off' as any})));});

for(const width of [12,16,20,24,40])for(const length of [8,12,24])for(const stock of [144,192,240] as const)for(const boardWidth of [3.5,5.5] as const)check(`shared assemblies ${width}x${length} stock${stock} board${boardWidth}`,()=>{
  const d=fixture({width,length,boardStockLengthIn:stock,boardWidth,breakerLayout:'Center'}),m=buildDeckTakeoff(d);
  assert.equal(m.stockLength,stock);assert.equal(deckBoardStock(m,1.1).unresolved.length,0);
  for(const l of m.levels)for(const a of l.breakerAssemblies??[]){
    const joists=l.joists.filter(j=>j.assemblyId===a.id),rungs=l.blocking.filter(b=>b.assemblyId===a.id);
    assert(joists.length>=2);assert(rungs.length>=2);
    for(const r of rungs){
      assert(joists.some(j=>Math.abs(j.a.x+.75-r.a.x)<.001&&r.a.z>=j.a.z-.001&&r.a.z<=j.b.z+.001));
      assert(joists.some(j=>Math.abs(j.a.x-.75-r.b.x)<.001&&r.a.z>=j.a.z-.001&&r.a.z<=j.b.z+.001));
      assert(Math.abs(r.b.x-r.a.x-(boardWidth+2*a.jointGapIn))<.001);
    }
    const pieces=l.boards.filter(b=>b.role==='breaker'&&Math.abs(b.cx-a.x)<.01);
    for(const p of pieces){
      const start=p.cy-p.length/2+l.offset.z,end=p.cy+p.length/2+l.offset.z;
      for(const z of [start,end])assert(rungs.some(r=>Math.abs(r.a.z-z)<=.751),'each divider end has bearing');
      const under=rungs.filter(r=>r.a.z>=start&&r.a.z<=end).sort((x,y)=>x.a.z-y.a.z);
      for(let i=1;i<under.length;i++)assert(under[i].a.z-under[i-1].a.z<=d.joistSpacing+.001,'rung spacing');
    }
    const sorted=[...rungs].sort((x,y)=>x.a.z-y.a.z);
    for(let i=1;i<sorted.length;i++)assert(sorted[i].a.z-sorted[i-1].a.z>=1.499,'rungs do not overlap');
    for(const b of l.boards.filter(b=>b.angleDeg===0))for(const sign of [-1,1]){
      const x=b.cx+sign*b.length/2,edge=a.x-sign*(boardWidth/2+a.jointGapIn);
      if(Math.abs(x-edge)<.001)assert(joists.some(j=>Math.abs(j.a.x-(x-sign*.75+l.offset.x))<.001),'field-end bearing');
    }
  }
  const actual=m.levels.reduce((n,l)=>n+[...l.joists,...l.beams,...l.blocking,...(l.rim??[])].reduce((s,b)=>s+Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y,b.b.z-b.a.z)/12,0),0);
  assert(Math.abs(m.quantities.framingLf-actual)<.001);
});
for(const shape of ['Rectangle','L-Shape'] as const)for(const pictureFrameRows of [0,1,2] as const)check('borders, notches and level offsets',()=>{
  const d=fixture({shape,pictureFrameRows,levels:2,width2:24,length2:12,level2Position:'Left',level2Offset:27,cutoutWidth:6,cutoutLength:4}),m=buildDeckTakeoff(d);
  assert(m.levels.every(l=>l.boards.every(b=>b.length<=m.stockLength+.001)));
  for(const l of m.levels)for(const r of l.blocking.filter(b=>b.role==='breaker-ladder'))assert(l.joists.some(j=>j.assemblyId===r.assemblyId&&Math.abs(j.a.x+.75-r.a.x)<.01));
});
check('angled preference is explicitly unimplemented',()=>{const m=buildDeckTakeoff(fixture({pattern:'Diagonal',breakerLayout:'Center'}));assert(m.issues.some(i=>i.includes('only modeled for straight')));assert.equal(m.quantities.breakerBoards,0);});
check('adjacent bays never enlarged when divider displaces a joist',()=>{
  for(let width=8;width<=40;width+=.25)for(const joistSpacing of [12,16] as const){
    const m=buildDeckTakeoff(fixture({width,joistSpacing,breakerLayout:'Center'}));
    const xs=[...new Set(m.levels[0].joists.map(j=>j.a.x))].sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)assert(xs[i]-xs[i-1]<=joistSpacing+.001,`${width}ft / ${joistSpacing}in: ${xs[i]-xs[i-1]}`);
  }
});
check('fractional temperature bands retain larger adjacent gap',()=>{
  for(const [temperatureC,expected] of [[.5,3/16],[23.5,1/8]])assert.equal(breakerJointGap(fixture({deckingMaterial:'tt_terrain',installation:{...DEFAULT_INSTALLATION,temperatureC}}),.25),expected);
});
check('TimberTech ordinary blocking row spacing',()=>{
  const m=buildDeckTakeoff(fixture({deckingMaterial:'tt_harvest'}));
  const zs=[...new Set(m.levels[0].blocking.filter(b=>b.role==='field-blocking').map(b=>b.a.z))];
  assert(zs.includes(48));assert(zs.includes(96));
});
check('inlay replacement remains visible in framing export',()=>{
  const d=fixture({breakerLayout:'Center',hasInlay:true,inlayLf:8}),m=buildDeckTakeoff(d),l=m.levels[0];
  const n=l.boards.filter(p=>p.role==='breaker'||(p.role==='inlay'&&l.breakerAssemblies?.some(a=>Math.abs(a.x-p.cx)<.01))).length;
  assert.equal((exportFramingPlanSVG(d,m).match(/data-role="breaker-board"/g)??[]).length,n);
});
check('all exports consume actual assembly geometry',()=>{
  const d=fixture(),m=buildDeckTakeoff(d),svg=exportFramingPlanSVG(d,m),html=exportInstallationHTML(d,m),meshes=deckExportMeshes(d,m);
  assert(svg.includes('breaker-field-support'));assert(svg.includes('breaker-ladder'));assert(svg.includes('breaker-board'));assert(svg.includes('NOT FOR CONSTRUCTION'));
  assert(html.includes('L1-BR1'));
  assert(meshes.some(x=>x.name.includes('joist_breaker_support')));assert(meshes.some(x=>x.name.includes('blocking_breaker_ladder')));
  assert.throws(()=>exportFramingPlanSVG({...d,installation:{...DEFAULT_INSTALLATION,framing:'Steel'}},m),/not implemented/);
});
if(process.argv.includes('--sample')){
  const d=fixture({deckingMaterial:'tt_terrain',boardStockLengthIn:192,installation:{...DEFAULT_INSTALLATION,temperatureC:20},projectAddress:'Illustrative 24 x 12 ft deck - site not supplied'}),m=buildDeckTakeoff(d);
  writeFileSync('../../outputs/deckcraft-breaker-framing.svg',exportFramingPlanSVG(d,m));
  writeFileSync('../../outputs/deckcraft-breaker-installation.html',exportInstallationHTML(d,m));
}
console.log(`DECK BREAKERS OK — ${checks} stock, geometry, bearing, persistence and export checks.`);
