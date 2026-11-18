// Ground fit (G2) data layer: validation, save/load, new-patio defaults, the groundFit edit, and the yard.finished command.
import '../src/features/deckcraft/stairTargetsRuntime';
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {GROUND_FIT_LIMITS,type DeckData,type YardFeature} from '../src/features/deckcraft/types';
import type {SiteModel} from '../src/features/deckcraft/siteModel';
import {loadSiteEngine,sampleSiteHeight} from '../src/features/deckcraft/siteSurface';
import {fitNewPatio,newYardFeature} from '../src/features/deckcraft/yardSettings';
import {yardSurfaceIn} from '../src/features/deckcraft/yardElevations';
import {editYardFinished,type YardFinishedEdit} from '../src/features/deckcraft/yardFinishedEdits';
import {validateYardFinishedSettings} from '../src/features/deckcraft/yardFinishedSettings';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {deckReleaseData,parseDeckReleaseDesign,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {createDeckAgentController,type AgentCommand,type AgentResponse,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {parseAssistantPlan} from '../src/features/deckcraft/designer/assistantPlan';

let checks=0;
const check=(name:string,work:()=>void)=>{try{work();}catch(e){throw Error(`${name}: ${(e as Error).message}`);}checks++;};
const rejects=(name:string,work:()=>unknown,pattern?:RegExp)=>check(name,()=>assert.throws(work,pattern));
// A sloped measured plane whose ground at the default feature centre is not on a quarter inch.
const plane=(x:number,z:number)=>3.1+.02*z+0*x;
const site:SiteModel={version:1,points:[[-2000,-2000],[2000,-2000],[2000,2000],[-2000,2000],[0,0]].map(([x,z],i)=>({id:`p${i}`,xIn:x,zIn:z,elevationIn:plane(x,z)})),grading:[]};
async function main(){
 await loadSiteEngine();
 const legacyData:DeckData=structuredClone(DEFAULT_DECK),measured:DeckData={...structuredClone(DEFAULT_DECK),siteModel:site};
 const centre={x:legacyData.width/2*12,z:(legacyData.length+10)*12},ground=plane(centre.x,centre.z);
 check('Fixture: measured ground at the default centre is off the quarter inch',()=>{assert.ok(Math.abs(sampleSiteHeight(measured,centre.x,centre.z)!-ground)<1e-9);assert.notEqual(Math.round(ground*4)/4,ground);});

 // 1. Defaults for new patios.
 const patio=newYardFeature('patio',measured),wall=newYardFeature('retaining-wall',measured),water=newYardFeature('water-feature',measured),legacy=newYardFeature('patio',legacyData);
 check('New patio on measured ground: level with the ground, to 1/4 in',()=>assert.equal(patio.finishedElevationIn,Math.round(ground*4)/4));
 check('New patio on measured ground: graded round at the default 3:1',()=>assert.deepEqual(patio.groundFit,{slopeRatio:GROUND_FIT_LIMITS.defaultRatio}));
 check('New patio on measured ground keeps a flat surface',()=>assert.deepEqual(patio.patioSlope,{xPct:0,zPct:0}));
 check('Walls and water features get no ground fit',()=>{assert.ok(!('groundFit'in wall));assert.ok(!('groundFit'in water));assert.ok(Math.abs(wall.finishedElevationIn!-(ground+24))<1e-9);});
 check('Legacy yard: new patio unchanged (no ground fit, level not rounded)',()=>{assert.ok(!('groundFit'in legacy));assert.equal(legacy.finishedElevationIn,0);const sloped=newYardFeature('patio',{...legacyData,terrainConfig:{widthFt:80,depthFt:80,elevationIn:3.1,slopePct:2}});assert.ok(!('groundFit'in sloped));assert.ok(Math.abs(sloped.finishedElevationIn!-ground)<1e-9);});
 check('Shared helper leaves legacy yards, walls and steps alone (same object)',()=>{assert.equal(fitNewPatio(legacyData,legacy),legacy);assert.equal(fitNewPatio(measured,wall),wall);const steps={...patio,stoneSteps:{} as never};delete (steps as YardFeature).groundFit;assert.equal(fitNewPatio(measured,steps),steps);});
 check('Shared helper places a moved patio at its own centre and keeps a chosen ratio',()=>{const moved=fitNewPatio(measured,{...legacy,xFt:4,zFt:40,heightIn:2,groundFit:{slopeRatio:5}});assert.equal(moved.finishedElevationIn,Math.round((plane(48,480)+2)*4)/4);assert.deepEqual(moved.groundFit,{slopeRatio:5});});
 check('Shared helper skips a patio centred outside the measured ground',()=>{const away={...legacy,xFt:400,zFt:400};const out=fitNewPatio(measured,away);assert.equal(out,away);});

 // 2. Validation (load and edit share validateYardFinishedSettings).
 for(const r of [GROUND_FIT_LIMITS.minRatio,3,GROUND_FIT_LIMITS.maxRatio])check(`Accepts ${r}:1`,()=>assert.deepEqual(validateYardFinishedSettings({...patio,groundFit:{slopeRatio:r}}).groundFit,{slopeRatio:r}));
 for(const r of [1.49,10.01,0,-3,NaN,Infinity,'3',null,undefined])rejects(`Rejects slopeRatio ${String(r)}`,()=>validateYardFinishedSettings({...patio,groundFit:{slopeRatio:r} as never}),/1\.5:1 to 10:1/);
 rejects('Rejects null ground fit',()=>validateYardFinishedSettings({...patio,groundFit:null as never}));
 rejects('Rejects an array ground fit',()=>validateYardFinishedSettings({...patio,groundFit:[3] as never}));
 rejects('Rejects extra keys',()=>validateYardFinishedSettings({...patio,groundFit:{slopeRatio:3,runIn:120} as never}),/Invalid elevation setting fields/);
 rejects('Rejects a missing ratio',()=>validateYardFinishedSettings({...patio,groundFit:{} as never}));
 rejects('Rejects ground fit on a wall',()=>validateYardFinishedSettings({...wall,groundFit:{slopeRatio:3}}),/patios only/);
 rejects('Rejects ground fit on a water feature',()=>validateYardFinishedSettings({...water,groundFit:{slopeRatio:3}}));
 const {finishedElevationIn:_l,patioSlope:_s,...unfixed}=patio,{groundFit:_u,...unfixedPlain}=unfixed;
 rejects('Rejects ground fit without a fixed patio level',()=>validateYardFinishedSettings(unfixed),/Fix the patio elevation before grading/);
 check('An explicit undefined ground fit is dropped',()=>assert.ok(!('groundFit'in validateYardFinishedSettings({...patio,groundFit:undefined}))));
 check('Ground fit getters are refused without being called',()=>{let calls=0;const hostile={...patio};Object.defineProperty(hostile,'groundFit',{get:()=>{calls++;return {slopeRatio:3};},enumerable:true});assert.throws(()=>validateYardFinishedSettings(hostile));assert.equal(calls,0);});
 check('Validated ground fit is a fresh plain copy',()=>{const g={slopeRatio:4},out=validateYardFinishedSettings({...patio,groundFit:g});assert.notEqual(out.groundFit,g);assert.deepEqual(out.groundFit,g);});
 rejects('Design load rejects a bad ratio',()=>validateDesign({...measured,yardFeatures:[{...patio,groundFit:{slopeRatio:20}}]}));
 rejects('Design load rejects ground fit on an unfixed patio',()=>validateDesign({...measured,yardFeatures:[{...unfixed,groundFit:{slopeRatio:3}}]}),/Fix the patio elevation/);
 rejects('Design load rejects ground fit on a wall',()=>validateDesign({...measured,yardFeatures:[{...wall,groundFit:{slopeRatio:3}}]}));

 // 3. Save and load.
 const fitted:DeckData={...measured,yardFeatures:[{...patio,id:'fit-patio'},{...wall,id:'fit-wall'}]};
 const saved=serializeDesign(fitted),restored=parseDesign(saved);
 check('Save/load keeps the ground fit exactly',()=>{assert.deepEqual(restored.yardFeatures,fitted.yardFeatures);assert.equal(serializeDesign(restored),saved);});
 check('Public project round trip keeps the ground fit',()=>assert.deepEqual(parseDeckReleaseDesign(serializeDeckReleaseDesign(fitted)).yardFeatures?.[0].groundFit,{slopeRatio:3}));
 const {groundFit:_g,...plain}=patio,old:DeckData={...measured,yardFeatures:[{...plain,id:'old-patio'}]},oldText=serializeDesign(old),oldLoaded=parseDesign(oldText);
 check('A saved design without ground fit loads byte-identical',()=>{assert.equal(serializeDesign(oldLoaded),oldText);assert.ok(!('groundFit'in oldLoaded.yardFeatures![0]));assert.ok(!oldText.includes('groundFit'));});
 check('A saved legacy (unfixed) patio loads unchanged',()=>{const text=serializeDesign({...measured,yardFeatures:[{...unfixedPlain,id:'legacy-patio'}]}),loaded=parseDesign(text);assert.equal(serializeDesign(loaded),text);assert.equal(loaded.yardFeatures![0].finishedElevationIn,undefined);});

 // 4. The groundFit edit.
 const fixedPlain={...plain,id:'p'},data:DeckData={...measured,yardFeatures:[fixedPlain]};
 const on=editYardFinished(data,fixedPlain,{action:'groundFit',slopeRatio:4});
 check('Edit turns ground fit on and keeps the fixed level',()=>{assert.deepEqual(on.groundFit,{slopeRatio:4});assert.equal(on.finishedElevationIn,fixedPlain.finishedElevationIn);assert.deepEqual(on.patioSlope,fixedPlain.patioSlope);});
 check('Edit changes the ratio',()=>assert.deepEqual(editYardFinished(data,on,{action:'groundFit',slopeRatio:6}).groundFit,{slopeRatio:6}));
 check('Edit turns ground fit off and leaves everything else',()=>{const off=editYardFinished(data,on,{action:'groundFit',slopeRatio:null});assert.ok(!('groundFit'in off));assert.deepEqual(off,fixedPlain);});
 const legacyPatio:YardFeature={...unfixedPlain,id:'legacy',heightIn:2},legacyDesign:DeckData={...measured,yardFeatures:[legacyPatio]};
 check('Turning it on for an unfixed patio fixes its current top in the same edit',()=>{const before=yardSurfaceIn(legacyDesign,legacyPatio),next=editYardFinished(legacyDesign,legacyPatio,{action:'groundFit',slopeRatio:3});assert.ok(Math.abs(before-(ground+2))<1e-9);assert.equal(next.finishedElevationIn,before);assert.deepEqual(next.patioSlope,{xPct:0,zPct:0});assert.deepEqual(next.groundFit,{slopeRatio:3});});
 check('Turning it off on an unfixed patio does not fix its level',()=>{const next=editYardFinished(legacyDesign,legacyPatio,{action:'groundFit',slopeRatio:null});assert.equal(next.finishedElevationIn,undefined);assert.ok(!('groundFit'in next));});
 rejects('Edit refuses a wall',()=>editYardFinished({...measured,yardFeatures:[wall]},wall,{action:'groundFit',slopeRatio:3}),/Only patios/);
 rejects('Edit refuses stone steps',()=>editYardFinished(data,{...fixedPlain,stoneSteps:{} as never},{action:'groundFit',slopeRatio:3}),/Steps keep their own ground/);
 rejects('Edit refuses a legacy yard with no measured ground',()=>editYardFinished({...legacyData,yardFeatures:[fixedPlain]},fixedPlain,{action:'groundFit',slopeRatio:3}),/Measure the ground/);
 rejects('Edit refuses an out-of-range ratio',()=>editYardFinished(data,fixedPlain,{action:'groundFit',slopeRatio:12}),/1\.5:1 to 10:1/);
 rejects('Edit refuses a text ratio',()=>editYardFinished(data,fixedPlain,{action:'groundFit',slopeRatio:'3'} as never));
 rejects('Edit refuses extra fields',()=>editYardFinished(data,fixedPlain,{action:'groundFit',slopeRatio:3,runIn:1} as never),/Invalid finished-level operation fields/);
 rejects('Edit refuses a missing ratio',()=>editYardFinished(data,fixedPlain,{action:'groundFit'} as never),/Invalid finished-level operation fields/);
 check('Edit refuses a ratio getter without calling it',()=>{let calls=0;const edit={action:'groundFit'} as YardFinishedEdit;Object.defineProperty(edit,'slopeRatio',{get:()=>{calls++;return 3;},enumerable:true});assert.throws(()=>editYardFinished(data,fixedPlain,edit));assert.equal(calls,0);});

 // 5. The yard.finished command: preview, then execute as one undo step.
 let state:DeckAgentHostState={data:deckReleaseData({...measured,yardFeatures:[fixedPlain,legacyPatio]}),ready:true,view:'plan',openSections:[],canUndo:false,canRedo:false},previous=state.data,commits=0;
 const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{previous=state.data;state={...state,data:next,canUndo:true};commits++;},undo:()=>{state={...state,data:previous,canUndo:false,canRedo:true};},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:test=>{assert.ok(test(state));return Promise.resolve();}});
 let n=0;const request=(commands:AgentCommand[])=>({id:`ground-fit-${++n}`,expectedRevision:api.read().revision,commands});
 const ok=(r:AgentResponse)=>{if('error'in r)throw Error(`${r.error.code}: ${r.error.message}`);return r;};
 const turnOn=[{type:'yard.finished',id:'p',edit:{action:'groundFit',slopeRatio:4}},{type:'yard.finished',id:'legacy',edit:{action:'groundFit',slopeRatio:3}}] as AgentCommand[];
 const before=serializeDeckReleaseDesign(state.data),preview=ok(await api.preview(request(turnOn)));
 check('Command preview shows both patios graded round, with no live write',()=>{const f=preview.snapshot.design.yardFeatures!;assert.deepEqual(f[0].groundFit,{slopeRatio:4});assert.deepEqual(f[1].groundFit,{slopeRatio:3});assert.equal(f[1].finishedElevationIn,ground+2);assert.equal(commits,0);assert.equal(serializeDeckReleaseDesign(state.data),before);});
 ok(await api.execute(request(turnOn)));
 check('Command execute commits once (one undo step)',()=>{assert.equal(commits,1);assert.deepEqual(state.data.yardFeatures?.map(f=>f.groundFit?.slopeRatio),[4,3]);assert.equal(state.data.yardFeatures?.[1].finishedElevationIn,ground+2);});
 check('Snapshot design carries the ground fit',()=>assert.deepEqual(api.read().design.yardFeatures?.[0].groundFit,{slopeRatio:4}));
 const repatch=await api.execute(request([{type:'design.patch',patch:{yardFeatures:api.read().design.yardFeatures}}]));
 check('A design patch carrying ground fit passes the controller schema',()=>{ok(repatch);assert.equal(commits,1);});
 const bad=await api.execute(request([{type:'yard.finished',id:'p',edit:{action:'groundFit',slopeRatio:4,runIn:9}} as never]));
 check('Unknown edit fields are refused before any write',()=>{assert.ok('error'in bad);assert.equal(commits,1);});
 const range=await api.execute(request([{type:'yard.finished',id:'p',edit:{action:'groundFit',slopeRatio:0.5}}]));
 check('Out-of-range command is refused atomically',()=>{assert.ok('error'in range);assert.equal(commits,1);});
 ok(await api.execute(request([{type:'history.undo'}])));
 check('One undo restores both patios as they were',()=>{assert.equal(serializeDeckReleaseDesign(state.data),before);assert.equal(state.data.yardFeatures?.[1].finishedElevationIn,undefined);});
 ok(await api.execute(request([{type:'yard.finished',id:'p',edit:{action:'groundFit',slopeRatio:null}}])));
 check('Command off on an unfitted patio is harmless',()=>assert.ok(!('groundFit'in state.data.yardFeatures![0])));
 check('Assistant plans accept ground fit on and off',()=>{for(const slopeRatio of [3,null,GROUND_FIT_LIMITS.minRatio,GROUND_FIT_LIMITS.maxRatio])assert.ok(parseAssistantPlan({kind:'edit',message:'Grade round the patio.',assumptions:[],commands:[{type:'yard.finished',id:'p',edit:{action:'groundFit',slopeRatio}}]}).ok,String(slopeRatio));});
 check('Assistant plans refuse bad ground fit',()=>{for(const edit of [{action:'groundFit',slopeRatio:20},{action:'groundFit',slopeRatio:3,price:1},{action:'groundFit'}])assert.ok(!parseAssistantPlan({kind:'edit',message:'Bad.',assumptions:[],commands:[{type:'yard.finished',id:'p',edit}]}).ok,JSON.stringify(edit));});
 // 6. A stone edge course on the raised side (groundFit.lowEdge 'stone'): validation, save/load and the edit.
 const stone={slopeRatio:3,lowEdge:'stone'} as const;
 check('Accepts a stone edge',()=>assert.deepEqual(validateYardFinishedSettings({...patio,groundFit:{...stone}}).groundFit,stone));
 check('Validated stone edge is a fresh plain copy',()=>{const g={...stone},out=validateYardFinishedSettings({...patio,groundFit:g});assert.notEqual(out.groundFit,g);assert.deepEqual(out.groundFit,stone);});
 check('An explicit undefined lowEdge is dropped',()=>{const out=validateYardFinishedSettings({...patio,groundFit:{slopeRatio:3,lowEdge:undefined}});assert.deepEqual(out.groundFit,{slopeRatio:3});assert.ok(!('lowEdge'in out.groundFit!));});
 for(const bad of ['brick','','Stone',null,1,true,{}])rejects(`Rejects lowEdge ${JSON.stringify(bad)}`,()=>validateYardFinishedSettings({...patio,groundFit:{slopeRatio:3,lowEdge:bad} as never}),/lowEdge must be 'stone'/);
 rejects('Stone edge keeps the ratio limits',()=>validateYardFinishedSettings({...patio,groundFit:{slopeRatio:12,lowEdge:'stone'}}),/1\.5:1 to 10:1/);
 rejects('Stone edge refuses extra keys',()=>validateYardFinishedSettings({...patio,groundFit:{...stone,course:'granite'} as never}),/Invalid elevation setting fields/);
 rejects('Stone edge on a wall is refused',()=>validateYardFinishedSettings({...wall,groundFit:{...stone}}));
 check('A lowEdge getter is refused without being called',()=>{let calls=0;const g={slopeRatio:3};Object.defineProperty(g,'lowEdge',{get:()=>{calls++;return 'stone';},enumerable:true});assert.throws(()=>validateYardFinishedSettings({...patio,groundFit:g as never}));assert.equal(calls,0);});
 rejects('Design load rejects a bad lowEdge',()=>validateDesign({...measured,yardFeatures:[{...patio,groundFit:{slopeRatio:3,lowEdge:'wood'} as never}]}),/lowEdge must be 'stone'/);
 const stoned:DeckData={...measured,yardFeatures:[{...patio,id:'stone-patio',groundFit:{...stone}}]},stoneText=serializeDesign(stoned);
 check('Save/load keeps the stone edge exactly',()=>{const back=parseDesign(stoneText);assert.deepEqual(back.yardFeatures![0].groundFit,stone);assert.equal(serializeDesign(back),stoneText);});
 check('Public project round trip keeps the stone edge',()=>assert.deepEqual(parseDeckReleaseDesign(serializeDeckReleaseDesign(stoned)).yardFeatures?.[0].groundFit,stone));
 check('A design without a stone edge never writes lowEdge',()=>assert.ok(!serializeDesign(fitted).includes('lowEdge')));
 const edged=editYardFinished(data,fixedPlain,{action:'groundFit',slopeRatio:4,lowEdge:'stone'});
 check('Edit sets a stone edge with the ratio',()=>{assert.deepEqual(edged.groundFit,{slopeRatio:4,lowEdge:'stone'});assert.equal(edged.finishedElevationIn,fixedPlain.finishedElevationIn);});
 check('Changing only the ratio keeps the stone edge',()=>assert.deepEqual(editYardFinished(data,edged,{action:'groundFit',slopeRatio:6}).groundFit,{slopeRatio:6,lowEdge:'stone'}));
 check('lowEdge null goes back to banks',()=>{const banks=editYardFinished(data,edged,{action:'groundFit',slopeRatio:4,lowEdge:null});assert.deepEqual(banks.groundFit,{slopeRatio:4});assert.ok(!('lowEdge'in banks.groundFit!));});
 check('Turning ground fit off clears the stone edge too',()=>{const off=editYardFinished(data,edged,{action:'groundFit',slopeRatio:null});assert.ok(!('groundFit'in off));assert.deepEqual(off,fixedPlain);assert.ok(!('groundFit'in editYardFinished(data,edged,{action:'groundFit',slopeRatio:null,lowEdge:null})));});
 check('A stone edge on an unfixed patio fixes its current top in the same edit',()=>{const next=editYardFinished(legacyDesign,legacyPatio,{action:'groundFit',slopeRatio:3,lowEdge:'stone'});assert.equal(next.finishedElevationIn,yardSurfaceIn(legacyDesign,legacyPatio));assert.deepEqual(next.groundFit,{slopeRatio:3,lowEdge:'stone'});});
 rejects('Edit refuses a stone edge with no ratio',()=>editYardFinished(data,edged,{action:'groundFit',slopeRatio:null,lowEdge:'stone'}),/bank ratio/);
 rejects('Edit refuses an unknown lowEdge',()=>editYardFinished(data,fixedPlain,{action:'groundFit',slopeRatio:3,lowEdge:'brick'} as never),/'stone', or null/);
 rejects('Edit refuses an undefined lowEdge field',()=>editYardFinished(data,fixedPlain,{action:'groundFit',slopeRatio:3,lowEdge:undefined}),/'stone', or null/);
 rejects('Edit refuses fields beyond lowEdge',()=>editYardFinished(data,fixedPlain,{action:'groundFit',slopeRatio:3,lowEdge:'stone',height:4} as never),/Invalid finished-level operation fields/);
 check('Edit refuses a lowEdge getter without calling it',()=>{let calls=0;const edit={action:'groundFit',slopeRatio:3} as YardFinishedEdit;Object.defineProperty(edit,'lowEdge',{get:()=>{calls++;return 'stone';},enumerable:true});assert.throws(()=>editYardFinished(data,fixedPlain,edit));assert.equal(calls,0);});
 console.log(`Ground fit data: ${checks} checks passed.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
