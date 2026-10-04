import type {DeckData,UnderDeckConfig} from './types';

/** Drainage systems offered today. */
export const DRAINAGE_OPTIONS={none:'No drainage',dryspace:'TimberTech DrySpace · drainage + ceiling',zipup:'Zip-UP · drainage + ceiling'} as const;
/** No longer offered (owner, 2026-10-04). Still accepted from saved and shared designs so they reopen with a note; priced as no drainage. */
export const RETIRED_DRAINAGE={rainescape:'Trex RainEscape · no longer offered'} as const;
export const RETIRED_DRAINAGE_NOTE='Trex RainEscape drainage is no longer offered and isn\'t in this price. Choose TimberTech DrySpace or Zip-UP under Privacy, skirting & extras if you want a dry underside.';
export const CEILING_OPTIONS={none:'No separate ceiling',aluminum:'Aluminum soffit · black',pvc:'Trusscore PVC · white',cedar:'Western red cedar · knotty T&G'} as const;
export const UNDER_DECK_OFF:UnderDeckConfig={drainage:'none',ceiling:'none',scope:'main',gravel:false,gravelDepthIn:3,floorMesh:false};
/** Strict persistence boundary. An explicit config supersedes the old drainage switch. */
export function normalizeUnderDeck(value:unknown):UnderDeckConfig{
  const v=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const drainage=typeof v.drainage==='string'&&(Object.hasOwn(DRAINAGE_OPTIONS,v.drainage)||Object.hasOwn(RETIRED_DRAINAGE,v.drainage))?v.drainage as UnderDeckConfig['drainage']:'none';
  const ceiling=typeof v.ceiling==='string'&&Object.hasOwn(CEILING_OPTIONS,v.ceiling)?v.ceiling as UnderDeckConfig['ceiling']:'none';
  return {drainage,ceiling:drainage==='dryspace'||drainage==='zipup'?'none':ceiling,scope:v.scope==='all'?'all':'main',gravel:v.gravel===true,gravelDepthIn:typeof v.gravelDepthIn==='number'&&Number.isFinite(v.gravelDepthIn)?Math.min(6,Math.max(2,v.gravelDepthIn)):3,floorMesh:v.floorMesh===true};
}
export function underDeckConfig(data:DeckData):UnderDeckConfig{return data.underDeck?normalizeUnderDeck(data.underDeck):{...UNDER_DECK_OFF,...(data.hasDrainage?{drainage:'rainescape' as const,scope:'all' as const}:{})};}
/** What is priced, drawn and listed: a retired drainage system counts as none. */
export const effectiveUnderDeck=(c:UnderDeckConfig):UnderDeckConfig=>c.drainage==='rainescape'?{...c,drainage:'none'}:c;
export const hasEffectiveDrainage=(data:DeckData)=>effectiveUnderDeck(underDeckConfig(data)).drainage!=='none';
export const underDeckSelected=(c:UnderDeckConfig)=>c.drainage!=='none'||c.ceiling!=='none'||c.gravel||c.floorMesh;
export function underDeckWords(data:DeckData):string[]{const c=effectiveUnderDeck(underDeckConfig(data));return underDeckSelected(c)?[`Under-deck: ${[c.drainage!=='none'&&DRAINAGE_OPTIONS[c.drainage],c.ceiling!=='none'&&CEILING_OPTIONS[c.ceiling],c.gravel&&`${c.gravelDepthIn} in clear stone over weed fabric (ground footprint)`,c.floorMesh&&'floor insect mesh; open sides remain unscreened'].filter(Boolean).join('; ')}. Drainage, ceiling and mesh scope: ${c.scope==='all'?'all deck platforms':'main deck'}.`]:[];}
