import type {DeckData} from './types';
export interface EditorLayer {id:string;name:string;visible:boolean;locked:boolean}
export interface EditorGroup {id:string;name:string;objectIds:string[]}
export interface EditorOrganization {layers:EditorLayer[];groups:EditorGroup[];objects:{id:string;layerId:string;locked:boolean}[]}
import {DesignExtensionLoadError} from './designExtensionState';
type Runtime=Pick<typeof import('./editorOrganizationRuntime'),'validateEditorOrganization'|'assertUnlockedChanges'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export function registerEditorOrganizationRuntime(value:Runtime){runtime=value;}
export const editorOrganizationReady=()=>!!runtime;
export async function loadEditorOrganizationRuntime(){if(runtime)return;loading??=import('./editorOrganizationRuntime').then(value=>{runtime=value;},error=>{loading=undefined;throw new DesignExtensionLoadError('editorOrganization',error);});await loading;}
function get():Runtime{if(!runtime)throw new DesignExtensionLoadError('editorOrganization');return runtime;}
export const emptyOrganization=():EditorOrganization=>({layers:[{id:'design',name:'Design',visible:true,locked:false}],groups:[],objects:[]});
export const isObjectLocked=(o:EditorOrganization|undefined,id:string)=>{const entry=o?.objects.find(x=>x.id===id);return !!entry&&(entry.locked||!!o?.layers.find(l=>l.id===entry.layerId)?.locked);};
export const isObjectVisible=(o:EditorOrganization|undefined,id:string)=>{const entry=o?.objects.find(x=>x.id===id);return !entry||o?.layers.find(l=>l.id===entry.layerId)?.visible!==false;};
export const validateEditorOrganization:Runtime['validateEditorOrganization']=value=>get().validateEditorOrganization(value);
export const assertUnlockedChanges:Runtime['assertUnlockedChanges']=(before,after)=>{if(before.editorOrganization)get().assertUnlockedChanges(before,after);};

/** Yard and landscape share the controller, layers and groups identity space. */
export function assertUniqueObjectIds(data:Pick<DeckData,'yardFeatures'|'landscapeObjects'|'pools'|'siteModel'>){
 const ids=new Set(['deck','house','site']);for(const object of [...(data.yardFeatures??[]),...(data.landscapeObjects??[]),...(data.pools??[]),...(data.siteModel?.transitions??[])]){if(ids.has(object.id))throw Error('Object identifiers must be unique across yard and landscape and cannot use deck, house or site.');ids.add(object.id);}
}
