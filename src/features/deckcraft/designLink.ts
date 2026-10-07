import {BUSINESS} from '../../data/business';
import {DEFAULT_DECK} from './defaults';
import {serializeDeckReleaseDesign} from './deckRelease';
import {PRICE_BOOK} from './priceBook';
import type {DeckData} from './types';

/**
 * Share links carry the whole design in the URL hash, so no server stores anything:
 * `/deck-designer/#d=1z<payload>`. The payload is the release-mode design file (the same JSON
 * "Save JSON" writes) minus the customer's name, project address and scope of work, which the
 * studio promises stay on this device. It is zlib-deflated where the browser can (`z`) or left as
 * plain JSON (`j`), then base64url-encoded. The hash never reaches a server.
 *
 * Opening a link goes through `parseDeckReleaseDesign`, so its 100 KB limit and `validateDesign`
 * stay the only way a design gets in.
 */
export const DESIGN_LINK_PARAM='d';
/** Longest link payload accepted before decoding; a heavy design is about 1,800 characters. */
export const MAX_DESIGN_LINK_CHARS=40_000;
/** Where the studio keeps the visitor's own design while they look at a shared one. */
export const DESIGN_LINK_BACKUP_KEY='golden-maple.deck-studio.deck-only.before-link.v1';
const PERSONAL_FIELDS=['customerName','projectAddress','scopeOfWork'] as const;

export class DesignLinkError extends Error{}

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

/** The design file a link carries (minified, personal details removed), with the price book it was priced with. */
export function designLinkJson(data:DeckData):string{
  const file=JSON.parse(serializeDeckReleaseDesign(data)) as {configuration:Record<string,unknown>;priceBook?:string};
  for(const key of [...PERSONAL_FIELDS,'poolQuoteInputs'])delete file.configuration[key];
  const site=file.configuration.siteModel as Record<string,unknown>|undefined;if(site)delete site.overlay;
  file.priceBook=PRICE_BOOK.version;
  return JSON.stringify(file);
}

/** Compression is loaded only for sharing or restoring a link; the public async API stays unchanged. */
export async function transformBytes(bytes:Uint8Array,stream:CompressionStream|DecompressionStream,limit=Infinity){return (await import('./designLinkCodec')).transformBytes(bytes,stream,limit);}
export async function encodeDesignLink(data:DeckData,origin=typeof window!=='undefined'?window.location.origin:BUSINESS.canonicalUrl):Promise<string>{return (await import('./designLinkCodec')).encode(data,origin);}
/** The link payload in a URL hash (`#d=1z…`), or null when the hash holds no design. */
export function designLinkFromHash(hash:string):string|null{
  const value=new URLSearchParams(hash.replace(/^#/,'')).get(DESIGN_LINK_PARAM);
  return value?value:null;
}

export async function decodeDesignLink(value:string):Promise<DeckData>{return (await decodeDesignLinkFile(value)).design;}
export async function decodeDesignLinkFile(value:string):Promise<{design:DeckData;priceBook:string|null}>{return (await import('./designLinkCodec')).decodeDesignLinkFile(value);}
