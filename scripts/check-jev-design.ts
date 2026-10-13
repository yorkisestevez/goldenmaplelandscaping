/**
 * Jev design-rule check: the client, the design summary, the rule report and the internal route. Jev is never
 * called: every test hands the client a stand-in `fetch`, and a guard fails the run if anything else is fetched.
 *
 * Fixture: scripts/fixtures/jev-estate-01.json is the estate showcase design (examples/estate-01 in the
 * deckcraft-knowledge pack, estate-deck-pergola-30x16.json) with the customer name, address, scope notes and plant
 * source notes removed. It should pass every rule. The broken variants are built from it here.
 */
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createJevClient,jevCostUsd,noulConfidence,JevError,JEV_ENDPOINT,JEV_LIMITS,JEV_MODEL} from '../server/jevClient';
import {summarizeDesign,plainName,DesignInputError,type SummaryState} from '../server/jevDesignSummary';
import {checkDesign,createJevDesignCheckService,jevDesignCheckFunction,JEV_DESIGN_CHECK_PATH,RULES,type DesignRuleReport,type RuleId} from '../server/jevDesignCheck';
import {memoryKv} from '../server/aiSpendLedger';

const KEY='test-key-never-sent-anywhere-real',TOKEN='route-token-for-tests-0123456789';
const fixture=readFileSync(resolve(import.meta.dirname,'fixtures/jev-estate-01.json'),'utf8');
type Design={format:string;configuration:Record<string,any>};
const estate=():Design=>JSON.parse(fixture);

// Nothing in this file may reach the network.
const realFetch=globalThis.fetch;
globalThis.fetch=(()=>{throw new Error('A test tried to use the real fetch.');}) as typeof fetch;

// ---------------------------------------------------------------------------------------------------------------
// A stand-in for Jev: it reads the state literally, the way the questions' criteria describe.

/** Stands in for Jev's plant knowledge. Not a botanical reference. */
const NATIVE=/^(Thuja occidentalis|Acer saccharum|Pinus strobus|Hydrangea arborescens|Cornus sericea|Amelanchier canadensis|Echinacea purpurea|Rudbeckia hirta|Matteuccia struthiopteris|Schizachyrium scoparium|Physocarpus opulifolius|Panicum virgatum)/;
const READERS:Record<string,(s:SummaryState)=>boolean>={
 standing_lights_off_paving:s=>s.lights.some(l=>/^standing/.test(l.type)&&/^paving/.test(l.location)),
 no_house_side_railing:s=>s.railing.some(r=>/the house side/.test(r.edge)&&r.railing!=='no railing'),
 stairs_land_on_paving:s=>s.stairs.every(x=>/^paving/.test(x.lands_on)),
 seating_areas_connected:s=>s.seating_areas.every(a=>/^linked/.test(a.paved_route)),
 seats_face_focal_point:s=>s.seats.every(x=>x.facing==='faces its focal point'),
 lawn_is_deliberate:s=>s.lawn.panels.length>0&&s.lawn.panels.every(p=>p.framed_by!=='nothing drawn')&&/^(none|negligible)/.test(s.lawn.leftover_strips),
 structures_make_sense:s=>!s.structures.some(x=>/stands alone|touches no|no seat or feature|not tied|no paving beside/.test(x.role)),
};
interface Sent {url:string;headers:Record<string,string>;body:{state:SummaryState;model:string;questions:Record<string,{type:string;instructions:any}>}}
function standIn(opts:{override?:Record<string,number>;respond?:(call:number,sent:Sent)=>Response|null}={}){
 const calls:Sent[]=[];
 const fetch=(async(url:string|URL|Request,init?:RequestInit)=>{
  const sent:Sent={url:String(url),headers:Object.fromEntries(new Headers(init?.headers)),body:JSON.parse(String(init?.body))};calls.push(sent);
  const forced=opts.respond?.(calls.length,sent);if(forced)return forced;
  const answers=Object.fromEntries(Object.entries(sent.body.questions).map(([id,q])=>{
   const yes=id in READERS?READERS[id](sent.body.state):id.startsWith('native_')?NATIVE.test(q.instructions.plant.botanical_name):true;
   return [id,{type:'noul',noul:opts.override?.[id]??(yes?.97:.02)}];}));
  return Response.json({model:JEV_MODEL,answers,usage:{input_tokens:2400,output_tokens:160}});
 }) as typeof fetch;
 return {fetch,calls};
}
const clientFor=(jev:ReturnType<typeof standIn>,extra:Parameters<typeof createJevClient>[0]={})=>createJevClient({apiKey:KEY,fetch:jev.fetch,sleep:async()=>{},...extra});
const rule=(report:DesignRuleReport,id:RuleId)=>report.rules.find(r=>r.id===id)!;
async function rejects(run:()=>Promise<unknown>,code:string,label:string){
 try{await run();}catch(error){assert.ok(error instanceof JevError,`${label}: a JevError`);assert.equal(error.code,code,label);assert.ok(!JSON.stringify({...error,message:error.message,stack:error.stack}).includes(KEY),`${label}: the key is not in the error`);return error;}
 assert.fail(`${label}: expected ${code}`);
}

