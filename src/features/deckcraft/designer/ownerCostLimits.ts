import type {EstimateResult} from '../calculations';

/** Private owner cost edits stay on-device with the same bounds as contractor presets. */
export const OWNER_COST_LIMITS={
  markupMin:0,
  markupMax:500,
  amountMin:0,
  amountMax:1_000_000,
  overrideMax:200,
} as const;

/** Book installation labour from the Installation Labour line when no private override is on. */
export function bookInstallationLabour(estimate:EstimateResult){
  const item=estimate.sections.find(s=>s.title.startsWith('Labour'))?.items.find(i=>i.name==='Installation Labour');
  return item?.cost??0;
}

export function parseOwnerMoney(value:string,label:string){
  const n=Number(value);
  if(!Number.isFinite(n)||n<OWNER_COST_LIMITS.amountMin||n>OWNER_COST_LIMITS.amountMax||Math.abs(n*100-Math.round(n*100))>1e-6){
    throw Error(`${label} must be a CAD amount from ${OWNER_COST_LIMITS.amountMin} to ${OWNER_COST_LIMITS.amountMax.toLocaleString('en-CA')} with at most two decimals.`);
  }
  return Math.round(n*100)/100;
}

export function parseOwnerMarkup(value:string){
  const n=Number(value);
  if(!Number.isFinite(n)||n<OWNER_COST_LIMITS.markupMin||n>OWNER_COST_LIMITS.markupMax||Math.abs(n*10-Math.round(n*10))>1e-6){
    throw Error(`Material markup must be between ${OWNER_COST_LIMITS.markupMin} and ${OWNER_COST_LIMITS.markupMax}% (one decimal).`);
  }
  return Math.round(n*10)/10;
}
