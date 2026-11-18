// Ground fit G2 pricing: graded banks round patios. Proves bank earthwork is priced honestly (owner rates null →
// builder quote, never $0), lawn restoration on the banks reuses the shared restoration rate, nothing is charged
// twice once rates are set, and a design without banks prices byte-identically.
// Until the bank engine lands the surface reports no bank parts, so bank quantities are injected into a real
// yard model's siteCutFill (they are a part of its existing cut/fill totals, as the engine will report them).
import '../src/features/deckcraft/yardModelAdvancedRuntime';
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import type {SiteModel} from '../src/features/deckcraft/siteModel';
import {buildYardModel,type YardModel} from '../src/features/deckcraft/yardModel';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {createSiteSurface,designSiteModel} from '../src/features/deckcraft/siteSurfaceEngine';
import {getTerrainConfig} from '../src/features/deckcraft/yardSettings';
import {yardFeatureOutline} from '../src/features/deckcraft/yardPathGeometry';
import {raisedPatioGuard} from '../src/features/deckcraft/raisedPatio';
import {GUARD} from '../src/features/deckcraft/designRules';
import {buildYardTakeoff,type YardTakeoff,type PublicYardSection} from '../src/features/deckcraft/yardTakeoff';
import {GROUND_FIT_RATES} from '../src/features/deckcraft/groundFitRates';
import baseline from '../src/data/engine-baseline.json';

let checks=0;
const check=(v:unknown,msg:string)=>{assert.ok(v,msg);checks++;};
const same=(a:unknown,b:unknown,msg:string)=>{assert.deepEqual(a,b,msg);checks++;};
const near=(a:number,b:number,msg:string)=>check(Math.abs(a-b)<1e-9,`${msg}: ${a} vs ${b}`);
const RATE=baseline.calibration.restorationPerSqft;

const feature=(id:string,patch:Partial<YardFeature>={}):YardFeature=>({id,kind:'patio',name:id,enabled:true,xFt:25,zFt:10,widthFt:10,depthFt:8,heightIn:0,rotationDeg:0,productId:'permacon-mondrian-plus',color:'#aaa69b',finishedElevationIn:4,...patch});
const level=(stationIn:number,elevationIn:number)=>({stationIn,elevationIn});
const site=(h:(x:number,z:number)=>number):SiteModel=>({version:1,points:[[-120,-120],[480,-120],[480,480],[-120,480]].map(([xIn,zIn],i)=>({id:String(i),xIn,zIn,elevationIn:h(xIn,zIn)})),grading:[],
 transitions:[{id:'ramp',name:'Ramp',enabled:true,a:{points:[{x:0,y:0},{x:240,y:0}],elevationSource:'specified',levels:[level(0,-6),level(240,18)]},b:{points:[{x:0,y:120},{x:240,y:120}],elevationSource:'specified',levels:[level(0,6),level(240,30)]}}]});
const base:DeckData={...structuredClone(DEFAULT_DECK),yardFeatures:[],terrainConfig:{widthFt:120,depthFt:120,elevationIn:0,slopePct:0}};
const measured:DeckData={...base,siteModel:site((x,z)=>x*.02+z*.01),yardFeatures:[feature('patio')]};
const hauled:DeckData={...base,siteModel:site(x=>x*.02),yardEarthwork:{soilReusePct:30,spoilSwellPct:25,looseSpoilTonnesPerYd3:1.3,binVolumeYd3:14,binPayloadTonnes:4},yardFeatures:[feature('patio',{finishedElevationIn:2})]};
const supplierOnly:DeckData={...measured,yardFeatures:[feature('patio',{productId:'not-a-carr-paver'})]};

const withBanks=(m:YardModel,bankCutYd3:number,bankFillYd3:number,bankAreaSqft:number):YardModel=>({...m,siteCutFill:{...m.siteCutFill!,bankCutYd3,bankFillYd3,bankAreaSqft}});
const row=(t:YardTakeoff,id:string)=>t.sections.find(s=>s.id===id);
const pricedSum=(t:YardTakeoff)=>t.sections.reduce((n,s)=>n+(s.amountCents??0),0);
const rates=(cut:number|null,fill:number|null)=>{GROUND_FIT_RATES.cutHaulPerYd3=cut;GROUND_FIT_RATES.fillCompactionPerYd3=fill;};
const stripBank=(s:PublicYardSection)=>s.note===undefined?s:({...s,note:s.note.replace(/ Includes [\d.]+ cu yd (dug from graded banks|of bank fill) round patios\./,'')});
const BANK_CUT=1.2,BANK_FILL=2.4,BANK_AREA=84;