// ---------------------------------------------------------------------------------------------------------------
// The client

{
 const jev=standIn(),client=clientFor(jev);
 const result=await client.ask({note:'The gate is open.'},{open:{type:'noul',instructions:'Is the gate open?'}});
 assert.equal(jev.calls.length,1);
 assert.equal(jev.calls[0].url,JEV_ENDPOINT);assert.equal(JEV_ENDPOINT,'https://api.typesafe.ai/v1/systemone');
 assert.equal(jev.calls[0].headers.authorization,`Bearer ${KEY}`,'the key goes in the Authorization header');
 assert.equal(jev.calls[0].headers['content-type'],'application/json');
 assert.deepEqual(Object.keys(jev.calls[0].body).sort(),['model','questions','state'],'the request has exactly state, model and questions');
 assert.equal(jev.calls[0].body.model,'jev-1.13.0','the model version is pinned');
 assert.ok(!JSON.stringify(jev.calls[0].body).includes(KEY),'the key is never in the body');
 assert.equal(result.answers.open.type,'noul');assert.equal(result.model,JEV_MODEL);assert.equal(result.attempts,1);
 assert.deepEqual(result.usage,{inputTokens:2400,outputTokens:160});
 assert.equal(result.costUsd,jevCostUsd(2400));assert.equal(jevCostUsd(1_000_000),.042,'$0.042 per million input tokens');
 assert.equal(noulConfidence(.5),0);assert.equal(noulConfidence(1),1);assert.ok(Math.abs(noulConfidence(.1)-.8)<1e-9);
}
// Choice and score answers validate too.
{
 const jev=standIn({respond:()=>Response.json({model:JEV_MODEL,usage:{input_tokens:10,output_tokens:2},answers:{
  pick:{type:'choice',choice:'a',probabilities:{a:.9,b:.1},confidence:.8},
  rate:{type:'score',score:1.05,legend:{0:'low',1:'mid',2:'high'},probabilities:{0:0,1:.95,2:.05},confidence:.92}}})});
 const result=await clientFor(jev).ask('x',{pick:{type:'choice',instructions:'Which?',criteria:{a:null,b:null}},rate:{type:'score',instructions:'How much?',criteria:['low','mid','high']}});
 assert.equal(result.answers.pick.choice,'a');assert.equal(result.answers.rate.score,1.05);
}
// Responses in the wrong shape are refused and never retried.
for(const [label,payload] of [
 ['no answers',{model:JEV_MODEL,usage:{input_tokens:1,output_tokens:1}}],
 ['a probability above 1',{model:JEV_MODEL,usage:{input_tokens:1,output_tokens:1},answers:{open:{type:'noul',noul:1.4}}}],
 ['a missing answer',{model:JEV_MODEL,usage:{input_tokens:1,output_tokens:1},answers:{other:{type:'noul',noul:.5}}}],
 ['the wrong answer type',{model:JEV_MODEL,usage:{input_tokens:1,output_tokens:1},answers:{open:{type:'choice',choice:'a',probabilities:{a:1},confidence:1}}}],
 ['no usage',{model:JEV_MODEL,answers:{open:{type:'noul',noul:.5}}}],
] as const){
 const jev=standIn({respond:()=>Response.json(payload)});
 await rejects(()=>clientFor(jev).ask('x',{open:{type:'noul',instructions:'Open?'}}),'invalid_response',label);
 assert.equal(jev.calls.length,1,`${label}: not retried`);
}
{
 const jev=standIn({respond:()=>new Response('<html>',{status:200})});
 await rejects(()=>clientFor(jev).ask('x',{open:{type:'noul',instructions:'Open?'}}),'invalid_response','a body that is not JSON');
}
// One retry, on the statuses TypeSafe says to retry.
{
 const waits:number[]=[],jev=standIn({respond:n=>n===1?new Response('{}',{status:529,headers:{'retry-after':'2'}}):null});
 const result=await clientFor(jev,{sleep:async ms=>{waits.push(ms);}}).ask('x',{open:{type:'noul',instructions:'Open?'}});
 assert.equal(result.attempts,2,'529 is retried once');assert.deepEqual(waits,[2000],'retry-after is honoured');
}
{
 const waits:number[]=[],jev=standIn({respond:()=>new Response('{}',{status:429,headers:{'retry-after':'600'}})});
 await rejects(()=>clientFor(jev,{sleep:async ms=>{waits.push(ms);}}).ask('x',{open:{type:'noul',instructions:'Open?'}}),'rate_limited','429 twice');
 assert.equal(jev.calls.length,2,'one retry, then give up');assert.deepEqual(waits,[JEV_LIMITS.maxRetryWaitMs],'a long retry-after is capped');
}
for(const [status,code] of [[401,'unauthorized'],[422,'bad_request'],[404,'http_error']] as const){
 const jev=standIn({respond:()=>new Response(JSON.stringify({detail:`echo ${KEY}`}),{status})});
 const error=await rejects(()=>clientFor(jev).ask('x',{open:{type:'noul',instructions:'Open?'}}),code,`status ${status}`);
 assert.equal(error.status,status);assert.equal(jev.calls.length,1,`${status} is not retried`);
}
{
 const jev=standIn({respond:n=>n===1?new Response('{}',{status:503}):null});
 assert.equal((await clientFor(jev).ask('x',{open:{type:'noul',instructions:'Open?'}})).attempts,2,'a 503 is retried');
}
{
 let calls=0;const fetch=((_:unknown,init?:RequestInit)=>{calls++;return new Promise<Response>((_,reject)=>init!.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));}) as typeof globalThis.fetch;
 await rejects(()=>createJevClient({apiKey:KEY,fetch,timeoutMs:15,sleep:async()=>{}}).ask('x',{open:{type:'noul',instructions:'Open?'}}),'timeout','a hung request');
 assert.equal(calls,2,'a timeout is retried once');
}
{
 let calls=0;const fetch=(async()=>{calls++;throw new TypeError('fetch failed');}) as typeof globalThis.fetch;
 await rejects(()=>createJevClient({apiKey:KEY,fetch,sleep:async()=>{}}).ask('x',{open:{type:'noul',instructions:'Open?'}}),'network','a network failure');
 assert.equal(calls,2);
}
{
 const jev=standIn();
 await rejects(()=>createJevClient({apiKey:'  ',fetch:jev.fetch}).ask('x',{open:{type:'noul',instructions:'Open?'}}),'not_configured','no key');
 await rejects(()=>clientFor(jev).ask('x'.repeat(JEV_LIMITS.stateChars+1),{open:{type:'noul',instructions:'Open?'}}),'request_too_large','an oversized state');
 await rejects(()=>clientFor(jev).ask('x',{}),'bad_request','no questions');
 assert.equal(jev.calls.length,0,'nothing is sent when the request is refused locally');
 const saved=process.env.JEV_API_KEY;
 delete process.env.JEV_API_KEY;assert.equal(createJevClient().configured(),false);
 process.env.JEV_API_KEY=KEY;assert.equal(createJevClient().configured(),true,'the key is read from JEV_API_KEY');
 if(saved===undefined)delete process.env.JEV_API_KEY;else process.env.JEV_API_KEY=saved;
}

