import {buildPoolQuote} from './poolQuoteRegistry';
import {physicalFoundationSections} from './physicalQuote';
import {applyQuoteResolutions,type QuoteResolutionReview} from './quoteCostRegistry';
import {pergolaPricing,pergolaQuoteKey} from './pergolaPricing';
import {pergolaLayout} from './pergolaLayout';
import { activeWrap, wrapLabourFactor } from './lib/wrapGeometry';
import {buildUnderDeckPricing} from './underDeckPricing';
import { activeCornerChamfers, chamferLabourFactor } from './lib/cornerChamfers';
import { activeCustomFront, customLabourFactor, customOutline } from './lib/customOutline';
import {freeFootprint,freeOutlineLabourFactor} from './lib/freeOutline';
import { outlineSpans } from './zoneFraming';
import {getHardwareLayout} from './hardwareLayout';
import {deckBoardStock,type ProductStock} from './stockPlan';
import {productStock} from './deckingStock';
import {usesCurrentBuildRules} from './buildRules';
import {hasBoardLayout,layoutBoardStock,layoutAutomaticBreakerLf,boardLayoutAllowance,BOARD_LAYOUT_POLICY,BOARD_LAYOUT_SUPPORT_QUOTE} from './boardLayoutPricing';
import {boardFinishPlan,colourName,darkSlateBorder,parseColourRef,type StockGroup} from './boardFinishes';
import {DECK_PARTS,partRef,railingFinish,stairTreadKey} from './deckPartFinishes';
import {inlayCrewDays,PATTERN_LABOUR} from './lib/inlayGeometry';
import {SKIRTING_STYLE_NAMES,skirtingPlan} from './skirting';
import {pricedSkirtingRows} from './skirtingPricing';
import {claddingPlan} from './stairCladding';
import {STAIR_ALLOWANCE_WIDTH_IN,DECKING_RATE_SOURCES,deckingRateWidth} from './supplierRates';
import {fasciaSupply} from './fasciaPricing';
import {houseRailingConflicts} from './houseRailingClearance';
import {buildDeckTakeoff,type DeckTakeoff} from './deckTakeoff';
import {DECK_SETTINGS} from './defaults';
import {DECKING_CATALOGUE,RAILING_CATALOGUE} from './manufacturerRuntimeCatalogue';
import {catalogueAccessoryLayout} from './catalogueAccessories';
import {lightingSystemCheck,syncAutoLighting} from './lightingSystem';
import {borderLightingPlan,BORDER_SUPPORT_NOTE,BORDER_SUPPORT_QUOTE} from './borderLighting';
import {quotedPrivacyScreens,pricedPrivacyArea} from './privacyScreens';
import {extrasLayout} from './extrasLayout';
import {edgeSectionId} from './lib/edgeSections';
import {exposedRim,getHouseContact} from './houseContact';
import {pictureFrameCompatibility} from './lib/finishedFootprint';
import {GLASS_FINISH_NAMES,glassRailingName,type FramelessGlassLayout} from './framelessGlass';
import {buildYardModel,type YardModel} from './yardModel';
import {buildYardTakeoff,type YardTakeoff} from './yardTakeoff';
import {stairVeneerLayout} from './stairVeneerLayout';
import {planStock} from './stockPlan';
import {connectorSchedule,constructionStock,stairStock,type ConnectorScheduleRow,type StockScheduleRow} from './schedule';
import { 
  DeckData, 
  WASTE_FACTORS, 
  STAIR_TREAD_COSTS, 
  STAIR_LABOR_MULTIPLIER, 
  Municipality,
  RailingType,
  LIGHTING_COSTS
} from './types';

/** Decking supply rates exclude delivery, so every design lists it for a supplier quote. */
export const DECKING_DELIVERY_QUOTE='Decking delivery (supplier quote)';

export interface EstimateResult {
  poolQuoteReview?:import('./poolQuoteRuntime').PoolQuoteReview;
  quoteResolutionReview?:QuoteResolutionReview;
  yardModel:YardModel;
  yardTakeoff:YardTakeoff;
  /** Nonempty means totals show only the priced portion, never a complete quotation. */
  quoteRequired: string[];
  connectorSchedule: ConnectorScheduleRow[];
  stockSchedule: StockScheduleRow[];
  model: DeckTakeoff;
  total: number;        // grand total including HST
  subtotal: number;     // pre-tax sum of all sections
  hst: number;          // 13% Ontario HST
  costPerSqft: number;
  area: number;
  manHours: number;
  calculatedRailingLf: number;
  sections: {
    quoteRequired?: boolean;
    title: string;
    icon: string;
    description?: string;
    total: number;
    items: { 
      name: string; 
      spec: string; 
      qty: number | string; 
      unit: string; 
      cost: number | null;
      quoteResolved?: boolean;
      unitPrice?: number;
      laborCost?: number;
    }[];
  }[];
  flags: string[];
  materialList: { item: string; spec: string; qty: number | string; unit: string; cost: number | null }[];
  breakerInfo?: {
    required: boolean;
    rows: number;
    interval: number;
    standardLength: number;
    positions1: number[];
    positions2: number[];
  };
}

