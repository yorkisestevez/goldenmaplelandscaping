import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {deckReleaseData} from './deckRelease';
import {exportDeckDXF,exportDeckOBJ} from './designExports';

/** The public release's DXF and OBJ exports. The deck designer imports this module only when a visitor asks
 * for a file, so the export geometry (house, yard, hardware, stair and skirting layouts) is not part of the
 * page's first load; scripts/check-deck-bundle.ts keeps it that way. */
export function exportDeckReleaseDXF(data:DeckData,model:DeckTakeoff):string{return exportDeckDXF(deckReleaseData(data),model);}
export function exportDeckReleaseOBJ(data:DeckData,model:DeckTakeoff):string{return exportDeckOBJ(deckReleaseData(data),model);}
