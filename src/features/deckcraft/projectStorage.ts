/** Native IndexedDB stores the complete private working project. Public links
 * remain a separate, explicitly stripped format. No write succeeds before its
 * transaction commits, and legacy/recovery bytes are retained. */
export const PROJECT_DATABASE='golden-maple.deckcraft-projects.v1';
const VERSION=1,STORES=['projects','attachments','privateRates','recovery'] as const;
type Store=(typeof STORES)[number];
export type ProjectSlot='current'|'jobs';
export interface StoredProjectText {version:1;json:string;savedAt:string;revision:number;legacyKey?:string}
export interface ProjectHydration {record?:StoredProjectText;unrestoredText?:string;migrated:boolean;legacyKey?:string}
let connection:Promise<IDBDatabase>|undefined;
const failure=(error:unknown)=>new Error(error instanceof Error?`Device storage: ${error.message}`:'Device storage is unavailable.');
export function closeProjectStorage(){if(connection)void connection.then(db=>db.close(),()=>{});connection=undefined;}
function database():Promise<IDBDatabase>{
 if(connection)return connection;
 connection=new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('IndexedDB is unavailable on this device.'));return;}
  let request:IDBOpenDBRequest;try{request=indexedDB.open(PROJECT_DATABASE,VERSION);}catch(error){reject(failure(error));return;}
  let settled=false;const fail=(error:Error)=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};
  const timer=setTimeout(()=>fail(Error('Device storage could not open. Close another tab using this project and retry.')),8000);
  request.onupgradeneeded=()=>{for(const store of STORES)if(!request.result.objectStoreNames.contains(store))request.result.createObjectStore(store);};
  request.onerror=()=>fail(failure(request.error));
  request.onblocked=()=>fail(Error('Another tab is preventing the storage upgrade. Close it and retry.'));
  request.onsuccess=()=>{const db=request.result;if(settled){db.close();return;}settled=true;clearTimeout(timer);db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);};
 });
 connection.catch(()=>{connection=undefined;});return connection;
}
const finished=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(failure(tx.error));tx.onabort=()=>reject(failure(tx.error??Error('Storage transaction aborted.')));});
const result=<T>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(failure(request.error));});
export async function readProjectValue<T>(store:Store,key:IDBValidKey):Promise<T|undefined>{const db=await database(),tx=db.transaction(store,'readonly'),done=finished(tx);try{const value=await result(tx.objectStore(store).get(key));await done;return value as T|undefined;}catch(error){await done.catch(()=>{});throw error;}}
export async function writeProjectValues(records:{store:Store;key:IDBValidKey;value:unknown}[]):Promise<void>{
 if(!records.length)return;const db=await database(),tx=db.transaction([...new Set(records.map(r=>r.store))],'readwrite'),done=finished(tx);
 try{for(const r of records)tx.objectStore(r.store).put(r.value,r.key);}catch(error){tx.abort();await done.catch(()=>{});throw failure(error);}await done;
}
export async function removeProjectValue(store:Store,key:IDBValidKey){const db=await database(),tx=db.transaction(store,'readwrite'),done=finished(tx);tx.objectStore(store).delete(key);await done;}
/** The updater runs synchronously inside one transaction; throwing leaves the
 * existing value intact. This supports ratebook import previews with revisions. */
