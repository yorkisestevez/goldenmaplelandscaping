import '../src/features/deckcraft/lib/inlayGeometryRuntime';
import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {validateDesign,serializeDesign,parseDesign} from '../src/features/deckcraft/designPersistence';
import {boardFinishPlan,contrastColour} from '../src/features/deckcraft/boardFinishes';
import {boardOutline,polygonCut,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import {fitInlay,inlayOutline,levelInlayContext,planInlays,validateCustomInlayPoints,validateDeckInlay} from '../src/features/deckcraft/lib/inlayGeometry';
import {createInlayPreset,INLAY_PRESETS} from '../src/features/deckcraft/lib/inlayPresets';
import type {DeckData,DeckInlay} from '../src/features/deckcraft/types';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';

let checks=0,designs=0;
const ok=(v:unknown,label:string)=>{assert(v,label);checks++;};
const base=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),width:24,length:20,...patch});
const area=(p:PlanPoint[][])=>p.reduce((n,x)=>n+Math.abs(signedArea(x)),0);
const box=(p:PlanPoint[])=>({x0:Math.min(...p.map(v=>v.x)),x1:Math.max(...p.map(v=>v.x)),y0:Math.min(...p.map(v=>v.y)),y1:Math.max(...p.map(v=>v.y))});
const contrast=contrastColour(base());
const testDesign=(inlay:DeckInlay,patch:Partial<DeckData>={})=>{
  const data=base({...patch,inlays:[inlay]}),m=buildDeckTakeoff(data),l=m.levels.find(x=>x.kind==='deck'&&x.index===(inlay.level??1)-1)!;designs++;
  const p=l.inlays?.[0];ok(p?.status==='ok',`${inlay.id}: actual plan builds (${p?.status})`);
  const solids=l.boards.map(b=>({b,p:boardOutline(b,data.boardWidth)})),ordered=solids.map(s=>({...s,box:box(s.p)})).sort((a,b)=>a.box.x0-b.box.x0);
  for(const {b,p:poly} of solids){
    ok([b.cx,b.cy,b.length,b.width??data.boardWidth,b.angleDeg,...poly.flatMap(v=>[v.x,v.y])].every(Number.isFinite),`${inlay.id}: finite physical board`);
    ok(b.length<=m.stockLength+.001&&(b.width??data.boardWidth)<=data.boardWidth+.01,`${inlay.id}: cut fits documented stock width/length`);
    ok(area(polygonCut([poly],[l.deckingFootprint?.outline??l.footprint.outline],true))<.05,`${inlay.id}: actual cut stays inside finished level`);
    if(!b.inlay)ok(area(polygonCut([poly],p!.pieces))<.05,`${inlay.id}: original field is physically cut out`);
    else ok(area(polygonCut([poly],p!.pieces,true))<.05,`${inlay.id}: installed inlay cut stays inside its silhouette`);
  }
  for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length&&ordered[j].box.x0<ordered[i].box.x1-.001;j++){
    const a=ordered[i],b=ordered[j];if(a.box.y0>=b.box.y1-.001||a.box.y1<=b.box.y0+.001)continue;
    ok(area(polygonCut([a.p],[b.p]))<.05,`${inlay.id}: no double-covered physical board area`);
  }
  if(inlay.kind==='custom'||inlay.kind==='medallion'||'rotationDeg'in inlay&&inlay.rotationDeg){
    ok(p!.quote&&p!.solid?.length&&l.blocking.some(b=>b.role==='inlay-solid'),`${inlay.id}: measured support enters actual takeoff; fabrication remains quoted`);
  }
  const clean=validateDesign(data),back=parseDesign(serializeDesign(clean));
  assert.deepEqual(back.inlays,clean.inlays,`${inlay.id}: public save/import preserves geometry and finish`);checks++;
  return {data,m,l,p:p!};
};

