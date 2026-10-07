import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import '../src/features/deckcraft/foundationDatumsRuntime';
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import type {SiteModel} from '../src/features/deckcraft/siteModel';
import {createSiteSurface,designSiteModel,designSiteSurface,sampleSiteHeight} from '../src/features/deckcraft/siteSurface';
import {getTerrainConfig} from '../src/features/deckcraft/yardSettings';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {foundationDatums} from '../src/features/deckcraft/foundationDatums';
import {newSkirting,skirtingPlan} from '../src/features/deckcraft/skirting';

/**
 * The design's ground has one resolver (G2). A design can carry a measured survey (data.siteModel); ground-fit patios
 * add graded banks that live only in the derived model, designSiteModel(data) / designSiteSurface(data). Everything
 * that wants "the design's ground" (3D, drawings, footings, stairs, pools, beds, skirting) must read the derived model,
 * and only code that edits, validates or imports the raw survey may build a surface straight from data.siteModel.
 * (a) Static: every createSiteSurface(...) whose first argument names siteModel is allow-listed below with a reason.
 * (b) Behaviour: with no ground-fit patio the derived ground IS the survey, so the resolver and its consumers
 * (sampleSiteHeight, foundation datums, skirting) give exactly what the raw survey gave.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;},same=(a:unknown,b:unknown,message:string)=>ok(JSON.stringify(a)===JSON.stringify(b),message);

// (a) Static guard.
const DC=fileURLToPath(new URL('../src/features/deckcraft/',import.meta.url));
const ALLOW:{file:string;arg?:RegExp;reason:string;pending?:true}[]=[
 {file:'siteSurfaceEngine.ts',reason:'the engine: builds a surface from whatever model it is handed'},
 {file:'siteFeatureGrading.ts',reason:'derives the ground-fit pads from the ground before the pads'},
 {file:'siteSurface.ts',reason:'the resolver itself'},
 {file:'siteModelRuntime.ts',reason:'validates the saved survey'},
 {file:'SiteReadingImport.tsx',reason:'reads raw survey readings being imported'},
 {file:'SiteEditor.tsx',reason:'edits and validates the saved survey'},
 {file:'GradingTransitionEditor.tsx',arg:/^\{\.\.\.data\.siteModel!?,transitions:\[\]\}$/,reason:'transition drafting surface: drafted against the raw survey, pads are derived after transitions'},
];
const files=(dir:string):string[]=>readdirSync(dir).flatMap(name=>{const p=join(dir,name);return statSync(p).isDirectory()?files(p):/\.tsx?$/.test(name)?[p]:[];});
/** The call's first argument, read to the top-level comma or close paren. */
const firstArg=(text:string,from:number)=>{let depth=0,quote='',i=from;for(;i<text.length;i++){const c=text[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}if(c==='\''||c==='"'||c==='`')quote=c;else if('([{'.includes(c))depth++;else if(')]}'.includes(c)){if(!depth)break;depth--;}else if(c===','&&!depth)break;}return text.slice(from,i).trim();};
const calls=(text:string,name:string)=>[...text.matchAll(new RegExp(`(?<![\\w.])${name}\\(`,'g'))].filter(m=>!/function\s*$/.test(text.slice(Math.max(0,m.index!-12),m.index))).map(m=>firstArg(text,m.index!+m[0].length));
const usedAllowances=new Set<(typeof ALLOW)[number]>(),engineImports:string[]=[],bareSamples:string[]=[];let rawSites=0,designSites=0;
for(const path of files(DC)){
 const file=relative(DC,path).replace(/\\/g,'/'),text=readFileSync(path,'utf8');
 for(const arg of calls(text,'createSiteSurface')){
  if(!/(^|[^A-Za-z])siteModel/.test(arg)){designSites+=+/^designSiteModel\(/.test(arg);continue;}
  const allowance=ALLOW.find(a=>a.file===file&&(!a.arg||a.arg.test(arg)));
  ok(allowance,`${file}: createSiteSurface(${arg}, …) builds the raw survey. Use designSiteSurface(data) / createSiteSurface(designSiteModel(data), terrain), or allow-list it here with a reason.`);
  usedAllowances.add(allowance!);rawSites++;
 }
 if(!/^(siteSurfaceEngine|siteSurface|siteFeatureGrading)\.ts$/.test(file)&&/import\s*\{[^}]*\bsampleSiteHeight\b[^}]*\}\s*from\s*'[^']*siteSurfaceEngine'/.test(text))engineImports.push(file);
 for(const arg of calls(text,'sampleSiteHeight'))if(arg.startsWith('{')&&!/yardFeatures|\.\.\./.test(arg))bareSamples.push(`${file}: sampleSiteHeight(${arg}, …)`);
}
ok(!engineImports.length,`Import sampleSiteHeight from siteSurface (the design ground), not the engine's raw-survey copy: ${engineImports.join(', ')}`);
ok(!bareSamples.length,`These pass a design without yardFeatures, so ground-fit banks are lost: ${bareSamples.join('; ')}`);
ok(rawSites>0&&designSites>=5,`The scan sees the call sites (${rawSites} raw, ${designSites} on designSiteModel)`);
const pending=ALLOW.filter(a=>a.pending&&usedAllowances.has(a)).map(a=>a.file),resolved=ALLOW.filter(a=>a.pending&&!usedAllowances.has(a)).map(a=>a.file);

