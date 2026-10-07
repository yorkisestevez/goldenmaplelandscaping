import assert from 'node:assert/strict';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {newYardFeature} from '../src/features/deckcraft/yardSettings';
import {parseNaturalLanguageCommands,type AssistedSelection} from '../src/features/deckcraft/designer/naturalLanguageCommands';
import {buildAssistantContext,assistantPlanRequest,parseAssistantPlan} from '../src/features/deckcraft/designer/assistantPlan';
import {yardShapeWorldPoints} from '../src/features/deckcraft/yardShapeEditing';

// These fixtures deliberately exercise historical grade-following voice behavior.
const legacyFeature=(kind:'patio'|'retaining-wall')=>{const {finishedElevationIn:_level,patioSlope:_slope,...f}=newYardFeature(kind,DEFAULT_DECK);return f;};
const patio={...legacyFeature('patio'),id:'voice-patio',name:'Lower Patio',xFt:32,zFt:32,widthFt:16,depthFt:12,heightIn:2};
const wall={...legacyFeature('retaining-wall'),id:'voice-wall',name:'Upper Wall',xFt:32,zFt:52,widthFt:16,heightIn:30,baseElevationIn:-3,wallPath:[{x:-96,y:0},{x:0,y:0},{x:96,y:0}],wallConstruction:{geogridLengthIn:72,geogridEveryCourses:2}};
const other={...legacyFeature('retaining-wall'),id:'voice-other',name:'Other Wall',xFt:55,zFt:61,widthFt:8};
let state:DeckAgentHostState={data:deckReleaseData({...structuredClone(DEFAULT_DECK),yardFeatures:[patio,wall,other]}),ready:true,view:'plan',openSections:[],canUndo:false,canRedo:false},beforeUndo=state.data,commits=0;
const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{beforeUndo=state.data;state={...state,data:next,canUndo:true};commits++;},undo:()=>{state={...state,data:beforeUndo,canUndo:false,canRedo:true};},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:test=>{if(!test(state))throw Error('Host did not render');return Promise.resolve();}});
const choose=(id:string,target:'area'|'edge'|'point'='area',index=0):AssistedSelection=>({partIds:[],boards:[],yard:{id,target,index}});
const snapshot=api.read(),voice=(s:string,selection:AssistedSelection)=>parseNaturalLanguageCommands(s,snapshot,selection);
let checks=0;const equal=(a:unknown,b:unknown,message:string)=>{assert.deepEqual(a,b,message);checks++;};const truth=(a:unknown,message:string)=>{assert.ok(a,message);checks++;};
const command=(s:string,selection:AssistedSelection)=>{const r=voice(s,selection);if('clarification' in r)throw Error(r.clarification);return r.request.commands[0];};