export function calculateEstimate(data: DeckData, settings?: any): EstimateResult {
  settings = settings || DECK_SETTINGS;
  const model=buildDeckTakeoff(data);
  const yardModel=buildYardModel(data,model),yardTakeoff=buildYardTakeoff(data,yardModel);
  const veneer=stairVeneerLayout(data,model);
  const quantities=model.quantities;
  const sectionRailing=data.railSections!==undefined||data.railDefault!==undefined;
  const hardware=getHardwareLayout(data,model);
  // Flashing covers every wall the deck meets: ledgers plus bump-out flush walls (same as ledger length without them).
  const flashingLf=getHouseContact(data,model.levels[0].footprint).flashingLf;
  const connectors=connectorSchedule(data,model,hardware);
  const framingStock=constructionStock(model),stairSchedule=stairStock(data,model);
  const {
    width, length, height, cutoutWidth, cutoutLength, width2, length2, height2, cutoutWidth2, cutoutLength2, shape, levels, pattern,
    deckType, municipality, siteType, soilCondition, buildSeason, intendedLoad, foundation,
    deckingMaterial, boardWidth, joistSpacing, fasteningSystem, pictureFrameRows, hasInlay, inlayLf,
    railingType, railingLf, stairFlights, stairWidth, stairType,
    lightingSystem, benchLf, privacySqft, hasDrainage, hasDemo, pergolaSqft,
    customLaborCost, materialMarkup
  } = data;

  const materials = settings?.materials || [];
  const crewRates = settings?.crewRates || {};
  const permitFees = settings?.permitFees || {};
  const railingCosts = settings?.railingCosts || {};
  const stairTreadCosts = settings?.stairTreadCosts || {};
  const wasteFactors = settings?.wasteFactors || {};

  let area1 = width * length;
  if (shape === 'L-Shape') {
    area1 -= (cutoutWidth * cutoutLength);
  }
  let area2 = levels > 1 ? width2 * length2 : 0;
  if (levels > 1 && shape === 'L-Shape') {
    area2 -= (cutoutWidth2 * cutoutLength2);
  }
  
  // Landing midway down steps if second level exists
  const landingArea = levels > 1 ? (stairWidth / 12) * (stairWidth / 12) : 0;
  
  const area = quantities.area;
  // A wrap-around's fascia follows its real outline; every other shape keeps the original rectangle basis.
  const wrap = activeWrap(data), wrapCorners = wrap ? (wrap.left ? 1 : 0) + (wrap.right ? 1 : 0) : 0;
  const wrapOutlineFt = model.levels[0].footprint.outline.reduce((n, p, i, o) => { const q = o[(i + 1) % o.length]; return n + Math.hypot(q.x - p.x, q.y - p.y) / 12; }, 0);
  // Angled corners replace each corner's two legs with one 45° face (leg × √2) on the same rectangle basis.
  const chamfers = activeCornerChamfers(data);
  // A custom outline's fascia is its true outline length (feet), as a wrap-around's is.
  const custom = activeCustomFront(data);
  const customOutlineFt = custom ? customOutline(custom, 1).outline.reduce((n, p, i, o) => { const q = o[(i + 1) % o.length]; return n + Math.hypot(q.x - p.x, q.y - p.y); }, 0) : 0;
  const actualPerimeter=(index:number)=>model.levels.find(l=>l.kind==='deck'&&l.index===index)?.footprint.outline.reduce((n,p,i,o)=>n+Math.hypot(p.x-o[(i+1)%o.length].x,p.y-o[(i+1)%o.length].y)/12,0)??0;
  const perimeter1 = freeFootprint(data,1)?actualPerimeter(0):wrapCorners ? wrapOutlineFt : custom ? customOutlineFt : chamfers ? 2 * (width + length) - (2 - Math.SQRT2) * (chamfers.leftIn + chamfers.rightIn) / 12 : 2 * (width + length);
  const perimeter2 = levels > 1 ? freeFootprint(data,2)?actualPerimeter(1):2 * (width2 + length2) : 0;
  // A third section adds its own fascia on the same basis as the second.
  const perimeter3 = levels > 2 && data.level3 ? freeFootprint(data,3)?actualPerimeter(2):2 * (data.level3.widthFt + data.level3.lengthFt) : 0;
  const perimeter = perimeter1 + perimeter2 + perimeter3;
  
  const catalogueMaterial=DECKING_CATALOGUE.find(m=>m.id===deckingMaterial);
  const selectedMaterial = catalogueMaterial?.costPerSqft===null?catalogueMaterial:materials.find((m: any) => m.id === deckingMaterial)||catalogueMaterial||materials[0];
  const quoteRequired:string[]=connectors.filter(c=>c.qty>0&&c.rate===null&&!c.basis.startsWith('Priced by')).map(c=>c.name);
  const missingStairPath=!!data.stairPath&&stairFlights>0&&!model.flights.some(f=>f.kind==='grade'),stairPathQuote='Stair path supply and installation (reviewed layout / builder quote)';
  if(missingStairPath)quoteRequired.push(stairPathQuote);
  
  // Trex / Deckorators behavioral defaults
  const isTrexOrDeck = selectedMaterial.id.startsWith('trex_') || selectedMaterial.id.startsWith('deck_');
  const effectiveJoistSpacing = isTrexOrDeck && pattern === 'Diagonal' ? 12 : joistSpacing;
  const effectiveFasteningSystem = isTrexOrDeck ? 'Hidden' : fasteningSystem;

  const wasteFactor = wasteFactors[pattern] || 1.10;

  // Board Count (Math Engine Formula - Linear Logic)
  const gapIn = selectedMaterial.isComposite ? 0.375 : 0.25;
  const boardWidthIn = boardWidth || 5.5;
  const boardCoverageFt = (boardWidthIn + gapIn) / 12;
  
  // Total Linear Feet (LF) = (Area / Coverage) * Waste
  const layoutRecords=[...(data.boardLayout?.regions??[]),...(data.boardLayout?.breakers??[]),...(data.boardLayout?.pieces??[])];
  const presentLayoutLevels=new Set(model.levels.filter(l=>l.kind==='deck').map(l=>l.index+1));
  // Each product is bought in its own listed lengths (deckingStock.productStock); legacy designs keep their one stock length.
  const mainStock=productStock(data,data.deckingMaterial);
  const customBoardLayout=model.levels.some(l=>l.boards.some(b=>!!b.layoutId)),stockFor=(m:DeckTakeoff,w:number,stock:ProductStock=mainStock)=>customBoardLayout?layoutBoardStock(data,m,w,{straight:wasteFactors.Straight||1.10,diagonal:wasteFactors.Diagonal||1.15},model,stock):deckBoardStock(m,w,stock);
  const boardStock=stockFor(model,wasteFactor);
  const separateBorder=darkSlateBorder(data)&&model.levels.some(l=>l.boards.some(b=>b.role==='border'&&!(b as typeof b&{layoutColour?:string}).layoutColour));
  const darkBoard=(li:number,bi:number,role?:string)=>separateBorder&&role==='border'&&!(model.levels[li].boards[bi] as typeof model.levels[number]['boards'][number]&{layoutColour?:string}).layoutColour;
  // Accent-colour and inlay boards (boardFinishes.ts) leave the main stock and are ordered as their own boards.
  const finish=data.boardColours?.length||data.inlays?.length||data.deckFinishes?.border||customBoardLayout?boardFinishPlan(data,model):null,accent=finish?.pieces?finish:null,separate=finish?.stock.length?finish:null;
  const accentKeys=new Set(separate?.stock.flatMap(g=>g.boards.map(b=>`${b.level}:${b.index}`)));
  const boardsWhere=(keep:(level:number,index:number,role?:string)=>boolean,waste=wasteFactor,stock=mainStock)=>stockFor({...model,levels:model.levels.map((l,li)=>({...l,boards:l.boards.filter((b,bi)=>keep(li,bi,b.role))}))},waste,stock);
  const pricedBoardStock=separate?boardsWhere((li,bi,role)=>!darkBoard(li,bi,role)&&!accentKeys.has(`${li}:${bi}`)):separateBorder?boardsWhere((li,bi,role)=>!darkBoard(li,bi,role)):boardStock;
  const totalDeckingLf = pricedBoardStock.orderedLf;
  // The main product's longest board, in feet (legacy 16 / cedar 12), so breaker wording names a real board length.
  const standard_board_length = Math.max(...mainStock.lengthsIn)/12;
  const finalBoards = pricedBoardStock.orderedBoards;
  // costPerSqft → $/lin-ft conversion is (boardWidthIn / 12): a 5.5" board covers
  // 5.5/12 sqft per lin-ft. (Was /5.5, which billed per-sqft prices per lin-ft —
  // inflating decking material ~2.18×. Same conversion as unit_cost_per_lf below.)
  const rateWidthIn=customBoardLayout?BOARD_LAYOUT_POLICY.stockWidthIn:deckingRateWidth(selectedMaterial.id,boardWidthIn);
  const deckingCost = totalDeckingLf * (selectedMaterial.costPerSqft * (rateWidthIn / 12));

  // Framing (Math Engine Formula)
  const joistSpacingFt = effectiveJoistSpacing / 12;
  const joistCount1 = model.levels[0].joists.length;
  const joistCount2 = model.levels[1]?.joists.length || 0;
  let joistCount = joistCount1 + joistCount2;
  
  // Quantities come from the same members and board cuts used in the model.
  // Unit rates, markup and crew rates remain Deck Craft Pro's own values.
  const rimLf=model.levels.reduce((n,l)=>n+l.footprint.outline.reduce((s,p,i)=>{const q=l.footprint.outline[(i+1)%l.footprint.outline.length];return s+Math.hypot(q.x-p.x,q.y-p.y)/12;},0),0);
  const hasModeledRim=model.levels.some(l=>(l as typeof l & {rim?:unknown[]}).rim?.length);
  const totalFramingLf=framingStock.reduce((n,row)=>n+row.orderedLf+row.unresolvedIn.reduce((sum,cut)=>sum+cut/12,0),0)+(hasModeledRim?0:rimLf);
  const breaker_rows=quantities.breakerBoards;
  const breaker_required=breaker_rows>0;
  const breaker_positions1=model.levels[0].breakers.map(x=>x/12);
  const breaker_positions2=model.levels[1]?.breakers.map(x=>x/12)||[];
  const breaker_interval=standard_board_length;
  // Breaker decking and its four-member build-ups are already in the shared
  // board and framing takeoff. These legacy extra-charge fields must stay zero.
  const total_breaker_boards=0,breaker_blocking_lf=0,breaker_screws=0;
  // A breaker beside an angled corner is only as long as the deck is deep at that point.
  const breaker_labor_hrs=customBoardLayout?layoutAutomaticBreakerLf(model)/10*BOARD_LAYOUT_POLICY.fitHoursPer10Lf:model.levels.reduce((n,l)=>n+(l.angledEdges?.length?l.breakers.reduce((d,x)=>d+outlineSpans(l.footprint.outline,x,'x').reduce((s,[a,b])=>s+b-a,0),0)/120*1.5:l.breakers.length*(l.footprint.bounds.h/120)*1.5),0);
  const unit_cost_per_lf=selectedMaterial.costPerSqft*(rateWidthIn/12);
  const framingSize = data.framingSize || '2x10';
  let framingCostPerLf = 4.50;
  if (framingSize === '2x8') framingCostPerLf = 3.50;
  if (framingSize === '2x12') framingCostPerLf = 5.50;

  const framingCost = totalFramingLf * framingCostPerLf;
  const breaker_blocking_cost = breaker_blocking_lf * framingCostPerLf;
  const breaker_board_cost = total_breaker_boards * standard_board_length * unit_cost_per_lf;
  const breaker_screw_cost = breaker_screws * (effectiveFasteningSystem === 'Hidden' && selectedMaterial.isComposite ? 0.85 : 0.28);

  // Foundation (Math Engine Formula)
  let footingType: string = foundation;
  let footingCostPerUnit = 190; // Concrete Piers default
  let flags: string[] = boardStock.unresolved.length ? ['Some board cuts exceed available stock; review the design before quoting.'] : [];
  flags.push('Construction assembly rates, permit fees and unsourced materials remain planning allowances. Published supply benchmarks exclude order-specific delivery and configuration adjustments; confirm the complete scope before a final quote.');
  flags.push(...houseRailingConflicts(data,model).map(c=>c.message));
  if(framingStock.some(row=>row.unresolvedIn.length))flags.push('Framing stock has unresolved oversize members. These lengths remain costed; stock and bearing design need review.');
  if(connectors.some(row=>row.rate===null&&!row.basis.startsWith('Priced by')))flags.push('Estimate excludes separately unpriced connection components. Review the connector schedule and obtain supplier rates before a final quote.');
  flags.push(...((model as DeckTakeoff & {warnings?:string[]}).warnings||[]));
  flags.push(...((model as DeckTakeoff & {issues?:string[]}).issues||[]));
  const orphanedRails=(data.railSections??[]).filter(s=>!model.levels.some(l=>l.kind==='deck'&&l.index===s.level-1&&l.footprint.outline.some((_,i)=>edgeSectionId(l.footprint,i)===s.edgeId)));
  if(orphanedRails.length)flags.push(`${orphanedRails.length} saved rail section${orphanedRails.length===1?'':'s'} no longer match an active deck edge. These settings are retained but inactive and do not alter current installed rails or prices. Restore the edge or choose its current section again.`);
  const inactiveLayoutLevels=[...new Set(layoutRecords.filter(r=>!presentLayoutLevels.has(r.level)).map(r=>r.level))].sort();
  if(inactiveLayoutLevels.length)flags.push(`Custom board-layout edits on absent deck level(s) ${inactiveLayoutLevels.join(', ')} are retained but inactive. They are excluded from current installed quantities and supply totals. Restore the level or remove those edits before construction.`);
  if(hasBoardLayout(data)&&!customBoardLayout&&layoutRecords.some(r=>presentLayoutLevels.has(r.level)))flags.push('Retained custom board-layout edits currently place no boards on the deck footprint. They are inactive and add no material or installation scope. Move them onto the deck or remove them before construction.');

  if (footingType === 'Helical Piles') {
    footingCostPerUnit = 475;
  } else if (footingType === 'Deck Blocks') {
    footingCostPerUnit = 4.50;
    if (height > 23.5) flags.push('Deck Blocks not recommended for height > 24"');
  } else {
    // Concrete Piers
    if (soilCondition === 'Clay' || soilCondition === 'Fill') {
      footingType = 'Concrete Pier 16"';
      footingCostPerUnit = 240;
    }
  }

  if (siteType === 'Waterfront-Lakefront' || siteType === 'Island-Ferry') {
    flags.push('CA Permit Required');
  }
  if (soilCondition === 'Shallow Bedrock') {
    // Handled in professional fees section
  }

  // Post Footings: ceil(Width/8) * ceil(Depth/8)
  const footingCount = quantities.footings;
  const foundationCost = footingCount * footingCostPerUnit;

  // Fasteners
  const screwsPerBoard = 2 * joistCount;
  const totalScrews = Math.ceil(hardware.screws.length * 1.10);
  const screwCost = effectiveFasteningSystem === 'Face' ? totalScrews * 0.28 : 0;
  const hiddenClipCost = effectiveFasteningSystem === 'Hidden' ? area * 0.85 : 0;
  const joistHangerCost = hardware.hangers.length * 4.50; // (Total Joists * 2)
  const ledgerBoltCost = hardware.ledgerBolts.length * 2.80;
  const postAnchorCost = footingCount * 22.00;
  const hardwareTotal = screwCost + hiddenClipCost + joistHangerCost + ledgerBoltCost + postAnchorCost + breaker_screw_cost;

  // Railing (Precise Formulas)
  // NOTE: railing INSTALL labour is covered by the crew-day engine below
  // (railing lf / rate → crew-days) — this section prices materials only.
  let railingMaterialCost = 0;
  let railingPostCount = 0;
  let railingSectionCount = 0;
  let railingHardwareCost = 0;
  let railingFlags: string[] = [];

  // Calculate Railing LF automatically if not provided or as a base
  let calculatedRailingLf = 0;
  if (railingType !== 'None') {
    // 1. Deck Perimeter Railing
    let deckPerimeter = 0;
    if (deckType === 'Attached' || deckType === 'Add-on') {
      deckPerimeter = (2 * length) + width;
    } else {
      deckPerimeter = 2 * (width + length);
    }

    if (levels > 1) {
      if (deckType === 'Attached' || deckType === 'Add-on') {
        deckPerimeter += (2 * length2) + width2;
      } else {
        deckPerimeter += 2 * (width2 + length2);
      }
    }

    // Subtract stair openings from deck perimeter
    const stairOpeningLf = (stairWidth / 12) * stairFlights;
    calculatedRailingLf = Math.max(0, deckPerimeter - stairOpeningLf);

    // 2. Stair Railing
    const stepCount = Math.ceil(height / 7.5);
    const stairRailingPerSide = stepCount * 1.04; // 12.5" hypotenuse per 7.5" rise
    const totalStairRailingLf = quantities.stairRailingLf;
    
    calculatedRailingLf = quantities.railingLf;

    // Use user override if provided and > 0, otherwise use calculated
    const effectiveRailingLf = sectionRailing ? quantities.railingLf : (railingLf && railingLf > 0) ? railingLf : calculatedRailingLf;

    const rCost = railingCosts[railingType] || { material: 60, install: 55, spacing: 6, postCost: 95 };
    const maxSpan = rCost.spacing || 6;
    
    // Section Count: ceil(Total LF / Max Span)
    railingSectionCount = quantities.railingSections;
    
    // Post Count: Total Sections + 1 (+1 for every corner/stair transition)
    let corners = 4;
    if (shape === 'L-Shape') corners = 6;
    if (shape === 'Multi-corner') corners = 8;
    railingPostCount = quantities.railingPosts;

    // Stair Multiplier: 25% increase for stair panels
    const levelRailingLf = Math.max(0, effectiveRailingLf - totalStairRailingLf);
    
    // Frameless glass has no rate: its glass, shoe or spigots and handrail are a supplier quote (below).
    const baseMaterialCost = railingType === 'Frameless Glass' ? 0 : (levelRailingLf * rCost.material) + (totalStairRailingLf * rCost.material * 1.25);

    railingMaterialCost = baseMaterialCost + (railingPostCount * rCost.postCost);

    // Hardware Logic: (Total Sections * 4) for brackets (2 top, 2 bottom)
    // Plus (1) Post Cap and (1) Post Skirt per post
    const bracketCost = (railingSectionCount * 4) * 8.50; // $8.50 per bracket
    const capSkirtCost = railingPostCount * 25; // $25 for cap + skirt
    railingHardwareCost = bracketCost + capSkirtCost;

    // OBC Compliance Flags
    if (height > 24) {
      railingFlags.push('OBC: Deck > 24" (600mm) - 36" high railing required.');
    }
    if (height > 71) {
      railingFlags.push('OBC: Deck > 71" (1800mm) - 42" high railing required.');
    }
    if (railingType === 'Frameless Glass') railingFlags.push(...framelessGlassNotes(model.railing.frameless));
    else railingFlags.push('OBC: Ensure baluster spacing is < 4" (100mm) for non-climbable standards.');
  }

  // Stairs
  const riserCount = quantities.risersPerFlight;
  const stringerCount = stairFlights ? quantities.stringers / stairFlights : 0;
  const treadCostKey = selectedMaterial.isComposite ? 'composite' : (selectedMaterial.id === 'cedar' ? 'cedar' : 'pine');
  const totalRisers=(quantities as typeof quantities & {totalRisers?:number}).totalRisers ?? stairFlights*riserCount;
  // Treads and risers in their own finishes (deckPartFinishes.ts) take the dearest category of the two.
  const stairParts=data.deckFinishes?[partRef(data,'treads'),partRef(data,'risers')]:null;
  const widthAdjustedRisers=model.flights.reduce((n,f)=>n+f.risers*f.width/STAIR_ALLOWANCE_WIDTH_IN*(data.stairTreadDepthIn&&f.kind==='grade'?Math.max(1,Math.ceil((f.run+model.stairSupport.treadNosingIn)/(data.boardWidth+model.gap))/2):1),0);
  const stairMaterialCost = widthAdjustedRisers * (stairTreadCosts[stairParts?stairTreadKey(treadCostKey,stairParts,stairTreadCosts):treadCostKey] || 24);
  const stairLaborBase = widthAdjustedRisers / 10; // Ten 4 ft riser assemblies per crew-day.
  // STAIR_LABOR_MULTIPLIER is a scalar (1.25). Indexing it by stairType returned
  // undefined and NaN-poisoned every downstream total. Winder/Landing stairs get
  // a heavier factor on top of the base multiplier.
  const stairLaborMultiplier = stairType === 'Winder' ? STAIR_LABOR_MULTIPLIER * 1.2
    : stairType === 'Landing' ? STAIR_LABOR_MULTIPLIER * 1.12
    : STAIR_LABOR_MULTIPLIER;

  // Labor Engine — Golden Maple model: ONE fully-loaded crew day rate
  // (CREW_DAY_RATES: $3,700/day all-in, confirmed by the owner 2026-09-23) covers wages, burden, equipment,
  // overhead AND profit. No separate overhead/contingency/profit waterfall.
  const crewDayRate = crewRates[municipality] || 3700;
  
  // Base Crew Days
  let crewDays = 0;
  crewDays += footingCount / 13;
  crewDays += area / 1000;
  
  const deckingRate = selectedMaterial.id === 'pressure_treated' ? 400 : (selectedMaterial.id === 'cedar' ? 360 : 320);
  crewDays += area / deckingRate;
  
  if (railingType !== 'None') {
    const rRate = railingType === 'Wood Picket' ? 60 : (railingType === 'Aluminum' ? 50 : (railingType === 'Cable' ? 15 : 20));
    // Use the effective railing LF (user override or auto-calculated) — the raw
    // railingLf input is 0 when auto-calc is in play, which zeroed railing labour.
    const labourRailingLf = sectionRailing ? quantities.railingLf : (railingLf && railingLf > 0) ? railingLf : calculatedRailingLf;
    crewDays += (labourRailingLf * 1.10) / rRate;
  }
  
  crewDays += perimeter / 100; // Fascia
  
  // Multipliers
  let complexityMult = 1.0;
  if (!data.deckOutlines?.main && shape === 'L-Shape') complexityMult *= 1.10;
  if (!data.deckOutlines?.main && shape === 'Multi-corner') complexityMult *= 1.25;
  if (!data.deckOutlines?.main && shape === 'Curved') complexityMult *= 1.50;
  complexityMult *= wrapLabourFactor(wrap);
  complexityMult *= chamferLabourFactor(chamfers);
  complexityMult *= customLabourFactor(custom);
  complexityMult *= freeOutlineLabourFactor(data);
  
  complexityMult *= PATTERN_LABOUR[pattern] ?? 1; // Diagonal ×1.20, Picture Frame ×1.25, Herringbone ×1.30
  
  if (levels === 2) complexityMult *= 1.35;
  if (levels === 3) complexityMult *= 1.60;
  
  if (height > 48 && height <= 96) complexityMult *= 1.20;
  if (height > 96) complexityMult *= 1.30;
  
  if (siteType === 'Waterfront-Lakefront') complexityMult *= 1.10;
  if (siteType === 'Hillside') complexityMult *= 1.25;
  if (siteType === 'Urban Tight') complexityMult *= 1.35;
  if (siteType === 'Island-Ferry') complexityMult *= 1.75;
  
  if (buildSeason === 'Fall') complexityMult *= 1.15;
  if (buildSeason === 'Winter') complexityMult *= 1.40;
  
  if (railingType === 'Cable') complexityMult *= 1.30;
  // Frameless glass installs on the Glass Panels basis (owner decision 2026-09-25): 20 LF per crew-day above, and ×1.40.
  if (railingType === 'Glass Panels' || railingType === 'Frameless Glass') complexityMult *= 1.40;

  const breaker_crew_days = breaker_labor_hrs / 8;
  // Inlays: fitted edges at the breaker rate, and the inside's pattern factor on its share (lib/inlayGeometry.ts).
  const inlayDays = inlayCrewDays(model.levels.flatMap(l => l.inlays ?? []), pattern, deckingRate);
  const layoutAllowance=customBoardLayout?boardLayoutAllowance(data,model,deckingRate):null;
  const totalCrewDays = (crewDays + stairLaborBase * stairLaborMultiplier + breaker_crew_days + inlayDays.total + (layoutAllowance?.crewDays??0)) * complexityMult;
  const manHours = totalCrewDays * 27; // 3-person crew × 9-hour days (GM standard)
  const calculatedLaborCost = totalCrewDays * crewDayRate;
  const finalLaborCost = customLaborCost !== undefined ? customLaborCost : calculatedLaborCost;

  // Apply material markup — GM doctrine default 35% (25% large orders / 50%+
  // specialty). Materials are carried at Carr TRADE cost in MATERIAL_TIERS;
  // this is where contractor margin on materials lives.
  const markupMult = (1 + ((materialMarkup ?? 35) / 100));
  // Each accent colour at its own collection's rate (null when the collection needs a supplier quote), with the
  // deck's waste allowance, using the same $/sq ft → $/lin-ft conversion as the main decking.
  const collectionRate=(id:string):number|null=>{const c=DECKING_CATALOGUE.find(m=>m.id===id);if(!c||c.costPerSqft===null)return null;return (materials.find((m:any)=>m.id===id)?.costPerSqft as number|undefined)??c.costPerSqft;};
  // Inlay boards use the waste allowance of what they are: a frame is picture-frame work, a fill its own pattern.
  // The border in its own colour (deckFinishes.border) is priced the same way, in the Deck-part finishes section.
  const groupRow=(g:StockGroup)=>{
    const keys=new Set(g.boards.map(b=>`${b.level}:${b.index}`)),stock=boardsWhere((li,bi)=>keys.has(`${li}:${bi}`),g.wasteKey?wasteFactors[g.wasteKey]||wasteFactor:wasteFactor,productStock(data,g.material.id)),rate=collectionRate(g.material.id);
    const part=()=>g.part==='band'?'Inlay band':g.part==='medallion'?'Medallion inlay':g.part==='frame'?'Inlay frame':`Inlay inside, ${g.wasteKey!.toLowerCase()}`;
    const label=g.kind==='inlay'?`${part()} · ${g.material.name} · ${g.color.name}`:g.kind==='border'?`Border · ${g.material.name} · ${g.color.name}`:`${g.material.name} · ${g.color.name}`;
    return {group:g,stock,label,cost:rate===null?null:stock.orderedLf*rate*((customBoardLayout?BOARD_LAYOUT_POLICY.stockWidthIn:deckingRateWidth(g.material.id,boardWidthIn))/12)*markupMult};
  };
  const accentRows=(separate?.stock??[]).filter(g=>g.kind!=='border'&&g.kind!=='layout').map(groupRow),borderRows=(separate?.stock??[]).filter(g=>g.kind==='border').map(groupRow),layoutRows=(separate?.stock??[]).filter(g=>g.kind==='layout').map(groupRow);
  const m_deckingCost = deckingCost * markupMult;
  const m_framingCost = framingCost * markupMult;
  const m_foundationCost = foundationCost * markupMult;
  const m_hardwareTotal = hardwareTotal * markupMult;
  const m_railingMaterialCost = railingMaterialCost * markupMult;
  const m_stairMaterialCost = stairMaterialCost * markupMult;
  const m_screwCost = screwCost * markupMult;
  const m_hiddenClipCost = hiddenClipCost * markupMult;
  const m_joistHangerCost = joistHangerCost * markupMult;
  const m_postAnchorCost = postAnchorCost * markupMult;
  const m_breaker_board_cost = breaker_board_cost * markupMult;
  const m_breaker_blocking_cost = breaker_blocking_cost * markupMult;

  const settingsEngineeringFee = settings?.engineeringFee || 1500;

  // Permits
  let permitFee = 0;
  if (deckType === 'Attached' || area > 108 || height > 24 || pergolaSqft > 0 || !!data.pergola) {
    permitFee = permitFees[municipality] || 200;
  }
  const caFee = (siteType === 'Waterfront-Lakefront' || siteType === 'Island-Ferry') ? 560 : 0;
  let engineeringFee = 0;
  if (intendedLoad === 'Heavy' || levels >= 3 || pergolaSqft > 0 || !!data.pergola || soilCondition === 'Shallow Bedrock') {
    engineeringFee = settingsEngineeringFee;
    flags.push('Engineering Required');
  }

  let permitDesc = '';
  switch (municipality) {
    case 'Toronto': permitDesc = 'Apply via toronto.ca/building or call 311 / 416-392-2489.'; break;
    case 'Barrie': permitDesc = 'Apply via barrie.ca/building or call 705-739-4212.'; break;
    case 'Simcoe County': permitDesc = 'Apply via simcoe.ca or check local township. Call 705-726-9300.'; break;
    case 'Burlington-Oakville': permitDesc = 'Apply via burlington.ca/building (905-335-7731) or oakville.ca/building (905-845-6601).'; break;
    default: permitDesc = 'Please check your local municipal website for building permit requirements.';
  }

  // Add-ons
  const lSys = lightingSystem || { selectedItems: [], wireDistance: 0 };
  // Retain exact-edge requests for restore, but bill only screens with an actual complete placement.
  const explicitScreens=data.privacyScreens?.some(s=>s.edgeId!==undefined),screenLayout=explicitScreens?extrasLayout(data,model):undefined;
  const activeScreenIds=new Set(screenLayout?.screenHandles.map(s=>s.id));
  const activeScreens=explicitScreens?(data.privacyScreens??[]).filter(s=>s.edgeId===undefined||activeScreenIds.has(s.id)):data.privacyScreens??[];
  const screenFace=explicitScreens?pricedPrivacyArea(activeScreens):privacySqft;
  if(screenLayout)flags.push(...screenLayout.warnings.filter(w=>w.startsWith('Privacy screen')&&w.includes('inactive')));
  const lightingData=screenLayout?{...data,lightingSystem:{...lSys,selectedItems:syncAutoLighting(data,{posts:model.railing.posts.length,stairs:model.treads.length,privacy:screenLayout.privacyMounts.length,border:borderLightingPlan(data,model).availableMounts.length}).filter(i=>i.zone!=='privacy'||screenLayout.privacyMounts.length>0)}}:data;
  const lightingCheck=lightingSystemCheck(lightingData,model),selectedLightingItems=lightingCheck.items;
  flags.push(...lightingCheck.warnings,...pictureFrameCompatibility(data));
  // Decking supply benchmarks exclude delivery: listed for a supplier quote, never priced or silently dropped.
  quoteRequired.push(DECKING_DELIVERY_QUOTE);
  quoteRequired.push(...selectedLightingItems.filter(p=>p.cost===null||p.laborCost===null).map(p=>p.cost!==null?`${p.name} installation (builder quote)`:p.laborCost!==null?`${p.name} supply (supplier quote)`:`${p.name} supply and installation`));
  if(selectedLightingItems.some(p=>p.rateSource))flags.push('Lighting supply uses the Islington Nurseries 2026 published trade price list (CAD). Confirm availability and delivery before ordering; installation is quoted separately where no labour rate exists.');
  // The per-foot note came with the 2026-10 listed-stock purchasing; saves from before it keep 9b2ee11's flag word for word.
  if(deckingMaterial in DECKING_RATE_SOURCES)flags.push(`Selected decking uses a current DeckMart retail purchasing benchmark rather than the archived Carr trade rate. The listed total is an estimate${usesCurrentBuildRules(data)?' priced per foot from its 12 ft board, also for longer stock':''}; confirm the selected colour, profile, stock lengths and delivery before quoting.`);
  // Manufacturer privacy screens have no price-book rate: listed for a supplier quote, never priced at zero.
  const quotedScreens=quotedPrivacyScreens(activeScreens);
  quoteRequired.push(...quotedScreens.map(name=>`${name} supply and installation`));

  const lightingWireLf=selectedLightingItems.length&&!selectedLightingItems.some(p=>p.geometry==='cable')?Math.max(0,lSys.wireDistance||0):0;
  const totalLightingMaterial = selectedLightingItems.reduce((sum, item) => sum + (item.cost || 0) * item.qty, 0)+lightingWireLf*LIGHTING_COSTS.wirePerFt;
  const totalLightingLabor = selectedLightingItems.reduce((sum, item) => sum + (item.laborCost || 0) * item.qty, 0);

  const totalLightingCost = (totalLightingMaterial * markupMult) + totalLightingLabor;

  const addOnCosts = {
    lighting: totalLightingCost,
    bench: benchLf * 155 * markupMult,
    privacy: screenFace * 70 * markupMult,
    demo: hasDemo ? area * 14 * markupMult : 0,
    pergola: data.pergola ? 0 : pergolaSqft * 65 * markupMult,
    // Add-on module specific
    structuralTieIn: deckType === 'Add-on' ? (data.addOnHardwareCost || 450) * markupMult : 0,
    ledgerFlashing: deckType === 'Add-on' ? (data.addOnFlashingLf || flashingLf) * 12 * markupMult : 0,
    transitionLabor: deckType === 'Add-on' ? (data.addOnTransitionLabor || 850) : 0,
  };

  if (breaker_rows > 5) flags.push('Unusually high number of breaker rows detected. Verify deck depth input — consider using longer board lengths if available from supplier.');

  // Build Sections
  const sections: EstimateResult['sections'] = [
    {
      title: 'Permits & Professional Fees',
      icon: '📋',
      description: `${permitDesc} (Prices last verified: Feb 2026)`,
      total: permitFee + caFee + engineeringFee,
      items: [
        { name: 'Building Permit', spec: municipality, qty: 1, unit: 'ea', cost: permitFee },
        { name: 'CA Permit', spec: 'Conservation Authority', qty: caFee > 0 ? 1 : 0, unit: 'ea', cost: caFee },
        { name: 'Engineering Review', spec: 'Structural Stamp', qty: engineeringFee > 0 ? 1 : 0, unit: 'ea', cost: engineeringFee },
      ]
    },
    {
      title: 'Foundation & Footings',
      icon: '🏗',
      description: 'Includes excavation, materials, and installation of the selected foundation system.',
      total: m_foundationCost,
      items: [
        { name: footingType, spec: soilCondition, qty: footingCount, unit: 'ea', cost: m_foundationCost },
      ]
    },
    {
      title: `Structural Framing (${framingSize} Joists)`,
      icon: '🔧',
      description: `Pressure-treated pine ${framingSize} joists and beams/ledger boards. Installation labour is in the Labour section.`,
      total: m_framingCost - m_breaker_blocking_cost,
      items: [
        { name: 'Joists & Beams', spec: `${framingSize}; stock cuts and offcuts included at the existing framing LF allowance`, qty: Math.ceil(totalFramingLf - breaker_blocking_lf), unit: 'lf', cost: m_framingCost - m_breaker_blocking_cost },
      ]
    },
    {
      title: 'Decking',
      icon: '🪵',
      description: 'Ordered stock from the modeled field, border and breaker cuts, including the existing waste allowance.',
      total: m_deckingCost + m_breaker_board_cost + m_breaker_blocking_cost,
      items: [
        { name: selectedMaterial.name, spec: `${pattern}${customBoardLayout?' with custom board layout':''}; ${pricedBoardStock.bins.reduce((n,b)=>n+b.cutsIn.length,0)} ${customBoardLayout?'stock cuts':'installed pieces'}, ${pricedBoardStock.spareBoards} spare stock boards${separateBorder?'; contrast border priced separately':''}${separate?`; ${[accent?'accent-colour':'',finish!.inlayPieces?'inlay':'',finish!.borderPieces?'border':'',layoutRows.length?'custom-layout':''].filter(Boolean).join(' and ')} boards priced separately`:''}`, qty: finalBoards, unit: 'boards', cost: m_deckingCost },
        { name: DECKING_DELIVERY_QUOTE, spec: 'Supplier quote required: delivery of the ordered decking stock is not in the supply rate.', qty: 1, unit: 'allowance', cost: null },
        ...(false ? [
          { name: `Breaker Board Rows (${breaker_rows} rows)`, spec: `${total_breaker_boards} boards × ${standard_board_length}ft — perpendicular to field, full deck width`, qty: total_breaker_boards, unit: 'boards', cost: m_breaker_board_cost },
          { name: `Breaker Row Blocking (PT 2×10)`, spec: `${breaker_rows} rows × joist bay blocking @ ${(joistSpacing / 12 - 0.1).toFixed(1)}ft each`, qty: Math.ceil(breaker_blocking_lf / 8), unit: 'pcs', cost: m_breaker_blocking_cost }
        ] : []),
      ]
    },
    {
      title: 'Hardware & Fasteners',
      icon: '🔩',
      description: 'Screws, hidden clips, joist hangers, and post anchors.',
      total: m_hardwareTotal,
      items: [
        { name: effectiveFasteningSystem === 'Face' ? 'Deck Screws' : 'Hidden Clips', spec: effectiveFasteningSystem === 'Face'?'Corrosion resistant; model plus 10%':'Existing area allowance; modeled clip count is shown separately', qty: effectiveFasteningSystem === 'Face' ? totalScrews : Math.ceil(area), unit: effectiveFasteningSystem === 'Face' ? 'pcs' : 'sqft', cost: m_screwCost + m_hiddenClipCost },
        { name: 'Ledger Bolts', spec: 'Modeled ledger positions', qty: hardware.ledgerBolts.length, unit: 'ea', cost: ledgerBoltCost * markupMult },
        { name: 'Joist Hangers', spec: 'LUS26/28', qty: joistHangerCost / 4.5, unit: 'ea', cost: m_joistHangerCost },
        { name: 'Post Anchors', spec: 'ABU44/66', qty: footingCount, unit: 'ea', cost: m_postAnchorCost },
      ]
    },
    {
      title: 'Railing System',
      icon: '🚧',
      description: 'Guardrails and handrails required by code or selected for aesthetics.',
      total: m_railingMaterialCost + (railingHardwareCost * markupMult),
      items: railingType === 'Frameless Glass' ? framelessGlassItems(model.railing.frameless) : [
        { name: railingType, spec: `Kits (${railingSectionCount} × ${railingCosts[railingType]?.spacing || 6}ft)`, qty: railingSectionCount, unit: 'kits', cost: m_railingMaterialCost - (railingPostCount * (railingCosts[railingType]?.postCost || 0) * markupMult) },
        { name: 'Railing Posts', spec: 'W/ Caps & Skirts', qty: railingPostCount, unit: 'ea', cost: railingPostCount * (railingCosts[railingType]?.postCost || 0) * markupMult },
        { name: 'Railing Hardware', spec: 'Brackets (4/section) & Caps', qty: railingSectionCount * 4, unit: 'ea', cost: railingHardwareCost * markupMult },
      ].filter(item => railingType !== 'None')
    },
    {
      title: 'Stairs',
      icon: '🪜',
      description: 'Stair treads, risers, and stringer materials. Build labour is in the Labour section.',
      total: m_stairMaterialCost,
      items: totalRisers > 0 ? [
        { name: 'Stair Treads & Stringers', spec: `${quantities.stringers} stringers at maximum ${model.stairSupport.spacingIn} in centres; ${quantities.stairTreads} treads; ${quantities.riserBoardPieces} closed riser pieces. Assembly allowance scales each flight to a ${STAIR_ALLOWANCE_WIDTH_IN}-inch width basis and includes these materials; no duplicate riser charge.${stairParts?.some(Boolean)?` ${stairParts.map((r,i)=>r?`${i?'Risers':'Treads'} in ${colourName(r)}.`:'').filter(Boolean).join(' ')}`:''}`, qty: totalRisers, unit: 'risers', cost: m_stairMaterialCost },
      ] : []
    },
    {
      title: 'Labour (Construction & Build)',
      icon: '👷',
      description: 'Full installation labour — excavation, footings, framing, decking, railing, and stairs — by a dedicated 3-person crew. Fully editable.',
      total: finalLaborCost,
      items: [
        {
          name: 'Installation Labour',
          spec: `${totalCrewDays.toFixed(1)} crew-days × $${crewDayRate.toLocaleString()}/day${inlayDays.total > 0 ? `; includes ${(inlayDays.total * complexityMult).toFixed(1)} crew-days for inlays (fitted edges at the breaker-board rate, the inside at its pattern's labour factor)` : ''}${layoutAllowance?`; custom layout direction adjustment ${(layoutAllowance.directionDays*complexityMult).toFixed(2)} crew-days, cutting/fitting allowance ${(layoutAllowance.fittingDays*complexityMult).toFixed(2)} crew-days (existing 1.5 crew-hours/10 LF fitting basis); structural scope quoted separately`:''}`,
          qty: Math.round(totalCrewDays * 10) / 10,
          unit: 'days',
          cost: finalLaborCost,
          unitPrice: crewDayRate,
          laborCost: finalLaborCost
        },
      ]
    },
    {
      title: 'in-lite® Lighting System',
      icon: '💡',
      quoteRequired: selectedLightingItems.some(p=>p.cost===null||p.laborCost===null),
      description: 'Included installation zones. Preview illumination does not change quantities. Unknown supply/installation prices are excluded; review electrical compatibility notes.',
      total: totalLightingCost,
      items: [...selectedLightingItems.flatMap(item => item.cost!==null&&item.laborCost===null?[
        {name:`${item.name} supply`,spec:`2026 published trade supply benchmark, CAD · ${item.zone==='border'?'picture-frame edge':item.zone}; confirm availability and delivery`,qty:item.qty,unit:'ea',cost:item.cost*markupMult*item.qty,unitPrice:item.cost*markupMult},
        {name:`${item.name} installation (builder quote)`,spec:`${item.zone==='border'?'Picture-frame edge':item.zone}: builder quote required; no installation rate for this product in the price book. Supply is included in the priced portion.`,qty:item.qty,unit:'ea',cost:null},
      ]:item.cost===null&&item.laborCost!==null?[
        {name:`${item.name} supply`,spec:'Supplier quote required. Installation is included in the priced portion.',qty:item.qty,unit:'ea',cost:null},
        {name:`${item.name} installation`,spec:'Existing installation allowance',qty:item.qty,unit:'ea',cost:item.laborCost*item.qty},
      ]:[{
        name: item.name,
        spec: `${item.category}${['transformer','cable','accessory'].includes(item.geometry)?'':` · ${item.zone}`}`,
        qty: item.qty,
        unit: 'ea',
        cost: item.cost===null||item.laborCost===null?null:(item.cost * markupMult + item.laborCost) * item.qty,
        unitPrice: item.cost===null?undefined:item.cost * markupMult,
        laborCost: item.laborCost??undefined
      }]),...(lightingWireLf?[{name:'Low-voltage cable',spec:'Existing Deck Craft Pro wire-per-foot rate',qty:lightingWireLf,unit:'lf',cost:lightingWireLf*LIGHTING_COSTS.wirePerFt*markupMult}]:[])]
    },
    {
      title: 'Add-ons & Extras',
      icon: '✨',
      description: 'Optional features to enhance your outdoor living space.',
      total: Object.values(addOnCosts).reduce((a, b) => a + b, 0) - addOnCosts.lighting,
      items: [
        { name: 'Built-in Bench', spec: 'Matching Decking', qty: benchLf, unit: 'lf', cost: addOnCosts.bench },
        { name: 'Privacy Screen', spec: 'Louvered/Slatted', qty: screenFace, unit: 'sqft', cost: addOnCosts.privacy },
        ...quotedScreens.map(name => ({ name: 'Manufacturer privacy screen', spec: name, qty: 1, unit: 'screen', cost: null })),
        { name: 'Demo & Removal', spec: 'Existing Deck', qty: hasDemo ? area : 0, unit: 'sqft', cost: addOnCosts.demo },
        { name: 'Pergola', spec: 'Wood/Aluminum', qty: data.pergola ? 0 : pergolaSqft, unit: 'sqft', cost: addOnCosts.pergola },
        { name: 'Structural Tie-in', spec: 'Hardware to Existing', qty: deckType === 'Add-on' ? 1 : 0, unit: 'ls', cost: addOnCosts.structuralTieIn },
        { name: 'Ledger Flashing', spec: 'Connection Width', qty: deckType === 'Add-on' ? (data.addOnFlashingLf || flashingLf) : 0, unit: 'lf', cost: addOnCosts.ledgerFlashing },
        { name: 'Transition Labor', spec: 'Leveling & Siding Prep', qty: deckType === 'Add-on' ? 1 : 0, unit: 'ls', cost: addOnCosts.transitionLabor },
      ].filter(item => item.qty > 0)
    },
  ];

  const underDeck=buildUnderDeckPricing(data,model,markupMult,crewDayRate);
  if(missingStairPath)sections.push({title:'Unresolved stair path',icon:'🪜',quoteRequired:true,total:0,items:[{name:stairPathQuote,spec:'Saved stair path is not buildable; redraw it or resolve its landing, perimeter and clearance issues. No supply or installation amount is included.',qty:1,unit:'layout',cost:null}]});
  const physicalSections=physicalFoundationSections(data,model);sections.push(...physicalSections);quoteRequired.push(...physicalSections.flatMap(s=>s.items.map(i=>i.name)));
  sections.push(...underDeck.sections);quoteRequired.push(...underDeck.quoteRequired);flags.push(...underDeck.flags);
  // Apply custom overrides
  if (data.customOverrides) {
    sections.forEach(section => {
      section.items.forEach(item => {
        const override = data.customOverrides![item.name];
        if (override) {
          if (override.qty !== undefined) item.qty = override.qty;
          if (override.cost !== undefined) item.cost = override.cost;
        }
      });
      // Recalculate section total
      section.total = (section.items as any[]).reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
    });
  }

  // New catalogue products have nullable supplier rates, never borrowed prices.
  if(rateWidthIn!==boardWidthIn){
    quoteRequired.push('Custom-width decking fabrication');
    flags.push(`The sourced decking benchmark buys ${rateWidthIn} in stock boards. Drawing ${boardWidthIn} in boards does not reduce the purchased price per linear foot; ripping, profile, fasteners and added installation require a builder quote.`);
  }
  // Keep their quantities in the schedule while excluding them from the priced portion.
  const requireSection=(title:string,label:string)=>{const section=sections.find(s=>s.title===title);if(!section||!section.items.some(i=>Number(i.qty)>0))return;section.quoteRequired=true;section.total=0;section.items.forEach(i=>{i.cost=null;delete i.unitPrice;});quoteRequired.push(label);};
  if(catalogueMaterial?.costPerSqft===null){
    requireSection('Decking',catalogueMaterial.name);
    requireSection('Stairs',`Tread materials for ${catalogueMaterial.name}`);
    const extras=sections.find(s=>s.title==='Add-ons & Extras');if(extras){for(const item of extras.items)if(['Built-in Bench','Privacy Screen','Pergola'].includes(item.name)){item.cost=null;extras.quoteRequired=true;quoteRequired.push(`${item.name} with selected finish`);}extras.total=extras.items.reduce((n,i)=>n+(i.cost??0),0);}
    flags.push('Selected decking and matching finish materials require supplier prices. The displayed amount covers priced work only; installation allowances require product and profile confirmation.');
  }
  const catalogueRail=RAILING_CATALOGUE.find(r=>r.id===data.catalogueRailingId);
  if(catalogueRail){requireSection('Railing System',catalogueRail.name);flags.push(catalogueRail.notes);}
  if(railingType==='Frameless Glass')requireSection('Railing System',`${glassRailingName(data)} (supplier quote)`);
  // A railing colour (deckPartFinishes.ts) leaves the rate as it is; the supplier confirms availability and any premium.
  const railColour=railingFinish(data);
  if(railColour)flags.push(`Railing colour ${railColour.colour} (${railColour.system.name}): the railing rate is unchanged${railColour.unconfirmed?'. This line is not confirmed as sold in Canada':''}; confirm availability and any colour premium with the supplier.`);
  if(separateBorder){const lf=model.levels.reduce((n,l,li)=>n+l.boards.reduce((s,b,bi)=>s+(darkBoard(li,bi,b.role)?b.length/12:0),0),0);quoteRequired.push('Deckorators Dark Slate picture-frame boards');sections.push({title:'Picture-frame border finish',icon:'🪵',quoteRequired:true,total:0,items:[{name:'Deckorators Dark Slate',spec:'Dedicated border product; installed cuts are in the stock schedule. Supplier board lengths, order allowance and pricing require confirmation.',qty:Math.ceil(lf*10)/10,unit:'lf',cost:null}]});}
  if(customBoardLayout){
    const unpriced=layoutRows.filter(r=>r.cost===null);
    if(layoutRows.length)sections.push({title:'Custom board-layout stock',icon:'🎨',description:'Real catalogue colours ordered separately as full-width stock, including requested piece rectangles, actual stock joints and the cut/waste allowance.',quoteRequired:unpriced.length>0||undefined,total:layoutRows.reduce((n,r)=>n+(r.cost??0),0),items:layoutRows.map(r=>({name:r.label,spec:`${r.group.boards.length} installed polygon(s), ${r.stock.spareBoards} spare full-width stock boards; fitting allowance is in Labour${r.cost===null?'; supplier quote required':''}`,qty:r.stock.orderedBoards,unit:'boards',cost:r.cost}))});
    quoteRequired.push(...unpriced.map(r=>`${r.label} custom-layout boards`),BOARD_LAYOUT_SUPPORT_QUOTE);
    sections.push({title:'Custom board-layout construction review',icon:'🔩',quoteRequired:true,total:0,items:[{name:BOARD_LAYOUT_SUPPORT_QUOTE,spec:'Builder quote required for altered board support, end bearing, blocking, fastener/profile compatibility and any structural changes. Decking supply and the stated direction/cutting allowance are included; custom supporting assemblies are not represented by the legacy framing model.',qty:1,unit:'scope',cost:null}]});
    flags.push('Custom board-layout labour uses planning allowances on the existing crew-day basis. Full-width purchased boards are charged for narrow rips; no rip-waste discount is assumed. Confirm support, fastening, mixed-product compatibility and the final installed scope with the builder.');
  }
  if(accentRows.length){
    // Accent boards: real product colours ordered as their own boards; a collection without a rate is a supplier quote.
    const unpriced=accentRows.filter(r=>r.cost===null);
    quoteRequired.push(...unpriced.map(r=>`${r.label} ${r.group.kind==='accent'?'accent boards':'boards'}`));
    const inlaid=accentRows.some(r=>r.group.kind==='inlay');
    sections.push({title:inlaid?'Accent colours & inlays':'Accent-colour boards',icon:'🎨',description:inlaid?`Accent-colour and inlay boards, each colour ordered as its own stock boards at its collection’s rate. ${[accentRows.some(r=>r.group.part==='frame'||r.group.part==='inside')&&'Inlay frames carry the picture-frame waste allowance and inlay insides their own pattern’s.',accentRows.some(r=>r.group.part==='band')&&'Bands carry the straight-board allowance.',accentRows.some(r=>r.group.part==='medallion')&&'Medallions carry the herringbone allowance, for their angled cuts.'].filter(Boolean).join(' ')} Colours vary by screen; confirm with samples.`:'Boards in a second colour, ordered as their own stock boards at their collection’s rate with the same waste allowance. Colours vary by screen; confirm with samples.',quoteRequired:unpriced.length>0||undefined,total:accentRows.reduce((n,r)=>n+(r.cost??0),0),
      items:accentRows.map(r=>({name:r.label,spec:`${r.group.boards.length} ${r.group.kind==='inlay'?'inlay':'accent-colour'} pieces, ${r.stock.spareBoards} spare stock boards${r.cost===null?'; supplier quote required':''}`,qty:r.stock.orderedBoards,unit:'boards',cost:r.cost}))});
    // Fitting a second colour has no labour rate in the price book yet: listed for a builder quote, never $0.
    const labour=sections.find(s=>s.title==='Labour (Construction & Build)');
    if(accent&&labour){labour.quoteRequired=true;labour.items.push({name:'Accent-colour board labour',spec:`Builder quote required: laying out and fitting ${accent!.pieces} accent-colour board${accent!.pieces===1?'':'s'} has no rate in the price book yet. The priced labour covers the deck as one colour.`,qty:accent!.pieces,unit:'boards',cost:null});}
    if(accent)quoteRequired.push('Accent-colour board labour (builder quote)');
    if(accentRows.some(r=>r.group.material.id.split('_')[0]!==deckingMaterial.split('_')[0]))flags.push('Accent boards from a different manufacturer than the decking: confirm the board gap, hidden fasteners and warranty with the supplier before ordering.');
  }
  // Medallions: their boards and solid blocking are priced; cutting and fitting one has no labour rate in the price
  // book yet, so it is listed for a builder quote, never $0.
  const quotedInlays=model.levels.flatMap(l=>(l.inlays??[]).filter(p=>p.status==='ok'&&p.quote));
  const medallions=quotedInlays.filter(p=>p.kind==='medallion');
  if(medallions.length){
    const labour=sections.find(s=>s.title==='Labour (Construction & Build)'),n=medallions.length;
    if(labour){labour.quoteRequired=true;labour.items.push({name:'Medallion inlay labour',spec:`Builder quote required: laying out, cutting and fitting ${n===1?'a medallion inlay':`${n} medallion inlays`} (${medallions.reduce((a,p)=>a+p.fillSqft,0).toFixed(1)} sq ft inside the frame${n===1?'':'s'}) has no rate in the price book yet. The priced labour covers the deck without ${n===1?'it':'them'}; the boards and blocking are priced.`,qty:n,unit:n===1?'medallion':'medallions',cost:null});}
    quoteRequired.push('Medallion inlay labour (builder quote)');
  }
  const customInlays=quotedInlays.filter(p=>p.kind!=='medallion');
  if(customInlays.length){
    const labour=sections.find(s=>s.title==='Labour (Construction & Build)'),n=customInlays.length;
    if(labour){labour.quoteRequired=true;labour.items.push({name:'Custom inlay fabrication labour',spec:`Builder quote required: laying out, cutting, fitting and supporting ${n} custom or rotated inlay${n===1?'':'s'} (${customInlays.reduce((a,p)=>a+p.fillSqft,0).toFixed(1)} sq ft inside the frame) has no documented installation rate. The priced portion includes the deck boards and modelled blocking; decorative fabrication and its site review remain outstanding.`,qty:n,unit:n===1?'inlay':'inlays',cost:null});}
    quoteRequired.push('Custom inlay fabrication labour (builder quote)');
  }
  if(finish?.unmatched.length){const n=finish.unmatched.length;flags.push(`${n} accent-colour choice${n===1?' no longer lines':'s no longer line'} up with a board after a design change (or no longer suit${n===1?'s':''} this decking), so ${n===1?'it is':'they are'} not shown or priced. Review them in the accent boards panel.`);}
  const catalogueAccessories=catalogueAccessoryLayout(data,model);
  if(catalogueAccessories.rows.length){
    const rows=catalogueAccessories.rows.filter(r=>r.qty>0);
    sections.push({title:'Manufacturer deck accessories',icon:'🔩',quoteRequired:true,total:0,items:rows.map(r=>({name:r.name,spec:r.spec,qty:r.qty,unit:r.unit,cost:null}))});
    quoteRequired.push(...rows.map(r=>r.name));
    if(data.catalogueAccessories?.some(id=>id==='tt_concealoc'||id==='dk_stealthlock')){const section=sections.find(s=>s.title==='Hardware & Fasteners');if(section){for(const item of section.items)if(item.name==='Hidden Clips'||item.name==='Deck Screws')item.cost=null;section.quoteRequired=true;section.total=section.items.reduce((n,i)=>n+(i.cost??0),0);}}
    if(data.catalogueAccessories?.includes('tt_protac_flashing')){const section=sections.find(s=>s.title==='Add-ons & Extras');if(section){for(const item of section.items)if(item.name==='Ledger Flashing')item.cost=null;section.total=section.items.reduce((n,i)=>n+(i.cost??0),0);}}
  }
  if(catalogueMaterial?.availabilityNote)flags.push(catalogueMaterial.availabilityNote);
  // Deck-part finishes (deckPartFinishes.ts): the border in its own colour, ordered as its own boards at its collection's
  // rate; fascia boards over the exposed rim, a supplier quote (no fascia rate in the price book; fitting is in the
  // labour); and treads or risers from a line without a rate make the stairs a supplier quote. Never $0.
  if(data.deckFinishes){
    const fascia=partRef(data,'fascia'),fasciaLf=fascia&&!data.catalogueAccessories?.some(id=>id==='tt_fascia'||id==='dk_fascia')?exposedRim(data,model).reduce((n,r)=>n+Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z)/12,0):0;
    const items:EstimateResult['sections'][number]['items']=borderRows.map(r=>({name:r.label,spec:`${r.group.boards.length} border pieces, ${r.stock.spareBoards} spare stock boards${r.cost===null?'; supplier quote required':''}`,qty:r.stock.orderedBoards,unit:'boards',cost:r.cost}));
    if(fascia&&fasciaLf>0){
      const supply=fasciaSupply(fascia,exposedRim(data,model).map(r=>({lengthIn:Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),heightIn:10})),markupMult);
      items.push({name:`Fascia · ${colourName(fascia)}`,spec:supply?`DeckMart retail supply benchmark: ${supply.boards} × 12 ft fascia boards with 10% order allowance; fitting is in priced labour. Builder confirms joints; fascia fasteners and delivery need a quote.`:'Over the rim the house does not cover. Supplier quote required for this fascia; fitting is in the labour.',qty:supply?supply.boards:Math.ceil(fasciaLf*10)/10,unit:supply?'boards':'lf',cost:supply?supply.cost:null});
      if(supply){items.push({name:'Fascia fasteners and delivery (supplier quote)',spec:'Supplier quote required: colour-matched fastener packs and delivery are not included in the fascia supply benchmark.',qty:1,unit:'allowance',cost:null});quoteRequired.push('Fascia fasteners and delivery (supplier quote)');}
    }
    if(items.length){
      sections.push({title:'Deck-part finishes',icon:'🎨',description:'Deck parts in their own real product colour. Colours vary by screen; confirm with samples.',quoteRequired:items.some(i=>i.cost===null)||undefined,total:items.reduce((n,i)=>n+(i.cost??0),0),items});
      quoteRequired.push(...borderRows.filter(r=>r.cost===null).map(r=>`${r.label} boards`),...(fasciaLf>0&&items.some(i=>i.name.startsWith('Fascia ·')&&i.cost===null)?['Fascia boards (supplier quote)']:[]));
    }
    const quoted=stairParts?.map(r=>r&&parseColourRef(r)!.material).find(m=>m&&m.costPerSqft===null);
    if(quoted)requireSection('Stairs',`Stair treads and risers in ${quoted.name}`);
    const brand=(id:string)=>id.split('_')[0],mixed=DECK_PARTS.some(p=>{const r=partRef(data,p);return !!r&&brand(parseColourRef(r)!.material.id)!==brand(deckingMaterial);});
    if(mixed)flags.push('Deck parts from another manufacturer than the decking: confirm fastener compatibility with the supplier.');
  }
  if(veneer.applicable){
    if(veneer.status==='modeled-straight')flags=flags.filter(s=>!s.includes('displayed stringers and closed risers do not provide that complete assembly'));
    flags.push(...veneer.issues);
    const rows=veneer.rows.filter(r=>r.id!=='terrain-veneer-wood');
    if(rows.length){quoteRequired.push(...rows.map(r=>r.name));sections.push({title:'Terrain stair support connections',icon:'🔩',quoteRequired:true,total:0,items:rows.map(r=>({name:r.name,spec:r.basis,qty:r.qty,unit:r.unit,cost:null}))});}
  }
  // Porch wraps fold into wrapLabourFactor (×0.15 on top of the one-/two-corner wrap rate); no separate quote line.
  if([1,2,3].some(n=>n<=data.levels&&!!freeFootprint(data,n as 1|2|3))){
    const label='Custom outline support and connection details (builder quote)';
    quoteRequired.push(label);sections.push({title:'Custom outline construction',icon:'📐',quoteRequired:true,total:0,items:[{name:label,spec:'Deck boards, actual perimeter, modeled framing and base installation allowance are priced. Bespoke angled supports, house attachment and reshaped level connections need a builder review and quote before a construction price is final.',qty:1,unit:'design',cost:null}]});
  }
  // Skirting under the deck (skirtingPricing.ts): face, backing, access panels and labour at published rates.
  const skirting=data.skirting?skirtingPlan(data,model):null;
  if(skirting){
    const rows=pricedSkirtingRows(skirting,markupMult);
    if(rows.length){const total=rows.reduce((n,r)=>n+(r.cost??0),0);sections.push({title:'Deck skirting',icon:'🧱',total,description:`${SKIRTING_STYLE_NAMES[skirting.style]} under the deck, priced from the skirting rate table (face supply, backing, access panels and install labour).`,items:rows});}
    flags.push(...skirting.notes);
  }
  // Stair sides, step ends and the faces between levels (stairCladding.ts): fascia boards the price book has no rate for,
  // so they are listed for a builder quote, never priced or $0 (owner decision 2026-09-25).
  const cladding=claddingPlan(data,model),claddingSqft=cladding.sqft['stair-side']+cladding.sqft['step-end']+cladding.sqft['level-drop'];
  if(claddingSqft>=.1){
    const fasciaColour=partRef(data,'fascia'),parts=[['stair-side','stair sides'],['step-end','step ends'],['level-drop','faces between levels']] as const;
    const words=parts.filter(([k])=>cladding.sqft[k]>=.05).map(([k,w])=>`${w} ${Math.ceil(cladding.sqft[k]*10)/10} sq ft`).join(', ');
    const claddingColour=fasciaColour??`${deckingMaterial}:${data.deckingColor??selectedMaterial.colors[0]?.name}`;
    const supply=fasciaSupply(claddingColour,cladding.slabs.map(s=>({lengthIn:Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y),heightIn:Math.max(s.topA-s.bottomA,s.topB-s.bottomB)})),markupMult);
    sections.push({title:'Stair and level cladding',icon:'🪜',quoteRequired:true,total:supply?.cost??0,description:supply?'Stock-priced fascia supply benchmark. Installation, fasteners and delivery require a builder quote. Tall and triangular faces allow full-width rectangular blanks; the builder confirms cut layout and joints.':'Fascia boards over stair stringers, step ends and level drops require a builder quote for the selected product.',
      items:[...(supply?[{name:'Stair and level cladding supply',spec:`DeckMart retail benchmark, ${supply.rate.sku}; ${supply.boards} × 12 ft fascia boards including 10% order allowance for ${words}. Confirm availability and cut layout.`,qty:supply.boards,unit:'boards',cost:supply.cost}]:[]),
        {name:'Stair and level cladding',spec:`Builder quote required: ${supply?'installation, fasteners and delivery (fascia supply is priced separately)':'fascia boards supplied and fitted'}${fasciaColour?` in ${colourName(fasciaColour)}`:''} over the ${words}.`,qty:Math.ceil(claddingSqft*10)/10,unit:'sqft',cost:null}]});
    quoteRequired.push('Stair and level cladding (builder quote)');
  }
  flags.push(...cladding.notes);
  flags.push(...yardTakeoff.warnings);
  for(const row of yardTakeoff.sections){
    const unknown=row.amountCents===null;if(unknown)quoteRequired.push(row.label);
    sections.push({title:`Yard · ${row.label}`,icon:'🌿',quoteRequired:unknown,total:(row.amountCents??0)/100,description:row.note,items:[{name:row.label,spec:row.note??'Shared yard construction takeoff using the existing Golden Maple website price basis; Ontario HST added once at project level.',qty:row.quantity??1,unit:row.unit??'allowance',cost:unknown?null:row.amountCents!/100}]});
  }
  const stairFrame=stairSchedule.find(r=>r.name.startsWith('Stair picture-frame'));
  if(stairFrame){
    const label='Stair picture-frame detail (builder / supplier quote)';
    quoteRequired.push(label);
    sections.push({title:'Stair picture-frame detail',icon:'🪜',quoteRequired:true,total:0,items:[{name:label,spec:`${stairFrame.section}. ${stairFrame.installedLf.toFixed(1)} lf installed from ${stairFrame.orderedPieces} stock boards (${stairFrame.orderedLf.toFixed(1)} lf ordered). The Stairs assembly allowance already includes generic tread supply and installation. Quote only the net adjustment for this selected border product, mitre cutting, backing, fastening and delivery, crediting that allowance; no duplicate full supply charge. Supplier confirms stock availability and builder confirms supported joints.`,qty:stairFrame.orderedPieces,unit:'boards',cost:null}]});
  }
  const borderLighting=borderLightingPlan(data,model);
  if(borderLighting.selected)flags.push(...borderLighting.warnings);
  if(borderLighting.selected&&borderLighting.availableMounts.length){
    quoteRequired.push(BORDER_SUPPORT_QUOTE);
    sections.push({title:'Picture-frame lighting edge detail',icon:'💡',quoteRequired:true,total:0,items:[{name:BORDER_SUPPORT_QUOTE,spec:BORDER_SUPPORT_NOTE+' Fixture installation is listed separately in the lighting section when enabled. Cable reels or a generic cable allowance already selected are not charged again here.',qty:borderLighting.availableMounts.length,unit:'mounts',cost:null}]});
  }
  // HST is computed AFTER custom overrides so tax always tracks the final
  // pre-tax number. Rendered as a section so every view (results, proposal,
  // PDF) shows it without extra wiring.
  const aluminum=pergolaPricing(data,materialMarkup??35,settings?.pergolaQuote??(data.pergolaQuoteCosts?.key===pergolaQuoteKey(data)?data.pergolaQuoteCosts.quote:undefined));
  if(aluminum){sections.push(aluminum.section);quoteRequired.push(...aluminum.outstanding);flags.push(...aluminum.outstanding,...(pergolaLayout(data,model)?.warnings??[]));}
  const poolQuote=buildPoolQuote(data,yardModel,markupMult);if(poolQuote){sections.push(...poolQuote.sections);quoteRequired.push(...poolQuote.pending);flags.push(...poolQuote.flags);}
  const quoteResolutionReview=applyQuoteResolutions(data,sections,quoteRequired,markupMult,connectors,yardTakeoff);
  if(quoteResolutionReview?.inactive)flags.push(`${quoteResolutionReview.inactive} saved additional-cost record(s) are inactive after scope, design or pricing changes. Reconfirm them before inclusion.`);
  const subtotal = sections.reduce((sum, s) => sum + s.total, 0);
  const hst = subtotal * 0.13;
  sections.push({
    title: 'HST (13%)',
    icon: '🧾',
    description: 'Ontario Harmonized Sales Tax.',
    total: hst,
    items: [
      { name: 'HST', spec: '13% on subtotal', qty: 1, unit: 'ls', cost: hst },
    ]
  });

  const finalTotal = subtotal + hst;
  const finalCostPerSqft = area > 0 ? finalTotal / area : 0;

  if (finalCostPerSqft > 0 && finalCostPerSqft < 40) flags.push('Estimate may be incomplete - review inputs');
  if (finalCostPerSqft > 250) flags.push('Estimate is high - review inputs');
  // Mixed listed lengths name each packed board's length (binLengthsIn); the row's stock length is the longest listed board.
  const stockRow=(name:string,stock:ReturnType<typeof deckBoardStock>,product:ProductStock=mainStock):StockScheduleRow=>({name,section:`${customBoardLayout?BOARD_LAYOUT_POLICY.stockWidthIn:boardWidth} in decking`,stockLengthIn:Math.max(...product.lengthsIn),orderedPieces:stock.orderedBoards,cutsIn:stock.bins.map(b=>b.cutsIn),...(new Set(product.lengthsIn).size>1?{binLengthsIn:stock.bins.map(b=>b.lengthIn)}:{}),unresolvedIn:stock.unresolved,installedLf:stock.installedLf,orderedLf:stock.orderedLf});
  const boardSchedules=[stockRow(`${selectedMaterial.name} — ${pricedBoardStock.spareBoards} spare boards included`,pricedBoardStock)];
  if(separateBorder){const slate=productStock(data,'dark-slate'),stock=boardsWhere((li,bi,role)=>darkBoard(li,bi,role),wasteFactor,slate);boardSchedules.push(stockRow(`Dark Slate border — quote required; ${stock.spareBoards} spare boards allowed`,stock,slate));}
  for(const r of [...accentRows,...borderRows,...layoutRows])boardSchedules.push(stockRow(`${r.label} ${r.group.kind==='accent'?'accent boards':'boards'} — ${r.cost===null?'quote required; ':''}${r.stock.spareBoards} spare boards included`,r.stock,productStock(data,r.group.material.id)));
  if(veneer.woodBoxes.length){const stock=planStock(veneer.woodBoxes.map(b=>b.w),192);boardSchedules.push({name:'Flat 2×6 stair veneer supports — confirm inclusion in assembly allowance',section:'1.5 × 5.5 in framing',stockLengthIn:192,orderedPieces:stock.bins.length,cutsIn:stock.bins.map(b=>b.cutsIn),unresolvedIn:stock.unresolved,installedLf:stock.installedLf,orderedLf:stock.purchasedLf});}

  return {
    ...(poolQuote?{poolQuoteReview:poolQuote.review}:{}),
    ...(quoteResolutionReview?{quoteResolutionReview}:{}),
    yardModel,yardTakeoff,
    quoteRequired:[...new Set(quoteRequired)],
    connectorSchedule:connectors,
    stockSchedule:[...boardSchedules,...framingStock,...stairSchedule],
    model,
    total: finalTotal,
    subtotal,
    hst,
    costPerSqft: finalCostPerSqft,
    area,
    manHours,
    calculatedRailingLf,
    sections: sections.filter(s => s.total > 0||s.quoteRequired||s.items.some(i=>i.quoteResolved||i.cost===null&&Number(i.qty)>0)),
    flags: Array.from(new Set([...flags, ...railingFlags])),
    materialList: sections.flatMap(s => s.items).map(i => ({ 
      item: i.name, 
      spec: i.spec, 
      qty: i.qty, 
      unit: i.unit, 
      cost: i.cost 
    })).filter(i => i.cost===null||i.cost > 0),
    breakerInfo: breaker_required ? {
      required: true,
      rows: breaker_rows,
      interval: breaker_interval,
      standardLength: standard_board_length,
      positions1: breaker_positions1,
      positions2: breaker_positions2
    } : undefined
  };
}