// (b) Behaviour on a measured design with no ground-fit patio.
const rect=(x0:number,z0:number,x1:number,z1:number)=>[{x:x0,y:z0},{x:x1,y:z0},{x:x1,y:z1},{x:x0,y:z1}];
const survey=(lift=0):SiteModel=>({version:1,points:[-600,0,600].flatMap(x=>[-600,0,600].map(z=>({id:`${x}/${z}`,xIn:x,zIn:z,elevationIn:4+lift+x*.01+z*.02+x*z*1e-5}))),grading:[{id:'terrace',name:'Lower terrace',boundary:rect(-300,300,300,560),originXIn:0,originZIn:300,elevationIn:9,slopeXPct:0,slopeZPct:1}]});
const patio:YardFeature={id:'patio',kind:'patio',name:'Patio',enabled:true,xFt:8,zFt:18.5,widthFt:12,depthFt:12,heightIn:0,finishedElevationIn:18,rotationDeg:0,productId:'permacon-melville',color:'#aaa'};
const data:DeckData={...structuredClone(DEFAULT_DECK),height:48,stairFlights:0,skirting:newSkirting(),siteModel:survey(),yardFeatures:[patio]},bare:DeckData={...data,yardFeatures:undefined};
const terrain=getTerrainConfig(data),raw=createSiteSurface(data.siteModel,terrain),design=designSiteSurface(data)!;
const grid=Array.from({length:23},(_,i)=>-660+i*60).flatMap(x=>Array.from({length:23},(_,j)=>({x,z:-660+j*60})));
ok(designSiteModel(data)===data.siteModel&&designSiteModel(bare)===data.siteModel,'No ground-fit patio: the design model is the saved survey itself');
ok(!!design,'A measured design resolves a design surface');
same(design.cutFill,raw.cutFill,'Design surface cut/fill equals the raw survey\'s');
ok(raw.cutFill.cutYd3+raw.cutFill.fillYd3>0,'The fixture grades some ground (cut/fill is not trivially zero)');
for(const kind of ['existing','proposed'] as const){ok(grid.every(p=>design.sample(p.x,p.z,kind)===raw.sample(p.x,p.z,kind)),`Design surface ${kind} samples equal the raw survey (${grid.length} points, coverage edges included)`);ok(grid.every(p=>sampleSiteHeight(data,p.x,p.z,kind)===raw.sample(p.x,p.z,kind)&&sampleSiteHeight(bare,p.x,p.z,kind)===raw.sample(p.x,p.z,kind)),`sampleSiteHeight ${kind} equals the raw survey sample`);}
ok(grid.some(p=>raw.sample(p.x,p.z)===undefined)&&grid.some(p=>raw.sample(p.x,p.z)!==undefined),'The sample sweep crosses the survey coverage edge');
same(design.extrema([rect(-100,-100,300,250)],'proposed'),raw.extrema([rect(-100,-100,300,250)],'proposed'),'Design surface extrema equal the raw survey\'s');
const legacy={...data,siteModel:undefined};ok(designSiteSurface(legacy)===undefined&&sampleSiteHeight(legacy,0,120)===terrain.elevationIn+120*terrain.slopePct/100,'A legacy yard has no design surface and samples the terrain plane');
const model=buildDeckTakeoff(bare),datums=foundationDatums(data,model.levels),plan=skirtingPlan(data,model)!;
ok(datums.length>0&&datums.every(d=>d.status==='modeled'&&d.gradeElevationIn===raw.sample(d.x,d.z)),'Foundation datums stand on the raw survey grade when nothing is fitted');
same(datums,foundationDatums(bare,model.levels),'Foundation datums are identical with or without unfitted yard features');
ok(plan&&plan.runs.length>0,'The fixture deck is skirted');
same(plan,skirtingPlan(bare,model),'Skirting plan is identical with or without unfitted yard features');
const lifted={...data,siteModel:survey(12)};ok(JSON.stringify(skirtingPlan(lifted,model))!==JSON.stringify(plan)&&foundationDatums(lifted,model.levels).some((d,i)=>d.gradeElevationIn!==datums[i].gradeElevationIn),'Skirting and footings read the measured ground (a lifted survey changes them)');

// The same consumers follow the derived model once a patio is fitted (pads when the G2 engine is live).
const fitted:DeckData={...data,yardFeatures:[{...patio,groundFit:{slopeRatio:3}}]},fittedModel=designSiteModel(fitted)!,fittedSurface=designSiteSurface(fitted)!,padsLive=fittedModel!==fitted.siteModel;
ok(designSiteModel(fitted)===fittedModel,'The derived model is memoized for the same design');
ok(!fitted.siteModel!.featurePads,'Deriving pads never writes them into the saved survey');
ok(!padsLive||fittedModel.featurePads?.length===1&&fittedModel.featurePads[0].featureId==='patio','A fitted patio derives exactly one pad');
same(fittedSurface.cutFill,createSiteSurface(fittedModel,terrain).cutFill,'designSiteSurface builds the derived model');
ok(grid.every(p=>sampleSiteHeight(fitted,p.x,p.z)===fittedSurface.sample(p.x,p.z)),'sampleSiteHeight samples the derived ground');
ok(foundationDatums(fitted,model.levels).every(d=>d.gradeElevationIn===null||d.gradeElevationIn===fittedSurface.sample(d.x,d.z)),'Footings stand on the derived ground');

console.log(`Site resolver checks passed: ${checks}; ${rawSites} raw-survey createSiteSurface sites allow-listed, ${designSites} on designSiteModel; ground-fit pads ${padsLive?'live':'not yet derived (engine stub)'}${pending.length?`; pending switch: ${pending.join(', ')}`:''}${resolved.length?`; pending allowances now unused, remove: ${resolved.join(', ')}`:''}.`);
