import {MAX_DESIGN_BYTES} from './designPersistence';
import {parseDeckReleaseDesign} from './deckRelease';
import {ensureLiveDesignExtensions} from './designExtensions';
/** Public imports prepare optional schemas and geometry before synchronous validation. */
export async function prepareDesignFileImport(text:string){
 if(new TextEncoder().encode(text).length>MAX_DESIGN_BYTES)throw Error('Choose a design file smaller than 1 MB.');
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw Error('Choose a valid Golden Maple JSON design file.');}
 await ensureLiveDesignExtensions(raw);
 return parseDeckReleaseDesign(text);
}
