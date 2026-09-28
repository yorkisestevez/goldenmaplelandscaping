import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {addRim} from '../src/features/deckcraft/constructionDetails';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import {buildDeckDesignSubmission,type SendDesignFields} from '../src/features/deckcraft/sendDesign';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {activeWrap} from '../src/features/deckcraft/lib/wrapGeometry';
import {colourRef} from '../src/features/deckcraft/boardFinishes';
import {unconfirmedRates} from '../src/features/deckcraft/rateConfidence';
import {newSkirting,SKIRTING_EDGE,SKIRTING_LIMITS,skirtingPlan,type SkirtingPlan,type SkirtingRun} from '../src/features/deckcraft/skirting';
import type {DeckData,HouseBlock,SkirtingConfig} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * Skirting under the deck (skirting.ts). A design without it builds, saves and prices exactly as before, and one
 * with it builds and prices the same deck: skirting only adds a "Deck skirting" section whose every row is a quote.
 * The house decides which main-deck edges it covers (houseContact.ts); those, the edges where levels meet and the
 * stair and level-connection openings (their width plus 1 in each side) are never skirted, winders never are, and the
 * face follows the ground plus the chosen clearance, slope included.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const base=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk',...patch});
const skirt=(patch:Partial<SkirtingConfig>={}):SkirtingConfig=>({...newSkirting(),...patch});
const price=(d:DeckData)=>calculateDeckReleaseEstimate(d,DECK_SETTINGS);
const planOf=(d:DeckData)=>skirtingPlan(d,buildDeckTakeoff(d))!;
const stable=(value:unknown)=>JSON.stringify(value,(_k,v)=>typeof v==='number'?(Object.is(v,-0)||Math.abs(v)<5e-7?0:Math.round(v*1e6)/1e6):v);
const digest=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex').slice(0,20);
const section=(e:ReturnType<typeof price>)=>e.sections.find(s=>s.title==='Deck skirting');
const near=(a:number,b:number,tol=.05)=>Math.abs(a-b)<=tol;
const runsOn=(plan:SkirtingPlan,level:number)=>plan.runs.filter(r=>r.level===level);
const inches=(runs:SkirtingRun[])=>runs.reduce((n,r)=>n+r.lengthIn,0);
const COCOA=colourRef('tt_prime_plus','Dark Cocoa');

// 1. Absent: nothing runs. No section, flag, fact, feature, export part or saved key, and a design with skirting builds
//    the same deck and the same priced portion: skirting only adds its quote section.
const plainDesigns:[string,Partial<DeckData>][]=[['rectangle',{}],['L-shape two levels',{shape:'L-Shape',width:20,length:16,levels:2,height:48,height2:24}],['wrap',{width:34,length:12,wrap:{left:{widthFt:8,runFt:10}}}],['herringbone freestanding',{pattern:'Herringbone',deckType:'Freestanding'}]];
for(const [label,patch] of plainDesigns){
  const d=base(patch),e=price(d),on={...d,skirting:skirt()},eo=price(on);
  ok(!section(e)&&!e.flags.some(f=>/[Ss]kirting/.test(f))&&!e.quoteRequired.some(q=>/kirting/.test(q)),`${label}: no skirting section, note or quote without skirting`);
  ok(!describeDesign(d,e).facts.some(f=>f.startsWith('Skirting'))&&!designFeatures(d).includes('deck_skirting'),`${label}: no skirting fact or funnel label without skirting`);
  ok(!deckExportMeshes(d,e.model).some(m=>m.name.startsWith('skirting_')),`${label}: no skirting export parts without skirting`);
  ok(!serializeDesign(d).includes('skirting')&&serializeDesign(d)===serializeDesign({...d,skirting:undefined}),`${label}: a design without skirting saves byte for byte as before`);
  ok(skirtingPlan(d,e.model)===null,`${label}: the skirting plan is null without skirting`);
  const {issues:_i,...model}=e.model,{issues:_j,...modelOn}=eo.model;
  ok(digest(model)===digest(modelOn)&&digest(getHardwareLayout(d,e.model))===digest(getHardwareLayout(on,eo.model)),`${label}: skirting leaves the deck's takeoff and hardware untouched`);
  const priced=(x:typeof e)=>digest(x.sections.filter(s=>s.title!=='Deck skirting'));
  ok(priced(e)===priced(eo)&&e.subtotal===eo.subtotal&&e.total===eo.total,`${label}: skirting leaves every priced section, the subtotal and the total unchanged`);
  const deckParts=(x:typeof e,y:DeckData)=>digest(deckExportMeshes(y,x.model).filter(m=>!m.name.startsWith('skirting_')).map(m=>[m.name,m.vertices,m.faces]));
  ok(deckParts(e,d)===deckParts(eo,on),`${label}: the export's deck parts are unchanged by skirting`);
}

