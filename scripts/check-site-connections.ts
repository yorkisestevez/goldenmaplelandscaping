import assert from 'node:assert/strict';
import '../src/features/deckcraft/siteSurfaceEngine';
import '../src/features/deckcraft/yardModelAdvancedRuntime';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import type {YardFeatureModel,YardBox} from '../src/features/deckcraft/yardModel';
import {buildYardModel} from '../src/features/deckcraft/yardModel';
import {createSiteSurface,sitePlaneHeight} from '../src/features/deckcraft/siteSurface';
import {gradeDiscontinuities} from '../src/features/deckcraft/siteElevationChecks';
import {siteConnectionBoundaries,reverseConnectionBoundary,draftGradeConnection} from '../src/features/deckcraft/siteConnectionDrafts';
import {fixedSiteLevelChanges} from '../src/features/deckcraft/siteConnectionReview';
import {transitionBoundaryPoint,transitionBoundaryLength} from '../src/features/deckcraft/gradingTransitionGeometry';
import {patioTopPlane} from '../src/features/deckcraft/yardElevationGeometry';
import {validateSiteModel} from '../src/features/deckcraft/siteModel';
import {getTerrainConfig} from '../src/features/deckcraft/yardSettings';
import {arcGeometry} from '../src/features/deckcraft/circularArcs';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {serializeDesign,parseDesign} from '../src/features/deckcraft/designPersistence';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},near=(a:number,b:number,m:string)=>ok(Math.abs(a-b)<1e-7,`${m}: ${a}/${b}`);
const square=(x:number,z:number,w:number,d=w)=>[{x,y:z},{x:x+w,y:z},{x:x+w,y:z+d},{x,y:z+d}];
const boundary=square(-360,-360,1440);
const data:DeckData={...structuredClone(DEFAULT_DECK),height:48,siteModel:{version:1,points:boundary.map((p,i)=>({id:'s'+i,xIn:p.x,zIn:p.y,elevationIn:0})),boundary,grading:[]},yardFeatures:[]};
const surface=createSiteSurface(data.siteModel,getTerrainConfig(data));
const triangle=(points:{x:number;y:number}[],height:number)=>({vertices:points.map(p=>({xIn:p.x,zIn:p.y,elevationIn:height})) as never,plane:{x:0,z:0,constant:height},existingPlane:{x:0,z:0,constant:0}});
const cliffSurface={proposedTriangles:[triangle([{x:0,y:0},{x:120,y:0},{x:0,y:120}],0),triangle([{x:0,y:0},{x:0,y:120},{x:-120,y:0}],24)]};
const cliff=gradeDiscontinuities(cliffSurface)[0];ok(cliff,'Grade discontinuity detected');near(cliff.maxJumpIn,24,'Grade jump is physical');
const wall:YardFeature={id:'wall',name:'Containment',kind:'retaining-wall',enabled:true,xFt:0,zFt:5,widthFt:10,depthFt:1,heightIn:30,rotationDeg:90,productId:'segmental-concrete',color:'#777777'};
const block=(bottom:number,top:number,patch:Partial<YardBox>={}):YardBox=>({id:'body',featureId:'wall',role:'wall-block',x:0,z:60,y:(bottom+top)/2,w:12,d:120,h:top-bottom,color:'#777777',...patch});
const model=(boxes:YardBox[]):YardFeatureModel=>({config:wall,footprints:[],topIn:30,boxes,members:[],warnings:[],quantities:{},excluded:false});
ok(gradeDiscontinuities(cliffSurface,[model([block(-6,30)])])[0].wallId==='wall','Wall spans the complete retained elevation');
ok(!gradeDiscontinuities(cliffSurface,[model([block(-6,12)])])[0].wallId,'Low wall no longer hides a grade conflict');
ok(!gradeDiscontinuities(cliffSurface,[model([block(6,30)])])[0].wallId,'Floating wall cannot contain lower grade');
ok(!gradeDiscontinuities(cliffSurface,[model([block(-6,12),block(12,30,{role:'wall-cap'})])])[0].wallId,'Decorative cap does not replace structural body');
ok(gradeDiscontinuities(cliffSurface,[model([block(-6,6),block(6,18),block(18,30)])])[0].wallId==='wall','Whole supporting courses meet vertically');
ok(!gradeDiscontinuities(cliffSurface,[model([block(-6,6),block(7,30)])])[0].wallId,'Unsupported vertical gap remains visible');
ok(!gradeDiscontinuities(cliffSurface,[model([block(-6,30,{z:20,d:40}),block(-6,30,{z:100,d:40})])])[0].wallId,'Horizontal gap remains visible');
ok(gradeDiscontinuities(cliffSurface,[model([block(-6,30,{z:30,d:60}),block(-6,30,{z:90,d:60})])])[0].wallId==='wall','Adjacent wall body runs join without false conflict');
ok(!gradeDiscontinuities(cliffSurface,[{...model([block(-6,30)]),excluded:true}])[0].wallId,'Excluded geometry does not resolve a conflict');

