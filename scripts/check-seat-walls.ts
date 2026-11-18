// S2 seat walls (freestanding walls) and the raised-patio proof the site designer builds on.
// Part 1: a freestanding wall is validated, modelled with no drainage, backfill or grid, stands on a patio's paving
// when drawn on one, keeps both faces in 3D (no retained bank) and prices honestly (never $0).
// Part 2: on the Craighurst survey, a patio at a fixed level standing more than 16 in above part of the measured
// ground, a retaining wall along those low edges from the ground to just under the paving, and stone steps down to
// grade, built with raisedPatioWallPath / raisedPatioWall (raisedPatio.ts).
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {loadAdvancedYardRuntime,buildYardModel,yardArea} from '../src/features/deckcraft/yardModel';
import type {YardModel,YardBox} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {wallConstructionProblem,wallConstructionPlan} from '../src/features/deckcraft/wallConstruction';
import {yardWallPath,yardFeatureOutline,yardPathEnvelope} from '../src/features/deckcraft/yardPathGeometry';
import {createSiteSurface,designSiteModel} from '../src/features/deckcraft/siteSurfaceEngine';
import {getTerrainConfig} from '../src/features/deckcraft/yardSettings';
import {insideRings} from '../src/features/deckcraft/patioGroundContact';
import {raisedPatioWallPath,raisedPatioWall,RAISED_PATIO_CAP_DROP_IN} from '../src/features/deckcraft/raisedPatio';
import {retainedBankGeometry} from '../src/features/deckcraft/components/viewer3d/finishedGrade';
import {yardFinishGeometry} from '../src/features/deckcraft/components/viewer3d/yardFinishGeometry';
import WallConstructionEditor from '../src/features/deckcraft/WallConstructionEditor';
import {arcGeometry} from '../src/features/deckcraft/circularArcs';

await loadAdvancedYardRuntime();
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},near=(a:number,b:number,m:string,tolerance=1e-6)=>ok(Math.abs(a-b)<=tolerance,`${m}: ${a} vs ${b}`);
const flat=(features:YardFeature[]):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:features});
const wall=(over:Partial<YardFeature>={}):YardFeature=>({id:'seat',kind:'retaining-wall',name:'Seat wall',enabled:true,xFt:0,zFt:40,widthFt:10,depthFt:1,heightIn:18,rotationDeg:0,productId:'segmental-concrete',color:'#aaa69b',...over});
const seat=(over:Partial<YardFeature>={})=>wall({wallConstruction:{freestanding:true},...over});
const of=(m:YardModel,id:string)=>m.features.find(f=>f.config.id===id)!;
/** A seat wall on one circular arc between two control points; its saved run is the exact arc length. */
const arcSeat=(chordIn:number,bulgeIn:number,over:Partial<YardFeature>)=>seat({wallPath:[{x:-chordIn/2,y:0},{x:chordIn/2,y:0}],curves:[{edge:0,bulgeIn}],widthFt:arcGeometry({x:-chordIn/2,y:0},{x:chordIn/2,y:0},bulgeIn).lengthIn/12,...over});
const roles=(m:YardModel,id:string)=>new Set(of(m,id).boxes.map(b=>b.role));
const across=(b:YardBox,z0:number)=>{const zs=b.polygon!.map(p=>p.y-z0);return [Math.min(...zs),Math.max(...zs)];};

// 1. Validation: walls only, a plain on/off flag; it survives a save and reload.
ok(wallConstructionProblem(seat())==='','A freestanding flag is a valid wall construction input');
ok(wallConstructionProblem(wall({wallConstruction:{freestanding:'yes' as unknown as boolean}}))==='Seat wall (freestanding) must be on or off.','A non-boolean flag is rejected');
ok(wallConstructionProblem({...seat(),kind:'patio'})==='Only walls support plain construction inputs.','Patios cannot carry the flag');
const saved=parseDesign(serializeDesign(flat([seat()])));
ok(saved.yardFeatures![0].wallConstruction?.freestanding===true,'The flag survives a save and reload');
assert.throws(()=>validateDesign({...flat([wall({wallConstruction:{freestanding:1 as unknown as boolean}})])}),/Seat wall/);checks++;