// 2. The house decides which edges it covers. With no stairs, the main deck is skirted along exactly its outline less
//    the contact edges houseContact.ts reports, and no run lies along a contact, for plain, narrow, bump-out, garage,
//    wrap and porch houses.
const house=(widthFt:number,depthFt:number)=>({...getHouseConfig({...base(),width:20}),widthFt,depthFt});
const block=(b:HouseBlock)=>b;
const houses:[string,Partial<DeckData>][]=[
  ['a plain house across the back',{width:16,length:12}],
  ['a narrow house (the deck runs past it)',{width:30,length:12,housePlacement:{anchor:'left',offsetIn:0},houseConfig:house(20,16)}],
  ['a narrow centred house',{width:36,length:12,housePlacement:{anchor:'center',offsetIn:0},houseConfig:house(20,16)}],
  ['a bump-out',{width:16,length:12,houseConfig:{...house(26,16),footprint:{rects:[block({id:'bump1',kind:'house',wall:'Front',offsetFt:9,widthFt:8,depthFt:3})]}}}],
  ['a bump-out on a wide deck',{width:24,length:14,housePlacement:{anchor:'center',offsetIn:0},houseConfig:{...house(20,16),footprint:{rects:[block({id:'bump1',kind:'house',wall:'Front',offsetFt:6,widthFt:8,depthFt:4})]}}}],
  ['an attached garage face',{width:30,length:12,housePlacement:{anchor:'left',offsetIn:0},houseConfig:{...house(20,16),footprint:{rects:[block({id:'garage1',kind:'garage',wall:'Right',offsetFt:0,widthFt:20,depthFt:22})]}}}],
  ['a left wrap',{width:34,length:12,wrap:{left:{widthFt:8,runFt:10}}}],
  ['a two-corner wrap',{width:22,length:12,wrap:{left:{widthFt:8,runFt:10},right:{widthFt:10,runFt:12}}}],
  ['a porch wrap',{width:34,length:12,wrap:{right:{widthFt:8,runFt:10},porchRight:{depthFt:6,runFt:10}}}],
  ['a wrap round a bump-out',{width:34,length:12,wrap:{left:{widthFt:8,runFt:10}},houseConfig:{...house(26,22),footprint:{rects:[block({id:'bump1',kind:'house',wall:'Front',offsetFt:9,widthFt:8,depthFt:3})]}}}],
];
const along=(r:{a:{x:number;y:number};b:{x:number;y:number}},c:{a:{x:number;y:number};b:{x:number;y:number};lengthIn:number})=>{
  const ux=(c.b.x-c.a.x)/c.lengthIn,uy=(c.b.y-c.a.y)/c.lengthIn,off=(p:{x:number;y:number})=>Math.abs((p.x-c.a.x)*uy-(p.y-c.a.y)*ux),t=(p:{x:number;y:number})=>(p.x-c.a.x)*ux+(p.y-c.a.y)*uy;
  if(off(r.a)>.5||off(r.b)>.5)return 0;
  return Math.max(0,Math.min(c.lengthIn,Math.max(t(r.a),t(r.b)))-Math.max(0,Math.min(t(r.a),t(r.b))));
};
for(const [label,patch] of houses)for(const deckType of ['Attached','Freestanding'] as const){
  const d=base({...patch,deckType,stairFlights:0,height:48,skirting:skirt()}),model=buildDeckTakeoff(d),plan=skirtingPlan(d,model)!;
  if(patch.wrap&&deckType==='Attached')ok(activeWrap(d),`${label}: the wrap is active`);
  const fp=model.levels[0].footprint,contact=getHouseContact(d,fp),o=fp.outline;
  const expected=o.reduce((n,p,i)=>{const q=o[(i+1)%o.length];return contact.isContactEdge(i)?n:n+Math.hypot(q.x-p.x,q.y-p.y);},0);
  const main=runsOn(plan,0);
  ok(near(inches(main),expected,.1),`${label} (${deckType}): the main deck is skirted along its outline less the house contacts (${inches(main).toFixed(2)} of ${expected.toFixed(2)} in)`);
  ok(main.every(r=>contact.contacts.every(c=>along(r,c)<.5)),`${label} (${deckType}): no skirting runs along a wall the house covers`);
  if(deckType==='Attached')ok(contact.contacts.length>0&&expected<o.reduce((n,p,i)=>{const q=o[(i+1)%o.length];return n+Math.hypot(q.x-p.x,q.y-p.y);},0)-1,`${label}: the house covers part of the attached deck's outline`);
  else ok(contact.contacts.length===0,`${label}: a freestanding deck meets no house wall, so every edge is skirted`);
}
{
  // The deck's back line past a narrow house is skirted; the stretch against the house is not.
  const d=base({...houses[1][1],stairFlights:0,height:48,skirting:skirt()}),plan=planOf(d),back=plan.edges.find(e=>e.id==='deck1-back');
  ok(back&&near(back.lengthFt,10,.01),'Past a narrow house, the 10 ft of back line beyond it is skirted');
}