// Every offered preset must be a valid, buildable distinct real model, not only a renamed UI option.
for(const preset of INLAY_PRESETS)testDesign(createInlayPreset(preset.id,`preset-${preset.id}`,contrast));
const fingerprints=new Map(['compass','compass-rose','sunburst'].map(id=>{
  const d=base({inlays:[createInlayPreset(id,'m',contrast)]}),m=buildDeckTakeoff(d);
  return [id,JSON.stringify(m.levels[0].boards.filter(b=>b.inlay==='m').map(b=>({angle:b.angleDeg,polygon:boardOutline(b,d.boardWidth),role:b.role})))];
}));
ok(new Set(fingerprints.values()).size===3,'Compass, pointed rose and radial sunburst have different actual cuts/directions');
const rose=base({inlays:[createInlayPreset('compass-rose','rose',contrast)]}),rmodel=buildDeckTakeoff(rose),finish=boardFinishPlan(rose,rmodel);
ok(new Set(finish.stock.filter(g=>g.kind==='inlay').map(g=>g.ref)).size>=2,'Rose orders installed boards in both actual product colours');

// Rotation changes silhouettes and physical fill direction; legacy absent rotation is unchanged.
for(const kind of ['rectangle','diamond','hexagon','star','chevron'] as const)for(const pattern of ['Straight','Diagonal','Herringbone'] as const){
  const i=createInlayPreset(kind,`${kind}-${pattern.toLowerCase()}`,contrast);if(i.kind==='band')throw new Error('Unexpected band');
  testDesign({...i,rotationDeg:17,...(i.kind!=='medallion'?{pattern}:{})});
}
const rug=createInlayPreset('rectangle','rug');if(rug.kind==='band')throw new Error('Unexpected band');
const c={x:144,y:120},zero=inlayOutline(rug,c),quarter=inlayOutline({...rug,rotationDeg:90},c);
ok(Math.abs(Math.abs(signedArea(zero))-Math.abs(signedArea(quarter)))<1e-7,'Rotation preserves exact outline area');
ok(Math.abs((box(quarter).x1-box(quarter).x0)-(box(zero).y1-box(zero).y0))<1e-7,'Quarter turn swaps physical width and depth');
assert.deepEqual(validateDeckInlay({...rug,rotationDeg:0}),validateDeckInlay(rug),'Zero rotation canonicalizes to exact old data');checks++;

// Concave pinched custom frame creates two real interiors; both get installed boards and support.
const dumbbell:DeckInlay={id:'two-interiors',kind:'custom',points:[{x:-60,y:-30},{x:-12,y:-30},{x:-12,y:-3},{x:12,y:-3},{x:12,y:-30},{x:60,y:-30},{x:60,y:30},{x:12,y:30},{x:12,y:3},{x:-12,y:3},{x:-12,y:30},{x:-60,y:30}],frame:contrast};
const db=testDesign(dumbbell);ok(db.p.inners?.length===2,'Narrow concave neck yields two separate interiors');
for(const inner of db.p.inners??[])ok(db.l.boards.some(b=>b.inlay==='two-interiors'&&b.role==='inlay-fill'&&area(polygonCut([boardOutline(b,db.data.boardWidth)],[inner]))>1),'Each separated interior has real fill boards');
for(const level of [2,3] as const){
  const i=createInlayPreset('hexagon',`lower-${level}`,contrast);if(i.kind!=='custom')throw new Error('Unexpected preset');
  testDesign({...i,level,rotationDeg:-31},{levels:3,height:48,width2:18,length2:14,height2:30,level3:{widthFt:16,lengthFt:12,heightIn:12,parent:2,position:'Front',offsetPct:50}});
}
testDesign({...createInlayPreset('octagon','narrow-stock',contrast),rotationDeg:33} as DeckInlay,{boardWidth:3.5,pattern:'Diagonal'});

