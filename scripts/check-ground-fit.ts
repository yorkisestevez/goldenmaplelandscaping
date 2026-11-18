import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import type {SiteModel,SiteBoundaryPoint} from '../src/features/deckcraft/siteModel';
import {createSiteSurface,designSiteModel,siteSurfaceSnapshot,siteArea,siteClip,siteGroundProfile} from '../src/features/deckcraft/siteSurfaceEngine';
import {validateSiteModel,siteModelProblem} from '../src/features/deckcraft/siteModel';
import {validateDerivedSiteModel} from '../src/features/deckcraft/siteModelRuntime';
import type {SiteSurface,SiteSurfaceTriangle} from '../src/features/deckcraft/siteSurfaceEngine';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {GROUND_FIT_LIMITS} from '../src/features/deckcraft/types';
import {loadAdvancedYardRuntime,buildYardModel} from '../src/features/deckcraft/yardModel';
import {newYardFeature} from '../src/features/deckcraft/yardSettings';
import {yardFeatureOutline} from '../src/features/deckcraft/yardPathGeometry';
import {patioTopPlane} from '../src/features/deckcraft/yardElevationGeometry';
import {patioEdgeSpans,patioGroundGaps,insideRings} from '../src/features/deckcraft/patioGroundContact';
import {HARDSCAPE_PRODUCTS} from '../src/features/deckcraft/hardscapeCatalogue';
import {validateDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {newSkirting,skirtingPlan} from '../src/features/deckcraft/skirting';

/** G2 ground fit: the proposed ground round a fitted patio is graded to its edge and daylights at k:1 (siteFeatureGrading.ts). */
await loadAdvancedYardRuntime();
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},near=(a:number,b:number,m:string,tolerance=1e-7)=>ok(Math.abs(a-b)<=tolerance,`${m}: ${a} vs ${b}`);
const terrain={widthFt:100,depthFt:100,elevationIn:0,slopePct:0};
const ground=(x:number,z:number)=>z*.1;
const plane:SiteModel=({version:1,points:[[0,0],[480,0],[480,480],[0,480],[120,200],[300,150],[250,350],[400,300],[60,420]].map(([x,z],i)=>({id:`p${i}`,xIn:x,zIn:z,elevationIn:ground(x,z)})),grading:[]});
const patio=(id:string,over:Partial<YardFeature>={}):YardFeature=>({id,kind:'patio',name:id,enabled:true,xFt:20,zFt:20,widthFt:10,depthFt:6,heightIn:0,rotationDeg:0,finishedElevationIn:24,productId:'permacon-melville',color:'#aaa',groundFit:{slopeRatio:3},...over});
const design=(site:SiteModel,features:YardFeature[]):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,siteModel:site,yardFeatures:features,terrainConfig:terrain});
const surfaceOf=(data:DeckData)=>createSiteSurface(designSiteModel(data),terrain);
const distance=(rings:SiteBoundaryPoint[][],x:number,z:number)=>Math.min(...rings.flatMap(r=>r.map((a,i)=>{const b=r[(i+1)%r.length],dx=b.x-a.x,dz=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.y)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a.x-dx*t,z-a.y-dz*t);})));
const padTriangles=(s:SiteSurface,id?:string)=>s.proposedTriangles.filter(t=>id?t.gradingId===`pad:${id}`:t.gradingId?.startsWith('pad:'));
/** The largest height difference between faces meeting at a point, read at points on every bank face edge (on the edge
 * itself, against every face whose closed triangle holds it); the patio's own edge, where the bank meets the untouched
 * ground under the paving, is left out. */