// 3. Openings: a stair's width plus 1 in each side is left open, on every stair type; landings are skirted round
//    their openings and winders never are.
{
  const none=planOf(base({height:48,stairFlights:0,skirting:skirt()}));
  for(const [stairPosition,stairOffset] of [['Front',50],['Front',0],['Left',30],['Right',100]] as const)for(const stairWidth of [36,48,60]){
    const d=base({height:48,stairPosition,stairOffset,stairWidth,skirting:skirt()}),plan=planOf(d);
    // Against a corner (0% or 100%) the 1 in on that side falls past the edge's end.
    const open=stairWidth+(stairOffset%100===0?1:2);
    ok(near(inches(none.runs)-inches(plan.runs),open,.05),`A ${stairWidth} in stair on the ${stairPosition.toLowerCase()} (${stairOffset}%) leaves ${open} in open`);
  }
  const two=planOf(base({height:48,stairFlights:2,stairPosition:'Left',skirting:skirt()}));
  ok(near(inches(none.runs)-inches(two.runs),2*50,.05),'Two stair flights each leave their width plus 2 in open');
  const landing=base({height:96,stairType:'Landing',skirting:skirt()}),lm=buildDeckTakeoff(landing),lp=skirtingPlan(landing,lm)!,li=lm.levels.findIndex(l=>l.kind==='landing');
  const landingRuns=runsOn(lp,li),landingPerimeter=2*(lm.levels[li].footprint.bounds.w+lm.levels[li].footprint.bounds.h);
  ok(li>0&&near(inches(landingRuns),landingPerimeter-2*48,.05)&&landingRuns.every(r=>r.edge.startsWith('landing1-')),'A stair landing is skirted round its arrival and departure openings');
  ok(near(inches(runsOn(lp,0)),inches(none.runs)-50,.05),'The deck above a landing stair loses only the stair opening');
  const winder=base({height:96,stairType:'Winder',skirting:skirt()}),wm=buildDeckTakeoff(winder),wp=skirtingPlan(winder,wm)!;
  ok(wm.levels.some(l=>l.kind==='winder')&&wp.runs.every(r=>wm.levels[r.level].kind!=='winder')&&!wp.edges.some(e=>/winder/i.test(e.label)),'Winder treads are never skirted');
  // Even a winder given a rim (none has one today) is left to the stair.
  const rimmed={...wm,levels:wm.levels.map(l=>{if(l.kind!=='winder')return l;const copy={...l,blocking:[...l.blocking]};addRim(copy);return copy;})};
  ok(rimmed.levels.some(l=>l.kind==='winder'&&(l.rim?.length??0)>0)&&skirtingPlan(winder,rimmed)!.runs.every(r=>rimmed.levels[r.level].kind!=='winder'),'A winder is skipped by kind, not only because it has no rim');
}

