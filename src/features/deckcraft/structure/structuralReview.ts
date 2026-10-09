/**
 * Structural review for designs on the current build rules (buildRules.ts, '2026-10-struct').
 * Saved '2026-10' and legacy designs do not call this. Planning checks for the office, not a permit approval.
 * Thresholds that are not a published OBC table are named as DeckCraft planning values.
 */
import {usesStructuralReview} from '../buildRules';
import {FROST_DEPTH_IN,GUARD_REQUIRED_ABOVE_IN,STONE_STEPS} from '../designRules';
import {deckAttachesToHouse} from '../houseContact';
import {getHouseConfig} from '../houseSettings';
import type {DeckData,Municipality,SoilCondition} from '../types';

export const MASONRY_CLADDINGS = ['Brick','Stone','Ledgestone','Fieldstone','Norman brick','Roman brick'] as const;

/** DeckCraft planning bearing, kPa. Not an OBC table. Unknown and clay 75, sandy 150, fill 50. */
export const PLANNING_BEARING_KPA:Record<SoilCondition,number>={Unknown:75,Clay:75,Sandy:150,Fill:50,'Shallow Bedrock':150};

/** Dead load added to the governing live or snow load when a pier is sized. DeckCraft planning value, kPa. */
export const PLANNING_DEAD_KPA=0.5;
/** Part 9 residential floor live load behind Tables 9.23.4.2. OBC 9.4.2.3.(1) takes the greater of this and specified snow. */
export const FLOOR_LIVE_KPA=1.9;

/** Clear post above this needs knee bracing or a professional lateral design. DeckCraft planning threshold, not an OBC height table. */
export const POST_KNEE_BRACE_ABOVE_IN=72;
/** A 6x6 is flagged above this clear height. OBC 9.17.4.1 only sets the 140 mm minimum size. DeckCraft planning threshold. */
export const POST_6X6_LIMIT_IN=108;
/** A freestanding frame above this clear height is flagged for lateral stability. DeckCraft planning threshold. */
export const FREESTANDING_BRACE_ABOVE_IN=48;

const IN_PER_M=1/0.0254;
const M2_PER_SQFT=0.09290304;

export interface ClimateBasis{
  municipality:Municipality;
  /** Ground snow Ss, kPa, where a station figure is on file. */
  ss?:number;
  /** Associated rain Sr, kPa. */
  sr?:number;
  /** 0.55·Ss + Sr, kPa. */
  snowKpa?:number;
  /** False when the 1.9 kPa span tables should not be treated as covering the site. */
  tablesGovern:boolean;
  warning?:string;
}

/** OBC SB-1 figures used here. Barrie is the office basis already in structure-sources.md. Toronto is a published
 * summary (Ss 1.4, Sr 0.4) and stays marked for confirmation. Other areas are not one station. */
export function climateFor(municipality:Municipality):ClimateBasis{
  if(municipality==='Barrie')return {municipality,ss:2.5,sr:0.4,snowKpa:0.55*2.5+0.4,tablesGovern:true};
  if(municipality==='Toronto')return {municipality,ss:1.4,sr:0.4,snowKpa:0.55*1.4+0.4,tablesGovern:true,warning:'Toronto is outside the Barrie climatic basis. A published summary gives Ss 1.4 kPa and Sr 0.4 kPa (specified snow about 1.17 kPa), so the 1.9 kPa floor load still governs if that station is confirmed in OBC SB-1. Confirm Ss and Sr before a permit.'};
  if(municipality==='Simcoe County')return {municipality,tablesGovern:false,warning:'Simcoe County is not one SB-1 station. Barrie is Ss 2.5 / Sr 0.4 (specified snow 1.775 kPa, so 1.9 kPa governs). Penetanguishene is about 1.94 kPa, which is outside these span tables. Confirm the township station in OBC SB-1 before relying on the spans.'};
  if(municipality==='Burlington-Oakville')return {municipality,tablesGovern:false,warning:'Burlington–Oakville is outside the Barrie climatic basis. Confirm Ss and Sr in OBC SB-1 for the site. These spans still use the 1.9 kPa floor load until that station is confirmed.'};
  return {municipality,tablesGovern:false,warning:'This municipality is outside the Barrie climatic basis. Confirm Ss and Sr in OBC SB-1 for the site. These spans still use the 1.9 kPa floor load until that station is confirmed.'};
}