function worstStep(s:SiteSurface,rings:SiteBoundaryPoint[][]){
 const C=12,cells=new Map<string,SiteSurfaceTriangle[]>();for(const t of s.proposedTriangles){const xs=t.vertices.map(v=>v.xIn),zs=t.vertices.map(v=>v.zIn);for(let x=Math.floor(Math.min(...xs)/C);x<=Math.floor(Math.max(...xs)/C);x++)for(let z=Math.floor(Math.min(...zs)/C);z<=Math.floor(Math.max(...zs)/C);z++){const k=x+','+z,l=cells.get(k);if(l)l.push(t);else cells.set(k,[t]);}}
 let worst=0;for(const t of padTriangles(s))for(let i=0;i<3;i++){const a=t.vertices[i],b=t.vertices[(i+1)%3];for(const f of [.13,.5,.87]){const x=a.xIn+(b.xIn-a.xIn)*f,z=a.zIn+(b.zIn-a.zIn)*f;if(distance(rings,x,z)<1e-6)continue;const hs:number[]=[];
  for(const u of cells.get(Math.floor(x/C)+','+Math.floor(z/C))??[]){const [p,q,r]=u.vertices,d=(q.xIn-p.xIn)*(r.zIn-p.zIn)-(r.xIn-p.xIn)*(q.zIn-p.zIn);if(Math.abs(d)<1e-12)continue;const l1=((q.xIn-x)*(r.zIn-z)-(r.xIn-x)*(q.zIn-z))/d,l2=((r.xIn-x)*(p.zIn-z)-(p.xIn-x)*(r.zIn-z))/d;if(Math.min(l1,l2,1-l1-l2)<-1e-9)continue;hs.push(u.plane.x*x+u.plane.z*z+u.plane.constant);}
  worst=Math.max(worst,Math.max(...hs)-Math.min(...hs));}}
 return worst;
}
const planArea=(s:SiteSurface,kind:'existingTriangles'|'proposedTriangles')=>s[kind].reduce((n,t)=>n+siteArea([t.vertices.map(v=>({x:v.xIn,y:v.zIn}))]),0);
/** (existing − proposed) on a 1 in grid of cell centres: [cut, fill] in yd³. */
function bruteForce(s:SiteSurface,x0:number,x1:number,z0:number,z1:number){let cut=0,fill=0;for(let x=Math.floor(x0)+.5;x<x1;x++)for(let z=Math.floor(z0)+.5;z<z1;z++){const e=s.sample(x,z,'existing'),p=s.sample(x,z,'proposed');if(e===undefined||p===undefined)continue;if(e>p)cut+=e-p;else fill+=p-e;}return [cut/46656,fill/46656];}
const within=(a:number,b:number,m:string)=>ok(Math.abs(a-b)<=Math.max(.002,Math.abs(b)*.02),`${m}: ${a.toFixed(5)} vs brute force ${b.toFixed(5)} yd³`);

// (a) Nothing fitted: the saved survey itself, and the surface it always had.
const plain=patio('plain',{groundFit:undefined}),unfitted=design(plane,[plain]);
ok(designSiteModel(unfitted)===plane,'No ground fit: the design model is the saved survey object');
ok(designSiteModel({siteModel:plane,yardFeatures:[]})===plane&&designSiteModel({siteModel:undefined,yardFeatures:[patio('x')]})===undefined,'Empty yard keeps the survey; no survey stays undefined');
ok(designSiteModel(design(plane,[patio('off',{enabled:false}),patio('free',{finishedElevationIn:undefined})]))===plane,'Disabled or unfixed patios derive no pad');
const before=surfaceOf(unfitted),fresh=createSiteSurface(structuredClone(plane),terrain);
ok(JSON.stringify(siteSurfaceSnapshot(before))===JSON.stringify(siteSurfaceSnapshot(fresh))&&!before.featurePadModels&&before.cutFill.bankCutYd3===undefined,'Unfitted surface is byte-identical to the survey alone');

// (b) Memo identity.
const fit=patio('fit'),fitted=design(plane,[fit]),model=designSiteModel(fitted)!;
ok(model!==plane&&model.featurePads?.length===1&&!plane.featurePads,'A fitted patio derives one pad without touching the saved survey');
ok(designSiteModel(fitted)===model&&designSiteModel({...fitted})===model,'Same survey and yard array: the same derived object');
ok(designSiteModel({...fitted,yardFeatures:[{...fit}]})===model,'An equal yard in a new array keeps the derived object (the surface cache survives unrelated edits)');
const moved=designSiteModel({...fitted,yardFeatures:[{...fit,xFt:21}]});ok(moved!==model&&moved!.featurePads![0].rings[0][0].x!==model.featurePads![0].rings[0][0].x,'A moved patio derives a new object');
ok(designSiteModel({...fitted,yardFeatures:[{...fit,groundFit:{slopeRatio:99}}]})!.featurePads![0].slopeRatio===GROUND_FIT_LIMITS.maxRatio,'Slope ratio is clamped to the limits');
ok(designSiteModel(design(plane,[fit,{...fit,groundFit:{slopeRatio:2},name:'dup'}]))!.featurePads!.length===1,'A repeated feature id derives one pad, from the first');
ok(createSiteSurface(model,terrain)===surfaceOf(fitted),'Surface is cached on the derived object');
ok(JSON.stringify(validateDerivedSiteModel(model).featurePads)===JSON.stringify(model.featurePads),'Derived pads pass the engine validator unchanged');
ok(!('featurePads' in validateSiteModel(model))&&!siteModelProblem({...model,featurePads:[{junk:1}]}),'Saved-design validation strips derived pads (never loaded or saved, harmless in an old file)');
const derivedProblem=(v:unknown)=>{try{validateDerivedSiteModel(v);return '';}catch(e){return (e as Error).message;}};
for(const bad of [{slopeRatio:1},{slopeRatio:Infinity},{name:''},{plane:{x:0,z:0}},{rings:[[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0}]]},{extra:1},{lowEdge:'wall'}])ok(derivedProblem({...model,featurePads:[{...model.featurePads![0],...bad}]}),`Invalid pad rejected (${Object.keys(bad)[0]})`);
ok(derivedProblem({...model,featurePads:[model.featurePads![0],model.featurePads![0]]}),'Duplicate pad rejected');