// 4. Inside edges: where two levels meet the space under the deck carries on; a level connection opens both edges.
{
  // Same height, joined along the main deck's front: nothing where they meet, no flight between them.
  const d=base({height:48,stairFlights:0,levels:2,height2:48,width2:8,length2:6,level2Position:'Front',skirting:skirt()}),model=buildDeckTakeoff(d),plan=skirtingPlan(d,model)!;
  const second=model.levels.findIndex(l=>l.kind==='deck'&&l.index===1);
  ok(near(plan.edges.find(e=>e.id==='deck1-front')!.lengthFt,16-8,.01)&&!plan.edges.some(e=>e.id==='deck2-back'),'Where the second level meets the main deck, neither edge is skirted');
  ok(near(inches(runsOn(plan,second)),(8+6+6)*12,.05),'The second level is skirted on its three open sides');
  // A step down with a flight between: each edge loses the flight's width plus 2 in.
  const s=base({height:48,stairFlights:0,levels:2,height2:24,width2:8,length2:6,level2Position:'Front',skirting:skirt()}),sm=buildDeckTakeoff(s),sp=skirtingPlan(s,sm)!;
  ok(near(sp.edges.find(e=>e.id==='deck1-front')!.lengthFt*12,16*12-50,.05)&&near(sp.edges.find(e=>e.id==='deck2-back')!.lengthFt*12,8*12-50,.05),'A level connection leaves its width plus 2 in open on both levels');
  // No run of one level overlaps another level's run, or sits inside another level.
  for(const dd of [d,s,validateDesign(base({levels:3,height:60,height2:48,skirting:skirt()})),base({levels:2,height:48,height2:40,level2FullStep:true,level2Position:'Left',skirting:skirt()})]){
    const m=buildDeckTakeoff(dd),p=skirtingPlan(dd,m)!;
    const clash=p.runs.some(r=>p.runs.some(q=>q.level!==r.level&&along(r,{a:q.a,b:q.b,lengthIn:q.lengthIn})>.5));
    ok(!clash,`${dd.levels} levels${dd.level2FullStep?', a full-width step':''}: no two levels are skirted along the same line`);
  }
}

// 5. The ground: the face runs from the rim's underside to the ground plus the clearance, following a slope; a
//    stretch with too little face is left open and says so.
{
  const slopePct=10,d=base({deckType:'Freestanding',stairFlights:0,height:60,terrainConfig:{widthFt:80,depthFt:80,elevationIn:4,slopePct},skirting:skirt({clearanceIn:3})});
  const model=buildDeckTakeoff(d),plan=skirtingPlan(d,model)!,ground=(y:number)=>4+y*slopePct/100;
  const rim=model.levels[0].rim![0],top=rim.a.y-rim.depth/2;
  ok(plan.runs.every(r=>near(r.top,top,.001)&&near(r.bottomA,ground(r.a.y)+3,.001)&&near(r.bottomB,ground(r.b.y)+3,.001)),'Each run hangs from the rim\'s underside to the ground plus the clearance at both ends');
  ok(plan.runs.some(r=>Math.abs(r.bottomA-r.bottomB)>5),'On a slope, the side runs follow the ground');
  ok(near(plan.faceSqft,plan.runs.reduce((n,r)=>n+r.lengthIn*(2*r.top-r.bottomA-r.bottomB)/2/144,0),.001),'The face area is each run\'s trapezoid');
  ok(plan.faces.every(f=>{const r=plan.runs.find(r=>Math.min(r.bottomA,r.bottomB)-.01<=Math.min(f.bottomA,f.bottomB)&&Math.max(f.topA,f.topB)<=r.top+.01);return !!r;}),'No face piece reaches below the ground line or above the rim');
  ok(price(d).flags.some(f=>f.includes('on this sloped yard the skirting follows the ground')),'The drainage note mentions the slope');
  // Ground rising into the framing: the buried stretch is left open, with a note.
  const steep=base({deckType:'Freestanding',stairFlights:0,height:30,terrainConfig:{widthFt:80,depthFt:80,elevationIn:0,slopePct:25},skirting:skirt()}),sp=planOf(steep);
  ok(sp.runs.length>0&&sp.runs.every(r=>r.top-Math.max(r.bottomA,r.bottomB)>=3-1e-6)&&!sp.edges.some(e=>e.id==='deck1-front'),'Where the ground rises into the framing, only the stretches with at least 3 in of face are skirted');
  ok(sp.notes.some(n=>/too close to the ground for skirting/.test(n)),'The buried stretch is named in a note');
  const low=planOf(base({deckType:'Floating',height:12,skirting:skirt()}));
  ok(low.runs.length===0&&low.notes.some(n=>n.includes('no deck edge has room'))&&!section(price(base({deckType:'Floating',height:12,skirting:skirt()}))),'A deck too low for any skirting lists nothing and says why');
  const higher=planOf(base({height:48,stairFlights:0,skirting:skirt({clearanceIn:6})})),lower=planOf(base({height:48,stairFlights:0,skirting:skirt({clearanceIn:1})}));
  ok(near(lower.faceSqft-higher.faceSqft,lower.lengthFt*5/12,.01),'More clearance takes the face up by exactly that much');
}

