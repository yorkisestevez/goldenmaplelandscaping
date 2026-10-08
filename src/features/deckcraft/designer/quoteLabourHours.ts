import {CREW_DAY_RATES} from '../types';
import {QUOTE_RESOLUTION_LIMITS} from '../quoteResolutionValidation';

/** Person-hours in one confirmed crew-day (3 people × 9 hours). */
export const CREW_DAY_PERSON_HOURS=27;
export const DEFAULT_CREW_MEMBERS=3;
/** Default CAD per person-hour from the confirmed $3,700 crew-day. */
export const DEFAULT_PERSON_HOUR_RATE=Math.round(CREW_DAY_RATES.Toronto/CREW_DAY_PERSON_HOURS*100)/100;

export type CrewHoursInput={crewMembers:string|number;hours:string|number;personHourRate?:string|number;materials?:string|number};

function money(value:string|number,label:string){
  const n=typeof value==='number'?value:value.trim()===''?NaN:Number(value);
  if(!Number.isFinite(n)||n<0||n>QUOTE_RESOLUTION_LIMITS.amount||Math.abs(n*100-Math.round(n*100))>1e-6)throw Error(`Use a nonnegative ${label} with at most two decimals.`);
  return Math.round(n*100)/100;
}

function positive(value:string|number,label:string,max:number,step=0.25){
  const n=typeof value==='number'?value:Number(value);
  if(!Number.isFinite(n)||n<=0||n>max)throw Error(`${label} must be greater than 0 and at most ${max}.`);
  if(Math.abs(n/step-Math.round(n/step))>1e-9)throw Error(`${label} must use ${step} steps.`);
  return n;
}

/** Man-hours = crew members × hours of that crew on the extra work. */
export function crewManHours(crewMembers:number,hours:number){
  return Math.round(crewMembers*hours*1000)/1000;
}

/**
 * Build private quote costs from crew size, extra hours, person-hour rate, and optional materials.
 * Labour has no second markup; materials take the job’s material markup when confirmed.
 */
export function quoteCostFromCrewHours(input:CrewHoursInput){
  const crewMembers=positive(input.crewMembers,'Crew members',12,1);
  const hours=positive(input.hours,'Extra hours',999,0.25);
  const personHourRate=input.personHourRate===undefined||input.personHourRate===''?DEFAULT_PERSON_HOUR_RATE:money(input.personHourRate,'person-hour rate');
  const materials=input.materials===undefined||String(input.materials).trim()===''?0:money(input.materials,'materials cost');
  const manHours=crewManHours(crewMembers,hours);
  const installationCost=Math.round(manHours*personHourRate*100)/100;
  if(installationCost<=0&&materials<=0)throw Error('Enter crew hours or materials for this scope.');
  if(installationCost>QUOTE_RESOLUTION_LIMITS.amount)throw Error('The crew-hour labour amount exceeds the cost limit.');
  return {supplyCost:materials,installationCost,manHours,crewMembers,hours,personHourRate};
}

/** Note fragment stored with the private confirmation (not shown on customer ledgers). */
export function crewHoursNote(result:ReturnType<typeof quoteCostFromCrewHours>){
  return `[Crew-hours: ${result.crewMembers} people × ${result.hours} h = ${result.manHours} man-hours @ CAD ${result.personHourRate.toFixed(2)}/h → labour ${result.installationCost.toFixed(2)}${result.supplyCost>0?`; materials ${result.supplyCost.toFixed(2)}`:''}.]`;
}
