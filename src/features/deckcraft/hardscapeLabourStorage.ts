import {readProjectValue,updateProjectValue} from './projectStorage';
import {DEFAULT_HARDSCAPE_LABOUR,validateHardscapeLabour,type HardscapeLabourSettings} from './hardscapeLabour';

const KEY='hardscape-labour-defaults';

/** Empty device book = built-in defaults. Kept off the estimate graph so IndexedDB is not in the first load. */
export async function readHardscapeLabourDefaults():Promise<HardscapeLabourSettings>{
  try{return validateHardscapeLabour(await readProjectValue('privateRates',KEY));}
  catch{return structuredClone(DEFAULT_HARDSCAPE_LABOUR);}
}

export async function saveHardscapeLabourDefaults(settings:HardscapeLabourSettings):Promise<HardscapeLabourSettings>{
  const clean=validateHardscapeLabour(settings);
  await updateProjectValue<HardscapeLabourSettings>('privateRates',KEY,()=>clean);
  return clean;
}

/** The device book for a new design, or undefined when it is the built-in book (so nothing private is added). */
export async function customHardscapeLabourDefaults():Promise<HardscapeLabourSettings|undefined>{
  const saved=await readHardscapeLabourDefaults();
  return JSON.stringify(saved)===JSON.stringify(DEFAULT_HARDSCAPE_LABOUR)?undefined:saved;
}