// 6. Styles: boards on studs at 16 in, boards on rails no more than 24 in apart, lattice in 4 ft panels; access panels.
{
  const style=(s:SkirtingConfig['style'])=>planOf(base({height:72,stairFlights:0,skirting:skirt({style:s,accessPanels:0})}));
  const h=style('Horizontal boards'),v=style('Vertical boards'),l=style('Lattice');
  ok(near(h.faceSqft,v.faceSqft,1e-6)&&near(h.faceSqft,l.faceSqft,1e-6)&&near(h.lengthFt,l.lengthFt,1e-6),'Every style covers the same face');
  const studs=(p:SkirtingPlan)=>p.backing.filter(s=>s.thick===3.5),rails=(p:SkirtingPlan)=>p.backing.filter(s=>s.thick===1.5);
  for(const [p,spacing] of [[h,16],[v,48],[l,24]] as const){
    // Stud centres along each run, from its own start.
    const byRun=p.runs.map(r=>{const ux=(r.b.x-r.a.x)/r.lengthIn,uy=(r.b.y-r.a.y)/r.lengthIn;return studs(p).filter(s=>Math.abs((s.a.x-r.a.x)*uy-(s.a.y-r.a.y)*ux)<3&&(s.a.x-r.a.x)*ux+(s.a.y-r.a.y)*uy>-.01&&(s.a.x-r.a.x)*ux+(s.a.y-r.a.y)*uy<r.lengthIn+.01).map(s=>(s.a.x+s.b.x-2*r.a.x)/2*ux+(s.a.y+s.b.y-2*r.a.y)/2*uy).sort((a,b)=>a-b);});
    ok(byRun.every((c,i)=>c.length>=2&&near(c[0],.75,.01)&&near(c.at(-1)!,p.runs[i].lengthIn-.75,.01)&&c.slice(1).every((x,k)=>x-c[k]<=spacing+.01)),`${p.style}: studs at each end of every run and no more than ${spacing} in apart`);
  }
  for(const [p,gap] of [[v,24],[l,48]] as const){
    // Level ground: rail tops from the nailer down, and the bottom rail's top; each clear gap is at most `gap`.
    const ys=[...new Set(rails(p).map(r=>Math.round(r.topA*1e4)/1e4))].sort((a,b)=>b-a);
    ok(ys.length>=3&&ys.slice(1).every((y,i)=>ys[i]-3.5-y<=gap+.01),`${p.style}: rails no more than ${gap} in apart, top to bottom (${ys.length} rail levels)`);
  }
  ok(h.faces.every(f=>near(f.topA-f.bottomA,5.5,.001)||f.topA-f.bottomA<5.5)&&v.faces.every(f=>near(Math.hypot(f.b.x-f.a.x,f.b.y-f.a.y),5.5,.001)||Math.hypot(f.b.x-f.a.x,f.b.y-f.a.y)<5.5),'Board styles are laid in deck-board widths (the last row or board ripped)');
  ok(l.faces.every(f=>f.topA-f.bottomA<=48+1e-6&&Math.hypot(f.b.x-f.a.x,f.b.y-f.a.y)<=96+1e-6)&&l.latticePanels>=Math.ceil(l.faceSqft/32),'Lattice is cut from 4 × 8 ft panels, enough of them to cover the face');
  ok(l.notes.some(n=>n.includes('two panels high'))&&!h.notes.some(n=>n.includes('panels high')),'Lattice over 4 ft is stacked, and says so');
  // Access panels: framed on the longest runs, 4 trim pieces each; one that cannot fit is not placed and says so.
  const two=planOf(base({height:48,stairFlights:0,skirting:skirt({accessPanels:2})}));
  ok(two.accessPanels.placed===2&&two.frames.length===8&&two.accessPanels.heightsIn.every(x=>x>=12&&x<=30),'Two access panels are framed in, each 30 in wide and 12 to 30 in tall');
  const many=planOf(base({width:8,length:6,height:48,stairFlights:0,skirting:skirt({accessPanels:6})}));
  ok(many.accessPanels.placed<6&&many.notes.some(n=>n.includes('6 asked for')),'More panels than the runs can take: the rest are left out, with a note');
  const short=planOf(base({height:24,stairFlights:0,skirting:skirt({accessPanels:1})}));
  ok(short.runs.length>0&&short.accessPanels.placed===0&&short.notes.some(n=>n.includes('no access panel fits')),'A face too short for an access panel gets none and a note');
  ok(planOf(base({height:48,skirting:skirt({accessPanels:0})})).notes.some(n=>n.includes('One is recommended')),'No access panel asked for: a note recommends one');
}