// (c) A level 10×6 ft patio at mid-slope on a 10% survey: cut bank uphill, fill bank downhill.
const s=surfaceOf(fitted),pad=s.featurePadModels![0],rings=yardFeatureOutline(fit),top=24;
ok(pad.status==='ready'&&!pad.warnings.length,`Pad ready (${pad.warnings.join(' ')})`);
const run=3.6/(1/3-.1);near(pad.runIn,run,'Bank runs out where a 3:1 bank meets 10% ground',1e-6);
const spans=patioEdgeSpans(rings,patioTopPlane(fit,0),(x,z)=>s.sample(x,z,'proposed'),{probeIn:.5});ok(spans.length>=4,'Patio edge spans');
ok(spans.every(sp=>[sp.a,sp.b].every(p=>p.ground!==undefined&&Math.abs(p.ground-p.top)<=.5/3+.01)),'Ground 0.5 in outside the edge is within 0.5/3 in of the top');
ok(rings[0].every(p=>Math.abs((s.sample(p.x+(p.x>240?.001:-.001),p.y+(p.y>240?.001:-.001))??NaN)-top)<.001),'Ground at each outside corner meets the top');
const steepest=Math.max(...s.existingTriangles.map(t=>Math.hypot(t.plane.x,t.plane.z))),faces=padTriangles(s,'fit');
ok(faces.length>0&&faces.every(t=>Math.hypot(t.plane.x,t.plane.z)<=Math.max(1/3,steepest)+1e-6),`Every bank face is no steeper than 3:1 or the ground (${faces.length} faces)`);
ok(faces.every(t=>t.vertices.every(v=>insideRings(rings,v.xIn,v.zIn)===false||distance(rings,v.xIn,v.zIn)<1e-6)),'Bank faces lie outside the patio');
let far=0,inside=0;for(let x=2;x<480;x+=7)for(let z=3;z<480;z+=7){const d=distance(rings,x,z),inRing=insideRings(rings,x,z);if(!inRing&&d>pad.runIn+12){far++;near(s.sample(x,z,'proposed')!,s.sample(x,z,'existing')!,'Beyond the bank the ground is untouched',1e-9);checks--;}if(inRing&&d>.01){inside++;near(s.sample(x,z,'proposed')!,before.sample(x,z,'proposed')!,'Inside the patio the ground is as before',1e-9);checks--;}}
ok(far>3000&&inside>100,`Untouched ground beyond the bank (${far} points) and inside the patio (${inside} points)`);
near(planArea(s,'proposedTriangles'),planArea(s,'existingTriangles'),'The banked surface still tiles the survey exactly once',1e-6);
const [bruteCut,bruteFill]=bruteForce(s,180-run-2,300+run+2,204-run-2,276+run+2);
ok(s.cutFill.bankCutYd3!>0&&s.cutFill.bankFillYd3!>0,'Cut bank uphill and fill bank downhill');
within(s.cutFill.bankCutYd3!,bruteCut,'Bank cut matches brute-force integration');within(s.cutFill.bankFillYd3!,bruteFill,'Bank fill matches brute-force integration');
near(s.cutFill.cutYd3,s.cutFill.bankCutYd3!,'Total cut includes the bank (nothing else graded)',1e-12);near(s.cutFill.fillYd3,s.cutFill.bankFillYd3!,'Total fill includes the bank',1e-12);
near(pad.cutYd3,s.cutFill.bankCutYd3!,'Pad model carries its cut',1e-12);near(pad.areaSqft,s.cutFill.bankAreaSqft!,'Pad model carries its area',1e-12);ok(s.cutFill.complete,'Ready bank keeps cut/fill complete');
// Uphill and downhill straight runs: the analytic wedge, 120 in long.
const wedge=.5*run*3.6*120/46656;ok(s.cutFill.bankCutYd3!>wedge&&s.cutFill.bankCutYd3!<wedge*1.6,'Cut is the uphill wedge plus its corners and sides');

// (d) Ratios and a sloped patio.
const runOf=(over:Partial<YardFeature>)=>{const f=patio('r',over),ss=surfaceOf(design(plane,[f]));return {ss,m:ss.featurePadModels![0],f};};
const r2=runOf({groundFit:{slopeRatio:2}}),r6=runOf({groundFit:{slopeRatio:6}});
near(r2.m.runIn,3.6/(.5-.1),'2:1 bank runs out sooner',1e-6);near(r6.m.runIn,3.6/(1/6-.1),'6:1 bank runs out later',1e-6);ok(r2.ss.cutFill.bankAreaSqft!<pad.areaSqft&&pad.areaSqft<r6.ss.cutFill.bankAreaSqft!,'Steeper banks are narrower');
const sloped=runOf({patioSlope:{xPct:4,zPct:5},rotationDeg:20}),sp=sloped.ss,sr=yardFeatureOutline(sloped.f),pp=patioTopPlane(sloped.f,0);
ok(sloped.m.status==='ready'&&sloped.m.areaSqft>0,'A sloped, rotated patio is fitted');
ok(patioEdgeSpans(sr,pp,(x,z)=>sp.sample(x,z),{probeIn:.5}).every(q=>[q.a,q.b].every(p=>Math.abs(p.ground!-p.top)<=.5/3+.01)),'Sloped patio: ground beside every edge meets its tilted top');
ok(padTriangles(sp).every(t=>t.vertices.every(v=>!insideRings(sr,v.xIn,v.zIn)||distance(sr,v.xIn,v.zIn)<1e-6)),'Sloped patio bank stays outside it');

