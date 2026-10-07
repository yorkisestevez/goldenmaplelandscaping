import type {DeckData} from './types';
import {parseDeckReleaseDesign} from './deckRelease';
import {MAX_PUBLIC_DESIGN_BYTES as MAX_DESIGN_BYTES} from './designPersistence';
import {readPriceBookVersion} from './priceBook';
import {DesignLinkError,MAX_DESIGN_LINK_CHARS,DESIGN_LINK_PARAM,designLinkJson,withoutPersonalDetails} from './designLink';
const LINK_VERSION='1';
const DAMAGED='This design link is incomplete or damaged. Ask for the link again, or for the saved design file.';
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

export async function encode(data:DeckData,origin:string):Promise<string>{
  const json=new TextEncoder().encode(designLinkJson(data));
  const payload=typeof CompressionStream==='function'?'z'+toBase64Url(await transformBytes(json,new CompressionStream('deflate'))):'j'+toBase64Url(json);
  return `${origin}/deck-designer/#${DESIGN_LINK_PARAM}=${LINK_VERSION}${payload}`;
}

export async function decodeDesignLinkFile(value:string):Promise<{design:DeckData;priceBook:string|null}>{
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
  try{await (await import('./designExtensions')).ensureDesignExtensions(JSON.parse(text));design=parseDeckReleaseDesign(text);}
  catch(error){
    // File-format problems read as a damaged link; a validation reason is kept for support calls.
    const reason=error instanceof Error?error.message:'';
    throw new DesignLinkError(!reason||/design file|format or version/i.test(reason)?DAMAGED:`${DAMAGED} (${reason})`);
  }
  let priceBook:string|null=null;
  try{priceBook=readPriceBookVersion((JSON.parse(text) as {priceBook?:unknown}).priceBook);}catch{/* parseDeckReleaseDesign already read it. */}
  // A shared design always opens without anyone's name or address, whatever the link holds.
  return {design:withoutPersonalDetails(design),priceBook};
}
