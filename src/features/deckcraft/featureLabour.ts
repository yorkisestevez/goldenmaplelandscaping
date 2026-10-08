/**
 * Inlay and special-feature labour: man-hours + optional extra materials by default.
 * Per-user defaults live on-device (IndexedDB); a job may override them via DeckData.featureLabour
 * (private — stripped from public share/JSON). Materials for the boards themselves stay on the
 * accent/inlay supply lines; `materialsCad` is only extra consumables for that scope.
 */
import {readProjectValue,updateProjectValue} from './projectStorage';
import {CREW_DAY_RATES} from './types';

export const FEATURE_LABOUR_SCOPES=['accent','medallion','customInlay'] as const;
export type FeatureLabourScope=typeof FEATURE_LABOUR_SCOPES[number];
export type FeatureLabourMode='crew-hours'|'quote';

/** Person-hours in one confirmed crew-day (3 × 9). Same basis as quoteLabourHours. */
export const FEATURE_CREW_DAY_PERSON_HOURS=27;
export const FEATURE_DEFAULT_CREW=2;
export const FEATURE_DEFAULT_PERSON_HOUR_RATE=Math.round(CREW_DAY_RATES.Toronto/FEATURE_CREW_DAY_PERSON_HOURS*100)/100;

export interface FeatureLabourScopeSettings{
  mode:FeatureLabourMode;
  crewMembers:number;
  /** Extra hours for the whole scope, or per unit when hoursPerUnit is true. */
  hours:number;
  hoursPerUnit:boolean;
  materialsCad:number;
}

export interface FeatureLabourSettings{
  version:1;
  personHourRate:number;
  scopes:Record<FeatureLabourScope,FeatureLabourScopeSettings>;
}

const KEY='feature-labour-defaults';
const SCOPE_LABELS:Record<FeatureLabourScope,string>={
  accent:'Accent-colour board labour',
  medallion:'Medallion inlay labour',
  customInlay:'Custom inlay fabrication labour',
};

export const FEATURE_LABOUR_LABELS=SCOPE_LABELS;
const crewManHours=(crewMembers:number,hours:number)=>Math.round(crewMembers*hours*1000)/1000;

const defaultScope=(hours:number,hoursPerUnit=true):FeatureLabourScopeSettings=>({
  mode:'crew-hours',
  crewMembers:FEATURE_DEFAULT_CREW,
  hours,
  hoursPerUnit,
  materialsCad:0,
});

/** Built-in defaults: crew-hours + materials (boards priced separately). */
export const DEFAULT_FEATURE_LABOUR:FeatureLabourSettings={
  version:1,
  personHourRate:FEATURE_DEFAULT_PERSON_HOUR_RATE,
  scopes:{
    accent:defaultScope(0.25,true),       // 0.25 h per accent board
    medallion:defaultScope(4,true),       // 4 h per medallion
    customInlay:defaultScope(6,true),     // 6 h per custom/rotated inlay
  },
};

const fail=(m:string):never=>{throw Error(m);};
function money(n:unknown,label:string):number{
  if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1_000_000)fail(`${label} must be a CAD amount with at most two decimals.`);
  const amount=n as number;
  if(Math.abs(amount*100-Math.round(amount*100))>1e-6)fail(`${label} must be a CAD amount with at most two decimals.`);
  return Math.round(amount*100)/100;
}
function positive(n:unknown,label:string,max:number,step:number):number{
  if(typeof n!=='number'||!Number.isFinite(n)||n<=0||n>max)fail(`${label} must be greater than 0 and at most ${max}.`);
  const amount=n as number;
  if(Math.abs(amount/step-Math.round(amount/step))>1e-9)fail(`${label} must use ${step} steps.`);
  return amount;
}