// 2. On ground (legacy flat yard): a base course and a buried course like any wall; no drainage, backfill or grid.
const freeModel=buildYardModel(flat([seat()])),retModel=buildYardModel(flat([wall()]));
const free=of(freeModel,'seat'),ret=of(retModel,'seat');
ok(!free.excluded&&!ret.excluded,'Both walls build');
for(const role of ['wall-drainage','backfill','geogrid'] as const){ok(!roles(freeModel,'seat').has(role),`No ${role} for a freestanding wall`);ok(roles(retModel,'seat').has(role),`The retaining wall keeps its ${role}`);}
ok(!freeModel.members.some(m=>m.featureId==='seat'),'No toe drain for a freestanding wall');
for(const key of ['drainageYd3','backfillYd3','geogridSqft','geogridOrderSqft','geogridPlanningOrderSqft','drainPipeLf','wallFilterFabricSqft','drainOutletCount','drainOutletElevationPending'])ok((free.quantities[key]??0)===0,`Freestanding ${key} is 0 (${free.quantities[key]})`);
ok(free.quantities.minDrainCollectionInvertIn===undefined,'No drain invert is reported');
ok(free.quantities.wallBaseYd3>0&&free.quantities.wallFreestanding===1&&free.quantities.wallCourses===ret.quantities.wallCourses,'Base course and the same buried courses as the retaining wall');
const base=free.boxes.filter(b=>b.role==='base'),body=free.boxes.filter(b=>b.role==='wall-block'),cap=free.boxes.filter(b=>b.role==='wall-cap');
ok(base.length>0&&base.every(b=>{const [lo,hi]=across(b,480);return Math.abs(lo+12)<1e-6&&Math.abs(hi-12)<1e-6;}),'The base course runs 6 in beyond both faces');
ok(body.every(b=>{const [lo,hi]=across(b,480);return Math.abs(lo+6)<1e-6&&Math.abs(hi-6)<1e-6;})&&cap.every(b=>{const [lo,hi]=across(b,480);return Math.abs(lo+7)<1e-6&&Math.abs(hi-7)<1e-6;}),'The cap overhangs both faces by an inch');
const regions=freeModel.formationRegions.filter(r=>r.featureId==='seat');
ok(regions.length>0&&regions.every(r=>Math.abs(r.bottomIn-Math.min(...base.map(b=>b.y-b.h/2)))<1e-6),'Only the base trench is dug, at the base bottom');
const fw=free.warnings.join(' ');
ok(/Freestanding seat wall\. Both faces exposed and finished, cap overhanging both sides/.test(fw)&&fw.includes('Seat height (16–24 in).'),`Seat-height note (${fw})`);
ok(!/Outlet elevation check|Grid allowance|Toe pipe|Proposed retained ground|retained ground/.test(fw),'No drainage, grid or retained-ground notes');
ok(!free.quoteRequired||ret.quoteRequired,'A seat wall adds no drain-outlet hold');
// Over 36 in: builder review / engineering.
const tall=of(buildYardModel(flat([seat({heightIn:40})])),'seat');
ok(tall.quantities.freestandingReviewPending===1&&tall.quoteRequired&&tall.warnings.some(w=>/over 36 in .*builder review and engineering/.test(w))&&!tall.warnings.some(w=>w.includes('Seat height')),'A 40 in freestanding wall needs builder review and engineering');
ok(buildYardTakeoff(flat([seat({heightIn:40})])).sections.some(s=>s.id==='wall-freestanding-review-seat'&&s.amountCents===null),'…and carries a quoted review row');