const patio:YardFeature={id:'patio',name:'Sloped curved patio',kind:'patio',enabled:true,xFt:10,zFt:10,widthFt:20,depthFt:20,heightIn:3,rotationDeg:35,finishedElevationIn:12,patioSlope:{xPct:2,zPct:-1},productId:'permacon-mondrian-plus',color:'#777777',outline:square(-120,-120,240),curves:[{edge:0,bulgeIn:30}]};
data.yardFeatures=[patio];const sources=siteConnectionBoundaries(data,surface),source=sources.find(b=>b.id==='patio:0')!;
ok(source.boundary.elevationSource==='specified','Fixed patio provides explicit source levels');near(source.boundary.curves![0].bulgeIn,30,'Circular definition retained');
const plane=patioTopPlane(patio,0),length=transitionBoundaryLength(source.boundary);
for(const l of source.boundary.levels!){const p=transitionBoundaryPoint(source.boundary,l.stationIn/length);near(l.elevationIn,sitePlaneHeight(plane,p.x,p.y),'Arc station samples the true rotated slope');}
for(let i=0;i+1<source.boundary.levels!.length;i++){const a=source.boundary.levels![i],b=source.boundary.levels![i+1],p=transitionBoundaryPoint(source.boundary,(a.stationIn+b.stationIn)/2/length);ok(Math.abs((a.elevationIn+b.elevationIn)/2-sitePlaneHeight(plane,p.x,p.y))<=.001001,'Sloped circular source bounded interpolation');}
const reversed=reverseConnectionBoundary(source.boundary);near(reversed.curves![0].bulgeIn,-30,'Reversal preserves radius and reverses bend');near(transitionBoundaryLength(reversed),length,'Reversal preserves analytic station length');assert.deepEqual(reverseConnectionBoundary(reversed).points,source.boundary.points);checks++;
near(reversed.levels![0].elevationIn,source.boundary.levels!.at(-1)!.elevationIn,'Reversal retains endpoint elevation');
const hidden={...data,editorOrganization:{layers:[{id:'hidden',name:'Hidden',visible:false,locked:false}],groups:[],objects:[{id:'patio',layerId:'hidden',locked:false}]}};
ok(!siteConnectionBoundaries(hidden,surface).some(s=>s.id.startsWith('patio:')),'Hidden feature omitted from source picker');

const draft=draftGradeConnection(cliff,48,'connection');near(Math.hypot(draft.a.points[0].x-draft.b.points[0].x,draft.a.points[0].y-draft.b.points[0].y),48,'Connection width is exact');ok(draft.a.elevationSource==='proposed'&&draft.b.elevationSource==='proposed','Draft samples entered ground; no guessed elevations');for(const width of [0,-1,NaN,1201]){assert.throws(()=>draftGradeConnection(cliff,width,'bad'));checks++;}
const explicit={...draft,a:{...draft.a,elevationSource:'specified' as const,levels:[{stationIn:0,elevationIn:0},{stationIn:120,elevationIn:0}]},b:{...draft.b,elevationSource:'specified' as const,levels:[{stationIn:0,elevationIn:12},{stationIn:120,elevationIn:12}]}};
validateSiteModel({...data.siteModel!,transitions:[explicit]});checks++;
const connectionSurface=createSiteSurface({...data.siteModel!,transitions:[explicit]},getTerrainConfig(data));ok(connectionSurface.transitionModels![0].status==='ready','Explicit connection derives ready surface');near(connectionSurface.cutFill.fillYd3,120*48*6/46656,'Connection fill analytic');
const outside={...explicit,id:'outside',a:{...explicit.a,points:explicit.a.points.map(p=>({x:p.x+2000,y:p.y}))},b:{...explicit.b,points:explicit.b.points.map(p=>({x:p.x+2000,y:p.y}))}};const missing=createSiteSurface({...data.siteModel!,transitions:[outside]},getTerrainConfig(data));ok(missing.transitionModels![0].status==='pending'&&missing.transitionModels![0].triangles.length===0,'Missing survey never becomes fabricated ground');