export function validateFeatureLabour(raw:unknown):FeatureLabourSettings{
  if(raw===undefined||raw===null)return structuredClone(DEFAULT_FEATURE_LABOUR);
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Feature labour settings must be an object.');
  const r=raw as FeatureLabourSettings;
  if(r.version!==1||!r.scopes||typeof r.scopes!=='object')fail('Unsupported feature labour settings version.');
  const personHourRate=r.personHourRate===undefined?FEATURE_DEFAULT_PERSON_HOUR_RATE:money(r.personHourRate,'Person-hour rate');
  if(personHourRate<=0)fail('Person-hour rate must be greater than 0.');
  const scopes={} as Record<FeatureLabourScope,FeatureLabourScopeSettings>;
  for(const id of FEATURE_LABOUR_SCOPES){
    const s=r.scopes[id]??DEFAULT_FEATURE_LABOUR.scopes[id];
    if(!s||typeof s!=='object')fail(`Missing ${id} labour settings.`);
    if(s.mode!=='crew-hours'&&s.mode!=='quote')fail(`${id}: choose crew-hours or quote.`);
    scopes[id]={
      mode:s.mode,
      crewMembers:positive(s.crewMembers,'Crew members',12,1),
      hours:positive(s.hours,'Hours',999,0.25),
      hoursPerUnit:s.hoursPerUnit===true,
      materialsCad:money(s.materialsCad??0,'Materials'),
    };
  }
  return {version:1,personHourRate,scopes};
}

export type FeatureLabourPatch={
  personHourRate?:number;
  scopes?:Partial<Record<FeatureLabourScope,Partial<FeatureLabourScopeSettings>>>;
};

export function mergeFeatureLabour(base:FeatureLabourSettings|undefined,patch:FeatureLabourPatch):FeatureLabourSettings{
  const cur=validateFeatureLabour(base);
  return validateFeatureLabour({
    version:1,
    personHourRate:patch.personHourRate??cur.personHourRate,
    scopes:{
      accent:{...cur.scopes.accent,...patch.scopes?.accent},
      medallion:{...cur.scopes.medallion,...patch.scopes?.medallion},
      customInlay:{...cur.scopes.customInlay,...patch.scopes?.customInlay},
    },
  });
}

export type FeatureLabourQty={accentBoards?:number;medallions?:number;customInlays?:number};

/** Price one scope from settings. Returns null when the scope is in quote mode or qty is 0. */
export function priceFeatureLabourScope(settings:FeatureLabourSettings|undefined,scope:FeatureLabourScope,units:number){
  const cfg=validateFeatureLabour(settings);
  const s=cfg.scopes[scope];
  if(s.mode!=='crew-hours'||units<=0)return null;
  const hours=s.hoursPerUnit?Math.round(s.hours*units*1000)/1000:s.hours;
  const manHours=crewManHours(s.crewMembers,hours);
  const installationCost=Math.round(manHours*cfg.personHourRate*100)/100;
  const supplyCost=s.materialsCad;
  if(installationCost<=0&&supplyCost<=0)return null;
  const label=SCOPE_LABELS[scope];
  const unitWord=scope==='accent'?'board':scope==='medallion'?'medallion':'inlay';
  const basis=s.hoursPerUnit
    ?`${s.crewMembers} people × ${s.hours} h per ${unitWord} × ${units} ${unitWord}${units===1?'':'s'}`
    :`${s.crewMembers} people × ${hours} h for this scope`;
  return {
    label,
    installationCost,
    supplyCost,
    manHours,
    personHourRate:cfg.personHourRate,
    crewMembers:s.crewMembers,
    hours,
    units,
    spec:`Planning allowance (${basis} = ${manHours} man-hours @ CAD ${cfg.personHourRate.toFixed(2)}/h → labour $${installationCost.toFixed(2)}${supplyCost>0?`; extra materials $${supplyCost.toFixed(2)}`:''}). Boards/blocking are priced separately. Edit in Owner costs · Inlays & special features.`,
  };
}

export function featureLabourIsQuote(settings:FeatureLabourSettings|undefined,scope:FeatureLabourScope){
  return validateFeatureLabour(settings).scopes[scope].mode==='quote';
}

/** Empty device book = built-in defaults. */
export async function readFeatureLabourDefaults():Promise<FeatureLabourSettings>{
  try{return validateFeatureLabour(await readProjectValue('privateRates',KEY));}
  catch{return structuredClone(DEFAULT_FEATURE_LABOUR);}
}

export async function saveFeatureLabourDefaults(settings:FeatureLabourSettings):Promise<FeatureLabourSettings>{
  const clean=validateFeatureLabour(settings);
  await updateProjectValue<FeatureLabourSettings>('privateRates',KEY,()=>clean);
  return clean;
}

/** Sanity: default rate still tracks the confirmed crew-day. */
export const FEATURE_LABOUR_RATE_SOURCE={crewDay:CREW_DAY_RATES.Toronto,personHours:FEATURE_CREW_DAY_PERSON_HOURS,personHourRate:FEATURE_DEFAULT_PERSON_HOUR_RATE} as const;
