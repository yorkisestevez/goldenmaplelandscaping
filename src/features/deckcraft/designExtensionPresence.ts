export function configuration(raw:unknown):Record<string,PropertyDescriptor>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};const descriptors=Object.getOwnPropertyDescriptors(raw),nested=descriptors.configuration;
 if(nested&&'value'in nested&&nested.value&&typeof nested.value==='object'&&!Array.isArray(nested.value))return Object.getOwnPropertyDescriptors(nested.value);return descriptors;
}
export function descriptorValue(d:Record<string,PropertyDescriptor>,key:string){return d[key]&&'value'in d[key]?d[key].value:undefined;}
export function arrayHasItems(value:unknown){return Array.isArray(value)&&Object.getOwnPropertyDescriptor(value,'length')?.value>0;}
function featureHasFields(value:unknown,keys:string[]){if(!Array.isArray(value))return false;const entries=Object.getOwnPropertyDescriptors(value);return Object.keys(entries).some(key=>{const e=entries[key];if(key==='length'||!('value'in e)||!e.value||typeof e.value!=='object')return false;const fields=Object.getOwnPropertyDescriptors(e.value);return keys.some(k=>descriptorValue(fields,k)!==undefined);});}
export function hasYardAssemblies(raw:unknown){return featureHasFields(descriptorValue(configuration(raw),'yardFeatures'),['stoneSteps','stepAssembly','pavingInterface']);}
export function hasStepAssemblies(raw:unknown){return featureHasFields(descriptorValue(configuration(raw),'yardFeatures'),['stepAssembly']);}
export function hasWallTopSteps(raw:unknown){return featureHasFields(descriptorValue(configuration(raw),'yardFeatures'),['wallTopSteps']);}
/** Detect advanced geometry without invoking accessors in imported files. */
export function hasAdvancedYard(raw:unknown){const d=configuration(raw),value=(key:string)=>descriptorValue(d,key);if(arrayHasItems(value('pools')))return true;if(value('siteModel')!==undefined)return true;const terrain=value('terrainConfig');if(terrain&&typeof terrain==='object'){const t=Object.getOwnPropertyDescriptors(terrain);if(['elevationIn','slopePct'].some(key=>descriptorValue(t,key)!==undefined&&descriptorValue(t,key)!==0))return true;}return arrayHasItems(value('stairTargets'))||featureHasFields(value('yardFeatures'),['finishedElevationIn','patioSlope','wallTopSteps','stoneSteps','stepAssembly','pavingInterface']);}
