import type {DeckData} from '../types';
import type {EstimateResult} from '../calculations';
import {buildQuoteScopes,isQuoteStatusRequirement,type QuoteScope,type QuoteResolutionReview} from '../quoteResolutions';
export type ReviewQuoteScope=QuoteScope&{known:{section:string;name:string;qty:number|string;unit:string;cost:number}[]};
/** Contractor-only enrichment is lazy; the synchronous engine does not duplicate already-priced rows. */
export function quoteScopeReview(data:DeckData,estimate:EstimateResult):Omit<QuoteResolutionReview,'scopes'>&{scopes:ReviewQuoteScope[];requirements:string[]}{
 const review=estimate.quoteResolutionReview??{scopes:buildQuoteScopes(data,estimate.sections.filter(s=>!s.title.startsWith('HST')),estimate.quoteRequired,estimate.connectorSchedule),active:[],inactive:0};
 return {...review,requirements:estimate.quoteRequired.filter(isQuoteStatusRequirement),scopes:review.scopes.map(scope=>{const titles=new Set(scope.rows.map(r=>r.sectionTitle));return {...scope,known:estimate.sections.filter(s=>!s.title.startsWith('HST')&&s.title!=='Confirmed additional quote costs').flatMap(s=>(!scope.rows.length||titles.has('Connection components')||titles.has(s.title))?s.items.filter(i=>i.cost!==null&&i.cost>0).map(i=>({section:s.title,name:i.name,qty:i.qty,unit:i.unit,cost:i.cost!})):[])};})};
}
