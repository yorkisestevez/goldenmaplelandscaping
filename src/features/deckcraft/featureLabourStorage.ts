import {readProjectValue,updateProjectValue} from './projectStorage';
import {DEFAULT_FEATURE_LABOUR,validateFeatureLabour,type FeatureLabourSettings} from './featureLabour';

const KEY='feature-labour-defaults';

/** Empty device book = built-in defaults. Kept off the estimate graph so IndexedDB is not in the first load. */
export async function readFeatureLabourDefaults():Promise<FeatureLabourSettings>{
  try{return validateFeatureLabour(await readProjectValue('privateRates',KEY));}
  catch{return structuredClone(DEFAULT_FEATURE_LABOUR);}
}

export async function saveFeatureLabourDefaults(settings:FeatureLabourSettings):Promise<FeatureLabourSettings>{
  const clean=validateFeatureLabour(settings);
  await updateProjectValue<FeatureLabourSettings>('privateRates',KEY,()=>clean);
  return clean;
}
