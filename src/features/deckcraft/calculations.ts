import { activeWrap, wrapLabourFactor } from './lib/wrapGeometry';
import {getHardwareLayout} from './hardwareLayout';
import {deckBoardStock} from './stockPlan';
import {buildDeckTakeoff,type DeckTakeoff} from './deckTakeoff';
import {DECK_SETTINGS} from './defaults';
import {DECKING_CATALOGUE,RAILING_CATALOGUE} from './manufacturerCatalog';
import {catalogueAccessoryLayout} from './catalogueAccessories';
import {lightingSystemCheck} from './lightingSystem';
import {quotedPrivacyScreens} from './privacyScreens';
import {getHouseContact} from './houseContact';
import {pictureFrameCompatibility} from './lib/finishedFootprint';
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

export interface EstimateResult {
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
  const hardware=getHardwareLayout(data,model);
  const ledgerLf=getHouseContact(data,model.levels[0].footprint).ledgerLf;
  const connectors=connectorSchedule(data,model,hardware);
  const framingStock=constructionStock(model);
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
  const perimeter1 = wrapCorners ? wrapOutlineFt : 2 * (width + length);
  const perimeter2 = levels > 1 ? 2 * (width2 + length2) : 0;
  // A third section adds its own fascia on the same basis as the second.
  const perimeter3 = levels > 2 && data.level3 ? 2 * (data.level3.widthFt + data.level3.lengthFt) : 0;
  const perimeter = perimeter1 + perimeter2 + perimeter3;
  
  const catalogueMaterial=DECKING_CATALOGUE.find(m=>m.id===deckingMaterial);
  const selectedMaterial = catalogueMaterial?.costPerSqft===null?catalogueMaterial:materials.find((m: any) => m.id === deckingMaterial)||catalogueMaterial||materials[0];
  const quoteRequired:string[]=connectors.filter(c=>c.qty>0&&c.rate===null&&!c.basis.startsWith('Priced by')).map(c=>c.name);
  
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
  const boardStock=deckBoardStock(model,wasteFactor);
  const separateBorder=data.borderFinish==='Dark Slate'&&model.levels.some(l=>l.boards.some(b=>b.role==='border'));
  const pricedBoardStock=separateBorder?deckBoardStock({...model,levels:model.levels.map(l=>({...l,boards:l.boards.filter(b=>b.role!=='border')}))},wasteFactor):boardStock;
  const totalDeckingLf = pricedBoardStock.orderedLf;
  const standard_board_length = selectedMaterial.id === 'cedar' ? 12 : 16;
  const finalBoards = pricedBoardStock.orderedBoards;
  // costPerSqft → $/lin-ft conversion is (boardWidthIn / 12): a 5.5" board covers
  // 5.5/12 sqft per lin-ft. (Was /5.5, which billed per-sqft prices per lin-ft —
  // inflating decking material ~2.18×. Same conversion as unit_cost_per_lf below.)
  const deckingCost = totalDeckingLf * (selectedMaterial.costPerSqft * (boardWidthIn / 12));

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
  const breaker_labor_hrs=model.levels.reduce((n,l)=>n+l.breakers.length*(l.footprint.bounds.h/120)*1.5,0);
  const unit_cost_per_lf=selectedMaterial.costPerSqft*(boardWidthIn/12);
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
  if(framingStock.some(row=>row.unresolvedIn.length))flags.push('Framing stock has unresolved oversize members. These lengths remain costed; stock and bearing design need review.');
  if(connectors.some(row=>row.rate===null&&!row.basis.startsWith('Priced by')))flags.push('Estimate excludes separately unpriced connection components. Review the connector schedule and obtain supplier rates before a final quote.');
  flags.push(...((model as DeckTakeoff & {warnings?:string[]}).warnings||[]));
  flags.push(...((model as DeckTakeoff & {issues?:string[]}).issues||[]));

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
    const effectiveRailingLf = (railingLf && railingLf > 0) ? railingLf : calculatedRailingLf;

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
    
