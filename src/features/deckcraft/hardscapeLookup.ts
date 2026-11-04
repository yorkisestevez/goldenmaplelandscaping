import type {HardscapeUnit} from './hardscapeCatalogue';
import {DesignExtensionLoadError} from './designExtensionState';

/** What the estimate, the saved-design validator and the yard model read from the supplier hardscape catalogue.
 * The catalogue (hardscapeCatalogue.ts) carries the generated engineering index, which only a design with yard features
 * needs: it loads with them (designExtensions.ts), never with a plain deck, so it is not part of the designer's first
 * load. It registers itself here, so the editors, runtimes and scripts that import it directly have it at once. */
type Catalogue=Pick<typeof import('./hardscapeCatalogue'),'hardscapeProduct'|'hardscapeSelection'|'hardscapeProblem'|'hardscapeName'>;
const EXTENSION='Supplier hardscape catalogue';
let catalogue:Catalogue|undefined,loading:Promise<void>|undefined;
export function registerHardscapeCatalogue(value:Catalogue){catalogue=value;}
export const hardscapeCatalogueReady=()=>!!catalogue;
export async function loadHardscapeCatalogue(){if(catalogue)return;loading??=import('./hardscapeCatalogue').then(value=>{catalogue=value;},error=>{loading=undefined;throw new DesignExtensionLoadError(EXTENSION,error);});await loading;}
function get():Catalogue{if(!catalogue)throw new DesignExtensionLoadError(EXTENSION);return catalogue;}
export const hardscapeProduct:Catalogue['hardscapeProduct']=id=>get().hardscapeProduct(id);
export const hardscapeSelection:Catalogue['hardscapeSelection']=f=>get().hardscapeSelection(f);
export const hardscapeProblem:Catalogue['hardscapeProblem']=f=>get().hardscapeProblem(f);
export const hardscapeName:Catalogue['hardscapeName']=f=>get().hardscapeName(f);
export const rectangularUnit=(u:HardscapeUnit)=>!u.shape||['rectangle','rectangular','rectangular-nominal','square','square-nominal'].includes(u.shape);
/** Key of a colour's manufacturer photo in the lazily fetched public/deckcraft/hardscape-swatches.json. */
export const hardscapeSwatchKey=(productId:string,finishId:string,colorId:string)=>`${productId}/${finishId}/${colorId}`;
