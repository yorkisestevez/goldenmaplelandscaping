import baseline from '../../data/engine-baseline.json';
import {c} from '../../utils/takeoff';
import {FIREPIT_GAS_LINE_CAD} from '../../utils/estimateEngine';
import type {DeckData,YardFeature} from './types';
import type {YardFeatureModel,YardModel} from './yardModel';
import type {PublicYardSection} from './yardTakeoff';
import {registerYardTakeoffRuntime} from './yardQuoteScopes';
import {fireProduct,type AllowanceItem} from './yardSettings';
import {GROUND_FIT_RATES} from './groundFitRates';
import {GUARD} from './designRules';

/**
 * The quote rows of seat walls, fire features, ground-fit banks, stone edge courses and raised-patio guards. Each exists only on a model
 * built by the advanced yard runtime, which imports this module, so their wording and arithmetic stay out of the first
 * estimate and the pricing worker until a design has one. wallQuoteScopes and buildYardTakeoff call these at the same
 * points, with the same rows, as when they were inline.
 */
type Add=(id:string,label:string,quantity:number,unit:string,note?:string)=>void;
/** Seat wall: priced on the retaining-wall basis plus a quoted second face, never $0. */
export function seatWall(q:Record<string,number>,hasAssemblyAllowance:boolean,add:Add,status:(id:string,label:string,note:string)=>void){
 if(q.wallFreestanding)add('wall-second-face','second finished face and two-sided cap (builder quote)',q.wallSecondFaceSqft,'sq ft second face',hasAssemblyAllowance?'Seat wall at the estimator wall rate per lf, height-adjusted (retaining-wall basis, drainage/grid share kept). Second face and cap overhang quoted here.':'Confirm stock finished on both faces (or a second-face veneer) and a two-sided cap.');
 if(q.freestandingReviewPending)status('wall-freestanding-review','freestanding height review and engineering','Over 36 in freestanding: builder review and engineering required.');
}
export function edgeCourse(model:YardModel,patios:YardFeatureModel[],unknown:PublicYardSection[]){
 const course=model.quantities.edgeCourseLf??0;if(course>0)unknown.push({id:'yard-edge-course',label:'Stone edge course on raised patio sides',amountCents:null,quantity:course,unit:'lf',featureIds:patios.filter(f=>f.quantities.edgeCourseLf>0).map(f=>f.config.id),note:`Tallest face ${(model.quantities.edgeCourseMaxIn??0).toFixed(1)} in above grade; stone and setting unpriced.`});
}
/** A raised patio's guard (yardModelAdvancedRuntime.ts, raisedPatioGuard, OBC 9.8.8.1): one builder-quote row with its
 * length over every patio that needs one, never $0. Absent unless a patio needs a guard. */
export function patioGuard(patios:YardFeatureModel[],unknown:PublicYardSection[]){
 const guarded=patios.filter(f=>f.guard);if(!guarded.length)return;
 const lf=Math.round(guarded.reduce((n,f)=>n+f.guard!.lf,0)*10)/10,words=(edges:string[])=>edges.length>1?`${edges.slice(0,-1).join(', ')} and ${edges.at(-1)} edges`:`${edges[0]} edge`;
 unknown.push({id:'yard-patio-guard',label:'Guard required at the raised patio edge',amountCents:null,quantity:lf,unit:'lf',featureIds:guarded.map(f=>f.config.id),
  note:`${guarded.map(f=>{const g=f.guard!;return `${f.config.name}: ${g.lf.toFixed(1)} ft along its ${words(g.edges)}, standing up to ${g.dropIn.toFixed(1)} in above the ground within 1.2 m${g.steep?' or over ground steeper than 1 in 2':''}; a ${g.heightIn} in guard`;}).join('. ')}. OBC 9.8.8.1 (over 600 mm): no opening over ${GUARD.maxOpeningIn} in and nothing climbable from ${GUARD.noClimbZoneIn[0]} to ${GUARD.noClimbZoneIn[1]} in. Guard, posts and their anchorage into the paving or wall cap unpriced: builder quote.`});
}
/** The placed fire feature's estimator allowance item (buildYardTakeoff), and any rows that follow it. A gas feature is
 * priced as the estimator's fire pit without its gas line, and the gas line follows as its own row at the estimator's
 * gas-line figure (FIREPIT_GAS_LINE_CAD, taken at its midpoint as the estimator's precise price takes it): priced as a
 * difference, alone in a yard the estimator's crew-day minimum absorbs the gas line and gas prices the same as wood.
 * A wood ring is the estimator's wood fire pit, unchanged. */
