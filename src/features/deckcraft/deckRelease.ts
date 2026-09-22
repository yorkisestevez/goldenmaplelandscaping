import {normalizeWrap} from './lib/wrapGeometry';
import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {calculateEstimate} from './calculations';
import {parseDesign,serializeDesign} from './designPersistence';
import {exportDeckDXF,exportDeckOBJ} from './designExports';
import {migrateLegacyPrivacy,pricedPrivacyArea} from './privacyScreens';

/** The public product is deck-only. Keep deferred yard authoring modules and
 * the older autosave intact, while giving this release its own storage slot. */
export const DECK_RELEASE_STORAGE_KEY='golden-maple.deck-studio.deck-only.v1';
export function deckReleaseData(data:DeckData):DeckData{
  const {yardFeatures:_yard,terrainConfig:_terrain,projectKind:_kind,hsUse:_use,hsProduct:_product,hsColor:_color,hsBorderRows:_border,hsSteps:_steps,hsFirePit:_fire,hsLightCount:_lights,...deck}=data;
  // Editable screens drive the priced area. Older single-area designs become equivalent screens.
  const screens=deck.privacyScreens??(deck.privacySqft>0?migrateLegacyPrivacy(deck):undefined);
  return normalizeWrap({...deck,...(screens?{privacyScreens:screens,privacySqft:pricedPrivacyArea(screens)}:{}),projectKind:'deck'});
}
export function parseDeckReleaseDesign(text:string):DeckData{return deckReleaseData(parseDesign(text));}
export function serializeDeckReleaseDesign(data:DeckData):string{return serializeDesign(deckReleaseData(data));}
export function calculateDeckReleaseEstimate(data:DeckData,settings?:any){return calculateEstimate(deckReleaseData(data),settings);}
export function exportDeckReleaseDXF(data:DeckData,model:DeckTakeoff):string{return exportDeckDXF(deckReleaseData(data),model);}
export function exportDeckReleaseOBJ(data:DeckData,model:DeckTakeoff):string{return exportDeckOBJ(deckReleaseData(data),model);}
