import baseline from '../../data/engine-baseline.json';

/**
 * Hardscape setting labour: industry production timing priced on the owner's hardscape crew day (owner, 2026-10-21).
 * Per-user defaults live on-device (IndexedDB); a job may override them via DeckData.hardscapeLabour (private, stripped
 * from public share/JSON like featureLabour). The crew day is the all-in hardscape card, so no markup applies.
 */
export type HardscapeLabourMode='production'|'quote';
export interface HardscapeSetting{
  mode:HardscapeLabourMode;
  tonsPerCrewDay:number;
  /** Crew days are billed up to a multiple of this step (0 bills them exactly), and never under minCrewDays. */
  stepCrewDays:number;
  minCrewDays:number;
}
export interface HardscapeLabourSettings{version:1;crewDayRate:number;scopes:{guillotinedSetting:HardscapeSetting}}

/** RSMeans 32 32 60.10-5100, setting stone dry: 0.160 labour-hours per cu ft. At 165 lb/cu ft that is 1.94 labour-hours
 * per ton, so the owner's 27 person-hour crew day (3 people × 9 h) sets about 14 tons. */
export const GUILLOTINED_TONS_PER_CREW_DAY=14;
export const DEFAULT_HARDSCAPE_LABOUR:HardscapeLabourSettings={
  version:1,
  crewDayRate:baseline.facts.crewDayRateHardscape,
  scopes:{guillotinedSetting:{mode:'production',tonsPerCrewDay:GUILLOTINED_TONS_PER_CREW_DAY,stepCrewDays:.5,minCrewDays:1}},
};

const fail=(m:string):never=>{throw Error(m);};
function amount(v:unknown,label:string,max:number,step:number,zero=false){
  if(typeof v!=='number'||!Number.isFinite(v)||(zero?v<0:v<=0)||v>max||Math.abs(v/step-Math.round(v/step))>1e-9)fail(`${label} must be ${zero?'0 or more':'greater than 0'} and at most ${max}, in ${step} steps.`);
  return v as number;
}

export function validateHardscapeLabour(raw:unknown):HardscapeLabourSettings{
  if(raw===undefined||raw===null)return structuredClone(DEFAULT_HARDSCAPE_LABOUR);
  const r=raw as HardscapeLabourSettings;
  if(typeof r!=='object'||Array.isArray(r)||r.version!==1||!r.scopes||typeof r.scopes!=='object')fail('Unsupported hardscape labour settings.');
  const s=r.scopes.guillotinedSetting??DEFAULT_HARDSCAPE_LABOUR.scopes.guillotinedSetting;
  if(s.mode!=='production'&&s.mode!=='quote')fail('Guillotined setting: choose production rate or builder quote.');
  return {version:1,crewDayRate:amount(r.crewDayRate??DEFAULT_HARDSCAPE_LABOUR.crewDayRate,'Crew-day rate',20000,.01),scopes:{guillotinedSetting:{
    mode:s.mode,
    tonsPerCrewDay:amount(s.tonsPerCrewDay,'Tons per crew-day',200,.1),
    stepCrewDays:amount(s.stepCrewDays,'Crew-day step',5,.25,true),
    minCrewDays:amount(s.minCrewDays,'Minimum crew days',10,.25,true),
  }}};
}

export type HardscapeLabourPatch={crewDayRate?:number;scopes?:{guillotinedSetting?:Partial<HardscapeSetting>}};
export function mergeHardscapeLabour(base:HardscapeLabourSettings|undefined,patch:HardscapeLabourPatch):HardscapeLabourSettings{
  const cur=validateHardscapeLabour(base);
  return validateHardscapeLabour({version:1,crewDayRate:patch.crewDayRate??cur.crewDayRate,scopes:{guillotinedSetting:{...cur.scopes.guillotinedSetting,...patch.scopes?.guillotinedSetting}}});
}