export function fireAllowance(item:AllowanceItem,fire:YardFeature):{item:AllowanceItem;rows:PublicYardSection[]}{
 const p=fireProduct(fire);if(p?.fuel!=='gas')return {item,rows:[]};
 const {low,high}=FIREPIT_GAS_LINE_CAD,money=(n:number)=>`$${n.toLocaleString('en-CA')}`;
 // No 'firepit.fuel' detail: the estimator adds nothing else for gas, so the body is its fire pit without the line.
 return {item:{...item,label:`${fire.name}: ${p.name.toLowerCase()}`,details:{}},rows:[{id:`fire-gas-line-${fire.id}`,label:`${fire.name}: gas line and hook-up (estimator allowance)`,amountCents:c((low+high)/2),featureIds:[fire.id],
  note:`The site estimator's gas-line figure, ${money(low)}–${money(high)}, at its midpoint: a planning allowance, not a quote. A licensed (TSSA-registered) gas contractor runs the line from the meter and makes the hook-up; the run is confirmed at the site visit.`}]};
}
/** The first placed fire feature is the fire pit allowance (buildYardTakeoff); the estimator has one fire pit, so any
 * further fire feature is a builder quote line, and so is the size premium of a linear table longer than the estimator's
 * 48 in fire pit. Only a placed (not excluded) fire feature replaces the fire pit allowance: an excluded one leaves the
 * allowance charged and is its own builder quote line. */
export function fires(fires:YardFeatureModel[],excluded:YardFeatureModel[],data:DeckData,unknown:PublicYardSection[],warnings:string[]){
 const first=fires[0]?.config,product=first&&fireProduct(first),widthIn=first?first.widthFt*12:0;
 if(first&&product&&!product.round&&widthIn>48+1e-6)unknown.push({id:`fire-size-${first.id}`,label:`${first.name}: Linear fire table over 48 in (size premium)`,amountCents:null,quantity:Math.round((widthIn-48)*10)/10,unit:'in over 48 in',featureIds:[first.id],note:`The estimator's fire pit allowance is for one medium fire pit (its rings and bowls run to 48 in). The longer burner, pan, body and gas supply of this ${Math.round(widthIn)} in table need a builder quote.`});
 for(const f of fires.slice(1))unknown.push({id:`fire-feature-${f.config.id}`,label:`${f.config.name}: a further fire feature, its base${fireProduct(f.config)?.fuel==='gas'?' and gas line':''} (builder quote)`,amountCents:null,featureIds:[f.config.id],note:'The estimator allows for one fire pit; each further fire feature needs its own builder quote.'});
 if(!data.yardAllowances||data.yardAllowances.firePit==='none')return;
 if(fires.length)warnings.push('The placed fire feature replaces the fire pit allowance, so it is not charged twice.');
 else if(excluded.length)warnings.push(`${excluded.map(f=>f.config.name).join(', ')} ${excluded.length>1?'are':'is'} excluded, so the fire pit allowance stays in the price until ${excluded.length>1?'one is':'it is'} placed.`);
}
/**
 * Ground-fit banks round patios: their cut and fill already sit inside the grading totals. A bank rate the owner has
 * set prices that part on its own line and takes it out of the generic hauling/bins and grading-fill quantities
 * (`model`), so nothing is charged twice; a null rate leaves it in those builder-quote rows and their notes say how much.
 * Priced bank rows: a zero amount (no bank, or an unset rate making hc/hf 0) adds no row, so never a $0 line.
 */
export function banks(model:YardModel){
 const cf=model.siteCutFill,{cutHaulPerYd3:cr,fillCompactionPerYd3:fr}=GROUND_FIT_RATES,bc=cf?.bankCutYd3||0,bf=cf?.bankFillYd3||0,ba=cf?.bankAreaSqft||0,hc=bc>.001&&cr!>0?bc:0,hf=bf>.001&&fr!>0?bf:0,q=model.quantities;
 const em:YardModel=hc||hf?{...model,quantities:{...q,excavationYd3:Math.max(0,q.excavationYd3-hc),sharedExcavationYd3:Math.max(0,q.sharedExcavationYd3-hc),siteEarthworkFillYd3:Math.max(0,q.siteEarthworkFillYd3-hf)}}:model;
 const rows:PublicYardSection[]=[],bank=(id:string,label:string,quantity:number,unit:string,rate:number,note:string,amountCents=c(quantity*rate))=>{if(amountCents>0)rows.push({id:'yard-bank-'+id,label,amountCents,quantity,unit,note});};
 bank('restoration','Lawn restoration on graded banks',ba,'sq ft',baseline.calibration.restorationPerSqft,'At the shared site restoration rate.');
 bank('cut','Bank cut and haul-away',hc,'cu yd',cr!,'Not in the shared bins.');
 bank('fill','Bank fill and compaction',hf,'cu yd',fr!,'Imported; not in grading fill.');
 return {model:em,rows,fillNote:bf>.001&&!hf?` Includes ${bf.toFixed(1)} cu yd of bank fill round patios.`:'',
  cut(unknown:PublicYardSection[]){if(bc>.001&&!hc)for(const s of unknown)if(/^yard-(haul|exc)/.test(s.id))s.note+=` Includes ${bc.toFixed(1)} cu yd dug from graded banks round patios.`;}};
}
registerYardTakeoffRuntime({seatWall,edgeCourse,patioGuard,fireAllowance,fires,banks});
