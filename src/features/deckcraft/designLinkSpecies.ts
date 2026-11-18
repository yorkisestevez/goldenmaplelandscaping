import type {DeckData} from './types';
import {designLinkJson} from './designLink';

/** Species tables for share links. Only the lazy link codec uses them, so they stay out of the deck route's first load. */
function speciesRecord(value:unknown):Record<string,unknown>|undefined{
  return !!value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
}

/**
 * The JSON a link deflates. A species used more than once is stored on `speciesTable` and named by id
 * on the plant. A species used once, or two records that share an id but differ, stays on the plant.
 * Saved files and `designLinkJson` are unchanged.
 */
export function linkDesignJson(data:DeckData):string{
  const file=JSON.parse(designLinkJson(data)) as {configuration:Record<string,unknown>;speciesTable?:unknown[]};
  const objects=file.configuration.landscapeObjects;
  if(!Array.isArray(objects))return JSON.stringify(file);
  const signature=new Map<string,string>(),count=new Map<string,number>(),conflict=new Set<string>();
  for(const raw of objects){
    const record=speciesRecord(raw&&typeof raw==='object'?(raw as {speciesRecord?:unknown}).speciesRecord:undefined),id=record?.id;
    if(!record||typeof id!=='string'||!id)continue;
    const key=JSON.stringify(record),prior=signature.get(id);
    if(prior===undefined)signature.set(id,key);else if(prior!==key)conflict.add(id);
    count.set(key,(count.get(key)??0)+1);
  }
  const table:unknown[]=[],stored=new Set<string>();
  for(const raw of objects){
    if(!raw||typeof raw!=='object')continue;
    const object=raw as Record<string,unknown>,record=speciesRecord(object.speciesRecord),id=record?.id;
    if(!record||typeof id!=='string'||conflict.has(id)||(count.get(JSON.stringify(record))??0)<2)continue;
    if(!stored.has(id)){stored.add(id);table.push(record);}
    delete object.speciesRecord;object.speciesId=id;
  }
  if(table.length)file.speciesTable=table;
  return JSON.stringify(file);
}

/** Puts species records back on each plant. Text without a species table is returned unchanged. */
export function expandSharedSpecies(text:string):string{
  let value:unknown;try{value=JSON.parse(text);}catch{return text;}
  if(!value||typeof value!=='object'||Array.isArray(value))return text;
  const file=value as {speciesTable?:unknown;configuration?:{landscapeObjects?:unknown}};
  if(!Array.isArray(file.speciesTable))return text;
  const byId=new Map<string,Record<string,unknown>>();
  for(const entry of file.speciesTable){
    const record=speciesRecord(entry),id=record?.id;
    if(record&&typeof id==='string'&&id&&!byId.has(id))byId.set(id,record);
  }
  if(Array.isArray(file.configuration?.landscapeObjects))for(const raw of file.configuration.landscapeObjects){
    if(!raw||typeof raw!=='object')continue;
    const object=raw as Record<string,unknown>;
    if(typeof object.speciesId!=='string'||object.speciesRecord!==undefined)continue;
    const record=byId.get(object.speciesId);
    if(!record)continue;
    delete object.speciesId;object.speciesRecord=structuredClone(record);
  }
  delete file.speciesTable;
  return JSON.stringify(file);
}

