import '../quoteResolutions';
import {storedPergolaQuote} from '../pergolaQuoteStorage';
import {cleanPergolaQuote,type PergolaQuoteContext} from '../pergolaPricing';
import {validateQuoteResolutions} from '../quoteResolutionValidation';
import type {DeckData} from '../types';
import {DEFAULT_DECK} from '../defaults';
import {validateDesign} from '../designPersistence';
import {deckReleaseData,calculateDeckReleaseEstimate} from '../deckRelease';
import {extrasLayout} from '../extrasLayout';
import {syncAutoLighting} from '../lightingSystem';
import {houseRailingReviewFlags} from '../houseRailingClearance';
import {captureContractorPreset} from './contractorPresets';

export const JOB_STORAGE_KEY='golden-maple.deck-studio.jobs.v1';
export const ACTIVE_JOB_KEY='golden-maple.deck-studio.active-job.v1';
export interface ActiveJobLabel {job:string;revision:string;savedAt:string}
export function readActiveJobLabel():ActiveJobLabel|null {try{const text=localStorage.getItem(ACTIVE_JOB_KEY);if(!text||text.length>600)return null;const v=JSON.parse(text);if(!v||Object.keys(v).sort().join(',')!=='job,revision,savedAt'||typeof v.job!=='string'||!v.job.trim()||v.job.length>80||typeof v.revision!=='string'||!v.revision.trim()||v.revision.length>80||typeof v.savedAt!=='string'||!Number.isFinite(Date.parse(v.savedAt)))return null;return v;}catch{return null;}}
export function writeActiveJobLabel(status:ActiveJobLabel):void {localStorage.setItem(ACTIVE_JOB_KEY,JSON.stringify(status));}
export function clearActiveJobLabel():void {localStorage.removeItem(ACTIVE_JOB_KEY);}
export const JOB_LIMITS={jobs:20,revisions:60,name:80,bytes:2_000_000,fileBytes:100_000} as const;
export interface JobRevision {id:string;name:string;savedAt:string;data:DeckData}
export interface SavedDeckJob {id:string;name:string;revisions:JobRevision[]}
export interface JobLibrary {format:'golden-maple-deck-jobs';version:1;jobs:SavedDeckJob[]}
export const emptyJobLibrary=():JobLibrary=>({format:'golden-maple-deck-jobs',version:1,jobs:[]});
const PRIVATE=['quoteResolutions','pergolaQuoteCosts','materialMarkup','customLaborCost','customOverrides','addOnTransitionLabor','addOnHardwareCost','addOnFlashingLf'] as const;
const PERSONAL=['customerName','projectAddress','scopeOfWork'] as const;
const OPTIONAL='foundationDepthIn houseConfig housePlacement wrap cornerChamfers stairEdgeId stairPath stairRiserCount stairTreadDepthIn level2EdgeId level2FullStep level2Position level2Offset level3 stairOffset stairTurn landingDepthIn lightingZoneEnabled autoLighting catalogueRailingId catalogueAccessories glassMount glassFinish borderFinish pictureFrameOverhangIn houseVisible houseWallHeightIn houseDoorOffset houseDoorWidthIn sceneLighting lightingPreviewOn privacyScreens railSections railDefault yardFeatures terrainConfig yardAllowances permitSite customFront boardColours inlays skirting deckFinishes underDeck deckOutlines deckOutlineOffsets boardLayout boundaryLocks pergola projectKind'.split(' ');
const allowedData=new Set([...Object.keys(DEFAULT_DECK),...OPTIONAL,...PRIVATE]);
const fail=(s:string):never=>{throw Error(s);};
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical)}]`:v&&typeof v==='object'?`{${Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`:JSON.stringify(v)??'undefined';
export const jobDesignStamp=(data:DeckData)=>canonical(data);
const bytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length;
/** Reject unsafe input before reading any user-supplied property. */
function safe(value:unknown,depth=0):void {
 if(depth>24)fail('Job library nesting is too deep.');if(value===null||typeof value==='boolean'||typeof value==='string')return;if(typeof value==='number'){if(!Number.isFinite(value))fail('Job numbers must be finite.');return;}if(!value||typeof value!=='object')fail('Use JSON values in a job library.');
 if(Object.getPrototypeOf(value)!==(Array.isArray(value)?Array.prototype:Object.prototype)&&Object.getPrototypeOf(value)!==null)fail('Custom object prototypes are not supported.');if(Object.getOwnPropertySymbols(value).length)fail('Symbol fields are not supported.');const d=Object.getOwnPropertyDescriptors(value);
 if(Array.isArray(value)){if(value.length>1000)fail('A job array is too large.');for(let i=0;i<value.length;i++)if(!Object.hasOwn(d,String(i)))fail('Sparse arrays are not supported.');}
 for(const [k,p] of Object.entries(d)){if(Array.isArray(value)&&k==='length')continue;if(!('value'in p)||!p.enumerable||['__proto__','constructor','prototype'].includes(k)||Array.isArray(value)&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=(value as unknown[]).length))fail('Unsupported job field or accessor.');safe(p.value,depth+1);}
}
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))fail('Expected a job object.');return v as Record<string,unknown>;}
function keys(v:Record<string,unknown>,names:string[]){if(Object.keys(v).some(k=>!names.includes(k))||names.some(k=>!Object.hasOwn(v,k)))fail('The job library has missing or unsupported fields.');}
function name(v:unknown):string {if(typeof v!=='string'||!v.trim()||v.trim().length>JOB_LIMITS.name||/[\u0000-\u001f]/.test(v))fail('Use a name with 1–80 characters.');return (v as string).trim();}
function id(v:unknown):string {if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(v))fail('Invalid job or revision identifier.');return v as string;}
export function cleanJobDesign(value:unknown,portable=false):DeckData {
 safe(value);const raw=object(value);for(const k of Object.keys(raw))if(!allowedData.has(k))fail(`Unsupported saved design field: ${k}.`);
 if(portable&&[...PRIVATE,...PERSONAL].some(k=>Object.hasOwn(raw,k)))fail('Portable job files cannot include customer details or private contractor prices.');
 const publicData=Object.fromEntries(Object.entries(raw).filter(([k])=>!(PRIVATE as readonly string[]).includes(k))),clean=deckReleaseData(validateDesign(publicData));
 for(const [k,v] of Object.entries(publicData)){if(k==='projectKind'&&v==='deck')continue;if(canonical(v)!==canonical((clean as unknown as Record<string,unknown>)[k]))fail(`Saved ${k} would be changed or discarded. Re-save a valid design before adding it to the library.`);}
 for(const k of PRIVATE){delete clean[k];if(Object.hasOwn(raw,k))(clean as unknown as Record<string,unknown>)[k]=structuredClone(raw[k]);}
 // Reuse the contractor pricing validator, without borrowing its specification compatibility rules.
 for(const k of ['materialMarkup','customLaborCost','addOnTransitionLabor','addOnHardwareCost','addOnFlashingLf'] as const)if(raw[k]!==undefined&&(typeof raw[k]!=='number'||!Number.isFinite(raw[k])||Number(raw[k])<0||Number(raw[k])>(k==='materialMarkup'?500:1_000_000)))fail(`Invalid private ${k}.`);
 if(raw.customOverrides!==undefined){const pricingOnly={...structuredClone(DEFAULT_DECK),customOverrides:raw.customOverrides} as DeckData;captureContractorPreset(pricingOnly,'Validate private prices',true,'validate');}
 if(raw.pergolaQuoteCosts!==undefined){const v=object(raw.pergolaQuoteCosts);if(Object.keys(v).sort().join(',')!=='key,quote'||typeof v.key!=='string'||v.key.length>30000)fail('Invalid private pergola quote snapshot.');const quote=cleanPergolaQuote(v.quote);if(canonical(quote)!==canonical(v.quote))fail('Invalid private pergola costs.');clean.pergolaQuoteCosts={key:v.key as string,quote} as PergolaQuoteContext;}
 if(raw.quoteResolutions!==undefined)clean.quoteResolutions=validateQuoteResolutions(raw.quoteResolutions);
 if(bytes(clean)>JOB_LIMITS.fileBytes)fail('A revision exceeds 100 KB.');return clean;
}
export function parseJobLibrary(value:unknown,portable=false):JobLibrary {
 safe(value);const raw=object(value);keys(raw,['format','version','jobs']);if(raw.format!=='golden-maple-deck-jobs'||raw.version!==1||!Array.isArray(raw.jobs)||raw.jobs.length>JOB_LIMITS.jobs)fail('Unsupported job library or too many jobs.');
 const ids=new Set<string>(),names=new Set<string>();let count=0;
 const jobs=(raw.jobs as unknown[]).map(v=>{const j=object(v);keys(j,['id','name','revisions']);const jobId=id(j.id),jobName=name(j.name);if(ids.has(jobId)||names.has(jobName.toLocaleLowerCase()))fail('Job names and identifiers must be unique.');ids.add(jobId);names.add(jobName.toLocaleLowerCase());if(!Array.isArray(j.revisions)||j.revisions.length<1)fail('A saved job needs at least one revision.');const revNames=new Set<string>();const revisions=(j.revisions as unknown[]).map(v=>{const r=object(v);keys(r,['id','name','savedAt','data']);const revId=id(r.id),revName=name(r.name);if(ids.has(revId)||revNames.has(revName.toLocaleLowerCase()))fail('Revision names and identifiers must be unique.');ids.add(revId);revNames.add(revName.toLocaleLowerCase());if(typeof r.savedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.savedAt)||!Number.isFinite(Date.parse(r.savedAt))||new Date(r.savedAt).toISOString()!==r.savedAt)fail('Invalid revision date.');if(++count>JOB_LIMITS.revisions)fail('Keep at most 60 revisions in this library.');return {id:revId,name:revName,savedAt:r.savedAt,data:cleanJobDesign(r.data,portable)};});return {id:jobId,name:jobName,revisions};});
 const library={format:raw.format,version:1,jobs} as JobLibrary;if(bytes(library)>JOB_LIMITS.bytes)fail('The local job library exceeds 2 MB.');return library;
}
export function parseJobText(text:string):JobLibrary {if(new TextEncoder().encode(text).length>JOB_LIMITS.fileBytes)fail('Choose a portable job library smaller than 100 KB.');return parseJobLibrary(JSON.parse(text),true);}
const newId=(prefix:string)=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
export function captureJobRevision(data:DeckData,revisionName:string):JobRevision {const {generatedImageUrl:_image,isGeneratingImage:_busy,...snapshot}=data;const privateQuote=storedPergolaQuote(data);const normalized=JSON.parse(JSON.stringify(deckReleaseData({...snapshot,...(privateQuote?{pergolaQuoteCosts:privateQuote}:{})})));return {id:newId('revision'),name:name(revisionName),savedAt:new Date().toISOString(),data:cleanJobDesign(normalized)};}
export function saveJobRevision(library:JobLibrary,data:DeckData,jobName:string,revisionName:string,jobId?:string):JobLibrary {if(jobId&&!library.jobs.some(j=>j.id===jobId))fail('Choose a saved job before saving another revision.');const revision=captureJobRevision(data,revisionName);return parseJobLibrary({...library,jobs:jobId?library.jobs.map(j=>j.id===jobId?{...j,revisions:[...j.revisions,revision]}:j):[...library.jobs,{id:newId('job'),name:name(jobName),revisions:[revision]}]});}
export function duplicateJobOption(library:JobLibrary,jobId:string,revisionId:string,optionName:string):JobLibrary {const source=library.jobs.find(j=>j.id===jobId)?.revisions.find(r=>r.id===revisionId);if(!source)fail('Choose a saved revision.');return saveJobRevision(library,source!.data,'',optionName,jobId);}
export function exportJobLibrary(library:JobLibrary,jobId?:string):string {const clean=parseJobLibrary(library),jobs=clean.jobs.filter(j=>!jobId||j.id===jobId).map(j=>({...j,revisions:j.revisions.map(r=>{const data={...r.data} as unknown as Record<string,unknown>;for(const k of [...PRIVATE,...PERSONAL])delete data[k];return {...r,data};})}));const text=JSON.stringify({...clean,jobs},null,2);if(new TextEncoder().encode(text).length>JOB_LIMITS.fileBytes)fail('This portable library is larger than 100 KB. Export a single job or remove older revisions.');return text;}
export function mergeJobLibraries(a:JobLibrary,b:JobLibrary):JobLibrary{return parseJobLibrary({...a,jobs:[...a.jobs,...b.jobs]});}
/** The preview and restore share this exact merged design; default preserves current private prices. */
export function revisionRestoreDesign(revision:JobRevision,current:DeckData,useSavedPricing=false):DeckData {const next=cleanJobDesign(revision.data);const currentQuote=storedPergolaQuote(current);if(!useSavedPricing&&currentQuote)current={...current,pergolaQuoteCosts:currentQuote};if(!useSavedPricing)for(const k of PRIVATE.filter(k=>k!=='quoteResolutions')){delete next[k];if(current[k]!==undefined)(next as unknown as Record<string,unknown>)[k]=structuredClone(current[k]);}return stabilizeJobDesign(next).data;}
export function stabilizeJobDesign(input:DeckData){if(!input.pergolaQuoteCosts){const quote=storedPergolaQuote(input);if(quote)input={...input,pergolaQuoteCosts:quote};}let data=deckReleaseData(input),estimate=calculateDeckReleaseEstimate(data);let extras=extrasLayout(data,estimate.model);const items=syncAutoLighting(data,{posts:estimate.model.railing.posts.length,stairs:estimate.model.treads.length,privacy:extras.privacyMounts.length,border:extras.borderMounts.length});if(canonical(items)!==canonical(data.lightingSystem.selectedItems)){data={...data,lightingSystem:{...data.lightingSystem,selectedItems:items}};estimate=calculateDeckReleaseEstimate(data);extras=extrasLayout(data,estimate.model);}return {data,estimate,issues:[...new Set([...houseRailingReviewFlags(data,estimate.model,estimate.flags),...extras.warnings])]};}
export function compareJobRevisions(current:DeckData,left:JobRevision|undefined,right:JobRevision,useSavedPricing=false){const a=stabilizeJobDesign(left?revisionRestoreDesign(left,current,useSavedPricing):current),b=stabilizeJobDesign(revisionRestoreDesign(right,current,useSavedPricing));return {left:a,right:b,delta:b.estimate.total-a.estimate.total,stamp:jobDesignStamp(current)};}
