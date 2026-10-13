/**
 * Design-rule check for a DeckCraft design, judged by Jev (TypeSafe's System One model), and the internal route
 * behind /.netlify/functions/jev-design-check.
 *
 * One request per design: the summary from jevDesignSummary.ts is the state, and each design rule
 * (docs/06-design-rules.md in the deckcraft-knowledge pack) is a yes/no question about it. A noul answer is the
 * probability of yes; its confidence is |2p − 1|, the measure TypeSafe documents for nouls.
 *
 * Two rules are split differently from the brief, following TypeSafe's "one judgment per question":
 * - Lawn and planting are two rules, not one.
 * - Planting asks one question per species ("is this native to Ontario?") and the share of native plants is counted
 *   here, because Jev does not count reliably.
 *
 * Each rule also carries `measured`: what the summary's own geometry says, where geometry can settle it. Jev and the
 * measurement disagreeing is the signal to look at the question wording or the threshold.
 *
 * This file never touches the proposal, share-link, lead-form or DeckCraft AI assistant endpoints, and imports none
 * of their modules. Its only outbound call is the Jev request in jevClient.ts.
 */
import {createJevClient,noulConfidence,JevError,JEV_MODEL,type JevClient,type JevNoulQuestion} from './jevClient';
import {summarizeDesign,DesignInputError,type DesignFacts,type DesignSummary,type SummaryState} from './jevDesignSummary';
import {blobsKv,fileKv,hashId,kvUpdate,sameToken,dayOf,type AiKv} from './aiSpendLedger';

export const JEV_DESIGN_CHECK_PATH='/.netlify/functions/jev-design-check';
export const CHECK_POLICY={
 /** A rule passes when Jev puts the chance it is met at or above this. */
 passAt:.5,
 /** Below this confidence the answer is flagged for a person to look at. Not yet tuned against real designs. */
 unsureBelow:.6,
 /** Share of plants (by count) that must be Ontario natives. An owner decision; estate-01 mixes natives with a few
  * garden staples such as hosta and lilac. */
 nativeShareMin:.6,
 speciesAsked:60,
} as const;

export type RuleId='standing_lights_off_paving'|'no_house_side_railing'|'stairs_land_on_paving'|'seating_areas_connected'|'seats_face_focal_point'|'lawn_is_deliberate'|'plants_ontario_native'|'structures_make_sense';
type Measured='pass'|'fail'|null;
interface Rule {id:RuleId;label:string;
 /** Whether a yes from Jev means the rule is met or broken. Questions are asked the plain way round. */
 metWhen:'yes'|'no';
 /** Why the rule does not apply to this design, or null when it does. */
 skip(facts:DesignFacts,state:SummaryState):string|null;
 question:JevNoulQuestion;
 measured(facts:DesignFacts):Measured;
 evidence(facts:DesignFacts):string[]}