// Concave and curved outlines: still exact, still 3:1, still meeting every edge.
for(const [label,over] of [['L-shaped',{outline:[{x:-60,y:-36},{x:60,y:-36},{x:60,y:0},{x:0,y:0},{x:0,y:36},{x:-60,y:36}]}],['round',{outline:[{x:-60,y:0},{x:60,y:0}],curves:[{edge:0,bulgeIn:60},{edge:1,bulgeIn:60}]}]] as [string,Partial<YardFeature>][]){
 const {ss,m,f}=runOf(over),rs=yardFeatureOutline(f),bank=padTriangles(ss);
 ok(m.status==='ready'&&bank.length>0&&bank.every(t=>Math.hypot(t.plane.x,t.plane.z)<=1/3+1e-6),`${label} patio: bank built, no face steeper than 3:1`);
 near(planArea(ss,'proposedTriangles'),planArea(ss,'existingTriangles'),`${label} patio: surface tiles the survey once`,1e-6);
 ok(patioEdgeSpans(rs,patioTopPlane(f,0),(x,z)=>ss.sample(x,z),{probeIn:.5}).every(q=>[q.a,q.b].every(p=>Math.abs(p.ground!-p.top)<=.5/3+.01)),`${label} patio: ground beside every edge meets the top`);
 ok(worstStep(ss,rs)<=1e-6,`${label} patio: the bank is continuous`);}
// Item 2: sloped concave patios once stepped where the nearest edge changed (1.8 in on the L, 2.4 in on the U); every
// field element covering a point now bounds it, so the bank is continuous.
const Lshape=[{x:-60,y:-36},{x:60,y:-36},{x:60,y:0},{x:0,y:0},{x:0,y:36},{x:-60,y:36}],Ushape=[{x:-90,y:-36},{x:90,y:-36},{x:90,y:36},{x:40,y:36},{x:40,y:0},{x:-40,y:0},{x:-40,y:36},{x:-90,y:36}];
for(const [label,over] of [['L patio sloped 5% in z, top 10 in',{outline:Lshape,patioSlope:{xPct:0,zPct:5},finishedElevationIn:10}],['U patio sloped 3% in x, top 10 in',{outline:Ushape,patioSlope:{xPct:3,zPct:0},finishedElevationIn:10}],['L patio sloped and turned',{outline:Lshape,patioSlope:{xPct:3,zPct:-4},rotationDeg:35,finishedElevationIn:12}]] as [string,Partial<YardFeature>][]){
 const {ss,m,f}=runOf(over),step=worstStep(ss,yardFeatureOutline(f));ok(m.status==='ready'&&padTriangles(ss).length>0&&step<=.01,`${label}: no step along the bank (worst ${step.toExponential(1)} in)`);
 near(planArea(ss,'proposedTriangles'),planArea(ss,'existingTriangles'),`${label}: surface tiles the survey once`,1e-6);}