    const baseMaterialCost = (levelRailingLf * rCost.material) + (totalStairRailingLf * rCost.material * 1.25);

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
    railingFlags.push('OBC: Ensure baluster spacing is < 4" (100mm) for non-climbable standards.');
  }

  // Stairs
  const riserCount = quantities.risersPerFlight;
  const stringerCount = stairFlights ? quantities.stringers / stairFlights : 0;
  const treadCostKey = selectedMaterial.isComposite ? 'composite' : (selectedMaterial.id === 'cedar' ? 'cedar' : 'pine');
  const totalRisers=(quantities as typeof quantities & {totalRisers?:number}).totalRisers ?? stairFlights*riserCount;
  const stairMaterialCost = totalRisers * (stairTreadCosts[treadCostKey] || 24);
  const stairLaborBase = totalRisers / 10; // Existing ten-risers-per-day basis, now from actual flights.
  // STAIR_LABOR_MULTIPLIER is a scalar (1.25). Indexing it by stairType returned
  // undefined and NaN-poisoned every downstream total. Winder/Landing stairs get
  // a heavier factor on top of the base multiplier.
  const stairLaborMultiplier = stairType === 'Winder' ? STAIR_LABOR_MULTIPLIER * 1.2
    : stairType === 'Landing' ? STAIR_LABOR_MULTIPLIER * 1.12
    : STAIR_LABOR_MULTIPLIER;

  // Labor Engine — Golden Maple model: ONE fully-loaded crew day rate
  // ($3,000/day all-in, set 2026-07-27) covers wages, burden, equipment,
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
    const labourRailingLf = (railingLf && railingLf > 0) ? railingLf : calculatedRailingLf;
    crewDays += (labourRailingLf * 1.10) / rRate;
  }
  
  crewDays += perimeter / 100; // Fascia
  
  // Multipliers
  let complexityMult = 1.0;
  if (shape === 'L-Shape') complexityMult *= 1.10;
  if (shape === 'Multi-corner') complexityMult *= 1.25;
  if (shape === 'Curved') complexityMult *= 1.50;
  complexityMult *= wrapLabourFactor(wrap);
  
  if (pattern === 'Diagonal') complexityMult *= 1.20;
  if (pattern === 'Picture Frame') complexityMult *= 1.25;
  if (pattern === 'Herringbone') complexityMult *= 1.30;
  
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
  if (railingType === 'Glass Panels') complexityMult *= 1.40;

  const breaker_crew_days = breaker_labor_hrs / 8;
  const totalCrewDays = (crewDays + stairLaborBase * stairLaborMultiplier + breaker_crew_days) * complexityMult;
  const manHours = totalCrewDays * 27; // 3-person crew × 9-hour days (GM standard)
  const calculatedLaborCost = totalCrewDays * crewDayRate;
  const finalLaborCost = customLaborCost !== undefined ? customLaborCost : calculatedLaborCost;

  // Apply material markup — GM doctrine default 35% (25% large orders / 50%+
  // specialty). Materials are carried at Carr TRADE cost in MATERIAL_TIERS;
  // this is where contractor margin on materials lives.
  const markupMult = (1 + ((materialMarkup ?? 35) / 100));
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
  if (deckType === 'Attached' || area > 108 || height > 24 || pergolaSqft > 0) {
    permitFee = permitFees[municipality] || 200;
  }
  const caFee = (siteType === 'Waterfront-Lakefront' || siteType === 'Island-Ferry') ? 560 : 0;
  let engineeringFee = 0;
  if (intendedLoad === 'Heavy' || levels >= 3 || pergolaSqft > 0 || soilCondition === 'Shallow Bedrock') {
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
  
  const lightingCheck=lightingSystemCheck(data),selectedLightingItems=lightingCheck.items;
  flags.push(...lightingCheck.warnings,...pictureFrameCompatibility(data));
  quoteRequired.push(...selectedLightingItems.filter(p=>p.cost===null||p.laborCost===null).map(p=>`${p.name} supply and installation`));
  // Manufacturer privacy screens have no price-book rate: listed for a supplier quote, never priced at zero.
  const quotedScreens=quotedPrivacyScreens(data.privacyScreens??[]);
  quoteRequired.push(...quotedScreens.map(name=>`${name} supply and installation`));

  const lightingWireLf=selectedLightingItems.length&&!selectedLightingItems.some(p=>p.geometry==='cable')?Math.max(0,lSys.wireDistance||0):0;
  const totalLightingMaterial = selectedLightingItems.reduce((sum, item) => sum + (item.cost || 0) * item.qty, 0)+lightingWireLf*LIGHTING_COSTS.wirePerFt;
  const totalLightingLabor = selectedLightingItems.reduce((sum, item) => sum + (item.laborCost || 0) * item.qty, 0);

  const totalLightingCost = (totalLightingMaterial * markupMult) + totalLightingLabor;

  const addOnCosts = {
    lighting: totalLightingCost,
    bench: benchLf * 155 * markupMult,
    privacy: privacySqft * 70 * markupMult,
    drainage: hasDrainage ? area * 12 * markupMult : 0,
    demo: hasDemo ? area * 14 * markupMult : 0,
    pergola: pergolaSqft * 65 * markupMult,
    // Add-on module specific
    structuralTieIn: deckType === 'Add-on' ? (data.addOnHardwareCost || 450) * markupMult : 0,
    ledgerFlashing: deckType === 'Add-on' ? (data.addOnFlashingLf || ledgerLf) * 12 * markupMult : 0,
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
        { name: selectedMaterial.name, spec: `${pattern}; ${pricedBoardStock.bins.reduce((n,b)=>n+b.cutsIn.length,0)} installed pieces, ${pricedBoardStock.spareBoards} spare stock boards${separateBorder?'; contrast border priced separately':''}`, qty: finalBoards, unit: 'boards', cost: m_deckingCost },
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
      items: [
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
        { name: 'Stair Treads & Stringers', spec: `${quantities.stringers} stringers at maximum ${model.stairSupport.spacingIn} in centres; ${quantities.stairTreads} treads; ${quantities.riserBoardPieces} closed riser pieces. Existing per-riser assembly allowance includes these materials; no duplicate riser charge.`, qty: totalRisers, unit: 'risers', cost: m_stairMaterialCost },
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
          spec: `${totalCrewDays.toFixed(1)} crew-days × $${crewDayRate.toLocaleString()}/day`,
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
      items: [...selectedLightingItems.map(item => ({
        name: item.name,
        spec: `${item.category}${['transformer','cable','accessory'].includes(item.geometry)?'':` · ${item.zone}`}`,
        qty: item.qty,
        unit: 'ea',
        cost: item.cost===null||item.laborCost===null?null:(item.cost * markupMult + item.laborCost) * item.qty,
        unitPrice: item.cost===null?undefined:item.cost * markupMult,
        laborCost: item.laborCost??undefined
      })),...(lightingWireLf?[{name:'Low-voltage cable',spec:'Existing Deck Craft Pro wire-per-foot rate',qty:lightingWireLf,unit:'lf',cost:lightingWireLf*LIGHTING_COSTS.wirePerFt*markupMult}]:[])]
    },
    {
      title: 'Add-ons & Extras',
      icon: '✨',
      description: 'Optional features to enhance your outdoor living space.',
      total: Object.values(addOnCosts).reduce((a, b) => a + b, 0) - addOnCosts.lighting,
      items: [
        { name: 'Built-in Bench', spec: 'Matching Decking', qty: benchLf, unit: 'lf', cost: addOnCosts.bench },
        { name: 'Privacy Screen', spec: 'Louvered/Slatted', qty: privacySqft, unit: 'sqft', cost: addOnCosts.privacy },
        ...quotedScreens.map(name => ({ name: 'Manufacturer privacy screen', spec: name, qty: 1, unit: 'screen', cost: null })),
        { name: 'Drainage System', spec: 'Under-deck', qty: hasDrainage ? area : 0, unit: 'sqft', cost: addOnCosts.drainage },
        { name: 'Demo & Removal', spec: 'Existing Deck', qty: hasDemo ? area : 0, unit: 'sqft', cost: addOnCosts.demo },
        { name: 'Pergola', spec: 'Wood/Aluminum', qty: pergolaSqft, unit: 'sqft', cost: addOnCosts.pergola },
        { name: 'Structural Tie-in', spec: 'Hardware to Existing', qty: deckType === 'Add-on' ? 1 : 0, unit: 'ls', cost: addOnCosts.structuralTieIn },
        { name: 'Ledger Flashing', spec: 'Connection Width', qty: deckType === 'Add-on' ? (data.addOnFlashingLf || ledgerLf) : 0, unit: 'lf', cost: addOnCosts.ledgerFlashing },
        { name: 'Transition Labor', spec: 'Leveling & Siding Prep', qty: deckType === 'Add-on' ? 1 : 0, unit: 'ls', cost: addOnCosts.transitionLabor },
      ].filter(item => item.qty > 0)
    },
  ];

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
  if(separateBorder){const lf=model.levels.reduce((n,l)=>n+l.boards.filter(b=>b.role==='border').reduce((s,b)=>s+b.length/12,0),0);quoteRequired.push('Deckorators Dark Slate picture-frame boards');sections.push({title:'Picture-frame border finish',icon:'🪵',quoteRequired:true,total:0,items:[{name:'Deckorators Dark Slate',spec:'Dedicated border product; installed cuts are in the stock schedule. Supplier board lengths, order allowance and pricing require confirmation.',qty:Math.ceil(lf*10)/10,unit:'lf',cost:null}]});}
  const catalogueAccessories=catalogueAccessoryLayout(data,model);
  if(catalogueAccessories.rows.length){
    const rows=catalogueAccessories.rows.filter(r=>r.qty>0);
    sections.push({title:'Manufacturer deck accessories',icon:'🔩',quoteRequired:true,total:0,items:rows.map(r=>({name:r.name,spec:r.spec,qty:r.qty,unit:r.unit,cost:null}))});
    quoteRequired.push(...rows.map(r=>r.name));
    if(data.catalogueAccessories?.some(id=>id==='tt_concealoc'||id==='dk_stealthlock')){const section=sections.find(s=>s.title==='Hardware & Fasteners');if(section){for(const item of section.items)if(item.name==='Hidden Clips'||item.name==='Deck Screws')item.cost=null;section.quoteRequired=true;section.total=section.items.reduce((n,i)=>n+(i.cost??0),0);}}
    if(data.catalogueAccessories?.includes('tt_protac_flashing')){const section=sections.find(s=>s.title==='Add-ons & Extras');if(section){for(const item of section.items)if(item.name==='Ledger Flashing')item.cost=null;section.total=section.items.reduce((n,i)=>n+(i.cost??0),0);}}
  }
  if(catalogueMaterial?.availabilityNote)flags.push(catalogueMaterial.availabilityNote);
  if(veneer.applicable){
    if(veneer.status==='modeled-straight')flags=flags.filter(s=>!s.includes('displayed stringers and closed risers do not provide that complete assembly'));
    flags.push(...veneer.issues);
    const rows=veneer.rows.filter(r=>r.id!=='terrain-veneer-wood');
    if(rows.length){quoteRequired.push(...rows.map(r=>r.name));sections.push({title:'Terrain stair support connections',icon:'🔩',quoteRequired:true,total:0,items:rows.map(r=>({name:r.name,spec:r.basis,qty:r.qty,unit:r.unit,cost:null}))});}
  }
  flags.push(...yardTakeoff.warnings);
  for(const row of yardTakeoff.sections){
    const unknown=row.amountCents===null;if(unknown)quoteRequired.push(row.label);
    sections.push({title:`Yard · ${row.label}`,icon:'🌿',quoteRequired:unknown,total:(row.amountCents??0)/100,description:row.note,items:[{name:row.label,spec:row.note??'Shared yard construction takeoff using the existing Golden Maple website price basis; Ontario HST added once at project level.',qty:row.quantity??1,unit:row.unit??'allowance',cost:unknown?null:row.amountCents!/100}]});
  }
  // HST is computed AFTER custom overrides so tax always tracks the final
  // pre-tax number. Rendered as a section so every view (results, proposal,
  // PDF) shows it without extra wiring.
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
  const stockRow=(name:string,stock:ReturnType<typeof deckBoardStock>):StockScheduleRow=>({name,section:`${boardWidth} in decking`,stockLengthIn:model.stockLength,orderedPieces:stock.orderedBoards,cutsIn:stock.bins.map(b=>b.cutsIn),unresolvedIn:stock.unresolved,installedLf:stock.installedLf,orderedLf:stock.orderedLf});
  const boardSchedules=[stockRow(`${selectedMaterial.name} — ${pricedBoardStock.spareBoards} spare boards included`,pricedBoardStock)];
  if(separateBorder){const stock=deckBoardStock({...model,levels:model.levels.map(l=>({...l,boards:l.boards.filter(b=>b.role==='border')}))},wasteFactor);boardSchedules.push(stockRow(`Dark Slate border — quote required; ${stock.spareBoards} spare boards allowed`,stock));}
  if(veneer.woodBoxes.length){const stock=planStock(veneer.woodBoxes.map(b=>b.w),192);boardSchedules.push({name:'Flat 2×6 stair veneer supports — confirm inclusion in assembly allowance',section:'1.5 × 5.5 in framing',stockLengthIn:192,orderedPieces:stock.bins.length,cutsIn:stock.bins.map(b=>b.cutsIn),unresolvedIn:stock.unresolved,installedLf:stock.installedLf,orderedLf:stock.purchasedLf});}

  return {
    yardModel,yardTakeoff,
    quoteRequired:[...new Set(quoteRequired)],
    connectorSchedule:connectors,
    stockSchedule:[...boardSchedules,...framingStock,...stairStock(data,model)],
    model,
    total: finalTotal,
    subtotal,
    hst,
    costPerSqft: finalCostPerSqft,
    area,
    manHours,
    calculatedRailingLf,
    sections: sections.filter(s => s.total > 0||s.quoteRequired),
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