check(GROUND_FIT_RATES.cutHaulPerYd3===null&&GROUND_FIT_RATES.fillCompactionPerYd3===null,'Owner bank rates are unset (null) until supplied');
try{
 for(const [name,data]of [['measured',measured],['hauled',hauled],['supplier-only',supplierOnly]] as const){
  const m=buildYardModel(data),t0=buildYardTakeoff(data,m),json=JSON.stringify(t0);
  check(!!m.siteCutFill&&m.siteCutFill.bankCutYd3===undefined,`${name}: no bank parts reported without ground fit`);
  check(!t0.sections.some(s=>s.id.startsWith('yard-bank-')),`${name}: no bank rows without banks`);
  check(!t0.sections.some(s=>/graded banks|bank fill/.test(s.note??'')),`${name}: no bank wording without banks`);
  same(JSON.stringify(buildYardTakeoff(data)),json,`${name}: default model path unchanged`);
  same(JSON.stringify(buildYardTakeoff(data,withBanks(m,0,0,0))),json,`${name}: zero banks price byte-identically to a design without ground fit`);
  same(JSON.stringify(buildYardTakeoff(data,withBanks(m,.0005,.0005,.0005))),json,`${name}: sub-threshold banks ignored`);
  rates(40,55);same(JSON.stringify(buildYardTakeoff(data,m)),json,`${name}: set rates change nothing without banks`);rates(null,null);
  near(pricedSum(t0),t0.knownSubtotalCents,`${name}: priced rows reconcile to the known subtotal`);
  const q=m.quantities;check(q.excavationYd3>BANK_CUT&&(q.siteEarthworkFillYd3??0)>BANK_FILL,`${name}: grading totals large enough to hold the injected bank parts`);
  const mb=withBanks(m,BANK_CUT,BANK_FILL,BANK_AREA);

  // Rates null: restoration priced; bank earthwork stays inside the builder-quote rows, said in their notes.
  const tn=buildYardTakeoff(data,mb),restoration=row(tn,'yard-bank-restoration')!;
  check(!!restoration,`${name}: lawn restoration on graded banks appears`);
  same([restoration.label,restoration.quantity,restoration.unit],['Lawn restoration on graded banks',BANK_AREA,'sq ft'],`${name}: restoration row measured in sq ft of bank`);
  same(restoration.amountCents,Math.round(BANK_AREA*RATE*100),`${name}: restoration = bank area × shared restoration rate`);
  check(!row(tn,'yard-bank-cut')&&!row(tn,'yard-bank-fill'),`${name}: null rates add no priced cut/fill rows`);
  check(!tn.sections.some(s=>s.amountCents===0),`${name}: nothing priced at $0`);
  const hauling=tn.sections.filter(s=>/^yard-(hauling|excavation-)/.test(s.id));
  check(hauling.length>0&&hauling.every(s=>s.amountCents===null&&s.note!.endsWith(` Includes ${BANK_CUT.toFixed(1)} cu yd dug from graded banks round patios.`)),`${name}: hauling/excavation review notes carry the bank cut`);
  const fill=row(tn,'site-grading-fill')!;
  check(fill.amountCents===null&&fill.note!.endsWith(` Includes ${BANK_FILL.toFixed(1)} cu yd of bank fill round patios.`),`${name}: grading-fill builder quote says it holds the bank fill`);
  same(fill.quantity,row(t0,'site-grading-fill')!.quantity,`${name}: bank fill stays in the grading-fill quantity while unpriced`);
  same(tn.sections.filter(s=>s!==restoration).map(stripBank),t0.sections,`${name}: every other row unchanged with rates null`);
  same(tn.earthwork,t0.earthwork,`${name}: hauling quantities unchanged with rates null`);
  same(tn.knownSubtotalCents,t0.knownSubtotalCents+restoration.amountCents!,`${name}: only the restoration joins the known subtotal`);
  near(pricedSum(tn),tn.knownSubtotalCents,`${name}: priced rows reconcile with banks`);
  check(tn.quoteRequired,`${name}: bank earthwork keeps the quote open`);

  // Rates set: priced cut/fill rows; generic hauling and fill drop by exactly the bank parts (no double charge).
  rates(40,55);const ts=buildYardTakeoff(data,mb),cut=row(ts,'yard-bank-cut')!,bankFill=row(ts,'yard-bank-fill')!;
  check(!!cut&&!!bankFill,`${name}: set rates add priced cut and fill rows`);
  same([cut.quantity,cut.unit,cut.amountCents],[BANK_CUT,'cu yd',Math.round(BANK_CUT*40*100)],`${name}: bank cut = yd³ × cut/haul rate`);
  same([bankFill.quantity,bankFill.unit,bankFill.amountCents],[BANK_FILL,'cu yd',Math.round(BANK_FILL*55*100)],`${name}: bank fill = yd³ × fill/compaction rate`);
  same(row(ts,'yard-bank-restoration'),restoration,`${name}: restoration unchanged by earthwork rates`);
  near(ts.earthwork.yardBankYd3,t0.earthwork.yardBankYd3-BANK_CUT,`${name}: priced yard bank (bins) drops by exactly the bank cut`);
  near(ts.earthwork.bankYd3,t0.earthwork.bankYd3-BANK_CUT,`${name}: physical hauling bank drops by exactly the bank cut`);
  near(row(ts,'site-grading-fill')!.quantity!,row(t0,'site-grading-fill')!.quantity!-BANK_FILL,`${name}: grading-fill quote drops by exactly the bank fill`);
  check(!ts.sections.some(s=>/graded banks round patios\.$|of bank fill round patios\.$/.test(s.note??'')),`${name}: generic notes no longer claim the priced bank work`);
  check((row(ts,'yard-disposal')?.amountCents??0)<=(row(t0,'yard-disposal')?.amountCents??0),`${name}: disposal never rises when bank cut is priced separately`);
  if(!data.yardEarthwork){
   near(ts.earthwork.exportBankYd3,t0.earthwork.exportBankYd3-BANK_CUT,`${name}: soil to export drops by exactly the bank cut`);
   near(row(ts,'yard-hauling-review')!.quantity!,row(t0,'yard-hauling-review')!.quantity!-BANK_CUT,`${name}: hauling review quantity drops by exactly the bank cut`);
  }
  const equipment=row(ts,'yard-excavation-equipment');if(equipment)near(equipment.quantity!,row(t0,'yard-excavation-equipment')!.quantity!-BANK_CUT,`${name}: excavation review drops by exactly the bank cut`);
  check(!ts.sections.some(s=>s.amountCents===0),`${name}: nothing priced at $0 with rates set`);
  near(pricedSum(ts),ts.knownSubtotalCents,`${name}: priced rows reconcile with rates set`);
  same(ts.quantities,tn.quantities,`${name}: reported yard quantities stay physical`);

  // All the grading fill is bank fill: the grading-fill quote row goes once it is priced.
  const allFill=q.siteEarthworkFillYd3!,tf=buildYardTakeoff(data,withBanks(m,BANK_CUT,allFill,BANK_AREA));
  check(!row(tf,'site-grading-fill')&&row(tf,'yard-bank-fill')!.quantity===allFill,`${name}: grading-fill row dropped when nothing remains`);

  // One rate set: only that line is priced; the other stays builder quote.
  rates(40,null);const tc=buildYardTakeoff(data,mb);
  check(!!row(tc,'yard-bank-cut')&&!row(tc,'yard-bank-fill')&&row(tc,'site-grading-fill')!.note!.includes('of bank fill round patios'),`${name}: cut rate alone prices only the cut`);
  rates(null,55);const tg=buildYardTakeoff(data,mb);
  check(!row(tg,'yard-bank-cut')&&!!row(tg,'yard-bank-fill')&&tg.sections.filter(s=>/^yard-haul/.test(s.id)).every(s=>s.note!.includes('dug from graded banks')),`${name}: fill rate alone prices only the fill`);
  same(tg.earthwork.yardBankYd3,t0.earthwork.yardBankYd3,`${name}: unpriced bank cut stays in the bins`);

  // A zero rate is not a price.
  rates(0,0);const tz=buildYardTakeoff(data,mb);
  check(!row(tz,'yard-bank-cut')&&!row(tz,'yard-bank-fill')&&!tz.sections.some(s=>s.amountCents===0),`${name}: zero rates never make $0 lines`);
  same(tz,tn,`${name}: zero rates behave as unset`);
  rates(null,null);
 }
}finally{rates(null,null);}
check(GROUND_FIT_RATES.cutHaulPerYd3===null&&GROUND_FIT_RATES.fillCompactionPerYd3===null,'Owner rates restored to null');