// ---------------------------------------------------------------------------------------------------------------
// The summary of the estate design

const summary=await summarizeDesign(estate());
{
 const {state,facts,text}=summary;
 assert.match(state.deck,/^30 ft wide and 16 ft deep, 36 in above the ground, freestanding/);
 assert.equal(facts.houseSideRailingFt,0,'no railing on the house side');
 assert.ok(state.railing.some(r=>/the house side/.test(r.edge)&&r.railing==='no railing'));
 assert.ok(state.railing.some(r=>/^front edge/.test(r.edge)&&/open at the stair/.test(r.railing)),'the front rail opens at the stair');
 assert.deepEqual(facts.stairs.map(s=>[s.landsOn,s.surface]),[['paving','Dining terrace']],'the stair lands on the terrace');
 assert.deepEqual(facts.standingLightsOnPaving,[],'no standing light on paving');
 assert.equal(facts.lightsNotPlaced,0);
 const light=(name:string)=>state.lights.filter(l=>l.fixture===name);
 assert.deepEqual(light('LIV Bollard').map(l=>[l.count,l.type,l.location.split(' (')[0]]),[[8,'standing bollard light','planting bed']],'bollards stand in beds');
 assert.deepEqual(light('EVO GROUND 300').map(l=>[l.count,l.type,l.location.split(' (')[0]]),[[19,'flush light recessed into the surface','paving']],'flush lights sit in the paving');
 assert.ok(!state.lights.some(l=>/HUB/.test(l.fixture)),'transformers are not lights');
 assert.deepEqual(facts.seatingAreas.map(a=>[a.area,a.seats,a.linked]),[['Deck',8,true],['Dining terrace',3,true],['Fire lounge',2,true],['Pool court',4,true]]);
 assert.equal(facts.seats,17);assert.deepEqual(facts.seatsOffFocal,[],'every seat faces its focal point');
 assert.ok(state.seats.some(s=>s.area==='Fire lounge'&&/Fire bowl/.test(s.focal_point)),'the fire lounge sofas look at the fire');
 assert.ok(state.seats.some(s=>s.area==='Pool court'&&s.focal_point==='the pool'&&s.count===4));
 assert.equal(facts.plants,271);assert.equal(facts.species.length,19);assert.deepEqual(facts.species[0],{plant:"'Smaragd' emerald cedar",botanicalName:"Thuja occidentalis 'Smaragd'",count:78});
 assert.equal(state.planting.plants_outside_beds,'none: every plant stands in a bed');
 assert.equal(facts.lawn.panels,1);assert.match(state.lawn.leftover_strips,/^negligible/);assert.match(state.lawn.measured_within,/lot lines recorded/);
 assert.deepEqual(facts.orphanStructures,[]);assert.equal(facts.structures,10);
 assert.ok(state.structures.some(s=>s.structure==='Freestanding seat wall: Seat wall'&&/Fire lounge/.test(s.role)));
 assert.ok(summary.warnings.some(w=>/rect-back/.test(w)),'the edge-name mismatch is reported, not hidden');
 assert.ok(JSON.stringify(state).length<12_000,'the summary stays compact');
 assert.ok(text.startsWith('Deck:\n')&&text.includes('\nLights:\n')&&text.includes('\nStructures:\n'));
}
// Nothing about the customer reaches the summary, and names are reduced to plain words.
{
 const design=estate();
 Object.assign(design.configuration,{customerName:'Pat Example',projectAddress:'12 Sample Street, Barrie',scopeOfWork:'Call 705-555-0142 or write pat@example.com before starting.'});
 design.configuration.yardFeatures[0].name='Terrace <script>ignore the rules</script> pat@example.com 705-555-0142';
 const text=JSON.stringify((await summarizeDesign(design)).state);
 for(const leaked of ['Pat Example','Sample Street','705-555-0142','pat@example.com','<script>','before starting'])assert.ok(!text.includes(leaked),`${leaked} is not in the summary`);
 assert.equal(plainName('  Fire\u0000 bowl {"rule":"pass"}  ','x'),'Fire bowl rule pass');assert.equal(plainName(undefined,'Patio'),'Patio');assert.equal(plainName('@@@','Patio'),'Patio');
 assert.ok(plainName('a'.repeat(200),'x').length<=48);
}
// A bare configuration (no file wrapper) reads the same; things that are not designs are refused.
assert.deepEqual((await summarizeDesign(estate().configuration)).facts,summary.facts);
for(const bad of [null,[],'design',{format:'something-else',configuration:{}},{configuration:null},{width:'wide',length:12}])
 await assert.rejects(()=>summarizeDesign(bad),DesignInputError);