// 7. Pricing: a "Deck skirting" section that is a quote, every row cost null, never $0; the priced total is unchanged.
{
  for(const [label,d] of [['boards with a panel',base({height:48,skirting:skirt()})],['lattice, no panel',base({height:60,skirting:skirt({style:'Lattice',accessPanels:0})})],['vertical boards on two levels',base({levels:2,height:48,height2:24,skirting:skirt({style:'Vertical boards',accessPanels:3})})]] as const){
    const e=price(d),s=section(e)!;
    ok(s&&s.quoteRequired===true&&s.total===0,`${label}: the skirting section is a quote with no priced total`);
    ok(s.items.length>=3&&s.items.every(i=>i.cost===null&&i.unitPrice===undefined&&Number(i.qty)>0),`${label}: every skirting row is cost null with a real quantity (never $0)`);
    ok(['Skirting face','Skirting backing','Skirting labour'].every(n=>s.items.some(i=>i.name===n))&&s.items.some(i=>i.name==='Skirting access panels')===(d.skirting!.accessPanels!>0),`${label}: face, backing and labour rows, and access panels only when there are some`);
    const p=skirtingPlan(d,e.model)!;
    ok(near(Number(s.items.find(i=>i.name==='Skirting face')!.qty),Math.round(p.faceSqft*10)/10,1e-9)&&near(Number(s.items.find(i=>i.name==='Skirting backing')!.qty),Math.round(p.backingLf*10)/10,1e-9),`${label}: the rows carry the plan's face area and backing length`);
    ok(e.quoteRequired.includes('Deck skirting (builder quote)')&&describeDesign(d,e).priceLabel==='Priced portion only','The skirting quote is listed, and the price reads as the priced portion only');
    ok(e.materialList.filter(i=>/^Skirting/.test(i.item)).every(i=>i.cost===null),`${label}: the material list carries the skirting rows as quotes`);
    ok(!e.sections.flatMap(x=>x.items).some(i=>/kirting/.test(i.name)&&i.cost===0),`${label}: no skirting line anywhere is priced at $0`);
  }
  const custom=base({height:48,skirting:skirt(),customOverrides:{'Skirting face':{cost:500}}});
  ok(section(price(custom))!.items.every(i=>i.cost===null),'A contractor override cannot turn a skirting quote into a price');
  ok(unconfirmedRates().some(r=>r.id==='skirting'&&r.status==='owner-decision'),'The rate register lists skirting as an owner decision');
}

// 8. Colour: the deck's own, or another real colour of its kind; anything else falls back to the deck colour.
{
  ok(planOf(base({height:48,skirting:skirt()})).colour===colourRef('tt_prime_plus','Coconut Husk'),'No colour: the deck\'s own');
  ok(planOf(base({height:48,skirting:skirt({colour:COCOA})})).colour===COCOA,'Another colour of the deck\'s collection is used');
  const reserve=colourRef('tt_reserve','Antique Leather');ok(planOf(base({height:48,skirting:skirt({colour:reserve})})).colour===reserve,'A priced composite collection is allowed on a composite deck');
  const cedar=planOf(base({height:48,deckingMaterial:'cedar',deckingColor:'Western Red Cedar',skirting:skirt({colour:COCOA})}));
  ok(cedar.colour===colourRef('cedar','Western Red Cedar')&&cedar.notes.some(n=>n.includes('does not suit this decking')),'A composite colour on a cedar deck falls back to the deck colour, with a note');
}

// 9. Open sides: named by level and side, left out when chosen, listed in the editor either way.
{
  const all=planOf(base({height:48,skirting:skirt()})),left=planOf(base({height:48,skirting:skirt({openEdges:['deck1-left','deck3-front']})}));
  const leftEdge=left.edges.find(e=>e.id==='deck1-left');
  ok(leftEdge?.open&&near(leftEdge.lengthFt,12,.01)&&!left.runs.some(r=>r.edge==='deck1-left')&&near(all.lengthFt-left.lengthFt,12,.01),'An open side is left out, and still listed as open');
  ok(!left.edges.some(e=>e.id==='deck3-front')&&left.notes.some(n=>n.includes('left open by choice: main deck, left side')),'A side the design no longer has matches nothing; the chosen one is noted');
  ok(all.edges.map(e=>e.id).sort().join()==='deck1-front,deck1-left,deck1-right','An attached deck lists its three open sides, never the one against the house');
  // Every side the editor can offer is one a saved design accepts, so turning sides off never breaks autosave.
  for(const d of [base({height:96,stairType:'Landing',stairFlights:3,skirting:skirt()}),validateDesign(base({levels:3,height:72,height2:48,skirting:skirt()})),base({width:22,length:12,wrap:{left:{widthFt:8,runFt:10},right:{widthFt:10,runFt:12}},skirting:skirt()}),base({deckType:'Freestanding',levels:2,height:130,height2:12,stairType:'Landing',skirting:skirt()})]){
    const ids=planOf(d).edges.map(e=>e.id),saved=validateDesign({...d,skirting:skirt({openEdges:ids})});
    ok(ids.length>0&&ids.every(id=>SKIRTING_EDGE.test(id))&&saved.skirting?.openEdges?.length===ids.length&&planOf(saved).runs.length===0,`Every side offered (${ids.join(', ')}) saves, and turning them all off leaves nothing skirted`);
  }
  const every=planOf(base({height:48,skirting:skirt({openEdges:['deck1-left','deck1-right','deck1-front']})}));
  ok(every.runs.length===0&&every.notes.some(n=>n.includes('every side is left open')),'Every side open: nothing listed, and a note says so');
}