// Stone edge course (groundFit.lowEdge 'stone'): where the patio stands above the measured ground a stone course holds
// its raised side instead of a fill bank. Measured from the patio's edge (yardModelAdvancedRuntime.ts), quoted by the
// builder: a row with its length and tallest face, never a price and never $0.
{
 const slope:SiteModel={version:1,points:[[-240,-240],[720,-240],[720,720],[-240,720],[240,240]].map(([xIn,zIn],i)=>({id:`s${i}`,xIn,zIn,elevationIn:zIn*.1})),grading:[]};
 const raised=(id:string,patch:Partial<YardFeature>={})=>feature(id,{xFt:20,zFt:20,finishedElevationIn:30,groundFit:{slopeRatio:3,lowEdge:'stone'},...patch});
 const stoneData:DeckData={...base,siteModel:slope,yardFeatures:[raised('stone')]},banked:DeckData={...stoneData,yardFeatures:[raised('stone',{groundFit:{slopeRatio:3}})]},unfitted:DeckData={...stoneData,yardFeatures:[raised('stone',{groundFit:undefined})]};
 const m=buildYardModel(stoneData),t=buildYardTakeoff(stoneData,m),f=m.features[0],course=row(t,'yard-edge-course')!;
 check(!f.excluded&&f.quantities.edgeCourseLf>0&&f.quantities.edgeCourseMaxIn>0,`stone edge measured on the patio (${f.quantities.edgeCourseLf} ft, ${f.quantities.edgeCourseMaxIn} in)`);
 same([m.quantities.edgeCourseLf,m.quantities.edgeCourseMaxIn],[f.quantities.edgeCourseLf,f.quantities.edgeCourseMaxIn],'yard quantities carry the edge course');
 check(Number.isInteger(m.quantities.edgeCourseLf!*10)&&Number.isInteger(m.quantities.edgeCourseMaxIn!*10),'edge course in feet and inches to one decimal');
 // The raised side is a whole run of edge here: the back (low ground) and both sides, the front only where the ground is low.
 const perimeterFt=2*(10+8);check(m.quantities.edgeCourseLf!>8&&m.quantities.edgeCourseLf!<perimeterFt,`edge course is part of the ${perimeterFt} ft edge`);
 near(m.quantities.edgeCourseMaxIn!,Math.round((30-(20*12-48)*.1)*10)/10,'tallest face at the back edge, finished top less measured ground');
 check(!!course,'stone edge course row appears');
 same([course.label,course.quantity,course.unit,course.amountCents,course.featureIds],['Stone edge course on raised patio sides',m.quantities.edgeCourseLf,'lf',null,['stone']],'edge course row: builder quote in linear feet');
 check(course.note!.includes(`${m.quantities.edgeCourseMaxIn!.toFixed(1)} in`),'edge course note gives the tallest face in inches');
 check(!t.sections.some(s=>s.amountCents===0),'nothing priced at $0 with a stone edge');
 check(t.quoteRequired,'the stone edge keeps the quote open');
 near(pricedSum(t),t.knownSubtotalCents,'priced rows reconcile with a stone edge');
 check(m.warnings.some(w=>w.startsWith(`stone: stone edge course on its raised side, ${m.quantities.edgeCourseLf!.toFixed(1)} ft, up to ${m.quantities.edgeCourseMaxIn!.toFixed(1)} in high`)),'a short note names the edge course');
 check(!m.warnings.some(w=>/stands up to .* exposed/.test(w)),'no exposed-base warning on the stone side');
 // The same patio with banks or no ground fit: no edge course anywhere in the model or the quote.
 for(const [name,data] of [['banked',banked],['unfitted',unfitted],['measured',measured],['hauled',hauled]] as const){
  const mm=buildYardModel(data),tt=buildYardTakeoff(data,mm);
  check(!JSON.stringify(mm).includes('edgeCourse')&&!row(tt,'yard-edge-course')&&!mm.warnings.some(w=>w.includes('stone edge course')),`${name}: no edge course without a stone edge`);
 }
 check(buildYardModel(unfitted).warnings.some(w=>/stands up to .* exposed base/.test(w)),'unfitted, the same patio still warns of its exposed base');
 // A stone-edged patio set below the ground has no raised side: measured as nothing, no row.
 const sunk:DeckData={...stoneData,yardFeatures:[raised('sunk',{finishedElevationIn:10})]},ms=buildYardModel(sunk);
 same([ms.quantities.edgeCourseLf,ms.quantities.edgeCourseMaxIn],[0,0],'sunk stone-edged patio: no edge course');
 check(!row(buildYardTakeoff(sunk,ms),'yard-edge-course'),'sunk stone-edged patio: no row');
 // Two stone-edged patios: one row, their lengths summed and the taller face.
 const two:DeckData={...stoneData,yardFeatures:[raised('one'),raised('two',{xFt:40,finishedElevationIn:36})]},m2=buildYardModel(two),t2=buildYardTakeoff(two,m2),r2=row(t2,'yard-edge-course')!,[q1,q2]=m2.features.map(g=>g.quantities);
 near(r2.quantity!,Math.round((q1.edgeCourseLf+q2.edgeCourseLf)*10)/10,'two stone edges: lengths summed');
 same([m2.quantities.edgeCourseMaxIn,r2.featureIds],[Math.max(q1.edgeCourseMaxIn,q2.edgeCourseMaxIn),['one','two']],'two stone edges: the taller face, both patios');
}
// Regression (review S, guards only on the site designer's raised patios): every patio at a fixed level on measured
// ground is checked with raisedPatioGuard (OBC 9.8.8.1, designRules GUARD). Where its paving stands more than 600 mm
// (23.6 in) over the lowest ground within 1.2 m of an open edge, or that ground falls steeper than 1 in 2, the model
// warns naming the edges and the run, the patio carries guard metrics (guardLf, edges) and the quote one builder-quote
// row in linear feet, never $0. Edges against another patio (a landing), the deck, a stair or the house are not open.
// A patio with no such edge adds nothing at all.
{
 const towardHouse:SiteModel={version:1,points:[[-240,-240],[720,-240],[720,720],[-240,720],[240,240]].map(([xIn,zIn],i)=>({id:`g${i}`,xIn,zIn,elevationIn:zIn*.1})),grading:[]};
 // A 10 × 8 ft patio, x 180–300 in and z 192–288 in; the ground falls 1 in 10 toward the house (its back edge).
 const at=(id:string,level:number,patch:Partial<YardFeature>={})=>feature(id,{xFt:20,zFt:20,finishedElevationIn:level,...patch});
 const design=(features:YardFeature[],siteModel=towardHouse):DeckData=>({...base,siteModel,yardFeatures:features});
 const guarded=design([at('high',40)]),m=buildYardModel(guarded,buildDeckTakeoff(guarded)),t=buildYardTakeoff(guarded,m),f=m.features[0],g=f.guard!,guardRow=row(t,'yard-patio-guard')!;
 const drop=40-(192-GUARD.adjacentWithinIn)*.1;
 check(!!g&&g.edges[0]==='back'&&!g.edges.includes('front')&&g.dropIn===Math.ceil(drop*10)/10&&g.heightIn===GUARD.heightIn&&!g.steep,`40 in over ground falling to ${(drop-40).toFixed(2)} in: a guard along the back edge, up to ${g?.dropIn} in (${JSON.stringify(g)})`);
 check(g.lf>=10&&g.lf<=11.5&&f.quantities.guardLf===g.lf&&f.quantities.guardDropIn===g.dropIn,`...its 10 ft back edge and the corner pieces beside it (${g.lf} ft)`);
 check(m.warnings.includes(`high: a guard is required along ${g.lf.toFixed(1)} ft of its back edge (10.0 ft), right edge (0.5 ft) and left edge (0.5 ft): it stands up to ${g.dropIn.toFixed(1)} in above the lowest ground within 1.2 m (47.2 in) of it, past the 600 mm (23.6 in) of OBC 9.8.8.1. A 36 in guard there is not priced: builder quote.`),`a warning names the edges and the run (${m.warnings.find(w=>/guard/.test(w))})`);
 same([guardRow.label,guardRow.quantity,guardRow.unit,guardRow.amountCents,guardRow.featureIds],['Guard required at the raised patio edge',g.lf,'lf',null,['high']],'one builder-quote row in linear feet');
 check(guardRow.note!.startsWith(`high: ${g.lf.toFixed(1)} ft along its back, right and left edges, standing up to ${g.dropIn.toFixed(1)} in`)&&/36 in guard/.test(guardRow.note!),'its note says where and how high');
 check(t.quoteRequired&&t.grandTotalCents===null&&!t.sections.some(s=>s.amountCents===0)&&f.quoteRequired===true,'the guard keeps the quote open, never $0');
 // The guard row is all it adds: the same model without it prices every other row identically.
 const bare={...m,features:m.features.map(x=>{const {guard:_g,...rest}=x;const {guardLf:_l,guardDropIn:_d,...q}=rest.quantities;return {...rest,quantities:q};})},tb=buildYardTakeoff(guarded,bare);
 same(t.sections.filter(s=>s!==guardRow),tb.sections,'every other row unchanged by the guard');
 same(t.knownSubtotalCents,tb.knownSubtotalCents,'the known subtotal unchanged by the guard');
 // 30 in: 15.5 in over the lowest ground 1.2 m out, under 600 mm, and nowhere steeper than 1 in 2: nothing added.
 const lower=design([at('high',30)]),ml=buildYardModel(lower,buildDeckTakeoff(lower)),tl=buildYardTakeoff(lower,ml);
 check(!ml.features[0].guard&&ml.features[0].quantities.guardLf===undefined&&!row(tl,'yard-patio-guard')&&!ml.warnings.some(w=>/guard is required/.test(w)),'30 in (15.5 in over the ground 1.2 m out): no guard, no metric, no row, no warning');
 // A landing at the same level along its back edge: that edge is shared, so not open. The landing's own open back
 // edge stands higher still and needs one; the row sums both patios.
 const withLanding=design([at('high',40),at('landing',40,{zFt:14,depthFt:4})]),mw=buildYardModel(withLanding,buildDeckTakeoff(withLanding)),tw=buildYardTakeoff(withLanding,mw);
 const [gh,gl]=['high','landing'].map(id=>mw.features.find(x=>x.config.id===id)!.guard!);
 check(!gh.edges.includes('back')&&gh.lf<2&&gl.edges[0]==='back'&&!gl.edges.includes('front'),`an edge shared with a landing needs no guard (high: ${gh.edges.join(',')} ${gh.lf} ft; landing: ${gl.edges.join(',')} ${gl.lf} ft)`);
 same([row(tw,'yard-patio-guard')!.quantity,row(tw,'yard-patio-guard')!.featureIds],[Math.round((gh.lf+gl.lf)*10)/10,['high','landing']],'one row for both patios, their lengths summed');
 // Beside the deck (its right side, x 192 in): the ground falls 1 in 2 toward the deck. Open, that edge would need a
 // guard all along; against the deck it needs none.
 const towardDeck:SiteModel={...towardHouse,points:towardHouse.points.map(p=>({...p,elevationIn:p.xIn*.5-96}))};
 const side=feature('side',{xFt:21,zFt:6,finishedElevationIn:30}),bySide=design([side],towardDeck),ms=buildYardModel(bySide,buildDeckTakeoff(bySide)),gs=ms.features[0].guard;
 const surface=createSiteSurface(designSiteModel(bySide),getTerrainConfig(bySide));
 check(raisedPatioGuard(yardFeatureOutline(side)[0],30,surface).runs.some(r=>r.out.x<-.9&&r.lengthIn>=90),'open, the edge against the deck would need a guard all along');
 check(!!gs&&!gs.edges.includes('left'),`against the deck it needs none (${gs?.edges.join(', ')})`);
 // A patio sloping 2 % down toward the drop is read from its paving at the edge, not its centre level.
 const sloped=design([at('high',40,{patioSlope:{xPct:0,zPct:2}})]),gp=buildYardModel(sloped,buildDeckTakeoff(sloped)).features[0].guard!;
 check(gp.edges[0]==='back'&&gp.dropIn===Math.ceil((drop-.02*48)*10)/10,`a 2 % slope lowers the back edge 0.96 in: up to ${gp.dropIn} in`);
 // Designs saved without such a patio: the stone-edge, banked and plain designs above carry no guard anywhere.
 for(const [name,data] of [['measured',measured],['hauled',hauled],['supplier-only',supplierOnly]] as const){const mm=buildYardModel(data);check(!mm.features.some(x=>x.guard||x.quantities.guardLf!==undefined)&&!row(buildYardTakeoff(data,mm),'yard-patio-guard'),`${name}: no guard`);}
}
console.log(`Ground-fit bank pricing: ${checks} checks passed.`);