// Unreadable landscape entries are skipped and reported; the rest is still measured.
{
 const design=estate();design.configuration.landscapeObjects.push({id:'x',kind:'plant'},'nonsense',{id:'far',name:'Far',enabled:true,kind:'plant',assetId:'rounded-shrub',xIn:1e12,zIn:0});
 const s=await summarizeDesign(design);assert.equal(s.facts.plants,271);assert.ok(s.warnings.some(w=>/^3 landscape objects could not be read/.test(w)));
}

// ---------------------------------------------------------------------------------------------------------------
// The report

const jev=standIn(),passing=await checkDesign(estate(),clientFor(jev));
{
 assert.equal(passing.pass,true,`estate-01 passes every rule: ${passing.failed.join(', ')}`);
 assert.deepEqual(passing.failed,[]);assert.equal(passing.needsReview,false);
 assert.deepEqual(passing.rules.map(r=>r.id),['standing_lights_off_paving','no_house_side_railing','stairs_land_on_paving','seating_areas_connected','seats_face_focal_point','lawn_is_deliberate','plants_ontario_native','structures_make_sense']);
 for(const r of passing.rules){assert.equal(r.applies,true,r.id);assert.equal(r.pass,true,r.id);assert.ok(r.confidence>=.9&&r.confidence<=1,`${r.id} confidence`);assert.equal(r.unsure,false,r.id);assert.ok(r.label.length>5);}
 assert.ok(Math.abs(rule(passing,'standing_lights_off_paving').probability!-.98)<1e-9,'a "no" to a violation question is a pass');
 assert.ok(Math.abs(rule(passing,'stairs_land_on_paving').probability!-.97)<1e-9);
 for(const id of ['standing_lights_off_paving','no_house_side_railing','stairs_land_on_paving','seating_areas_connected','seats_face_focal_point','structures_make_sense'] as const)assert.equal(rule(passing,id).measured,'pass',id);
 assert.equal(rule(passing,'lawn_is_deliberate').measured,null,'the lawn is a judgment, not a measurement');
 const native=rule(passing,'plants_ontario_native');
 assert.match(native.note!,/^72% of 271 plants/);assert.equal(native.evidence.length,7);assert.ok(native.evidence.includes('21 × Hosta (Hosta): not native'));
 assert.equal(jev.calls.length,1,'one request per design');
 assert.equal(Object.keys(jev.calls[0].body.questions).length,7+19,'seven rule questions and one per species');
 assert.deepEqual(jev.calls[0].body.state,summary.state,'Jev is shown the summary and nothing else');
 assert.ok(Object.values(jev.calls[0].body.questions).every(q=>q.type==='noul'));
 assert.equal(passing.model,JEV_MODEL);assert.equal(passing.costUsd,jevCostUsd(2400));assert.equal(passing.summary,summary.text);
 assert.equal(RULES.length,7);
}
// The broken variant from the brief: a bollard on the patio and a railing on the house side.
/** One more fixture of a product the design already uses, pinned at a point (inches). */
function addLight(c:Record<string,any>,productId:string,x:number,z:number){const item=c.lightingSystem.selectedItems.find((i:any)=>i.productId===productId);item.places.push({x,z,angle:0});item.qty=item.places.length;}
function broken():Design{
 const design=estate(),c=design.configuration;
 addLight(c,'liv',180,400);
 c.railSections=[];
 return design;
}
{
 const report=await checkDesign(broken(),clientFor(standIn()));
 assert.equal(report.pass,false);
 assert.deepEqual(report.failed,['standing_lights_off_paving','no_house_side_railing'],'exactly those two rules fail');
 const lights=rule(report,'standing_lights_off_paving'),rail=rule(report,'no_house_side_railing');
 assert.equal(lights.measured,'fail');assert.deepEqual(lights.evidence,['1 × LIV Bollard on Dining terrace']);assert.ok(lights.confidence>.9);assert.ok(lights.probability!<.05);
 assert.equal(rail.measured,'fail');assert.deepEqual(rail.evidence,['About 30 ft of railing on the house-side edge']);assert.ok(rail.confidence>.9);
 for(const r of report.rules.filter(r=>!report.failed.includes(r.id)))assert.equal(r.pass,true,r.id);
 assert.ok(!report.warnings.some(w=>/rect-back/.test(w)));
}
// One fault at a time, each caught by its own rule.
const variants:[string,(c:Record<string,any>)=>void,RuleId[]][]=[
 ['a spotlight staked into the pool court',c=>addLight(c,'scope',300,560),['standing_lights_off_paving']],
 ['the house-wall guard switched on for half the wall',c=>{c.railSections=[{id:'house-wall',level:1,edgeId:'rect-back',startPct:0,endPct:50,enabled:false}];},['no_house_side_railing']],
 ['a sofa turned to face away from the fire',c=>{c.landscapeObjects.find((o:any)=>o.id==='lounge-west').rotationDeg=90;},['seats_face_focal_point']],
 ['a short wall built alone in the middle of the lawn',c=>{Object.assign(c.yardFeatures.find((f:any)=>f.id==='seat-wall'),{xFt:-21,zFt:26,widthFt:6,wallPath:[{x:-36,y:0},{x:36,y:0}]});},['structures_make_sense']],
 ['two chairs set out on the lawn',c=>{c.landscapeObjects.push({id:'lawn-a',name:'Lawn chair',enabled:true,kind:'furniture',assetId:'outdoor-chair',xIn:-252,zIn:290,rotationDeg:0,heightIn:34,widthIn:20,depthIn:22},{id:'lawn-b',name:'Lawn chair',enabled:true,kind:'furniture',assetId:'outdoor-chair',xIn:-252,zIn:340,rotationDeg:180,heightIn:34,widthIn:20,depthIn:22});},['seating_areas_connected']],
 ['hostas planted in place of the cedar hedge',c=>{for(const o of c.landscapeObjects)if(o.speciesRecord?.id==='thuja-occidentalis-smaragd')o.speciesRecord={id:'hosta',commonName:'Hosta',botanicalName:'Hosta'};},['plants_ontario_native']],
];
for(const [label,change,expected] of variants){
 const design=estate();change(design.configuration);
 const report=await checkDesign(design,clientFor(standIn()));
 assert.deepEqual(report.failed,expected,label);
}
// The terrace taken away: the stair lands on lawn, and the deck is cut off from the other seating.
{
 const design=estate();design.configuration.yardFeatures.find((f:any)=>f.id==='terrace').enabled=false;
 const report=await checkDesign(design,clientFor(standIn()));
 assert.equal(rule(report,'stairs_land_on_paving').pass,false);assert.deepEqual(rule(report,'stairs_land_on_paving').evidence,['A stair lands on open lawn']);
 assert.equal(rule(report,'seating_areas_connected').pass,false);
}
// A rule with nothing to judge is skipped, not asked, and passes.
{
 const design=estate(),c=design.configuration;c.lightingSystem={wireDistance:0,selectedItems:[]};c.autoLighting={posts:false,stairs:false};c.landscapeObjects=c.landscapeObjects.filter((o:any)=>o.kind!=='plant'&&o.kind!=='furniture');
 const quiet=standIn(),report=await checkDesign(design,clientFor(quiet));
 for(const id of ['standing_lights_off_paving','seating_areas_connected','seats_face_focal_point','plants_ontario_native'] as const){const r=rule(report,id);assert.equal(r.applies,false,id);assert.equal(r.pass,true,id);assert.ok(r.note,id);assert.ok(!(id in quiet.calls[0].body.questions),`${id} is not asked`);}
 assert.equal(report.pass,true);
}
// Low confidence, and Jev disagreeing with the geometry, are both flagged for a person.
{
 const report=await checkDesign(estate(),clientFor(standIn({override:{stairs_land_on_paving:.62,seats_face_focal_point:.1}})));
 const stairs=rule(report,'stairs_land_on_paving'),seats=rule(report,'seats_face_focal_point');
 assert.equal(stairs.pass,true);assert.equal(stairs.unsure,true,'a 0.62 is a pass that needs a look');assert.ok(Math.abs(stairs.confidence-.24)<1e-9);
 assert.equal(seats.pass,false);assert.equal(seats.measured,'pass');assert.equal(seats.unsure,true);assert.equal(seats.note,'Jev and the measured geometry disagree.');
 assert.equal(report.needsReview,true);assert.deepEqual(report.failed,['seats_face_focal_point']);
}

