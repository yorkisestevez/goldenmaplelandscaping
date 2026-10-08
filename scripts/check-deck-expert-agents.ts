import assert from 'node:assert/strict';
import {ASSISTANT_PLAN_SCHEMA,ASSISTANT_SYSTEM_PROMPT,parseAssistantPlan,assistantPlanRequest} from '../src/features/deckcraft/designer/assistantPlan';
import {ASSISTANT_CLOUD_SYSTEM,ASSISTANT_WIRE_SCHEMA,parseAssistantOutput} from '../server/deckAssistantCloud';
import {parseDeckAssistantRequest} from '../server/deckAssistantBackend';
import {EXPERT_AGENTS,EXPERT_IDS,assistantSystemPromptFor,expertOf,isExpertId} from '../src/features/deckcraft/designer/expertAgents';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {buildAssistantContext} from '../src/features/deckcraft/designer/assistantPlan';

let checks=0;
const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};

ok(EXPERT_IDS.length===5&&EXPERT_AGENTS.every(e=>isExpertId(e.id)),'Five expert personas are registered');
ok(expertOf('decking').title.includes('Decking')&&expertOf(undefined).id==='general','Expert lookup defaults to general');
ok(assistantSystemPromptFor('construction',ASSISTANT_SYSTEM_PROMPT).includes('EXPERT MODE — CONSTRUCTION')&&assistantSystemPromptFor('construction',ASSISTANT_SYSTEM_PROMPT).includes('never an already applied'),'Expert prompts keep the base policy and add their mode');
ok(ASSISTANT_SYSTEM_PROMPT.includes('kind "advice"')&&JSON.stringify(ASSISTANT_PLAN_SCHEMA).includes('"advice"'),'Plan schema and base prompt allow advice');
ok((ASSISTANT_WIRE_SCHEMA.properties.kind.enum as readonly string[]).includes('advice'),'Cloud wire schema accepts advice');

const advice=parseAssistantPlan({kind:'advice',message:'Reserve ages better than Terrain for a high walkout; keep the border matching the field.',assumptions:['Catalogue comparison only; no prices stated.'],commands:[],question:'Switch the field boards to Reserve in Dark Hickory?',choices:['Yes, preview Reserve Dark Hickory','Keep current collection']});
ok(advice.ok&&advice.ok===true&&advice.plan.kind==='advice'&&advice.plan.commands.length===0,'Advice plans parse with empty commands');
if(advice.ok)assert.throws(()=>assistantPlanRequest(advice.plan,{id:'x',expectedRevision:0}),/Advice does not change/);checks++;

const clarify=parseAssistantPlan({kind:'clarify',message:'Need a target.',assumptions:[],commands:[],question:'Which edge?',choices:['Left','Right']});
ok(clarify.ok,'Clarify still parses');

const cloudAdvice=parseAssistantOutput(JSON.stringify({kind:'advice',message:'Helical piles suit deeper frost and less spoil on this walkout.',assumptions:[],commands_json:'[]',question:'',choices:[]}));
ok(cloudAdvice.kind==='advice'&&cloudAdvice.commands.length===0,'Cloud wrapper maps advice');

let state:DeckAgentHostState={data:deckReleaseData(structuredClone(DEFAULT_DECK)),ready:true,view:'plan',openSections:[],canUndo:false,canRedo:false};
const api=createDeckAgentController({getState:()=>state,commitDesign:()=>{},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:async()=>{}});
const ctx=buildAssistantContext(api.read());
const parsed=parseDeckAssistantRequest({prompt:'Compare Vintage and Reserve for this rail.',context:ctx,expert:'decking'});
ok(parsed.expert==='decking'&&parsed.prompt.includes('Compare'),'Backend accepts expert on the request');
assert.throws(()=>{try{parseDeckAssistantRequest({prompt:'x',context:ctx,expert:'wizard'});}catch(e){throw e;}},/Unknown expert|invalid_request/);checks++;
ok(parseDeckAssistantRequest({prompt:'Make it wider',context:ctx}).expert==='general','Missing expert defaults to general');
ok(ASSISTANT_CLOUD_SYSTEM.includes(ASSISTANT_SYSTEM_PROMPT.slice(0,40)),'Cloud system still embeds the base policy');
ok(EXPERT_AGENTS.every(e=>e.examples.length>=2&&e.promptAddendum.includes('EXPERT MODE')),'Every expert ships examples and a mode addendum');
api.dispose();

console.log(`DECK EXPERT AGENTS OK — ${EXPERT_AGENTS.length} personas, advice plans, cloud wire and request validation; ${checks} checks.`);