export const RULES:readonly Rule[]=[
 {id:'standing_lights_off_paving',label:'No standing or bollard lights on paving',metWhen:'no',
  skip:(_,s)=>s.lights.length?null:'The design has no lights.',
  question:{type:'noul',instructions:'Look at `lights`. Is there at least one fixture whose `type` is a standing light (a standing bollard light or a standing spotlight on a ground stake) and whose `location` is paving?',
   criteria:{true:'At least one entry has a standing type and a location that starts with "paving".',false:'Every standing light is in a planting bed or on open lawn, or there are no standing lights. Flush, wall, step and strip lights on paving do not count.'}},
  measured:f=>f.standingLightsOnPaving.length?'fail':f.lightsNotPlaced?null:'pass',evidence:f=>f.standingLightsOnPaving},
 {id:'no_house_side_railing',label:'No railing on the house side of the deck',metWhen:'no',
  skip:f=>!f.hasDeck?'The design has no deck.':f.houseSideRailingFt===null?'The deck has no railing, or no edge against a house.':null,
  question:{type:'noul',instructions:'Look at `railing`. Does the deck edge described as the house side have a railing along all or part of it?',
   criteria:{true:'An entry whose `edge` says "the house side" has a `railing` value that describes a railing.',false:'Every entry whose `edge` says "the house side" has the `railing` value "no railing".'}},
  measured:f=>f.houseSideRailingFt===null?null:f.houseSideRailingFt>0?'fail':'pass',evidence:f=>f.houseSideRailingFt?[`About ${f.houseSideRailingFt} ft of railing on the house-side edge`]:[]},
 {id:'stairs_land_on_paving',label:'Stairs land on paving',metWhen:'yes',
  skip:f=>f.stairs.length?null:'The design has no deck stair to the ground.',
  question:{type:'noul',instructions:'Look at `stairs`. Does every stair land on paving?',
   criteria:{true:'Every entry has a `lands_on` value that starts with "paving".',false:'At least one entry lands on open lawn, a planting bed, artificial turf or anything else that is not paving.'}},
  measured:f=>f.stairs.every(s=>s.landsOn==='paving')?'pass':'fail',evidence:f=>f.stairs.filter(s=>s.landsOn!=='paving').map(s=>`A stair lands on ${s.surface}`)},
 {id:'seating_areas_connected',label:'All sitting areas are connected',metWhen:'yes',
  skip:f=>f.seatingAreas.length>1?null:f.seatingAreas.length?'The design has a single seating area.':'The design has no seats.',
  question:{type:'noul',instructions:'Look at `seating_areas`. Is every seating area linked to the others by the deck, its stair and paving?',
   criteria:{true:'Every entry has a `paved_route` value that says it is linked to the other seating areas.',false:'At least one entry has a `paved_route` value that says it is not linked.'}},
  measured:f=>f.seatingAreas.every(a=>a.linked)?'pass':'fail',evidence:f=>f.seatingAreas.filter(a=>!a.linked).map(a=>`${a.area} is not linked by paving`)},
 {id:'seats_face_focal_point',label:'Every seat faces its focal point',metWhen:'yes',
  skip:f=>f.seats?null:'The design has no seats.',
  question:{type:'noul',instructions:'Look at `seats`. Does every seat face its focal point?',
   criteria:{true:'Every entry has the `facing` value "faces its focal point".',false:'At least one entry is angled away from its focal point, has its back to it, or has no focal point within reach.'}},
  measured:f=>f.seatsOffFocal.length?'fail':'pass',evidence:f=>f.seatsOffFocal},
 {id:'lawn_is_deliberate',label:'Lawn edges are deliberate',metWhen:'yes',
  skip:f=>f.lawn.openSqft?null:'The design leaves no open ground.',
  question:{type:'noul',instructions:'Look at `lawn`. Is the lawn a deliberate shape: one or more panels with clear edges formed by planting beds, paving or the lot line, with little ground left over in narrow strips?',
   criteria:{true:'Each lawn panel is framed by planting beds, paving, the deck or the lot line, and `leftover_strips` is "none" or starts with "negligible".',false:'There is no lawn panel, or a panel is framed by nothing drawn, or `leftover_strips` starts with "noticeable" or "large".'}},
  measured:()=>null,evidence:f=>f.lawn.stripSqft?[`About ${f.lawn.stripSqft} sq ft of open ground lies in strips under 3 ft wide or scraps under 50 sq ft`]:[]},
 {id:'structures_make_sense',label:'Every structure makes sense',metWhen:'yes',
  skip:f=>f.structures?null:'The design has no walls, paving, pool, fire feature or pergola.',
  question:{type:'noul',instructions:'Look at `structures`. Does every structure have a use or a connection, with no wall, paved area, fire feature, pool or pergola standing alone?',
   criteria:{true:'Every entry has a `role` that names what it holds, borders, links or runs along.',false:'At least one entry has a `role` that says it stands alone, touches no other paving, has no seat or feature on it, has no paving beside it, or is not tied to the deck or a paved area.'}},
  measured:f=>f.orphanStructures.length?'fail':'pass',evidence:f=>f.orphanStructures.map(name=>`${name} stands alone`)},
];
const NATIVE_LABEL='Plants are Ontario natives';

