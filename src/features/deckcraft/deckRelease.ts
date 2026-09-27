import {deckReleaseData} from './deckReleaseCore';
export {deckReleaseData,calculateDeckReleaseEstimate} from './deckReleaseCore';
import type {DeckData} from './types';
import {parseDesign,serializeDesign} from './designPersistence';

/** The public product: the deck, with its backyard (patios, retaining walls, water features and terrain;
 * see backyard.ts) when the design has one. The older combined autosave stays intact in its own slot; this
 * release keeps its own storage slot (the key predates the backyard and is kept so saved designs load). */
export const DECK_RELEASE_STORAGE_KEY='golden-maple.deck-studio.deck-only.v1';
export function parseDeckReleaseDesign(text:string):DeckData{return deckReleaseData(parseDesign(text));}
export function serializeDeckReleaseDesign(data:DeckData):string{return serializeDesign(deckReleaseData(data));}
// The release's DXF and OBJ exports are in deckReleaseExports.ts, which the page loads only when a file is asked for.