// 3. 3D: two exposed faces, the cap over both, and no retained bank in the finished view.
const normals=(b:YardBox)=>{const g=yardFinishGeometry(b),p=g.getAttribute('position'),index=g.index,out:THREE.Vector3[]=[],v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];const count=index?index.count:p.count;for(let t=0;t<count;t+=3){for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,index?index.getX(t+k):t+k);out.push(new THREE.Vector3().subVectors(v[1],v[0]).cross(new THREE.Vector3().subVectors(v[2],v[0])).normalize());}g.dispose();return out;};
const faces=normals(body[0]);ok(faces.some(n=>n.z>.9)&&faces.some(n=>n.z<-.9),'A seat-wall block has a face on each side');
const terrain=freeModel.terrain;
ok(retainedBankGeometry(free,terrain)===null,'No retained bank behind a freestanding wall');
const bank=retainedBankGeometry(ret,terrain);ok(bank!==null,'The same wall retaining keeps its illustrative bank');bank?.dispose();

// 4. On a patio: the wall stands on the paving; the paving is not cut; nothing is dug through the patio.
const terraceAt=(over:Partial<YardFeature>={}):YardFeature=>({id:'terrace',kind:'patio',name:'Fire pit terrace',enabled:true,xFt:0,zFt:40,widthFt:16,depthFt:14,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#9a8f80',finishedElevationIn:4,...over});
const arc=arcSeat(84,-30,{id:'arc',name:'Fire pit seat wall',zFt:42});
const alone=buildYardModel(flat([terraceAt()])),onPatio=buildYardModel(flat([terraceAt(),arc]));
const arcModel=of(onPatio,'arc'),patioTop=of(onPatio,'terrace').topIn,arcBody=arcModel.boxes.filter(b=>b.role==='wall-block');
ok(!arcModel.excluded&&!of(onPatio,'terrace').excluded,'The curved seat wall and its patio both build');
// Generic blocks are drawn .03 in short of their course (the bed joint); the course datum is the paving.
near(Math.min(...arcBody.map(b=>b.y-b.h/2)),patioTop+.03,'The first course sits on the paving',1e-6);
near(arcModel.topIn,patioTop+3*6+3,'Top rounds up to whole courses: 3 × 6 in + 3 in cap');
ok(!arcModel.boxes.some(b=>b.role==='base')&&!onPatio.formationRegions.some(r=>r.featureId==='arc'),'No base or dig of its own through the patio');
near(of(onPatio,'terrace').quantities.paverAreaSqft,of(alone,'terrace').quantities.paverAreaSqft,'The paving runs on under the seat wall');
ok(arcModel.warnings.some(w=>w.startsWith('Freestanding seat wall on Fire pit terrace: it stands on the paving, 3 whole courses and cap 21.0 in high.')),`On-patio note (${arcModel.warnings.join(' | ')})`);
ok(new Set(arcBody.map(b=>b.unitId)).size>3&&arcModel.quantities.wallLengthLf>7,'The arc is laid in blocks along its curve');
ok(retainedBankGeometry(arcModel,onPatio.terrain)===null,'No bank on the patio');
// Regression (review S, "on paving" decided from the centreline alone): a seat wall stands on the paving only when its
// whole base course lies on the patio. Straddling the patio's front edge (z 564 in), its centreline 1/4 in inside, it is
// built on the ground (base course, dig, burial) with a note; flush with that edge it still stands on the paving.
const straddle=seat({id:'edge',name:'Edge seat wall',zFt:(564-.25)/12}),flush=seat({id:'flush',name:'Flush seat wall',zFt:(564-6)/12});
const straddleModel=buildYardModel(flat([terraceAt(),straddle])),edgeWall=of(straddleModel,'edge');
ok(!edgeWall.excluded&&edgeWall.boxes.some(b=>b.role==='base')&&edgeWall.quantities.wallBaseYd3>0&&straddleModel.formationRegions.some(r=>r.featureId==='edge'),'Straddling the patio edge it is built on the ground: a base course and its own dig');
near(Math.min(...edgeWall.boxes.filter(b=>b.role==='wall-block').map(b=>b.y-b.h/2)),of(buildYardModel(flat([seat()])),'seat').boxes.filter(b=>b.role==='wall-block').reduce((n,b)=>Math.min(n,b.y-b.h/2),Infinity),'...its courses buried like the same wall on open ground');
ok(edgeWall.warnings.includes('Edge seat wall: it straddles the edge of Fire pit terrace, so it is built on the ground, with its own base course and burial, not on the paving. Move it wholly onto the patio to stand it on the paving.')&&!edgeWall.warnings.some(w=>/stands on the paving/.test(w)),`...with a note saying so (${edgeWall.warnings.find(w=>/seat wall/i.test(w))})`);
const flushWall=of(buildYardModel(flat([terraceAt(),flush])),'flush');
ok(!flushWall.boxes.some(b=>b.role==='base')&&flushWall.warnings.some(w=>w.startsWith('Freestanding seat wall on Fire pit terrace: it stands on the paving'))&&!flushWall.warnings.some(w=>/straddles/.test(w)),'Flush with the edge, its whole course on the patio, it stands on the paving');
ok(!of(buildYardModel(flat([terraceAt(),seat({id:'clear',zFt:60})])),'clear').warnings.some(w=>/straddles/.test(w)),'Clear of the patio: no straddle note');
// On the paving a finished level saved on the wall (from the ground under it) is ignored: it builds to its seat height.
for(const level of [-6,0,40]){
 const leveled=of(buildYardModel(flat([terraceAt(),{...arc,finishedElevationIn:level}])),'arc');
 near(leveled.topIn,patioTop+3*6+3,`A saved finished level of ${level} in is ignored on the paving: 3 × 6 in + 3 in cap over it`);
 ok(!leveled.quantities.freestandingReviewPending&&leveled.warnings.some(w=>w.startsWith('Freestanding seat wall on Fire pit terrace: it stands on the paving, 3 whole courses and cap 21.0 in high.')),`...a ${level} in level neither shortens nor raises it past 36 in`);
}

// 5. Pricing: same estimator wall basis, the second face quoted, never $0; catalogue walls stay quoted.
const freeTk=buildYardTakeoff(flat([seat()])),retTk=buildYardTakeoff(flat([wall()]));
ok(freeTk.knownSubtotalCents>0&&freeTk.knownSubtotalCents===retTk.knownSubtotalCents,`Seat wall priced at the estimator wall rate basis (${freeTk.knownSubtotalCents} vs ${retTk.knownSubtotalCents})`);
const second=freeTk.sections.find(s=>s.id==='wall-second-face-seat');
ok(second&&second.amountCents===null&&Math.abs(second.quantity!-free.quantities.wallFaceSqft)<1e-9&&/estimator wall rate per lf/.test(second.note??''),`Second face is a quoted line stating the basis (${second?.note})`);
ok(freeTk.quoteRequired&&freeTk.subtotalCents===null&&!freeTk.sections.some(s=>s.amountCents===0),'Quote required; no $0 line');
ok(!freeTk.sections.some(s=>/wall-(drainage|backfill|filter|drain|outlet|outlet-route|outlet-elevation|retained-grade)-seat$|^geogrid/.test(s.id)),'No drainage, grid or outlet rows');
const onPatioTk=buildYardTakeoff(flat([terraceAt(),arc]));ok(onPatioTk.sections.some(s=>s.id==='wall-second-face-arc'&&s.amountCents===null),'The on-patio seat wall carries its second-face quote');
ok(JSON.stringify(buildYardTakeoff(flat([terraceAt(),{...arc,finishedElevationIn:0}])).sections)===JSON.stringify(onPatioTk.sections),'On the paving, a saved finished level prices exactly as without it');
// The flag off is inert: a wall saved with freestanding:false prices and models exactly like one without it.
ok(JSON.stringify(buildYardTakeoff(flat([wall({wallConstruction:{freestanding:false}})])).sections)===JSON.stringify(retTk.sections),'freestanding:false prices byte-identically');
ok(JSON.stringify(of(buildYardModel(flat([wall({wallConstruction:{freestanding:false}})])),'seat').quantities)===JSON.stringify(ret.quantities),'…and models byte-identically');

// 6. Editor: the toggle is one change, drops the grid/drain inputs, and reverts to no inputs at all.
type El={type:unknown;props:Record<string,unknown>&{children?:unknown}};
const find=(node:unknown,test:(e:El)=>boolean):El|undefined=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){for(const n of node){const hit=find(n,test);if(hit)return hit;}return;}const e=node as El;if(e.props&&test(e))return e;return find(e.props?.children,test);};
const text=(node:unknown):string=>!node||typeof node==='boolean'?'':typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):text((node as El).props?.children);
let changed:YardFeature[]=[];
const view=(f:YardFeature)=>WallConstructionEditor({data:flat([f]),feature:f,onChange:next=>{changed.push(next);}});
const toggle=(f:YardFeature)=>find(view(f),e=>e.props['aria-label']==='Seat wall (freestanding)')!;
const off=wall({wallConstruction:{geogridLengthIn:60,drainOutletCount:2,foundationMode:'level'}});
ok(toggle(off).props.checked===false&&text(view(off)).includes('Seat wall (freestanding)'),'The toggle is shown, off');
(toggle(off).props.onChange as (e:{target:{checked:boolean}})=>void)({target:{checked:true}});
ok(changed.length===1&&JSON.stringify(changed[0].wallConstruction)==='{"foundationMode":"level","freestanding":true}','On: one change, grid/drain inputs dropped, the foundation layout kept');
const on=changed[0];changed=[];
ok(toggle(on).props.checked===true&&/16–24 in is seat height; over 36 in needs builder review and engineering/.test(text(view(on))),'On: its notes are shown');
ok(!find(view(on),e=>e.props['aria-label']==='Wall geogrid planning length')&&!find(view(on),e=>e.props['aria-label']==='Wall drain outlet count'),'On: no grid or drain fields');
(toggle(seat()).props.onChange as (e:{target:{checked:boolean}})=>void)({target:{checked:false}});
ok(changed.length===1&&!('wallConstruction' in changed[0]),'Off with nothing else recorded: the wall is as it was');
ok(String(find(view(on),e=>e.type==='label'&&e.props.className==='dd-check')?.props.className)==='dd-check','The toggle uses the 44 px dd-check control');