/** Governing uniform load for pier sizing: dead plus the greater of 1.9 kPa and a known specified snow. */
export function governingLoadKpa(municipality:Municipality):number{
  const snow=climateFor(municipality).snowKpa??0;
  return PLANNING_DEAD_KPA+Math.max(FLOOR_LIVE_KPA,snow);
}

/** Even-inch pier diameter, at least 12 in, from tributary load and the planning bearing. */
export function footingDiameterIn(areaSqft:number,footingCount:number,data:Pick<DeckData,'municipality'|'soilCondition'>):number{
  const each=governingLoadKpa(data.municipality)*areaSqft*M2_PER_SQFT/Math.max(1,footingCount);
  const areaM2=each/(PLANNING_BEARING_KPA[data.soilCondition]??PLANNING_BEARING_KPA.Unknown);
  const inches=Math.sqrt(4*areaM2/Math.PI)*IN_PER_M;
  return Math.max(12,Math.ceil(inches/2-1e-9)*2);
}

export function masonryCladding(data:DeckData):boolean{
  return (MASONRY_CLADDINGS as readonly string[]).includes(getHouseConfig(data).cladding);
}

/** Attached or add-on deck on brick veneer or stone: do not frame a ledger. */
export function ledgerBlocked(data:DeckData):boolean{
  return usesStructuralReview(data)&&(data.deckType==='Attached'||data.deckType==='Add-on')&&masonryCladding(data);
}

export function priceLedgerFlashing(data:DeckData):boolean{
  if(data.deckType==='Add-on')return true;
  return usesStructuralReview(data)&&data.deckType==='Attached'&&!ledgerBlocked(data);
}

function openEdgeWithoutGuard(data:DeckData,railingLf:number):boolean{
  if(data.railingType==='None')return true;
  if(data.railDefault===false&&!(data.railSections??[]).some(section=>section.enabled))return true;
  if((data.railSections??[]).some(section=>section.enabled===false))return true;
  return railingLf<0.5;
}

export interface StructuralReviewInput{
  surfaceIn:number;
  clearPostIn:number;
  areaSqft:number;
  footingCount:number;
  footingDiameterIn:number;
  railingLf:number;
  flights:{risers:number;rise:number;run:number}[];
  freestanding:boolean;
}