// (e) Partly off the survey: built where measured, flagged partial.
const edge=surfaceOf(design(plane,[patio('edge',{xFt:34.5})])),em=edge.featurePadModels![0];
ok(em.status==='partial'&&em.warnings.some(w=>w.includes('runs past the measured ground'))&&!edge.cutFill.complete,'Bank past the survey edge: partial, warned, cut/fill incomplete');
ok(padTriangles(edge).length>0&&padTriangles(edge).every(t=>t.vertices.every(v=>v.xIn<=480+1e-9)),'Measured part of the bank is still built, and only there');
const outside=surfaceOf(design(plane,[patio('away',{xFt:60})])).featurePadModels![0];ok(outside.status==='pending'&&outside.areaSqft===0,'A patio off the survey is pending and grades nothing');
// Item 6: a patio only partly on the survey is left out of the yard model ('site-coverage'), so it gets no bank either.
const partlyData=design(plane,[patio('half',{xFt:39})]),partly=surfaceOf(partlyData),pm=partly.featurePadModels![0],partlyYard=buildYardModel(partlyData);
ok(pm.status==='pending'&&pm.areaSqft===0&&pm.cutYd3===0&&!padTriangles(partly).length&&pm.warnings.some(w=>w.includes('part of it stands outside the measured ground')),`A patio partly off the survey is pending, grades nothing and says why (${pm.warnings.join(' ')})`);
ok(partlyYard.features[0].exclusionReason==='site-coverage'&&!partlyYard.siteCutFill!.bankAreaSqft&&!partlyYard.siteCutFill!.bankCutYd3,'…the same patio the yard model leaves out: no bank cut, fill or restoration');
const cliff:SiteModel={...plane,points:plane.points.map(p=>({...p,elevationIn:p.zIn*.4}))},cliffData=design(cliff,[patio('steep',{finishedElevationIn:96,groundFit:{slopeRatio:10}})]),cliffSurface=surfaceOf(cliffData),steep=cliffSurface.featurePadModels![0];
ok(steep.status==='pending'&&steep.areaSqft===0&&!padTriangles(cliffSurface).length&&steep.warnings.some(w=>w.includes('does not meet a 10:1 bank within 20 ft; use a stone edge, a wall, or a steeper bank')),`A bank that cannot daylight within 20 ft is not built as a cliff: pending, no faces (${steep.warnings.join(' ')})`);
ok(!buildYardModel(cliffData).siteCutFill!.bankAreaSqft,'…and prices no bank restoration');
const steep3=surfaceOf(design(cliff,[patio('steep',{finishedElevationIn:96,groundFit:{slopeRatio:2}})])).featurePadModels![0];ok(steep3.status!=='pending'&&steep3.areaSqft>0,'The same patio with a 2:1 bank daylights and is built');

// (f) Two fitted patios side by side at different levels.
const pair=surfaceOf(design(plane,[patio('low',{xFt:14,finishedElevationIn:20}),patio('high',{xFt:25,finishedElevationIn:30})]));
ok(pair.featurePadModels!.length===2&&padTriangles(pair,'low').length>0&&padTriangles(pair,'high').length>0,'Both patios get banks');
near(planArea(pair,'proposedTriangles'),planArea(pair,'existingTriangles'),'Adjacent banks never overlap: the surface tiles the survey once',1e-6);
const pairRings=[...yardFeatureOutline(patio('low',{xFt:14})),...yardFeatureOutline(patio('high',{xFt:25}))];ok(padTriangles(pair).every(t=>t.vertices.every(v=>!insideRings(pairRings,v.xIn,v.zIn)||distance(pairRings,v.xIn,v.zIn)<1e-6)),'Neither bank enters either patio');

