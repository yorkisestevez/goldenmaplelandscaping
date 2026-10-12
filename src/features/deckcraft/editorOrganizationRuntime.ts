import type {DeckData} from './types';
export interface EditorLayer {id:string;name:string;visible:boolean;locked:boolean}
export interface EditorGroup {id:string;name:string;objectIds:string[]}
export interface EditorOrganization {layers:EditorLayer[];groups:EditorGroup[];objects:{id:string;layerId:string;locked:boolean}[]}
const id=(v:unknown)=>typeof v==='string'&&/^[\w:.-]{1,100}$/.test(v);
function safeData(v:unknown,budget={left:12000}):unknown {
 if(--budget.left<0)throw Error('Editor organization exceeds its limits.');if(v===null||['string','number','boolean','undefined'].includes(typeof v))return v;
 if(!v||typeof v!=='object'||![Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(v)))throw Error('Editor fields must be plain data.');const d=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(v);if(keys.some(k=>typeof k!=='string'))throw Error('Editor fields cannot contain symbols.');
 if(Array.isArray(v)){if(v.length>500||keys.some(k=>k!=='length'&&(!/^(0|[1-9]\d*)$/.test(String(k))||Number(k)>=v.length)))throw Error('Invalid editor list.');return Array.from({length:v.length},(_,i)=>{if(!d[i]||!('value'in d[i]))throw Error('Editor lists must contain plain values.');return safeData(d[i].value,budget);});}
 const out:Record<string,unknown>={};for(const k of keys as string[]){if(['__proto__','constructor','prototype'].includes(k)||!('value'in d[k])||!d[k].enumerable)throw Error('Unsafe editor field.');out[k]=safeData(d[k].value,budget);}return out;
}
export function validateEditorOrganization(v:unknown):EditorOrganization {
 v=safeData(v);
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Editor organization must be an object.');
 const exact=(v:object,fields:string[])=>Object.keys(v).sort().join(',')===fields.sort().join(',');if(!exact(v,['layers','groups','objects']))throw Error('Unsupported editor fields.');
 const o=v as EditorOrganization;if(!Array.isArray(o.layers)||!Array.isArray(o.groups)||!Array.isArray(o.objects)||o.layers.length>40||o.groups.length>100||o.objects.length>500)throw Error('Editor organization exceeds its limits.');
 if(!o.layers.length||o.layers.some(l=>!l||typeof l!=='object'||!exact(l,['id','name','visible','locked']))||o.groups.some(g=>!g||typeof g!=='object'||!exact(g,['id','name','objectIds']))||o.objects.some(x=>!x||typeof x!=='object'||!exact(x,['id','layerId','locked'])))throw Error('Invalid editor records.');
 const unique=(a:string[])=>new Set(a).size===a.length;
 if(!unique(o.layers.map(l=>l.id))||!unique(o.groups.map(g=>g.id))||!unique(o.objects.map(x=>x.id)))throw Error('Layer, group and object IDs must be unique.');
 if(o.layers.some(l=>!id(l.id)||typeof l.name!=='string'||!l.name.trim()||l.name.length>80||typeof l.visible!=='boolean'||typeof l.locked!=='boolean'))throw Error('Invalid layer.');
 if(o.groups.some(g=>!id(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>80||!Array.isArray(g.objectIds)||g.objectIds.length>500||g.objectIds.some(x=>!id(x))||!unique(g.objectIds)))throw Error('Invalid group.');
 if(o.objects.some(x=>!id(x.id)||!o.layers.some(l=>l.id===x.layerId)||typeof x.locked!=='boolean'))throw Error('Invalid layer assignment.');
 return structuredClone(o);
}
export const emptyOrganization=():EditorOrganization=>({layers:[{id:'design',name:'Design',visible:true,locked:false}],groups:[],objects:[]});
export const isObjectLocked=(o:EditorOrganization|undefined,id:string)=>{const entry=o?.objects.find(x=>x.id===id);return !!entry&&(entry.locked||!!o?.layers.find(l=>l.id===entry.layerId)?.locked);};
export const isObjectVisible=(o:EditorOrganization|undefined,id:string)=>{const entry=o?.objects.find(x=>x.id===id);return !entry||o?.layers.find(l=>l.id===entry.layerId)?.visible!==false;};
export function assertUnlockedChanges(before:DeckData,after:DeckData){
 const o=before.editorOrganization;if(!o)return;
 for(const f of before.yardFeatures??[])if(isObjectLocked(o,f.id)&&JSON.stringify(f)!==JSON.stringify(after.yardFeatures?.find(n=>n.id===f.id)))throw Error(`${f.name} is locked. Unlock its object or layer first.`);
 for(const f of before.pools??[])if(isObjectLocked(o,f.id)&&JSON.stringify(f)!==JSON.stringify(after.pools?.find(n=>n.id===f.id)))throw Error(`${f.name} is locked. Unlock its object or layer first.`);
 for(const f of before.landscapeObjects??[])if(isObjectLocked(o,f.id)&&JSON.stringify(f)!==JSON.stringify(after.landscapeObjects?.find(n=>n.id===f.id)))throw Error(`${f.name} is locked. Unlock its object or layer first.`);
 for(const f of before.fences??[])if(isObjectLocked(o,f.id)&&JSON.stringify(f)!==JSON.stringify(after.fences?.find(n=>n.id===f.id)))throw Error(`${f.name} is locked. Unlock its object or layer first.`);
 for(const t of before.siteModel?.transitions??[])if(isObjectLocked(o,t.id)&&JSON.stringify(t)!==JSON.stringify(after.siteModel?.transitions?.find(n=>n.id===t.id)))throw Error(`${t.name} is locked. Unlock its object or layer first.`);
 if(isObjectLocked(o,'site')&&JSON.stringify(before.siteModel)!==JSON.stringify(after.siteModel))throw Error('The site layer is locked.');
 const pick=(d:DeckData,keys:string[])=>JSON.stringify(Object.fromEntries(keys.map(k=>[k,(d as unknown as Record<string,unknown>)[k]])));
 const deckKeys=['deckType','foundation','foundationDepthIn','width','length','height','cutoutWidth','cutoutLength','width2','length2','height2','cutoutWidth2','cutoutLength2','shape','levels','deckOutlines','deckOutlineOffsets','customFront','cornerChamfers','level3','wrap','boundaryLocks','boardLayout','inlays','pattern','deckingMaterial','deckingColor','framingSize','boardWidth','joistSpacing','fasteningSystem','pictureFrameRows','hasInlay','inlayLf','boardColours','deckFinishes','skirting','underDeck','stairEdgeId','stairPath','stairTargets','stairRiserCount','stairTreadDepthIn','level2EdgeId','level2FullStep','level2Position','level2Offset','stairTurn','landingDepthIn','railingType','railingHeight','railSections','railDefault','catalogueRailingId','glassMount','glassFinish','pictureFrameOverhangIn','borderFinish'];
 if(isObjectLocked(o,'deck')&&pick(before,deckKeys)!==pick(after,deckKeys))throw Error('The deck is locked.');
 if(isObjectLocked(o,'pergola:main')&&JSON.stringify(before.pergola)!==JSON.stringify(after.pergola))throw Error('The pergola is locked.');
 if(isObjectLocked(o,'lighting')&&pick(before,['lightingSystem','autoLighting','lightingZoneEnabled'])!==pick(after,['lightingSystem','autoLighting','lightingZoneEnabled']))throw Error('The lighting assembly is locked.');
 for(const screen of before.privacyScreens??[])if(isObjectLocked(o,`screen:${screen.id}`)&&JSON.stringify(screen)!==JSON.stringify(after.privacyScreens?.find(s=>s.id===screen.id)))throw Error('The screen is locked.');
 if(isObjectLocked(o,'house')&&pick(before,['houseConfig','housePlacement','houseVisible'])!==pick(after,['houseConfig','housePlacement','houseVisible']))throw Error('The house is locked.');
}

import {registerEditorOrganizationRuntime} from './editorOrganization';
registerEditorOrganizationRuntime({validateEditorOrganization,assertUnlockedChanges});
