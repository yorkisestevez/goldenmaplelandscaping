import {normalizeWrap} from './lib/wrapGeometry';
import {freeFootprint} from './lib/freeOutline';
import type {DeckData} from './types';
import {calculateEstimate} from './calculations';
import {migrateLegacyPrivacy,pricedPrivacyArea} from './privacyScreens';
import {activeCustomFront,frontBounds} from './lib/customOutline';

export function deckReleaseData(data:DeckData):DeckData{
  const {projectKind:_kind,hsUse:_use,hsProduct:_product,hsColor:_color,hsBorderRows:_border,hsSteps:_steps,hsFirePit:_fire,hsLightCount:_lights,...deck}=data;
  // Editable screens drive the priced area. Older single-area designs become equivalent screens.
  const screens=deck.privacyScreens??(deck.privacySqft>0?migrateLegacyPrivacy(deck):undefined);
  // A custom outline sets the deck's width and depth, and is one level (lib/customOutline.ts).
  const custom=activeCustomFront(deck);
  const free=freeFootprint(deck,1),second=freeFootprint(deck,2),third=freeFootprint(deck,3);
  return normalizeWrap({...deck,...(screens?{privacyScreens:screens,privacySqft:pricedPrivacyArea(screens)}:{}),...(custom?{...frontBounds(custom),levels:1 as const}:{}),...(free?{width:free.bounds.w/12,length:free.bounds.h/12}:{}),...(second?{width2:second.bounds.w/12,length2:second.bounds.h/12}:{}),...(third&&deck.level3?{level3:{...deck.level3,widthFt:third.bounds.w/12,lengthFt:third.bounds.h/12}}:{}),projectKind:'deck'});
}
export function calculateDeckReleaseEstimate(data:DeckData,settings?:any){return calculateEstimate(deckReleaseData(data),settings);}