export interface RuleResult {id:RuleId;label:string;
 /** False when the design has nothing for the rule to judge; such a rule passes. */
 applies:boolean;pass:boolean;
 /** 0–1: how far Jev's answer is from a coin toss. */
 confidence:number;
 /** Jev's probability that the rule is met; null when the rule was not asked or is counted from several answers. */
 probability:number|null;
 /** Low confidence, or Jev and the measurement disagree. */
 unsure:boolean;
 /** What the summary's own geometry says, where it can tell. */
 measured:Measured;note?:string;evidence:string[]}
export interface DesignRuleReport {ok:true;pass:boolean;needsReview:boolean;failed:RuleId[];rules:RuleResult[];warnings:string[];
 model:string;usage:{inputTokens:number;outputTokens:number};costUsd:number;
 /** The text Jev was shown. */
 summary:string}

const speciesQuestion=(plant:string,botanical:string):JevNoulQuestion=>({type:'noul',
 instructions:{plant:{common_name:plant,botanical_name:botanical},question:'Is `plant` native to Ontario, Canada? A named cultivar of a species that grows wild in Ontario counts as native.'},
 criteria:{true:'The species grows wild in Ontario and was not introduced there by people.',false:'The species or hybrid was introduced to Ontario from another region, or the name is too vague to tell.'}});

/** Asks Jev every rule that applies to this design, in one request. */
export async function checkDesignSummary(summary:DesignSummary,client:JevClient,policy:{passAt:number;unsureBelow:number;nativeShareMin:number}=CHECK_POLICY,opts:{signal?:AbortSignal}={}):Promise<DesignRuleReport>{
 const {state,facts}=summary,warnings=[...summary.warnings];
 const skipped=new Map(RULES.map(r=>[r.id,r.skip(facts,state)])),asked=RULES.filter(r=>skipped.get(r.id)===null);
 const species=facts.species.slice(0,CHECK_POLICY.speciesAsked);
 if(facts.species.length>species.length)warnings.push(`Only the ${species.length} most-planted species were checked for being native.`);
 const questions:Record<string,JevNoulQuestion>={...Object.fromEntries(asked.map(r=>[r.id,r.question])),...Object.fromEntries(species.map((s,i)=>[`native_${i}`,speciesQuestion(s.plant,s.botanicalName)]))};
 const none={model:client.model,answers:{} as Record<string,{noul:number}>,usage:{inputTokens:0,outputTokens:0},costUsd:0};
 const result=Object.keys(questions).length?await client.ask(state,questions,opts):none;
 const rules:RuleResult[]=RULES.map(rule=>{
  const note=skipped.get(rule.id),measured=rule.measured(facts);
  if(note)return {id:rule.id,label:rule.label,applies:false,pass:true,confidence:1,probability:null,unsure:false,measured:null,note,evidence:[]};
  const yes=result.answers[rule.id].noul,probability=rule.metWhen==='yes'?yes:1-yes,pass=probability>=policy.passAt,confidence=noulConfidence(yes),disagrees=measured!==null&&(measured==='pass')!==pass;
  return {id:rule.id,label:rule.label,applies:true,pass,confidence,probability,unsure:confidence<policy.unsureBelow||disagrees,measured,...(disagrees?{note:'Jev and the measured geometry disagree.'}:{}),evidence:rule.evidence(facts)};
 });
 // Planting: one answer per species, counted here by number of plants.
 const lawnAt=rules.findIndex(r=>r.id==='lawn_is_deliberate');
 if(!species.length)rules.splice(lawnAt+1,0,{id:'plants_ontario_native',label:NATIVE_LABEL,applies:false,pass:true,confidence:1,probability:null,unsure:false,measured:null,note:'The design has no plants.',evidence:[]});
 else{
  const answered=species.map((s,i)=>({...s,p:result.answers[`native_${i}`].noul})),total=answered.reduce((n,s)=>n+s.count,0),native=answered.filter(s=>s.p>=.5).reduce((n,s)=>n+s.count,0),part=native/total;
  const confidence=answered.reduce((n,s)=>n+noulConfidence(s.p)*s.count,0)/total,introduced=answered.filter(s=>s.p<.5);
  rules.splice(lawnAt+1,0,{id:'plants_ontario_native',label:NATIVE_LABEL,applies:true,pass:part>=policy.nativeShareMin,confidence,probability:null,unsure:confidence<policy.unsureBelow,measured:null,
   note:`${Math.round(part*100)}% of ${total} plants are species Jev reads as native to Ontario; the rule asks for ${Math.round(policy.nativeShareMin*100)}%.`,
   evidence:introduced.map(s=>`${s.count} × ${s.plant}${s.botanicalName==='not recorded'?'':` (${s.botanicalName})`}: not native`)});
 }
 const failed=rules.filter(r=>!r.pass).map(r=>r.id);
 return {ok:true,pass:!failed.length,needsReview:rules.some(r=>r.unsure),failed,rules,warnings,model:result.model,usage:result.usage,costUsd:result.costUsd,summary:summary.text};
}
/** Design JSON in, rule report out. */
export async function checkDesign(design:unknown,client:JevClient=createJevClient(),opts:{signal?:AbortSignal}={}):Promise<DesignRuleReport>{
 return checkDesignSummary(await summarizeDesign(design),client,CHECK_POLICY,opts);
}