// 10. Saving: validated, compact, round-trips, and the editor's ranges are the loader's.
{
  const d=base({height:48,skirting:{style:'Lattice',colour:COCOA,clearanceIn:3.5,openEdges:['deck1-left','deck1-left'],accessPanels:2}}),back=parseDesign(serializeDesign(d));
  ok(JSON.stringify(back.skirting)===JSON.stringify({style:'Lattice',colour:COCOA,clearanceIn:3.5,openEdges:['deck1-left'],accessPanels:2}),'Skirting survives a round trip, each open side once');
  ok(JSON.stringify(validateDesign({...base(),skirting:{style:'Vertical boards',clearanceIn:2,openEdges:[],accessPanels:0}}).skirting)==='{"style":"Vertical boards","clearanceIn":2}','Empty open sides and no access panels are not saved');
  ok(serializeDesign(parseDesign(serializeDesign(d)))===serializeDesign(d),'A saved design with skirting saves byte for byte again');
  const [cmin,cmax]=SKIRTING_LIMITS.clearanceIn,[,pmax]=SKIRTING_LIMITS.accessPanels;
  for(const [label,bad] of [['an unknown style',{style:'Brick',clearanceIn:2}],['an unknown colour',{style:'Lattice',clearanceIn:2,colour:'nope:Red'}],['a colour not in its collection',{style:'Lattice',clearanceIn:2,colour:'tt_prime_plus:Red'}],
    ['a clearance under the range',{style:'Lattice',clearanceIn:cmin-.5}],['a clearance over the range',{style:'Lattice',clearanceIn:cmax+.5}],['no clearance',{style:'Lattice'}],
    ['half an access panel',{style:'Lattice',clearanceIn:2,accessPanels:1.5}],['too many access panels',{style:'Lattice',clearanceIn:2,accessPanels:pmax+1}],
    ['a bad side',{style:'Lattice',clearanceIn:2,openEdges:['deck1-Back']}],['a side on a fourth level',{style:'Lattice',clearanceIn:2,openEdges:['deck4-left']}],['too many sides',{style:'Lattice',clearanceIn:2,openEdges:Array.from({length:SKIRTING_LIMITS.openEdges+1},()=>'deck1-left')}],['not an object',[]]] as const)
    assert.throws(()=>validateDesign({...base(),skirting:bad}),undefined,`Rejects ${label}`),checks++;
  const editor=read('src/features/deckcraft/designer/SkirtingEditor.tsx');
  ok(/min=\{cmin\} max=\{cmax\}/.test(editor)&&/min=\{pmin\} max=\{pmax\}/.test(editor)&&editor.includes('Math.round(Math.min(pmax,Math.max(pmin,')&&editor.includes('Math.min(cmax,Math.max(cmin,')&&editor.includes('.slice(-SKIRTING_LIMITS.openEdges)'),'The editor clamps every input to the ranges a saved design accepts');
}

