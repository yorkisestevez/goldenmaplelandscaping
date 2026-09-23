import {useEffect,useMemo,type Dispatch,type SetStateAction} from 'react';
import {calculateDeckReleaseEstimate as calculateEstimate,deckReleaseData} from '../deckRelease';
import {DECK_SETTINGS} from '../defaults';
import {describeDesign} from '../designFacts';
import {extrasLayout} from '../extrasLayout';
import {isSystemProduct,lightingSystemCheck,syncAutoLighting} from '../lightingSystem';
import type {DeckData} from '../types';

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
  const estimateKey=JSON.stringify({...data,privacyScreens:data.privacyScreens?.map(({side:_side,offsetPct:_offset,...screen})=>screen),houseFit:data.houseConfig&&[data.houseConfig.widthFt,data.houseConfig.depthFt,data.houseConfig.floorHeightIn,data.houseConfig.footprint?.rects.map(b=>[b.kind,b.wall,b.offsetFt,b.widthFt,b.depthFt,b.floorHeightIn])],houseConfig:undefined,houseVisible:undefined,customerName:undefined,projectAddress:undefined,scopeOfWork:undefined,yardFeatures:undefined,terrainConfig:undefined,houseWallHeightIn:undefined,houseDoorOffset:undefined,houseDoorWidthIn:undefined,sceneLighting:undefined,lightingPreviewOn:undefined});
  const estimate=useMemo(()=>calculateEstimate(data,DECK_SETTINGS),[estimateKey]);
  const lightingCheck=useMemo(()=>lightingSystemCheck(data),[data]);
  const extras=useMemo(()=>extrasLayout(data,estimate.model),[data,estimate.model]);
  // Simple post/step/screen lights follow the modeled mounts; only write when the selection really changes.
  const autoCounts={posts:estimate.model.railing.posts.length,stairs:estimate.model.treads.length,privacy:extras.privacyMounts.length};
  const autoKey=JSON.stringify([data.autoLighting,autoCounts,data.lightingSystem.selectedItems]);
  useEffect(()=>{
    if(JSON.stringify(syncAutoLighting(data,autoCounts))===JSON.stringify(data.lightingSystem.selectedItems))return;
    setData(prev=>deckReleaseData({...prev,lightingSystem:{...prev.lightingSystem,selectedItems:syncAutoLighting(prev,autoCounts)}}));
  },[autoKey]);
  const hasFixtures=lightingCheck.items.some(p=>!isSystemProduct(p));
  const reviewFlags=[...new Set([...estimate.flags,...extras.warnings])];
  // One description of the design feeds the estimate step, the summary download, the proposal and a sent design.
  const described=describeDesign(data,estimate);
  return {estimate,lightingCheck,extras,autoCounts,hasFixtures,reviewFlags,described};
}