// ---------------------------------------------------------------------------------------------------------------
// The internal route

export const ROUTE_LIMITS={bodyBytes:1_000_000,
 /** Requests per minute from one address, counted before the token is checked so guessing is throttled too. */
 perMinute:20,
 /** Jev calls per day across all callers: the spend guard. 300 calls stay under $1 even at Jev's 64k-token limit. */
 perDay:300,minTokenChars:24} as const;
export interface CheckRuntime {client:JevClient;kv:AiKv;
 /** The internal token callers must present; empty means the route is switched off. */
 routeToken:string;perMinute:number;perDay:number;salt:string;now:()=>number;log:(line:string)=>void}

const json=(value:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const failure=(status:number,code:string,message:string,headers:Record<string,string>={})=>json({ok:false,error:{code,message}},status,headers);
const JEV_FAILURES:Record<string,[number,string]>={
 not_configured:[503,'The design-rule check is not switched on here.'],timeout:[504,'Jev took too long. Try again.'],network:[502,'Jev could not be reached. Try again.'],
 rate_limited:[503,'Jev is rate limited right now. Try again in a minute.'],overloaded:[503,'Jev is busy right now. Try again in a minute.'],
 unauthorized:[502,'Jev rejected the server’s API key.'],bad_request:[502,'Jev rejected the request.'],request_too_large:[413,'This design is too large for Jev.'],
 http_error:[502,'Jev returned an error.'],invalid_response:[502,'Jev answered in a shape this check does not understand.'],cancelled:[499,'The request was cancelled.'],
};
async function readBody(request:Request,max:number):Promise<string|null>{
 const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>max))return null;
 if(!request.body)return '';
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>max)return null;chunks.push(chunk.value);}}finally{void reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks).toString('utf8');
}
/** Counts one use in a window (`stamp` names it). The record is overwritten when the window moves on, so nothing piles up. */
async function take(kv:AiKv,key:string,stamp:string,limit:number):Promise<boolean>{
 let allowed=false;
 await kvUpdate<{stamp:string;count:number}>(kv,key,current=>{const count=current&&current.stamp===stamp?current.count:0;allowed=count<limit;return allowed?{stamp,count:count+1}:undefined;});
 return allowed;
}

