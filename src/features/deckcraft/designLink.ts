import {BUSINESS} from '../../data/business';
import {DEFAULT_DECK} from './defaults';
import {parseDeckReleaseDesign,serializeDeckReleaseDesign} from './deckRelease';
import {MAX_DESIGN_BYTES} from './designPersistence';
import type {DeckData} from './types';

/**
 * Share links carry the whole design in the URL hash, so no server stores anything:
 * `/deck-designer#d=1z<payload>`. The payload is the release-mode design file (the same JSON
 * "Save JSON" writes) minus the customer's name, project address and scope of work, which the
 * studio promises stay on this device. It is zlib-deflated where the browser can (`z`) or left as
 * plain JSON (`j`), then base64url-encoded. The hash never reaches a server.
 *
 * Opening a link goes through `parseDeckReleaseDesign`, so its 100 KB limit and `validateDesign`
 * stay the only way a design gets in.
 */
export const DESIGN_LINK_PARAM='d';
const LINK_VERSION='1';
/** Longest link payload accepted before decoding; a heavy design is about 1,800 characters. */
export const MAX_DESIGN_LINK_CHARS=40_000;
/** Where the studio keeps the visitor's own design while they look at a shared one. */
export const DESIGN_LINK_BACKUP_KEY='golden-maple.deck-studio.deck-only.before-link.v1';
const PERSONAL_FIELDS=['customerName','projectAddress','scopeOfWork'] as const;

export class DesignLinkError extends Error{}
const DAMAGED='This design link is incomplete or damaged. Ask for the link again, or for the saved design file.';

/**
 * What to keep before a shared design replaces the working one: the visitor's own design, but only
 * when nothing is kept yet (a second link never overwrites it) and it differs from the shared design.
 * Returns null when nothing should be written.
 */
export function designToKeep(alreadyKept:string|null,own:string|null,shared:string):string|null{
  return !alreadyKept&&own&&own!==shared?own:null;
}

/** The design with the customer's own details cleared: they never travel in a link. */
export function withoutPersonalDetails(data:DeckData):DeckData{
  return {...data,...Object.fromEntries(PERSONAL_FIELDS.map(key=>[key,DEFAULT_DECK[key]]))};
}

/** The design file a link carries (minified, personal details removed). */
export function designLinkJson(data:DeckData):string{
  const file=JSON.parse(serializeDeckReleaseDesign(data)) as {configuration:Record<string,unknown>};
  for(const key of PERSONAL_FIELDS)delete file.configuration[key];
  return JSON.stringify(file);
}

function toBase64Url(bytes:Uint8Array):string{
  let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromBase64Url(text:string):Uint8Array{
  if(!/^[A-Za-z0-9_-]+$/.test(text)||text.length%4===1)throw new DesignLinkError(DAMAGED);
  const binary=atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}

/** Runs bytes through a (de)compression stream, stopping once the output passes `limit` bytes. */
export async function transformBytes(bytes:Uint8Array,stream:CompressionStream|DecompressionStream,limit=Infinity):Promise<Uint8Array>{
  const writer=stream.writable.getWriter();
  // Errors surface through the reader below; these promises only need to be observed.
  writer.write(bytes as Uint8Array<ArrayBuffer>).catch(()=>{});writer.close().catch(()=>{});
  const reader=stream.readable.getReader(),chunks:Uint8Array[]=[];let total=0;
  for(;;){
    const {done,value}=await reader.read();if(done)break;
    total+=value.length;
    if(total>limit){await reader.cancel().catch(()=>{});throw new DesignLinkError('This design link holds more than a design can.');}
    chunks.push(value);
  }
  const out=new Uint8Array(total);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}
  return out;
}

/** A link that reopens this design. `origin` defaults to this site in the browser, else the canonical site. */
export async function encodeDesignLink(data:DeckData,origin=typeof window!=='undefined'?window.location.origin:BUSINESS.canonicalUrl):Promise<string>{
  const json=new TextEncoder().encode(designLinkJson(data));
  const payload=typeof CompressionStream==='function'?'z'+toBase64Url(await transformBytes(json,new CompressionStream('deflate'))):'j'+toBase64Url(json);
  return `${origin}/deck-designer#${DESIGN_LINK_PARAM}=${LINK_VERSION}${payload}`;
}

/** The link payload in a URL hash (`#d=1z…`), or null when the hash holds no design. */
export function designLinkFromHash(hash:string):string|null{
  const value=new URLSearchParams(hash.replace(/^#/,'')).get(DESIGN_LINK_PARAM);
  return value?value:null;
}

/** The design a link payload holds. Throws `DesignLinkError` with a customer-facing message. */
export async function decodeDesignLink(value:string):Promise<DeckData>{
  if(value.length>MAX_DESIGN_LINK_CHARS)throw new DesignLinkError('This design link is too long to open. Ask for the saved design file instead.');
  if(value[0]!==LINK_VERSION)throw new DesignLinkError('This design link comes from a newer version of the studio. Refresh the page, or ask for the saved design file.');
  const kind=value[1];let bytes=fromBase64Url(value.slice(2));
  if(kind==='z'){
    if(typeof DecompressionStream!=='function')throw new DesignLinkError('This browser cannot open design links. Update it, or ask for the saved design file instead.');
    try{bytes=await transformBytes(bytes,new DecompressionStream('deflate'),MAX_DESIGN_BYTES);}
    catch(error){throw error instanceof DesignLinkError?error:new DesignLinkError(DAMAGED);}
  }else if(kind!=='j')throw new DesignLinkError(DAMAGED);
  let text:string;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new DesignLinkError(DAMAGED);}
  let design:DeckData;
  try{design=parseDeckReleaseDesign(text);}
  catch(error){
    // File-format problems read as a damaged link; a validation reason is kept for support calls.
    const reason=error instanceof Error?error.message:'';
    throw new DesignLinkError(!reason||/design file|format or version/i.test(reason)?DAMAGED:`${DAMAGED} (${reason})`);
  }
  // A shared design always opens without anyone's name or address, whatever the link holds.
  return withoutPersonalDetails(design);
}