// 7. Raised patio on the Craighurst survey. Its 11 measured shots cover only the deck's front yard, so the survey is
// extended by 16 shots east and south of them, where the yard falls away; the terrace straddles both.
const FIXTURE=readFileSync(new URL('../e2e/fixtures/craighurst-ground-fit.json',import.meta.url),'utf8');
const fall=(x:number,z:number)=>11-.06*z-.09*Math.max(0,x-150)-.04*Math.max(0,z-110);
const shots=[[200,0],[260,0],[320,0],[200,60],[260,60],[320,60],[200,120],[260,120],[320,120],[200,180],[260,180],[320,180],[150,180],[90,190],[30,180],[-30,150]].map(([x,z],i)=>({id:`X${i+1}`,xIn:x,zIn:z,elevationIn:+fall(x,z).toFixed(2)}));
async function load(features:YardFeature[]){const doc=JSON.parse(FIXTURE);doc.configuration.siteModel.points.push(...shots);doc.configuration.yardFeatures.push(...features);await ensureLiveDesignExtensions(doc);return parseDesign(JSON.stringify(doc));}
const LEVEL=18,MIN=16;
const terrace:YardFeature={id:'terrace',kind:'patio',name:'Raised terrace',enabled:true,xFt:174/12,zFt:102/12,widthFt:9,depthFt:6,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#9a8f80',finishedElevationIn:LEVEL};
const bare=await load([terrace]),surface=createSiteSurface(designSiteModel(bare),getTerrainConfig(bare)),deck=buildDeckTakeoff(bare);
const groundRange=yardFeatureOutline(terrace).flat().map(p=>surface.sample(p.x,p.y,'proposed')!);
ok(LEVEL-Math.min(...groundRange)>MIN&&LEVEL-Math.max(...groundRange)<MIN,`The terrace stands more than ${MIN} in above part of the measured ground (${(LEVEL-Math.max(...groundRange)).toFixed(1)}–${(LEVEL-Math.min(...groundRange)).toFixed(1)} in)`);
const CONTACT=/^Raised terrace: its finished surface stands up to ([\d.]+) in above the measured ground at its ([a-z-]+) edge/;
const contact=(m:YardModel)=>m.warnings.map(w=>CONTACT.exec(w)).find(Boolean);
const before=contact(buildYardModel(bare,deck));ok(before&&+before[1]>MIN+5,`Without a wall its raised side shows (${before?.[0]})`);
const runs=raisedPatioWallPath(terrace,surface,MIN);
ok(runs.length===1&&runs[0].maxRiseIn>MIN+5&&runs[0].lengthIn>120,`One raised run (${runs.map(r=>`${r.lengthIn.toFixed(1)} in, up to ${r.maxRiseIn.toFixed(1)} in`).join('; ')})`);
const outline=yardFeatureOutline(terrace);
ok(runs[0].points.slice(1).every((b,i)=>{const a=runs[0].points[i],l=Math.hypot(b.x-a.x,b.y-a.y),mx=(a.x+b.x)/2,mz=(a.y+b.y)/2;return insideRings(outline,mx-(b.y-a.y)/l,mz+(b.x-a.x)/l)&&!insideRings(outline,mx+(b.y-a.y)/l,mz-(b.x-a.x)/l);}),'The run keeps the patio on its left (the retained side)');
for(const p of runs[0].points.slice(1,-1))ok(LEVEL-surface.sample(p.x,p.y,'proposed')!>MIN-1,'Run corners stand above the threshold');
const retaining=raisedPatioWall(terrace,runs[0],'terrace-wall',{surface});
near(retaining.finishedElevationIn!,LEVEL-RAISED_PATIO_CAP_DROP_IN,'The wall cap sits just under the paving');
// Stone steps down to grade on the terrace's south edge, west of the wall.
const footGround=surface.sample(131,174,'proposed')!,lower=Math.round(footGround*4)/4;
const steps:YardFeature={id:'terrace-steps',kind:'patio',name:'Terrace steps',enabled:true,xFt:131/12,zFt:156/12,widthFt:2.5,depthFt:3,heightIn:0,rotationDeg:180,productId:'permacon-melville',color:'#8d8a84',finishedElevationIn:LEVEL,stoneSteps:{lowerElevationIn:lower,riserCount:3,treadRunIn:12,stockWidthIn:30,stockDepthIn:12,stockThicknessIn:7,baseDepthIn:6,settingBedIn:1,jointIn:.125,productName:'Entered cut-stone step planning stock'}};
// And a seat wall round a fire pit on the terrace: it stands on the paving, clear of the retaining wall's cap.
const terraceSeat=arcSeat(60,14,{id:'terrace-seat',name:'Terrace seat wall',xFt:178/12,zFt:100/12});
const data=await load([terrace,retaining,steps,terraceSeat]),model=buildYardModel(data,buildDeckTakeoff(data));
for(const id of ['terrace','terrace-wall','terrace-steps','terrace-seat'])ok(!of(model,id).excluded,`${id} builds (${of(model,id).warnings.slice(0,2).join(' | ')})`);
const after=contact(model);
ok(!after||+after[1]<=MIN+.5,`No ground-contact warning for the walled side (${after?.[0]??'none'})`);
ok(!model.warnings.some(w=>w.startsWith('Raised terrace: the measured ground beside it')),'No dig-back warning either');
const rw=of(model,'terrace-wall'),q=rw.quantities,benches=[...new Set(rw.boxes.filter(b=>b.role==='base').map(b=>+(b.y+b.h/2).toFixed(6)))].sort((a,b)=>a-b);
near(rw.topIn,LEVEL-RAISED_PATIO_CAP_DROP_IN,'Wall top just under the paving');
// The course count follows the measured ground: the lowest measured front grade plus the minimum 6 in burial.
const wallPathWorld=yardWallPath(retaining),low=surface.extrema(yardPathEnvelope(wallPathWorld,12)).min;
ok(q.wallCourses===Math.ceil((rw.topIn-3-low+6)/6-1e-9),`Courses follow the measured ground (${q.wallCourses} for ground down to ${low.toFixed(1)} in)`);
ok(q.wallFoundationSteps>=1&&benches.length>=2&&benches.every(b=>Math.abs((b-benches[0])/6-Math.round((b-benches[0])/6))<1e-6),`Stepped foundation on whole courses (${benches.join(', ')})`);
ok(q.minWallBurialIn>=6-1e-6,`Every bench keeps the 6 in burial (${q.minWallBurialIn})`);
ok(wallConstructionPlan(retaining,0).foundationMode==='stepped'&&!rw.config.wallConstruction?.freestanding,'A retaining (not freestanding) wall');
const st=of(model,'terrace-steps').quantities;ok(st.stoneStepRisers===3&&st.buriedTreadAreaSqft===0&&Math.abs(st.stoneStepRiseIn*3-(LEVEL-lower))<1e-9,`Three equal risers down to grade (${st.stoneStepRiseIn.toFixed(2)} in)`);
const ts=of(model,'terrace-seat'),tsBody=ts.boxes.filter(b=>b.role==='wall-block');
near(Math.min(...tsBody.map(b=>b.y-b.h/2)),of(model,'terrace').topIn+.03,'The terrace seat wall stands on the raised paving');
ok(yardArea(of(model,'terrace').footprints)>53.5,'The terrace paving is whole under the seat wall and beside the wall cap');
// A seat wall on the measured slope (on ground): stepped benches on whole courses, a base course, nothing retained.
const slopeSeat=seat({id:'slope-seat',name:'Slope seat wall',xFt:285/12,zFt:40/12,widthFt:5}),slopeData=await load([slopeSeat]),slope=of(buildYardModel(slopeData,buildDeckTakeoff(slopeData)),'slope-seat');
const slopeBenches=[...new Set(slope.boxes.filter(b=>b.role==='base').map(b=>+(b.y+b.h/2).toFixed(6)))];
ok(!slope.excluded&&slope.quantities.wallFoundationSteps>=1&&slopeBenches.length>=2&&slope.quantities.minWallBurialIn>=6-1e-6,`On a slope the seat wall steps its foundation (${slopeBenches.join(', ')}; ${slope.warnings.slice(0,1).join('')})`);
ok(!slope.boxes.some(b=>['wall-drainage','backfill','geogrid'].includes(b.role))&&!slope.warnings.some(w=>/retained ground|Toe pipe|Grid allowance/.test(w)),'…with nothing retained');
const tk=buildYardTakeoff(data,model),quotes=tk.sections.filter(s=>s.amountCents===null);
ok(tk.knownSubtotalCents>0&&tk.quoteRequired&&!tk.sections.some(s=>s.amountCents===0),`Priced with a known part and quoted lines (${(tk.knownSubtotalCents/100).toFixed(2)})`);
for(const id of ['wall-design-terrace-wall','wall-paving-terrace-wall','wall-second-face-terrace-seat'])ok(tk.sections.some(s=>s.id===id&&s.amountCents===null),`Quote line ${id}`);
ok(tk.sections.some(s=>s.id.startsWith('stone-stairs-terrace-steps')),'Quote lines for the stone steps');
// The terrace stands more than 600 mm over the ground beside its walled side: a guard (OBC 9.8.8.1) is a quoted row.
const terraceGuard=of(model,'terrace').guard,guardRow=tk.sections.find(s=>s.id==='yard-patio-guard');
ok(terraceGuard&&terraceGuard.dropIn>23.6&&guardRow&&guardRow.amountCents===null&&guardRow.quantity===terraceGuard.lf&&guardRow.unit==='lf'&&guardRow.featureIds?.join()==='terrace',`The raised terrace needs a guard: ${terraceGuard?.lf} ft along its ${terraceGuard?.edges.join(', ')} edge, up to ${terraceGuard?.dropIn} in`);
console.log(`Raised terrace quote lines (${quotes.length}):\n${quotes.map(s=>`  - ${s.label}${s.quantity!==undefined?` — ${+s.quantity.toFixed(2)} ${s.unit??''}`:''}`).join('\n')}`);
console.log(`check-seat-walls: ${checks} checks passed`);