/** A frameless glass railing's lines: quantities only, costed as a supplier quote (requireSection nulls them). */
function framelessGlassItems(layout?:FramelessGlassLayout){
  if(!layout)return [];
  const q=layout.quantities,finish=GLASS_FINISH_NAMES[layout.finish],tenth=(n:number)=>Math.ceil(n*10)/10;
  const sizes=q.panelSizes.slice(0,4).map(s=>`${s.count} × ${s.widthIn} × ${s.heightIn} in`).join(', ')+(q.panelSizes.length>4?', …':'');
  const raked=layout.shoes.some(s=>s.raked);
  return [
    {name:'Frameless glass panels',spec:`1/2 in safety glass, ${tenth(q.glassSqft)} sq ft: ${sizes}`,qty:q.panels,unit:'ea',cost:0},
    ...(layout.mount==='Spigots'?[{name:'Glass spigots',spec:`${finish}; 2 per panel${layout.spigots.some(s=>s.side)?', side standoffs on the stairs':''}`,qty:q.spigots,unit:'ea',cost:0}]
      :[{name:layout.mount==='Fascia-mount base shoe'?'Fascia-mount base shoe':'Top-mount base shoe',spec:`${finish}; ${q.shoeEndCaps} end caps${raked?'; raked on the stair stringers':''}`,qty:tenth(q.shoeLf),unit:'lf',cost:0}]),
    ...(q.handrailLf>0?[{name:'Glass-mounted handrail',spec:`1.66 in round, ${finish}; ${q.handrailBrackets} glass brackets, 35 in above the nosings`,qty:tenth(q.handrailLf),unit:'lf',cost:0}]:[]),
  ];
}
/** Review notes for a frameless glass railing: what the supplier and the permit reviewer confirm. */
function framelessGlassNotes(layout?:FramelessGlassLayout){
  if(!layout)return [];
  return [
    'Frameless glass railing: the glass, shoe or spigots and handrail are a supplier quote (the price book has no frameless glass rate). Installation labour uses the Glass Panels basis.',
    'Frameless glass: use safety glass (tempered or laminated). With no posts or top rail, the glass type and thickness and the shoe or spigots, with their anchors and the blocking behind them, need the supplier’s engineered load rating. Confirm with the supplier and the permit reviewer.',
    'Frameless glass: the supplier confirms whether laminated glass or a top cap rail is needed so the guard still stands if a panel breaks.',
    ...(layout.mount==='Fascia-mount base shoe'?['Fascia-mounted glass: add solid blocking behind the rim at every shoe anchor.']:[]),
    ...(layout.handrails.length?['Stairs with frameless glass: a graspable handrail about 34 to 38 in above the nosings is shown on the glass; the glass itself is not a handrail. Confirm the handrail with the permit reviewer.']:[]),
  ];
}