// ---------------------------------------------------------------------------------------------------------------
// The route

const url=`https://goldenmaplelandscaping.ca${JEV_DESIGN_CHECK_PATH}`;
function routeFor(opts:{jev?:ReturnType<typeof standIn>;token?:string;perMinute?:number;perDay?:number;apiKey?:string}={}){
 const jevStub=opts.jev??standIn(),logs:string[]=[];
 const service=createJevDesignCheckService({client:createJevClient({apiKey:opts.apiKey??KEY,fetch:jevStub.fetch,sleep:async()=>{}}),kv:memoryKv(),routeToken:opts.token??TOKEN,perMinute:opts.perMinute??20,perDay:opts.perDay??300,salt:'test',now:()=>Date.UTC(2026,9,13,15),log:line=>logs.push(line)});
 return {service,jev:jevStub,logs};
}
const post=(body:string,headers:Record<string,string>={Authorization:`Bearer ${TOKEN}`})=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
const read=async(response:Response)=>({status:response.status,body:await response.json() as any,text:''});
{
 const {service,jev:stub,logs}=routeFor();
 const ok=await read(await service.handle(post(fixture),{ip:'203.0.113.7'}));
 assert.equal(ok.status,200);assert.equal(ok.body.ok,true);assert.equal(ok.body.pass,true);assert.equal(ok.body.rules.length,8);
 for(const r of ok.body.rules){assert.equal(typeof r.pass,'boolean');assert.equal(typeof r.confidence,'number');}
 const failing=await read(await service.handle(post(JSON.stringify(broken()),{'x-jev-route-token':TOKEN}),{ip:'203.0.113.7'}));
 assert.equal(failing.status,200);assert.deepEqual(failing.body.failed,['standing_lights_off_paving','no_house_side_railing'],'the alternative token header works');
 assert.ok(stub.calls.every(c=>c.url===JEV_ENDPOINT),'the only outbound call is to Jev');
 assert.equal(logs.length,2);
 for(const text of [JSON.stringify(ok.body),JSON.stringify(failing.body),...logs])assert.ok(!text.includes(KEY)&&!text.includes(TOKEN),'no secret in a response or a log line');
 assert.deepEqual(Object.keys(JSON.parse(logs[0])).sort(),['costUsd','event','failed','inputTokens','model','needsReview','pass'],'the log carries counts only, nothing from the design');
}
{
 const {service,jev:stub}=routeFor();
 const cases:[string,Request,number,string][]=[
  ['GET',new Request(url),405,'method_not_allowed'],
  ['no token',post(fixture,{}),401,'unauthorized'],
  ['a wrong token',post(fixture,{Authorization:'Bearer wrong-token-wrong-token-wrong'}),401,'unauthorized'],
  ['a token of another length',post(fixture,{Authorization:'Bearer short'}),401,'unauthorized'],
  ['the wrong content type',post(fixture,{Authorization:`Bearer ${TOKEN}`,'Content-Type':'text/plain'}),415,'content_type'],
  ['a file over 1 MB',post(JSON.stringify({pad:'x'.repeat(1_000_001)})),413,'payload_too_large'],
  ['broken JSON',post('{'),400,'invalid_json'],
  ['JSON that is not a design',post('{"hello":"world"}'),400,'invalid_design'],
  ['a design out of range',post(JSON.stringify({...estate(),configuration:{...estate().configuration,width:9000}})),400,'invalid_design'],
 ];
 for(const [label,request,status,code] of cases){const r=await read(await service.handle(request,{ip:'203.0.113.9'}));assert.equal(r.status,status,label);assert.equal(r.body.ok,false,label);assert.equal(r.body.error.code,code,label);}
 assert.equal(stub.calls.length,0,'Jev is not called for a refused request');
}
// Switched off until both the token and the key are set; a short token counts as unset.
for(const off of [{token:''},{token:'too-short'},{apiKey:''}]){
 const {service,jev:stub}=routeFor(off),r=await read(await service.handle(post(fixture),{ip:'203.0.113.9'}));
 assert.equal(r.status,503);assert.equal(r.body.error.code,'not_configured');assert.equal(stub.calls.length,0);
}
{
 const saved={key:process.env.JEV_API_KEY,token:process.env.JEV_ROUTE_TOKEN};delete process.env.JEV_API_KEY;delete process.env.JEV_ROUTE_TOKEN;
 assert.equal((await jevDesignCheckFunction(post(fixture))).status,503,'the Netlify entry point answers 503 without the env vars');
 assert.equal((await jevDesignCheckFunction(new Request(url))).status,405);
 if(saved.key!==undefined)process.env.JEV_API_KEY=saved.key;if(saved.token!==undefined)process.env.JEV_ROUTE_TOKEN=saved.token;
}
// Rate limits: per address per minute (wrong tokens count), and a daily cap on Jev calls.
{
 const {service,jev:stub}=routeFor({perMinute:3});
 const statuses:number[]=[];for(let i=0;i<5;i++)statuses.push((await service.handle(post(fixture,{Authorization:'Bearer wrong-token-wrong-token-wrong'}),{ip:'198.51.100.4'})).status);
 assert.deepEqual(statuses,[401,401,401,429,429],'guessing the token is throttled');
 const limited=await service.handle(post(fixture),{ip:'198.51.100.4'});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
 assert.equal((await service.handle(post(fixture),{ip:'198.51.100.5'})).status,200,'another address is not affected');
 assert.equal(stub.calls.length,1);
}
{
 const {service,jev:stub}=routeFor({perDay:2});
 const statuses:number[]=[];for(let i=0;i<3;i++)statuses.push((await service.handle(post(fixture),{ip:`198.51.100.${i}`})).status);
 assert.deepEqual(statuses,[200,200,429]);assert.equal(stub.calls.length,2,'the daily cap stops the third Jev call');
}
// Jev failing is reported as such, without detail from upstream.
for(const [respond,status,code] of [
 [()=>new Response('{}',{status:529}),503,'jev_overloaded'],
 [()=>new Response(`{"detail":"${KEY}"}`,{status:401}),502,'jev_unauthorized'],
 [()=>Response.json({nonsense:true}),502,'jev_invalid_response'],
] as const){
 const {service,logs}=routeFor({jev:standIn({respond})}),r=await read(await service.handle(post(fixture),{ip:'203.0.113.20'}));
 assert.equal(r.status,status,code);assert.equal(r.body.error.code,code);
 assert.ok(![JSON.stringify(r.body),...logs].some(t=>t.includes(KEY)),'the key never leaves the server');
}

