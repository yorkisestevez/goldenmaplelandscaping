import {normalizeWrap} from './lib/wrapGeometry';
import type {DeckData} from './types';
import {calculateEstimate} from './calculations';
import {parseDesign,serializeDesign} from './designPersistence';
import {migrateLegacyPrivacy,pricedPrivacyArea} from './privacyScreens';
import {activeCustomFront,frontBounds} from './lib/customOutline';

/** The public product: the deck, with its backyard (patios, retaining walls, water features and terrain;
 * see backyard.ts) when the design has one. The older combined autosave stays intact in its own slot; this
 * release keeps its own storage slot (the key predates the backyard and is kept so saved designs load). */
export const DECK_RELEASE_STORAGE_KEY='golden-maple.deck-studio.deck-only.v1';
export function deckReleaseData(data:DeckData):DeckData{
  const {projectKind:_kind,hsUse:_use,hsProduct:_product,hsColor:_color,hsBorderRows:_border,hsSteps:_steps,hsFirePit:_fire,hsLightCount:_lights,...deck}=data;
  // Editable screens drive the priced area. Older single-area designs become equivalent screens.
  const screens=deck.privacyScreens??(deck.privacySqft>0?migrateLegacyPrivacy(deck):undefined);
  // A custom outline sets the deck's width and depth, and is one level (lib/customOutline.ts).
  const custom=activeCustomFront(deck);
  return normalizeWrap({...deck,...(screens?{privacyScreens:screens,privacySqft:pricedPrivacyArea(screens)}:{}),...(custom?{...frontBounds(custom),levels:1 as const}:{}),projectKind:'deck'});
}
export function parseDeckReleaseDesign(text:string):DeckData{return deckReleaseData(parseDesign(text));}
export function serializeDeckReleaseDesign(data:DeckData):string{return serializeDesign(deckReleaseData(data));}
export function calculateDeckReleaseEstimate(data:DeckData,settings?:any){return calculateEstimate(deckReleaseData(data),settings);}
// The release's DXF and OBJ exports are in deckReleaseExports.ts, which the page loads only when a file is asked for.