// (g) Craighurst: the measured landing that stood 8.8 in proud on one side and buried on the other.
const craighurst:SiteModel={version:1,points:Object.entries({P1:[156.416,0,10.58],P2:[0,0,0],P3:[-4.838,-9.421,-4.17],P4:[57.726,55.909,10.26],P5:[36.577,45.669,6.02],P6:[-.914,50.294,-1.58],P7:[-18.562,78.592,-7.37],P8:[8.725,131.744,-4.79],P9:[56.392,143.122,1.25],P10:[76.594,116.946,5.98],P11:[145.275,103.858,6.68]}).map(([id,[xIn,zIn,elevationIn]])=>({id,xIn,zIn,elevationIn})),grading:[]};
const base:DeckData={...structuredClone(DEFAULT_DECK),houseVisible:false,siteModel:craighurst};
const para=HARDSCAPE_PRODUCTS.find(p=>p.id==='techo-para-slab')!,paraFinish=para.finishes[0],{groundFit:_fit,...newPatio}=newYardFeature('patio',{...base,width:8,length:0});
const landing:YardFeature={...newPatio,id:'landing',name:'Landing',xFt:4,zFt:9.32,widthFt:5.5,depthFt:3.2,rotationDeg:0,heightIn:0,finishedElevationIn:5,productId:para.id,hardscape:{finishId:paraFinish.id,colorId:paraFinish.colors[0].id,unitId:paraFinish.units[0].id,patternId:'linear-laying-pattern-01-100-500x250',angleDeg:0,jointMm:0}};
const g1=(data:DeckData)=>buildYardModel(data).warnings.filter(w=>w.includes('measured ground beside it is up to')||w.includes('stands up to'));
const loose={...base,yardFeatures:[landing]},tight={...base,yardFeatures:[{...landing,groundFit:{slopeRatio:3}}]};
ok(g1(loose).length===2,`Unfitted landing: both G1 warnings fire (${g1(loose).length})`);
const t0=performance.now(),cs=surfaceOf(tight),craighurstMs=performance.now()-t0,yard=buildYardModel(tight),lf=yard.features.find(f=>f.config.id==='landing')!;
ok(!lf.excluded,'Fitted landing stays active');ok(g1(tight).length===0,`Fitted landing: neither G1 warning fires (${g1(tight).join(' | ')})`);
const thick=Math.max(...lf.boxes.filter(b=>b.role==='paver').map(b=>b.h)),gaps=patioGroundGaps(patioEdgeSpans(lf.footprints,lf.topPlane??{x:0,z:0,constant:lf.topIn},(x,z)=>cs.sample(x,z,'proposed'),{probeIn:.5}));
ok(gaps.aboveIn<=.2&&gaps.belowIn<=thick,`Craighurst edge gaps above ${gaps.aboveIn.toFixed(3)} in, below ${gaps.belowIn.toFixed(3)} in (paver ${thick.toFixed(2)} in)`);
const cm=cs.featurePadModels![0];ok(cm.areaSqft>0&&cs.cutFill.bankCutYd3!>0&&cs.cutFill.bankFillYd3!>0,'Craighurst landing gets both a cut and a fill bank');
ok(cm.status==='ready'||yard.warnings.some(w=>cm.warnings.includes(w)),'A partial Craighurst bank reports itself in the yard warnings');
near(yard.siteCutFill!.bankCutYd3!,cs.cutFill.bankCutYd3!,'Yard model carries the bank quantities',1e-12);
// Item 8: a stone low edge holds the raised side, so there is no fill bank; the cut bank is the same.
const stone:DeckData={...base,yardFeatures:[{...landing,groundFit:{slopeRatio:3,lowEdge:'stone'}}]},stoneSurface=surfaceOf(stone),before0=createSiteSurface(craighurst,terrain);
ok(designSiteModel(stone)!.featurePads![0].lowEdge==='stone','The derived pad carries the stone low edge');
ok(stoneSurface.cutFill.bankFillYd3===0,`Stone low edge: no fill bank (${stoneSurface.cutFill.bankFillYd3})`);
near(stoneSurface.cutFill.bankCutYd3!,cs.cutFill.bankCutYd3!,'Stone low edge: the cut bank is unchanged',1e-9);
const landingTop=patioTopPlane(landing,0);let lowSide=0;for(const r of yardFeatureOutline(landing))for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],l=Math.hypot(b.x-a.x,b.y-a.y),o={x:(b.y-a.y)/l,y:-(b.x-a.x)/l};for(const f of [.25,.5,.75])for(const d of [.5,2,6]){const x=a.x+(b.x-a.x)*f-o.x*d,z=a.y+(b.y-a.y)*f-o.y*d,w=insideRings([r],x,z)?{x:a.x+(b.x-a.x)*f+o.x*d,z:a.y+(b.y-a.y)*f+o.y*d}:{x,z},g=before0.sample(w.x,w.z);
 if(g!==undefined&&g<landingTop.x*w.x+landingTop.z*w.z+landingTop.constant-.01){lowSide++;near(stoneSurface.sample(w.x,w.z)!,g,'Below the stone-edged side the ground is left as it is',1e-9);checks--;}}}
ok(lowSide>0,`Stone low edge: the ground beside its raised side is left as measured (${lowSide} points)`);

// (h) Timing.
ok(craighurstMs<200,`Craighurst surface with pad in ${craighurstMs.toFixed(1)} ms`);
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const big:SiteModel={version:1,points:Array.from({length:2000},(_,i)=>{const x=rnd()*1200,z=rnd()*1200;return {id:`r${i}`,xIn:x,zIn:z,elevationIn:z*.08+x*.03+Math.sin(x/90)*6+Math.cos(z/70)*5};}),grading:[]};
const t1=performance.now(),bs=surfaceOf(design(big,[patio('big',{xFt:50,zFt:50,widthFt:30,depthFt:20,finishedElevationIn:60})])),bigMs=performance.now()-t1;
ok(bs.featurePadModels![0].areaSqft>0,'Random survey: bank built');ok(bigMs<2000,`2000-point survey with a 30×20 ft fitted patio in ${bigMs.toFixed(0)} ms`);
near(planArea(bs,'proposedTriangles'),planArea(bs,'existingTriangles'),'Random survey: the banked surface tiles the survey once',1e-5);
const bigSteep=Math.max(...bs.existingTriangles.map(t=>Math.hypot(t.plane.x,t.plane.z)));ok(padTriangles(bs).every(t=>Math.hypot(t.plane.x,t.plane.z)<=Math.max(1/3,bigSteep)+1e-6),'Random survey: no bank face steeper than 3:1 or the ground');