async function main(){
 const wallSelected=choose(wall.id,'edge',1),patioSelected=choose(patio.id);
 const context=buildAssistantContext(snapshot,wallSelected);equal(context.selection.yard,{id:wall.id,kind:'retaining-wall',name:wall.name,target:'edge',index:1},'Current wall and edge are present in public assistant context');
 truth(!JSON.stringify(context).includes('materialMarkup'),'Context does not expose private pricing');
 equal(command('raise this wall six inches',wallSelected),{type:'yard.elevation',id:wall.id,field:'baseElevationIn',valueIn:3},'Spoken wall raise changes base datum and keeps exposed height');
 equal(command('move this patio 2 feet right',patioSelected),{type:'yard.move',id:patio.id,target:'area',dxIn:24,dyIn:0},'Spoken patio move targets selected feature');
 equal(command('make this patio rounded',patioSelected),{type:'yard.preset',id:patio.id,presetId:'rounded'},'Spoken starter targets selected patio');
 equal(command('curve this edge 18 inches',wallSelected),{type:'yard.curve',id:wall.id,index:1,bulgeIn:18},'Spoken curve uses exact selected edge');
 const missing=voice('raise this wall 6 inches',{partIds:[],boards:[]});truth('localOnly' in missing&&missing.localOnly,'A missing selection requests clarification locally');
 const wrong=voice('raise this wall 6 inches',patioSelected);truth('localOnly' in wrong&&wrong.localOnly,'A selected patio cannot be silently treated as a wall');
 const ambiguous=voice('curve this edge 18 inches',choose(wall.id));truth('localOnly' in ambiguous&&ambiguous.localOnly,'A multi-edge wall requires exact edge selection');
 const point=voice('curve this edge 18 inches',choose(wall.id,'point',1));truth('localOnly' in point&&point.localOnly,'A selected point cannot be silently treated as an edge');
 const stale=voice('raise this wall 6 inches',choose('deleted-wall'));truth('localOnly' in stale&&stale.localOnly,'Deleted selected IDs cannot target another wall');
 const negative=voice('raise this wall -6 inches',wallSelected);truth('localOnly' in negative&&negative.localOnly,'Negative raise cannot invert the requested direction');
 const before=JSON.stringify(state.data),c=command('curve this edge 18 inches',wallSelected),request={id:'voice-preview',expectedRevision:snapshot.revision,commands:[c]};
 const preview=await api.preview(request);if('error'in preview)throw Error(preview.error.message);truth(preview.changed,'Selected edge curves in real controller');equal(JSON.stringify(state.data),before,'Voice preview never mutates design');equal(commits,0,'Voice preview has no commit');
 const applied=await api.execute(request);if('error'in applied)throw Error(applied.error.message);equal(commits,1,'Voice edit commits once');truth(applied.snapshot.design.yardFeatures!.find(f=>f.id===wall.id)!.curves?.some(c=>c.edge===1&&c.bulgeIn===18),'Selected wall edge retains its exact circular definition after apply');equal(applied.snapshot.design.yardFeatures!.find(f=>f.id===wall.id)!.wallConstruction,wall.wallConstruction,'Reinforcement inputs survive voice curve');
 const undo=await api.execute({id:'voice-undo',expectedRevision:applied.revision,commands:[{type:'history.undo'}]});if('error'in undo)throw Error(undo.error.message);equal(yardShapeWorldPoints(undo.snapshot.design.yardFeatures!.find(f=>f.id===wall.id)!),yardShapeWorldPoints(wall),'Undo restores exact wall shape');
 const planned=parseAssistantPlan({kind:'edit',message:'Raise the selected wall.',assumptions:[],commands:[{type:'yard.elevation',id:wall.id,field:'baseElevationIn',valueIn:3}]});if('error'in planned)throw Error(planned.error);
 truth(assistantPlanRequest(planned.plan,{id:'voice-ai-selected',expectedRevision:snapshot.revision,snapshot,selection:wallSelected,requestText:'raise this wall six inches'}).commands.length===1,'Model-proposed selected target compiles against current context');
 assert.throws(()=>assistantPlanRequest(planned.plan,{id:'voice-ai-wrong',expectedRevision:snapshot.revision,snapshot,selection:choose(other.id),requestText:'raise this wall six inches'}));checks++;
 const wrongEdge=parseAssistantPlan({kind:'edit',message:'Curve this edge.',assumptions:[],commands:[{type:'yard.curve',id:wall.id,index:0,bulgeIn:18}]});if('error'in wrongEdge)throw Error(wrongEdge.error);
 assert.throws(()=>assistantPlanRequest(wrongEdge.plan,{id:'voice-ai-wrong-edge',expectedRevision:snapshot.revision,snapshot,selection:wallSelected,requestText:'curve this edge eighteen inches'}));checks++;
 assert.throws(()=>assistantPlanRequest(wrongEdge.plan,{id:'voice-ai-no-edge',expectedRevision:snapshot.revision,snapshot,selection:choose(wall.id),requestText:'curve this wall eighteen inches'}));checks++;
 console.log(`Yard voice: ${checks} real selection, preview, apply and safety checks passed.`);
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