/** Review messages for the estimate, the permit set and window.deckcraft read(). Empty unless structural review is on. */
export function structuralReviewIssues(data:DeckData,input:StructuralReviewInput):string[]{
  if(!usesStructuralReview(data))return [];
  const issues:string[]=[];
  if(input.surfaceIn>GUARD_REQUIRED_ABOVE_IN&&openEdgeWithoutGuard(data,input.railingLf)){
    issues.push(`Guard required: the walking surface is ${Math.round(input.surfaceIn)} in above grade, more than 600 mm (OBC 9.8.8.1.(1)). An open edge is set to no guard.`);
  }
  if(data.intendedLoad==='Heavy'){
    issues.push('Heavy point or area load: a professional design is required for a hot tub, large planter or outdoor kitchen. Framing under that zone is a layout only and is not sized from the Part 9 span tables.');
  }
  if(ledgerBlocked(data)){
    issues.push(`Ledger blocked: the house cladding is ${getHouseConfig(data).cladding}. Do not fasten a ledger to brick veneer or stone. The house side is framed as a freestanding beam; use that or a professional attachment detail.`);
  }
  if(input.clearPostIn>POST_KNEE_BRACE_ABOVE_IN){
    issues.push(`Knee bracing or a professional lateral design: clear post height is ${Math.round(input.clearPostIn)} in, over the ${POST_KNEE_BRACE_ABOVE_IN} in DeckCraft planning threshold. OBC 9.17.4.1 sets a minimum post of 140×140 mm and does not publish a deck post-height table.`);
  }
  if(input.clearPostIn>POST_6X6_LIMIT_IN){
    issues.push(`6x6 posts are inadequate for a clear height of ${Math.round(input.clearPostIn)} in (DeckCraft planning limit ${POST_6X6_LIMIT_IN} in). Use a larger post or a professional design. OBC 9.17.4.1 minimum size is 140×140 mm.`);
  }
  if(input.freestanding&&input.clearPostIn>FREESTANDING_BRACE_ABOVE_IN){
    issues.push(`Freestanding stability: clear posts are ${Math.round(input.clearPostIn)} in and the frame has no house ledger to brace it (DeckCraft planning threshold ${FREESTANDING_BRACE_ABOVE_IN} in). Add knee bracing or a professional stability design.`);
  }
  const climate=climateFor(data.municipality);
  if(climate.warning)issues.push(climate.warning);
  if(data.foundation==='Concrete Piers'){
    const allowance=data.soilCondition==='Clay'||data.soilCondition==='Fill'?16:12;
    const bearing=PLANNING_BEARING_KPA[data.soilCondition];
    if(data.soilCondition==='Shallow Bedrock')issues.push('Shallow bedrock: the drawn pier is not a bearing design. A professional design sets the foundation.');
    else if(input.footingDiameterIn>allowance)issues.push(`Footings size to ${input.footingDiameterIn} in for the tributary load on ${data.soilCondition.toLowerCase()} soil (${bearing} kPa DeckCraft planning bearing; dead ${PLANNING_DEAD_KPA} kPa plus the greater of 1.9 kPa and the municipal snow). The price book still allows a ${allowance} in pier at the existing unit rate. Confirm the diameter and bearing before construction.`);
    if(data.soilCondition==='Fill')issues.push('Fill soil: planning bearing is 50 kPa. A professional design should confirm the foundation before construction.');
  }
  const depth=data.foundationDepthIn??FROST_DEPTH_IN;
  if(depth<FROST_DEPTH_IN&&data.foundation!=='Helical Piles'&&data.foundation!=='Deck Blocks'&&data.deckType!=='Floating'){
    issues.push(`Footing depth is ${depth} in, under the 48 in (1.2 m) frost depth (OBC 9.12.2.2; Barrie practice). Use at least 48 in, a floating deck, or a helical-pile system.`);
  }
  for(const flight of input.flights){
    if(flight.rise<STONE_STEPS.riseIn[0]||flight.rise>STONE_STEPS.riseIn[1]){
      issues.push(`Stair rise ${flight.rise.toFixed(2)} in is outside OBC Table 9.8.4.1 for private stairs (125–200 mm, ${STONE_STEPS.riseIn[0]}–${STONE_STEPS.riseIn[1]} in as printed for Barrie).`);
    }
    if(flight.run<STONE_STEPS.runIn[0]||flight.run>STONE_STEPS.runIn[1]){
      issues.push(`Stair run ${flight.run.toFixed(2)} in is outside 255–355 mm (OBC Table 9.8.4.1; Barrie Deck Specs prints ${STONE_STEPS.runIn[0]}–${STONE_STEPS.runIn[1]} in).`);
    }
    if(flight.risers>STONE_STEPS.handrailAboveRisers&&(data.railingType==='None'||data.railDefault===false)){
      issues.push(`Handrail required: a flight has ${flight.risers} risers, more than ${STONE_STEPS.handrailAboveRisers} (OBC 9.8.7.1.).`);
    }
  }
  if(data.framingSpecies&&data.framingSpecies!=='SPF'){
    issues.push(`${data.framingSpecies} No. 1/No. 2 joist spans (with bridging) are applied. Beam spans stay on S-P-F Table 9.23.4.2.-H. Confirm the species beam sheet before a permit.`);
  }
  return [...new Set(issues)];
}

export function structuralReviewInput(data:DeckData,ctx:{
  surfaceIn:number;supports:{y:number}[];areaSqft:number;footingCount:number;footingDiameterIn:number;railingLf:number;
  flights:{risers:number;rise:number;run:number}[];
}):StructuralReviewInput{
  const base=data.foundation==='Deck Blocks'?6.5:4.5;
  const clearPostIn=ctx.supports.reduce((max,support)=>Math.max(max,support.y-base),0);
  return {
    surfaceIn:ctx.surfaceIn,clearPostIn,areaSqft:ctx.areaSqft,footingCount:ctx.footingCount,footingDiameterIn:ctx.footingDiameterIn,
    railingLf:ctx.railingLf,flights:ctx.flights,
    freestanding:data.deckType==='Freestanding'||data.deckType==='Floating'||ledgerBlocked(data)||!deckAttachesToHouse(data),
  };
}