// (i) Item 1: a curved 30x30 ft patio of 24 alternating +-12 in arcs (528 outline points) on the 2000-point survey once
// gave 126,789 faces and a 15-20 s yard model at 3:1, and overflowed the stack at 10:1.
const N=24,R=180,star=Array.from({length:N},(_,i)=>({x:Math.cos(i/N*2*Math.PI)*R,y:Math.sin(i/N*2*Math.PI)*R})),wavy=(slopeRatio:number)=>design(big,[patio('wavy',{color:'#aaa69b',xFt:50,zFt:50,widthFt:30,depthFt:30,finishedElevationIn:60,outline:star,curves:star.map((_,i)=>({edge:i,bulgeIn:i%2?12:-12})),groundFit:{slopeRatio}})]);
const w3=wavy(3),wavyRings=yardFeatureOutline(w3.yardFeatures![0]);ok(wavyRings[0].length>500,`The wavy patio is finely tessellated (${wavyRings[0].length} points)`);
let t2=performance.now();const ws=surfaceOf(w3),wavyMs=performance.now()-t2;t2=performance.now();buildYardModel(w3);const wavyYardMs=performance.now()-t2;
ok(ws.featurePadModels![0].status==='ready'&&ws.proposedTriangles.length<15000,`Wavy patio at 3:1: ${ws.proposedTriangles.length} faces (under 15,000)`);
ok(wavyYardMs<3000,`Wavy patio at 3:1: yard model in ${wavyYardMs.toFixed(0)} ms (under 3 s; surface ${wavyMs.toFixed(0)} ms)`);
near(planArea(ws,'proposedTriangles'),planArea(ws,'existingTriangles'),'Wavy patio: the banked surface tiles the survey once',1e-4);
ok(padTriangles(ws).every(t=>Math.hypot(t.plane.x,t.plane.z)<=Math.max(1/3,bigSteep)+1e-6),'Wavy patio: no bank face steeper than 3:1 or the ground');
const wavyStep=worstStep(ws,wavyRings);ok(wavyStep<=.01,`Wavy patio: the bank is continuous (worst step ${wavyStep.toExponential(1)} in)`);
let wavyCrash='';const w10=wavy(10);try{buildYardModel(w10);}catch(e){wavyCrash=(e as Error).message;}const ws10=surfaceOf(w10);
ok(!wavyCrash,`Wavy patio at 10:1: no crash (${ws10.featurePadModels![0].status}, ${ws10.proposedTriangles.length} faces)`);

// (j) Item 3: derived pads are never loaded or saved. An old file carrying them (its patio since removed) loads without
// them: no bank, no restoration row; a survey object carrying them is never trusted either.
const ghost:DeckData={...design(plane,[]),siteModel:{...plane,featurePads:model.featurePads}},loaded=validateDesign(JSON.parse(JSON.stringify(ghost)));
ok(!loaded.siteModel!.featurePads&&!serializeDesign(loaded).includes('featurePads'),'A saved file with ground-fit pads loads without them and never writes them back');
const ghostYard=buildYardModel(loaded);ok(!surfaceOf(loaded).featurePadModels&&!ghostYard.siteCutFill!.bankAreaSqft&&!buildYardTakeoff(loaded,ghostYard).sections.some(x=>x.id==='yard-bank-restoration'),'...so it shows no bank and prices no restoration');
ok(!designSiteModel({siteModel:{...plane,featurePads:model.featurePads},yardFeatures:[plain]})!.featurePads&&!designSiteModel({siteModel:{...plane,featurePads:model.featurePads},yardFeatures:[]})!.featurePads,'Pads on a survey object are dropped before deriving');
ok(designSiteModel({siteModel:{...plane,featurePads:model.featurePads},yardFeatures:[fit]})!.featurePads!.length===1,'...and rebuilt from the fitted patio alone');

// (k) Item 6: bank earthwork is measured against the ground before the bank, so grading under it is not bank earthwork
// (the totals stay against the existing ground); restoration leaves out the bank under other paving.
const lowered:SiteModel={...plane,grading:[{id:'g1',name:'Lowered strip',boundary:[{x:100,y:276},{x:380,y:276},{x:380,y:330},{x:100,y:330}],originXIn:0,originZIn:0,elevationIn:18,slopeXPct:0,slopeZPct:0}]};
const graded=surfaceOf(design(lowered,[fit])),preBank=createSiteSurface(lowered,terrain);let bankCut=0,bankFill=0;
for(let x=.5;x<480;x++)for(let z=.5;z<480;z++){const p=graded.sample(x,z,'proposed')!,q=preBank.sample(x,z,'proposed')!;if(p<q)bankCut+=q-p;else bankFill+=p-q;}
within(graded.cutFill.bankCutYd3!,bankCut/46656,'Bank cut over a lowered grading region, against the ground before the bank');within(graded.cutFill.bankFillYd3!,bankFill/46656,'Bank fill over a lowered grading region, against the ground before the bank');
ok(graded.cutFill.bankFillYd3!>graded.cutFill.bankCutYd3!,'The bank fills back up to the patio from the lowered grading');
const [allCut,allFill]=bruteForce(graded,0,480,0,480);within(graded.cutFill.cutYd3,allCut,'Total cut still against the existing ground');within(graded.cutFill.fillYd3,allFill,'Total fill still against the existing ground');
const site2:SiteModel={...plane},alone=surfaceOf(design(site2,[fit])),front=patio('front',{color:'#aaa69b',zFt:27,widthFt:16,depthFt:8,groundFit:undefined,finishedElevationIn:30}),paved=design(site2,[fit,front]),covered=surfaceOf(paved),under=siteArea(siteClip(padTriangles(alone).map(t=>t.vertices.map(v=>({x:v.xIn,y:v.zIn}))),yardFeatureOutline(front),'intersection'))/144;
ok(under>1,`Another patio covers part of the bank (${under.toFixed(1)} sq ft)`);near(covered.cutFill.bankAreaSqft!,alone.cutFill.bankAreaSqft!-under,'Restoration leaves out the bank under the other paving',1e-6);
near(covered.cutFill.bankCutYd3!,alone.cutFill.bankCutYd3!,'...its earthwork is the same',1e-12);ok(covered.proposedTriangles===alone.proposedTriangles,'...and so is its geometry (shared, not rebuilt)');
const restoreRow=buildYardTakeoff(paved,buildYardModel(paved)).sections.find(x=>x.id==='yard-bank-restoration');ok(!!restoreRow&&Math.abs(Number(restoreRow.quantity)-covered.cutFill.bankAreaSqft!)<1e-9,'...as the takeoff prices it');