const pool={id:'pool',name:'Pool',enabled:true,type:'concrete' as const,xIn:600,zIn:600,rotationDeg:30,outline:square(-48,-96,96,192),copingTopElevationIn:12,waterOffsetIn:6,depthProfile:[{stationIn:0,depthIn:48},{stationIn:192,depthIn:48}],scopeMode:'complete' as const,coping:{status:'planning' as const,widthIn:12,thicknessIn:2,overhangIn:1,jointIn:.125,transitionJointIn:.375,stockLengthIn:24,verifiedForPool:false,color:'#aaaaaa'}};
data.pools=[pool];const poolSources=siteConnectionBoundaries(data,surface).filter(b=>b.id.startsWith('pool:'));ok(poolSources.length===4,'Pool outer coping edges selectable');for(const p of poolSources)ok(p.boundary.levels!.every(l=>l.elevationIn===12),'Coping levels stay fixed');
const w={...wall,widthFt:arcGeometry({x:-60,y:0},{x:60,y:0},24).lengthIn/12,finishedElevationIn:30,rotationDeg:0,wallPath:[{x:-60,y:0},{x:60,y:0}],curves:[{edge:0,bulgeIn:24}],wallTopSteps:[{stationIn:60,elevationIn:36}]};data.yardFeatures=[patio,w];const runs=siteConnectionBoundaries(data,surface).filter(b=>b.id.startsWith('wall:'));ok(runs.length===2,'Wall steps split source into separate runs');ok(runs[0].boundary.levels!.every(l=>l.elevationIn===30)&&runs[1].boundary.levels!.every(l=>l.elevationIn===36),'No interpolation across a stepped wall top');near(arcGeometry(runs[0].boundary.points[0],runs[0].boundary.points[1],runs[0].boundary.curves![0].bulgeIn).radius,arcGeometry({x:-60,y:0},{x:60,y:0},24).radius,'Wall run keeps authoritative radius');

await ensureLiveDesignExtensions(data);const before=structuredClone(data);let state:DeckAgentHostState={data:before,ready:true,view:'plan',openSections:[],canUndo:false,canRedo:false},commits=0;const history:DeckData[]=[];
const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{history.push(state.data);commits++;state={...state,data:next,canUndo:true};},undo:()=>{state={...state,data:history.pop()!,canUndo:history.length>0};},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:()=>Promise.resolve()});
const request={id:'connection-preview',expectedRevision:api.read().revision,commands:[{type:'site.transition' as const,transition:explicit}]};const preview=await api.preview(request);if("error" in preview)throw Error(JSON.stringify(preview.error));ok(preview.ok,'Connection preview accepted');ok(commits===0,'Preview does not mutate project');assert.deepEqual(fixedSiteLevelChanges(before,(preview as Extract<typeof preview,{ok:true}>).snapshot.design),[]);checks++;
const applied=await api.execute({...request,id:'connection-apply'});ok(applied.ok&&commits===1,'One atomic transition apply');assert.deepEqual(fixedSiteLevelChanges(before,state.data),[]);checks++;assert.deepEqual(state.data.siteModel!.points,before.siteModel!.points);checks++;
ok((await api.execute({...request,id:'stale'})).ok===false,'Stale connection preview rejected');
const loaded=parseDesign(serializeDesign(state.data));assert.deepEqual(loaded.siteModel!.transitions,state.data.siteModel!.transitions);checks++;
ok((await api.execute({id:'undo',expectedRevision:api.read().revision,commands:[{type:'history.undo'}]})).ok,'Undo accepted');assert.deepEqual(state.data.siteModel,before.siteModel);checks++;
api.dispose();console.log(`${checks} site connection checks passed.`);