// Nonzero/negative custom footprint origin matches buildDeckTakeoff placement, without changing legacy centres.
const off=base({shape:'Custom',deckOutlines:{main:[{x:-7.25,y:-4.125},{x:16.75,y:-4.125},{x:16.75,y:15.875},{x:-7.25,y:15.875}]}}),om=buildDeckTakeoff(off),ctx=levelInlayContext(off,om.levels[0]);
ok(Math.abs(ctx.centre.x-57)<1e-9&&Math.abs(ctx.centre.y-70.5)<1e-9,'Editor context includes actual fractional negative footprint origin');
const custom=createInlayPreset('octagon','fit');if(custom.kind!=='custom')throw new Error('Unexpected preset');
const far={...custom,dxFt:28,dyFt:28,rotationDeg:37};const fitted=fitInlay(far,[],ctx);
ok(fitted&&planInlays([fitted],ctx,{boards:false})[0].status==='ok','Rotated custom fit safely finds an actual contained placement');
assert.deepEqual(far,{...custom,dxFt:28,dyFt:28,rotationDeg:37},'Fit never mutates source points/draft');checks++;
const outside=planInlays([{...custom,dxFt:30}],ctx,{boards:false})[0];ok(outside.status==='outside'&&outside.boards.length===0,'Unfitted custom is retained with no fake boards');
const overlap=planInlays([custom,{...custom,id:'overlap'}],ctx,{boards:false});ok(overlap[1].status==='overlap','Overlapping custom additions are not built');

// Custom fabrication labour defaults to man-hours + materials; boards/blocking stay on priced material lines.
const estimated=calculateDeckReleaseEstimate(db.data,DECK_SETTINGS),labour=estimated.sections.find(s=>s.title.startsWith('Labour'));
ok(labour&&labour.items.some(i=>i.name==='Custom inlay fabrication labour'&&i.cost!==null&&i.cost>0),'Custom fabrication is priced as man-hours by default');
ok(!estimated.quoteRequired.includes('Custom inlay fabrication labour (builder quote)'),'Custom fabrication is not an outstanding builder quote by default');
ok(estimated.model.quantities.blocking>buildDeckTakeoff(base()).quantities.blocking,'Custom supports affect actual physical quantities');

// Hostile/malformed import must be rejected before getters run and without partial data writes.
let getters=0;const pointGetter=Object.defineProperty({y:1},'x',{enumerable:true,get(){getters++;return 0;}});
const rawCustom={id:'c',kind:'custom',points:[{x:-30,y:-30},{x:30,y:-30},{x:0,y:30}]};
const malformed:unknown[]=[{...rawCustom,points:[{x:0,y:0},{x:50,y:50},{x:0,y:50},{x:50,y:0}]},{...rawCustom,points:[{x:0,y:0},{x:20,y:0},{x:30,y:0}]},{...rawCustom,points:[pointGetter,{x:30,y:0},{x:0,y:30}]},{...rawCustom,widthFt:10},{...rawCustom,points:[{x:-241,y:0},{x:0,y:10},{x:10,y:0}]},{...rawCustom,points:[{x:-200,y:0},{x:200,y:0},{x:0,y:30}]},{...rawCustom,rotationDeg:361},{...rawCustom,name:'x'.repeat(41)},{...rawCustom,pattern:'Radial'},{...rawCustom,points:[{x:NaN,y:0},{x:20,y:0},{x:0,y:20}]},{...rawCustom,points:[{x:0,y:0},{x:20,y:0},{x:0,y:0}]},Object.defineProperty({...rawCustom},'points',{enumerable:true,get(){getters++;return [];}}),Object.create(rawCustom)];
const sparse=[{x:-30,y:0},,{x:0,y:30}];malformed.push({...rawCustom,points:sparse});
const hidden=[{x:-30,y:0},{x:30,y:0},{x:0,y:30}];Object.defineProperty(hidden,'hidden',{value:1});malformed.push({...rawCustom,points:hidden});
const symbol={...rawCustom,[Symbol('extra')]:true};malformed.push(symbol);
for(const bad of malformed){assert.throws(()=>validateDesign({...base(),inlays:[bad]}),'Malformed inlay import rejected');checks++;}
ok(getters===0,'No malformed inlay/point getter was executed');
assert.deepEqual(validateCustomInlayPoints([...rawCustom.points].reverse()),rawCustom.points,'Clockwise custom shape canonicalizes without changing coordinates');checks++;
assert.throws(()=>validateDesign({...base(),inlays:[rawCustom,rawCustom]}),'Repeated IDs rejected');checks++;
assert.throws(()=>createInlayPreset('fake','a'),'Unknown preset rejected');checks++;
console.log(`INLAY SHAPES OK — ${designs} physical designs, ${checks} independent checks; presets, rotation, concave interiors, containment/non-overlap, real stock/support, quote and hostile persistence.`);