// (l) Item 7: a renamed patio relabels its bank without rebuilding it.
const site3:SiteModel={...plane},named=surfaceOf(design(site3,[patio('edge',{xFt:34.5})])),renamed=surfaceOf(design(site3,[patio('edge',{xFt:34.5,name:'Back terrace'})])),rm=renamed.featurePadModels![0];
ok(renamed!==named&&renamed.proposedTriangles===named.proposedTriangles,'A renamed patio shares its bank geometry (no rebuild)');
ok(rm.name==='Back terrace'&&rm.warnings.length>0&&rm.warnings.every(w=>w.startsWith('Back terrace:'))&&named.featurePadModels![0].warnings.every(w=>w.startsWith('edge:')),'...and its warnings carry the new name');

// (m) Item 9: skirting on a dense survey. The ground profile under a rim is thinned where a piece would be under 24 in
// and the line can stay within 1 in of the ground, so skirting is not cut into slivers and access panels still fit.
let s9=3;const r9=()=>(s9=(s9*16807)%2147483647)/2147483647;
const dense:SiteModel={version:1,points:Array.from({length:600},(_,i)=>{const x=-72+r9()*288,z=-72+r9()*288;return {id:`d${i}`,xIn:x,zIn:z,elevationIn:z*.04+x*.02+Math.sin(x/70)*2+(r9()*2-1)*.25};}),grading:[]};
for(const [w,l] of [[12,12],[16,12]]){const d=deckReleaseData({...structuredClone(DEFAULT_DECK),deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk',height:48,stairFlights:0,width:w,length:l,skirting:{...newSkirting(),accessPanels:1},siteModel:dense}),p=skirtingPlan(d,buildDeckTakeoff(d))!,per=new Map<string,number>();for(const r of p.runs)per.set(r.edge,(per.get(r.edge)??0)+1);
 ok(per.size>=3&&Math.max(...per.values())<=4,`${w}x${l} ft deck on a 600-point survey: at most 4 skirting runs per edge (${JSON.stringify([...per])})`);
 ok(p.accessPanels.placed===1,`${w}x${l} ft deck on a 600-point survey: its access panel fits`);}
const denseSurface=createSiteSurface(dense,terrain),rim=[{x:0,y:144},{x:144,y:144}] as const,profile=siteGroundProfile(denseSurface,rim[0],rim[1],.25)!;let slack=0;for(let t=0;t<=144;t+=.25)slack=Math.max(slack,Math.abs(profile.at(t)-denseSurface.sample(t,144)!));
ok(slack<=1+1e-9,`The thinned profile stays within 1 in of the ground (${slack.toFixed(3)} in)`);
const breaks=denseSurface.lineBreaks(rim[0],rim[1]),kept=profile.stops(0,144);ok(breaks.length>12&&kept.length<breaks.length/2,`The profile keeps ${kept.length-2} of ${breaks.length-2} survey breaks under a 12 ft rim`);

console.log(`Ground fit: ${checks} checks passed; bank ${pad.areaSqft.toFixed(1)} sq ft, cut ${s.cutFill.bankCutYd3!.toFixed(4)} / fill ${s.cutFill.bankFillYd3!.toFixed(4)} yd³ (brute ${bruteCut.toFixed(4)} / ${bruteFill.toFixed(4)}); Craighurst ${cm.status} in ${craighurstMs.toFixed(1)} ms (${cs.proposedTriangles.length} faces); 2000-point survey ${bigMs.toFixed(0)} ms (${bs.proposedTriangles.length} faces); wavy patio 3:1 ${ws.proposedTriangles.length} faces, surface ${wavyMs.toFixed(0)} ms, yard ${wavyYardMs.toFixed(0)} ms; 10:1 ${ws10.featurePadModels![0].status}.`);