export async function updateProjectValue<T>(store:Store,key:IDBValidKey,update:(previous:T|undefined)=>T):Promise<T>{
 const db=await database(),tx=db.transaction(store,'readwrite'),done=finished(tx);let value:T,issue:unknown;const request=tx.objectStore(store).get(key);
 request.onsuccess=()=>{try{value=update(request.result);tx.objectStore(store).put(value,key);}catch(error){issue=error;tx.abort();}};
 try{await done;}catch(error){throw issue??error;}return value!;
}
export async function preserveRecoveryText(slot:ProjectSlot,json:string,reason:string){await writeProjectValues([{store:'recovery',key:`${slot}-${Date.now()}-${Math.random().toString(36).slice(2)}`,value:{slot,json,reason,savedAt:new Date().toISOString()}}]);}
function textLimit(slot:ProjectSlot,json:string){if(typeof json!=='string'||new TextEncoder().encode(json).length>(slot==='current'?1_000_000:4_000_000))throw Error('Project exceeds the local storage document limit.');}
function extensionRecovery(error:unknown,json:string):Error|undefined{
 if(!error||typeof error!=='object'||(error as {code?:string}).code!=='DECKCRAFT_EXTENSION_LOADING')return;
 const wrapped=new Error(error instanceof Error?error.message:'A design extension could not be loaded.');wrapped.name=error instanceof Error?error.name:'DesignExtensionLoadError';
 Object.defineProperties(wrapped,{code:{value:'DECKCRAFT_EXTENSION_LOADING',enumerable:true},recoveryText:{value:json,enumerable:false}});return wrapped;
}
function stored(value:unknown):value is StoredProjectText{const v=value as StoredProjectText;return !!v&&typeof v==='object'&&v.version===1&&typeof v.json==='string'&&Number.isSafeInteger(v.revision)&&v.revision>0&&typeof v.savedAt==='string'&&Number.isFinite(Date.parse(v.savedAt));}
/** Preserve the previous exact bytes in the same transaction as the new save. */
export async function saveStoredProject(slot:ProjectSlot,json:string,{expectedRevision}:{expectedRevision?:number}={}):Promise<StoredProjectText>{
 textLimit(slot,json);const db=await database(),tx=db.transaction(['projects','recovery'],'readwrite'),done=finished(tx),store=tx.objectStore('projects');let record:StoredProjectText|undefined;
 let issue:unknown;const previous=store.get(slot);previous.onsuccess=()=>{try{const old=previous.result;if(expectedRevision!==undefined&&(stored(old)?old.revision:old===undefined?0:-1)!==expectedRevision)throw Error('This project changed in another tab. Reload it before saving.');if(old!==undefined)tx.objectStore('recovery').put({slot,value:old,savedAt:new Date().toISOString()},`${slot}-previous`);record={version:1,json,savedAt:new Date().toISOString(),revision:stored(old)?old.revision+1:1};store.put(record,slot);}catch(error){issue=error;tx.abort();}};
 try{await done;}catch(error){throw issue??error;}return record!;
}
/** Migration keeps the legacy slot untouched and commits its recovery copy
 * atomically. Invalid existing IndexedDB or legacy documents never get replaced. */
export async function hydrateStoredProject(slot:ProjectSlot,legacyKeys:readonly string[],validate:(json:string)=>unknown|Promise<unknown>):Promise<ProjectHydration>{
 const existing=await readProjectValue<unknown>('projects',slot);
 if(existing!==undefined){const json=stored(existing)?existing.json:JSON.stringify(existing);try{if(!stored(existing))throw Error('Invalid stored project envelope.');await validate(json);return {record:existing,migrated:false,...(existing.legacyKey?{legacyKey:existing.legacyKey}:{})};}catch(error){const retry=extensionRecovery(error,json);if(retry)throw retry;await preserveRecoveryText(slot,json,'Stored project could not be restored.').catch(()=>{});return {unrestoredText:json,migrated:false};}}
 let json:string|null=null,legacyKey:string|undefined;
 if(typeof localStorage!=='undefined')for(const key of legacyKeys){const value=localStorage.getItem(key);if(value!==null){json=value;legacyKey=key;break;}}
 if(json===null)return {migrated:false};
 try{await validate(json);textLimit(slot,json);}catch(error){const retry=extensionRecovery(error,json);if(retry)throw retry;await preserveRecoveryText(slot,json,'Legacy project could not be restored.').catch(()=>{});return {unrestoredText:json,migrated:false,legacyKey};}
 const db=await database(),tx=db.transaction(['projects','recovery'],'readwrite'),done=finished(tx),store=tx.objectStore('projects');let record:StoredProjectText|undefined,won=false;
 let issue:unknown;const request=store.get(slot);request.onsuccess=()=>{try{if(request.result!==undefined){record=stored(request.result)?request.result:undefined;return;}record={version:1,json:json!,savedAt:new Date().toISOString(),revision:1,legacyKey};store.put(record,slot);tx.objectStore('recovery').put({slot,json,legacyKey,savedAt:record.savedAt},`legacy-${slot}-${legacyKey}`);won=true;}catch(error){issue=error;tx.abort();}};
 try{await done;}catch(error){throw issue??error;}
 if(!won)return hydrateStoredProject(slot,[],validate);
 return {record,migrated:true,legacyKey};
}