// 11. Outputs: the design facts, the funnel label, the sample request and the export parts.
{
  const d=base({height:48,skirting:skirt({colour:COCOA})}),e=price(d),facts=describeDesign(d,e);
  ok(facts.facts.some(f=>/^Skirting: horizontal boards in Dark Cocoa \(TimberTech EDGE Prime\+\), [\d.]+ ft on 3 sides, 2 in above the ground, 1 access panel$/.test(f))&&facts.summary.includes('Skirting: horizontal boards'),'The design facts and summary describe the skirting');
  ok(designFeatures(d).includes('deck_skirting'),'The funnel counts skirting');
  const fields:SendDesignFields={name:'A',email:'a@example.com',phone:'7053008015',address:'Barrie',notes:'',offers:false,botField:'',timeline:'',budget:'',samples:true};
  const sent=buildDeckDesignSubmission(fields,{data:d,estimate:e,summary:facts.summary,reviewItems:[],link:'https://goldenmaplelandscaping.ca/deck-designer#d',sentAt:new Date(0),consent:null});
  ok(sent.details.includes('Samples: please bring Coconut Husk and the skirting colour: Dark Cocoa (TimberTech EDGE Prime+)')&&sent.details.includes('Skirting: horizontal boards'),'A sent design names the skirting and asks for its colour sample');
  const same=base({height:48,skirting:skirt()});
  ok(buildDeckDesignSubmission(fields,{data:same,estimate:price(same),summary:'s',reviewItems:[],link:'https://goldenmaplelandscaping.ca/deck-designer#d',sentAt:new Date(0),consent:null}).details.includes('Samples: please bring a Coconut Husk sample'),'Skirting in the deck colour adds no sample');
  const meshes=deckExportMeshes(d,e.model),parts=meshes.filter(m=>m.name.startsWith('skirting_')),plan=skirtingPlan(d,e.model)!;
  ok(parts.filter(m=>m.name.startsWith('skirting_face_')).length===plan.faces.length&&parts.filter(m=>m.name.startsWith('skirting_backing_')).length===plan.backing.length&&parts.filter(m=>m.name.startsWith('skirting_access_panel_frame_')).length===plan.frames.length,'The export carries every face, backing and access-panel frame piece');
  const volume=(m:typeof parts[number])=>m.faces.reduce((sum,f)=>sum+f.slice(1,-1).reduce((s,_,i)=>{const a=m.vertices[f[0]],b=m.vertices[f[i+1]],c=m.vertices[f[i+2]];return s+(a.x*(b.y*c.z-b.z*c.y)+a.y*(b.z*c.x-b.x*c.z)+a.z*(b.x*c.y-b.y*c.x))/6;},0),0);
  ok(parts.every(m=>m.vertices.length===8&&m.faces.length===6&&m.vertices.every(v=>[v.x,v.y,v.z].every(Number.isFinite))&&volume(m)>0),'Every skirting part is a closed, outward-facing solid');
}

// 12. Wiring: the pure module, the house rule, the 3D views and the lazy editor.
{
  const lib=read('src/features/deckcraft/skirting.ts'),code=lib.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  ok(!/from ['"]three|@react-three/.test(lib),'skirting.ts does not import three.js');
  ok(!/\bBack\b/.test(lib),'skirting.ts never names a \'Back\' edge');
  ok(!/Math\.abs\(\s*[\w.]+\.[yz]\s*\)\s*[<>]/.test(code)&&!/\.[yz]\s*(===?|<=?|>=?)\s*(-?\d*\.?\d+|TOL)\b/.test(code)&&!/\b[yz]\s*(===?|<=?|>=?)\s*0\b/.test(code),'skirting.ts never looks for the house at y≈0');
  ok(code.includes('contact.onContact(')&&!/isContactEdge|exposedHouseLine|getHousePlacement|houseLine|getHouseWalls/.test(code),'skirting.ts leaves the house to houseContact.ts onContact');
  const viewer=read('src/features/deckcraft/components/viewer3d/Deck3DViewer.tsx'),s3d=read('src/features/deckcraft/components/viewer3d/Skirting3D.tsx');
  ok(viewer.includes('{data.skirting&&<Skirting3D data={data} model={model} finished={!structure&&!cutaway}')&&/finished\s*\?[\s\S]*?skirting-face[\s\S]*?:[\s\S]*?skirting-backing/.test(s3d),'The 3D view hides the skirting face in the framing and below-ground views and shows its backing there');
  const designer=designerSource(),bundle=read('scripts/check-deck-bundle.ts');
  ok(/lazy\(loadSkirtingEditor\)/.test(designer)&&/for\(const load of \[[^\]]*\bloadSkirtingEditor\b[^\]]*\]\)/.test(designer)&&bundle.includes('/^SkirtingEditor-/'),'The skirting editor loads on demand, preloaded after the page settles, never with the page');
  ok(/"check:deck":[^\n]*check-deck-skirting\.ts/.test(read('package.json')),'This check runs in check:deck');
}

console.log(`DECK SKIRTING OK — absent-means-nothing on ${plainDesigns.length} designs, the house rule on ${houses.length*2} houses and decks, openings, levels, slope, styles, access panels, quotes, colours, open sides, saving, outputs and wiring; ${checks} checks.`);