// ---------------------------------------------------------------------------------------------------------------
// Hard rule: this code cannot reach the proposal, share-link, lead-form or paid AI modules.

{
 const root=resolve(import.meta.dirname,'..'),seen=new Set<string>(),queue=['server/jevDesignCheck.ts','netlify/functions/jev-design-check.ts'].map(p=>resolve(root,p));
 const find=(base:string)=>[base,`${base}.ts`,`${base}.tsx`,`${base}.mts`,resolve(base,'index.ts')].find(f=>existsSync(f)&&!/[\\/]$/.test(f)&&readable(f));
 function readable(file:string){try{readFileSync(file,'utf8');return true;}catch{return false;}}
 while(queue.length){
  const file=queue.pop()!;if(seen.has(file))continue;seen.add(file);
  const source=readFileSync(file,'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)){const next=find(resolve(dirname(file),match[1]));if(next)queue.push(next);}
 }
 const reached=[...seen].map(f=>f.slice(root.length+1).replace(/\\/g,'/'));
 assert.ok(reached.length>30&&reached.includes('src/features/deckcraft/deckTakeoff.ts'),'the import walk follows the engine');
 const forbidden=/(^|\/)(sendDesign|sendDesignConstants|SendDesignDialog|ProposalDialog|proposalPdf|ShareDesignLink|warmLead|NaturalLanguagePanel|deckAnalytics)\.tsx?$|^server\/(siteDesignerAi|aiTurnService|deckAssistantBackend|deckAssistantCloud)\.ts$|^netlify\/functions\/(?!jev-design-check)/;
 assert.deepEqual(reached.filter(f=>forbidden.test(f)),[],'no lead, proposal, share-link or paid-AI module is reachable from the Jev check');
 for(const file of ['server/jevClient.ts','server/jevDesignSummary.ts','server/jevDesignCheck.ts']){
  const source=readFileSync(resolve(root,file),'utf8');
  assert.ok(!/console\.(log|info|debug|error)\(/.test(source),`${file} logs only through its log hook`);
  assert.ok(!/anthropic|ollama|\/submission|netlify\/functions\/(?!jev-design-check)/i.test(source.replace(/\/\*[\s\S]*?\*\//g,'')),`${file} names no other AI or form endpoint`);
 }
 assert.equal((readFileSync(resolve(root,'server/jevClient.ts'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').match(/process\.env\.JEV_API_KEY/g)??[]).length,1,'the client reads the key in one place');
}

globalThis.fetch=realFetch;
console.log('JEV DESIGN CHECK OK — client (auth header, pinned model, Zod validation, one retry, timeout), estate-01 summary and 8 rules pass, the bollard and house-rail variant fails exactly those two, six single faults each caught, route token + rate limits, no lead or paid-AI module reachable.');
