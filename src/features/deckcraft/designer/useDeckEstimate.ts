import {usePergolaQuote} from './usePergolaQuote';
import {pergolaQuoteKey} from '../pergolaPricing';
import {useEffect,useMemo,type Dispatch,type SetStateAction} from 'react';
import {calculateDeckReleaseEstimate as calculateEstimate,deckReleaseData} from '../deckRelease';
import {DECK_SETTINGS} from '../defaults';
import {describeDesign} from '../designFacts';
import {extrasLayout} from '../extrasLayout';
import {houseRailingReviewFlags} from '../houseRailingClearance';
import {isSystemProduct,lightingSystemCheck,syncAutoLighting} from '../lightingSystem';
import type {DeckData} from '../types';

/**
 * What re-prices the design: the design without its appearance (house looks and openings, screen positions, scene
 * lighting, the proposal's name and address, a backyard feature's concept colour). House size, attached blocks and floor
 * heights stay in it, because they can move the ledger. The option deltas (R6) are keyed by it too.
 */
export const estimateKeyOf=(data:DeckData)=>data.quoteResolutions?.length?JSON.stringify({...data,generatedImageUrl:undefined,isGeneratingImage:undefined,houseVisible:undefined,sceneLighting:undefined,lightingPreviewOn:undefined,boundaryLocks:undefined}):JSON.stringify({...data,privacyScreens:data.privacyScreens?.map(({side:_side,offsetPct:_offset,...screen})=>screen),houseFit:data.houseConfig&&[data.houseConfig.widthFt,data.houseConfig.depthFt,data.houseConfig.floorHeightIn,data.houseConfig.footprint?.rects.map(b=>[b.kind,b.wall,b.offsetFt,b.widthFt,b.depthFt,b.floorHeightIn])],houseConfig:undefined,houseVisible:undefined,customerName:undefined,projectAddress:undefined,scopeOfWork:undefined,yardFeatures:data.yardFeatures?.map(({color:_color,...feature})=>feature),houseWallHeightIn:undefined,houseDoorOffset:undefined,houseDoorWidthIn:undefined,sceneLighting:undefined,lightingPreviewOn:undefined});

/**
 * The live estimate and what hangs off it. The estimate key decides what re-prices: appearance never
 * does (house looks and openings, screen positions, scene lighting, the proposal's name and address).
 * Simple post/step/screen lights follow the modelled mounts; the effect writes only real changes.
 */
export function useDeckEstimate(data:DeckData,setData:Dispatch<SetStateAction<DeckData>>){
  // Appearance-only gestures must not rebuild every deck cut and stock group.
  // Installation zones remain part of this key; house appearance does not affect deck pricing.
  // Where a screen sits on its edge never changes the price, so dragging one does not re-run the estimate.
  // House size, attached blocks and floor heights can move the ledger and add warnings; looks and openings never price.
  // Backyard features and terrain price; a feature's concept colour never does.
  const {quote,revision}=usePergolaQuote(data,undefined,context=>setData(prev=>prev.pergola&&pergolaQuoteKey(prev)===context.key&&JSON.stringify(prev.pergolaQuoteCosts)!==JSON.stringify(context)?deckReleaseData({...prev,pergolaQuoteCosts:context}):prev));
  const designKey=estimateKeyOf(data);
  const estimateKey=designKey+(data.pergola?`:${revision}`:'');
  const estimate=useMemo(()=>calculateEstimate(data,{...DECK_SETTINGS,pergolaQuote:quote}),[estimateKey]);
  const lightingCheck=useMemo(()=>lightingSystemCheck(data,estimate.model),[data,estimate.model]);
  const extras=useMemo(()=>extrasLayout(data,estimate.model),[data,estimate.model]);
  // Simple post/step/screen lights follow the modeled mounts; only write when the selection really changes.
  const autoCounts={posts:estimate.model.railing.posts.length,stairs:estimate.model.treads.length,privacy:extras.privacyMounts.length,border:extras.borderMounts.length};
  const autoKey=JSON.stringify([data.autoLighting,autoCounts,data.lightingSystem.selectedItems]);
  useEffect(()=>{
    if(JSON.stringify(syncAutoLighting(data,autoCounts))===JSON.stringify(data.lightingSystem.selectedItems))return;
    setData(prev=>deckReleaseData({...prev,lightingSystem:{...prev.lightingSystem,selectedItems:syncAutoLighting(prev,autoCounts)}}));
  },[autoKey]);
  const hasFixtures=lightingCheck.items.some(p=>!isSystemProduct(p));
  const reviewFlags=[...new Set([...houseRailingReviewFlags(data,estimate.model,estimate.flags),...extras.warnings])];
  // One description of the design feeds the estimate step, the summary download, the proposal and a sent design.
  const described=describeDesign(data,estimate);
  // The estimate key also keys the option deltas (R6): a delta is shown only for the design it was priced for.
  return {estimate,estimateKey,lightingCheck,extras,autoCounts,hasFixtures,reviewFlags,described};
}