export function createJevDesignCheckService(runtime:CheckRuntime){
 const {client,kv,routeToken,now,log}=runtime;
 return {
  async handle(request:Request,info:{ip?:string}={}):Promise<Response>{
   try{
    if(request.method!=='POST')return failure(405,'method_not_allowed','Send the design with POST.',{Allow:'POST'});
    if(routeToken.length<ROUTE_LIMITS.minTokenChars||!client.configured())return failure(503,'not_configured',JEV_FAILURES.not_configured[1]);
    const address=info.ip??request.headers.get('x-nf-client-connection-ip')??'unknown',minute=Math.floor(now()/60_000);
    if(!await take(kv,`jev/minute/${hashId(runtime.salt,`${dayOf(now())}:${address}`)}`,String(minute),runtime.perMinute))return failure(429,'rate_limited','Too many requests. Wait a minute.',{'Retry-After':'60'});
    const header=request.headers.get('authorization')??'',presented=/^Bearer\s+/i.test(header)?header.replace(/^Bearer\s+/i,'').trim():request.headers.get('x-jev-route-token')?.trim()??'';
    if(!presented||!sameToken(presented,routeToken))return failure(401,'unauthorized','This route needs the internal token.',{'WWW-Authenticate':'Bearer'});
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get('content-type')??''))return failure(415,'content_type','Send application/json.');
    const body=await readBody(request,ROUTE_LIMITS.bodyBytes);if(body===null)return failure(413,'payload_too_large','Send a design file smaller than 1 MB.');
    let design:unknown;try{design=JSON.parse(body);}catch{return failure(400,'invalid_json','Send the design as valid JSON.');}
    const summary=await summarizeDesign(design);
    if(!await take(kv,'jev/day',dayOf(now()),runtime.perDay))return failure(429,'daily_limit','Today’s design checks are used up. They reset tomorrow.',{'Retry-After':'3600'});
    const report=await checkDesignSummary(summary,client,CHECK_POLICY,{signal:request.signal});
    log(JSON.stringify({event:'jev_design_check',pass:report.pass,failed:report.failed.length,needsReview:report.needsReview,model:report.model,inputTokens:report.usage.inputTokens,costUsd:report.costUsd}));
    return json(report);
   }catch(error){
    if(error instanceof DesignInputError)return failure(400,'invalid_design',error.message);
    if(error instanceof JevError){const [status,message]=JEV_FAILURES[error.code]??JEV_FAILURES.http_error;log(JSON.stringify({event:'jev_design_check_error',code:error.code,status:error.status??null}));return failure(status,`jev_${error.code}`,message);}
    log(JSON.stringify({event:'jev_design_check_error',code:'internal'}));
    return failure(500,'internal','The design check could not be completed.');
   }
  }};
}

const integer=(value:string|undefined,fallback:number,min:number,max:number)=>{const n=value===undefined||value.trim()===''?NaN:Number(value);return Number.isFinite(n)?Math.round(Math.min(max,Math.max(min,n))):fallback;};
/** JEV_API_KEY and JEV_ROUTE_TOKEN switch the route on. JEV_DAILY_CHECKS (default 300) and JEV_CHECKS_PER_MINUTE
 * (default 20) bound it. JEV_STORE_FILE keeps the counters in a JSON file instead of Netlify Blobs (local use). */
export async function checkRuntimeFromEnv(env:Record<string,string|undefined>,opts:Partial<CheckRuntime>={}):Promise<CheckRuntime>{
 return {client:opts.client??createJevClient({apiKey:env.JEV_API_KEY??''}),
  kv:opts.kv??(env.JEV_STORE_FILE?.trim()?fileKv(env.JEV_STORE_FILE.trim()):await blobsKv('jev-design-check')),
  routeToken:opts.routeToken??env.JEV_ROUTE_TOKEN?.trim()??'',
  perMinute:opts.perMinute??integer(env.JEV_CHECKS_PER_MINUTE,ROUTE_LIMITS.perMinute,1,600),perDay:opts.perDay??integer(env.JEV_DAILY_CHECKS,ROUTE_LIMITS.perDay,0,100_000),
  salt:opts.salt??(env.DECK_AI_HASH_SALT?.trim()||'deckcraft-jev-v1'),now:opts.now??Date.now,log:opts.log??((line:string)=>console.warn(line))};
}
let service:Promise<ReturnType<typeof createJevDesignCheckService>>|undefined;
/** Netlify entry point: one service per warm function instance. Answers 503 without touching storage when unset. */
export async function jevDesignCheckFunction(request:Request,context?:{ip?:string}):Promise<Response>{
 const env=process.env as Record<string,string|undefined>;
 if(!env.JEV_API_KEY?.trim()||!env.JEV_ROUTE_TOKEN?.trim())return request.method==='POST'?failure(503,'not_configured',JEV_FAILURES.not_configured[1]):failure(405,'method_not_allowed','Send the design with POST.',{Allow:'POST'});
 try{service??=checkRuntimeFromEnv(env).then(createJevDesignCheckService).catch(error=>{service=undefined;throw error;});return (await service).handle(request,{ip:context?.ip});}
 catch{return failure(503,'unavailable','The design check is unavailable right now.');}
}
export {JEV_MODEL};
