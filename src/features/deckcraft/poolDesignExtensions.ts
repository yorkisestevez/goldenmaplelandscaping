/** One optional preparation boundary keeps pool model/drawing registries out of the default worker. */
let runtime:typeof import('./poolDesignExtensionsRuntime')|undefined,loading:Promise<void>|undefined;
export const poolDesignReady=(geometry:boolean,privateQuotes:boolean)=>!geometry&&!privateQuotes||!!runtime&&runtime.poolDesignReady(geometry,privateQuotes);
export async function loadPoolDesignExtensions(geometry:boolean,privateQuotes:boolean){if(!runtime){loading??=import('./poolDesignExtensionsRuntime').then(v=>{runtime=v;},e=>{loading=undefined;throw e;});await loading;}await runtime!.loadPoolDesignExtensions(geometry,privateQuotes);}
