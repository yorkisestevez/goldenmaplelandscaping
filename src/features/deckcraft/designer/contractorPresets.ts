import type {DeckData,SkirtingConfig} from '../types';
import {DEFAULT_DECK} from '../defaults';
import {validateDesign} from '../designPersistence';
import {partAllowed} from '../boardFinishes';
import {effectiveUnderDeck,underDeckConfig} from '../underDeckOptions';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../deckRelease';
import {extrasLayout} from '../extrasLayout';
import {syncAutoLighting} from '../lightingSystem';
import {houseRailingReviewFlags} from '../houseRailingClearance';

export const PRESET_STORAGE_KEY='golden-maple.deck-studio.contractor-presets.v1';
export const PRESET_LIMITS={count:40,name:80,bytes:100_000,overrides:200} as const;
export const PRESET_FIELDS=['framingSize','joistSpacing','foundation','foundationDepthIn','deckingMaterial','deckingColor','boardWidth','fasteningSystem','pattern','pictureFrameRows','borderFinish','pictureFrameOverhangIn','deckFinishes','railingType','catalogueRailingId','glassMount','glassFinish','skirting','autoLighting','lightingZoneEnabled','underDeck'] as const;
type PresetField=typeof PRESET_FIELDS[number];
type SkirtSpecification=Omit<SkirtingConfig,'openEdges'|'accessPanels'>;
export type PresetSettings={ [K in Exclude<PresetField,'skirting'>]:NonNullable<DeckData[K]>|null }&{skirting:SkirtSpecification|null};
export interface PresetPricing{materialMarkup:number|null;customLaborCost:number|null;customOverrides:NonNullable<DeckData['customOverrides']>|null}
export interface ContractorPreset{id:string;name:string;settings:PresetSettings;pricing?:PresetPricing}
export interface PresetLibrary{format:'golden-maple-contractor-presets';version:1;presets:ContractorPreset[]}
export const emptyPresetLibrary=():PresetLibrary=>({format:'golden-maple-contractor-presets',version:1,presets:[]});
const canonical=(value:unknown):string=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`:JSON.stringify(value)??'undefined';
const fail=(message:string):never=>{throw Error(message);};
function object(value:unknown,label:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)fail(`${label} must be a plain object.`);return value as Record<string,unknown>;}
function keys(value:Record<string,unknown>,allowed:readonly string[],required:readonly string[],label:string){for(const key of Object.keys(value))if(!allowed.includes(key))fail(`${label}: unsupported field ${key}.`);for(const key of required)if(!Object.hasOwn(value,key))fail(`${label}: missing ${key}.`);}
/** Read descriptors before reading values: input accessors never execute. */
function safeTree(value:unknown,depth=0){if(depth>12)fail('Preset nesting is too deep.');if(value===null||typeof value==='string'||typeof value==='boolean')return;if(typeof value==='number'){if(!Number.isFinite(value))fail('Preset numbers must be finite.');return;}if(!value||typeof value!=='object')fail('Presets contain JSON values only.');if(Array.isArray(value)){if(value.length>PRESET_LIMITS.overrides)fail('Preset array is too large.');if(Object.getPrototypeOf(value)!==Array.prototype)fail('Unsupported preset array prototype.');const descriptors=Object.getOwnPropertyDescriptors(value);if(Object.getOwnPropertySymbols(value).length)fail('Symbol fields are not supported.');for(const key of Object.keys(descriptors)){if(key==='length')continue;if(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length||!('value' in descriptors[key]))fail('Unsupported array field or accessor.');}for(let i=0;i<value.length;i++){if(!Object.hasOwn(descriptors,String(i)))fail('Sparse preset arrays are not supported.');safeTree(descriptors[String(i)].value,depth+1);}return;}object(value,'Preset');if(Object.getOwnPropertySymbols(value).length)fail('Symbol fields are not supported.');for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))){if(!descriptor.enumerable||!('value' in descriptor)||['__proto__','prototype','constructor'].includes(key))fail('Unsupported preset field or accessor.');safeTree(descriptor.value,depth+1);}}
function number(value:unknown,min:number,max:number,label:string){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail(`${label} must be between ${min} and ${max}.`);return value as number;}
function nested(v:unknown,allowed:string[],label:string){const r=object(v,label);keys(r,allowed,[],label);return r;}
function validateSettings(value:unknown):PresetSettings{
 const settings=object(value,'Preset settings');keys(settings,PRESET_FIELDS,PRESET_FIELDS,'Preset settings');
 for(const field of ['framingSize','joistSpacing','foundation','deckingMaterial','deckingColor','boardWidth','fasteningSystem','pattern','pictureFrameRows','railingType'])if(settings[field]===null)fail(`${field} must have a selection.`);
 if(settings.skirting!==null)nested(settings.skirting,['style','colour','clearanceIn','cornerTreatment'],'Skirting specification');
 if(settings.deckFinishes!==null)nested(settings.deckFinishes,['border','fascia','treads','risers','railingColor'],'Deck finishes');
 if(settings.autoLighting!==null)nested(settings.autoLighting,['posts','stairs','border','stairStyle'],'Lighting intent');
 if(settings.lightingZoneEnabled!==null)nested(settings.lightingZoneEnabled,['deck','posts','stairs','landscape','house','privacy','border'],'Lighting zones');
 if(settings.underDeck!==null){const c=nested(settings.underDeck,['drainage','ceiling','scope','gravel','gravelDepthIn','floorMesh'],'Under-deck specification');keys(c,['drainage','ceiling','scope','gravel','gravelDepthIn','floorMesh'],['drainage','ceiling','scope','gravel','gravelDepthIn','floorMesh'],'Under-deck specification');if(c.drainage==='rainescape')c.drainage='none';/* retired 2026-10-04: older presets load without it */if(!['none','dryspace','zipup'].includes(c.drainage as string)||!['none','aluminum','pvc','cedar'].includes(c.ceiling as string)||!['main','all'].includes(c.scope as string)||typeof c.gravel!=='boolean'||typeof c.floorMesh!=='boolean')fail('Unsupported under-deck selection.');number(c.gravelDepthIn,2,6,'Gravel depth');if(['dryspace','zipup'].includes(c.drainage as string)&&c.ceiling!=='none')fail('Integrated drainage ceilings cannot include a second ceiling.');}
 const raw={...DEFAULT_DECK,...Object.fromEntries(Object.entries(settings).filter(([,v])=>v!==null))};
 const clean=validateDesign(raw) as unknown as Record<string,unknown>;
 for(const [field,v] of Object.entries(settings))if(v!==null&&canonical(v)!==canonical(clean[field]))fail(`${field} has conflicting or incompatible selections. Choose compatible finishes and border settings before saving.`);
 return structuredClone(settings) as PresetSettings;
}
function validatePricing(value:unknown):PresetPricing{
 const p=object(value,'Contractor pricing');keys(p,['materialMarkup','customLaborCost','customOverrides'],['materialMarkup','customLaborCost','customOverrides'],'Contractor pricing');
 if(p.materialMarkup!==null)number(p.materialMarkup,0,500,'Material markup');if(p.customLaborCost!==null)number(p.customLaborCost,0,1_000_000,'Labour allowance');
 if(p.customOverrides!==null){const overrides=object(p.customOverrides,'Price overrides');if(Object.keys(overrides).length>PRESET_LIMITS.overrides)fail('Too many price overrides.');for(const [name,value] of Object.entries(overrides)){if(!name.trim()||name.length>160||/[\u0000-\u001f]/.test(name))fail('Invalid price override name.');const row=nested(value,['qty','cost'],'Price override');if(!Object.keys(row).length)fail('Empty price override.');if(row.qty!==undefined)number(row.qty,0,1_000_000,'Override quantity');if(row.cost!==undefined)number(row.cost,0,10_000_000,'Override cost');}}
 return structuredClone(p) as unknown as PresetPricing;
}
export function parsePresetLibrary(value:unknown,{portable=false}:{portable?:boolean}={}):PresetLibrary{
 safeTree(value);const raw=object(value,'Preset library');keys(raw,['format','version','presets'],['format','version','presets'],'Preset library');if(raw.format!=='golden-maple-contractor-presets'||raw.version!==1||!Array.isArray(raw.presets)||raw.presets.length>PRESET_LIMITS.count)fail('Unsupported preset library or more than 40 presets.');
 const names=new Set<string>(),ids=new Set<string>();const presets=(raw.presets as unknown[]).map(value=>{const p=object(value,'Preset');keys(p,['id','name','settings','pricing'],['id','name','settings'],'Preset');if(typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.id)||ids.has(p.id))fail('Invalid or duplicate preset identifier.');if(typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>PRESET_LIMITS.name||/[\u0000-\u001f]/.test(p.name))fail('Name a preset using 1–80 characters.');const name=(p.name as string).trim(),folded=name.toLocaleLowerCase();if(names.has(folded))fail('Each preset needs a different name.');names.add(folded);ids.add(p.id as string);if(portable&&p.pricing!==undefined)fail('Portable presets cannot contain private contractor pricing.');return {id:p.id,name,settings:validateSettings(p.settings),...(p.pricing!==undefined?{pricing:validatePricing(p.pricing)}:{})} as ContractorPreset;});
 const library={format:raw.format,version:1,presets} as PresetLibrary;if(new TextEncoder().encode(JSON.stringify(library)).length>PRESET_LIMITS.bytes)fail('Preset library exceeds 100 KB.');return library;
}
export function parsePresetText(text:string,portable=true):PresetLibrary{if(new TextEncoder().encode(text).length>PRESET_LIMITS.bytes)fail('Choose a preset file smaller than 100 KB.');return parsePresetLibrary(JSON.parse(text),{portable});}
export function exportPresetLibrary(library:PresetLibrary):string{const clean=parsePresetLibrary(library),portable={...clean,presets:clean.presets.map(({pricing:_private,...preset})=>preset)},pretty=JSON.stringify(portable,null,2);return new TextEncoder().encode(pretty).length<=PRESET_LIMITS.bytes?pretty:JSON.stringify(portable);}
export function captureContractorPreset(data:DeckData,name:string,includePricing=false,id=`preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`):ContractorPreset{
 const settings=Object.fromEntries(PRESET_FIELDS.map(field=>[field,data[field]===undefined?null:structuredClone(data[field])])) as PresetSettings;
 if(data.skirting){const {openEdges:_edges,accessPanels:_access,...spec}=data.skirting;settings.skirting=spec;}
 settings.underDeck=effectiveUnderDeck(underDeckConfig(data));
 const preset={id,name,settings,...(includePricing?{pricing:{materialMarkup:data.materialMarkup??null,customLaborCost:data.customLaborCost??null,customOverrides:data.customOverrides?structuredClone(data.customOverrides):null}}:{})};
 return parsePresetLibrary({...emptyPresetLibrary(),presets:[preset]}).presets[0];
}
export function mergePresetLibraries(current:PresetLibrary,incoming:PresetLibrary):PresetLibrary{return parsePresetLibrary({...current,presets:[...current.presets,...incoming.presets]});}
/** Spec-only patch; existing geometry and manually placed features are never moved or deleted. */
export function contractorPresetPatch(data:DeckData,preset:ContractorPreset,includePricing=false):Partial<DeckData>{
 const verified=parsePresetLibrary({...emptyPresetLibrary(),presets:[preset]}).presets[0];
 const patch=Object.fromEntries(Object.entries(verified.settings).map(([k,v])=>[k,v===null?undefined:structuredClone(v)])) as Partial<DeckData>;
 if(patch.skirting&&data.skirting)patch.skirting={...patch.skirting,...(data.skirting.openEdges?{openEdges:structuredClone(data.skirting.openEdges)}:{}),...(data.skirting.accessPanels!==undefined?{accessPanels:data.skirting.accessPanels}:{})};
 patch.hasDrainage=patch.underDeck?.drainage!=='none'&&patch.underDeck!==undefined;
 if(patch.underDeck&&canonical(patch.underDeck)===canonical(underDeckConfig(data)))delete patch.underDeck;
 if(includePricing&&verified.pricing)for(const [key,value] of Object.entries(verified.pricing))(patch as Record<string,unknown>)[key]=value===null?undefined:structuredClone(value);
 const next={...data,...patch};const refs=[...(data.boardColours??[]).map(b=>b.colour),...(data.inlays??[]).flatMap(i=>[i.fill,'frame' in i?i.frame:undefined]),...(data.boardLayout?[...data.boardLayout.regions,...data.boardLayout.breakers,...data.boardLayout.pieces].map(b=>b.colour):[])].filter((v):v is string=>!!v);
 if(refs.some(ref=>!partAllowed(next,ref)))fail('This material is incompatible with this job’s saved board colours or inlays. Keep a compatible material; the preset will not clear your edits.');
 if(data.boardLayout?.pieces.some(p=>p.widthIn>next.boardWidth))fail('This board width is narrower than a saved custom board. The preset will not resize or delete your board edits.');
 return patch;
}
export function presetChanges(data:DeckData,patch:Partial<DeckData>):{key:string;before:unknown;after:unknown}[]{return Object.entries(patch).filter(([key,value])=>canonical((data as unknown as Record<string,unknown>)[key])!==canonical(value)).map(([key,after])=>({key,before:(data as unknown as Record<string,unknown>)[key],after}));}

const presetStamp=(value:unknown)=>JSON.stringify(value);
export function previewContractorPreset(data:DeckData,preset:ContractorPreset,includePricing=false){
 const patch=contractorPresetPatch(data,preset,includePricing),current=calculateDeckReleaseEstimate(data);let next=deckReleaseData({...data,...patch}),estimate=calculateDeckReleaseEstimate(next);
 const extras=extrasLayout(next,estimate.model),items=syncAutoLighting(next,{posts:estimate.model.railing.posts.length,stairs:estimate.model.treads.length,privacy:extras.privacyMounts.length,border:extras.borderMounts.length});
 if(presetStamp(items)!==presetStamp(next.lightingSystem.selectedItems)){next={...next,lightingSystem:{...next.lightingSystem,selectedItems:items}};patch.lightingSystem=next.lightingSystem;estimate=calculateDeckReleaseEstimate(next);}
 return {patch,current,next,estimate,changes:presetChanges(data,patch),issues:[...new Set([...houseRailingReviewFlags(next,estimate.model,estimate.flags),...extras.warnings])],stamp:presetStamp(data)};
}
