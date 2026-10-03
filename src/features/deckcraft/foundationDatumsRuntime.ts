import {registerFoundationRuntime} from './foundationDatums';
import type {FoundationDatum} from './foundationDatums';
import type {DeckData} from './types';
import type {DeckLevel} from './deckTakeoff';
import {createSiteSurface,sampleSiteHeight} from './siteSurface';
import {getTerrainConfig} from './yardSettings';
export function foundationDatums(data:DeckData,levels:DeckLevel[]):FoundationDatum[]{
 const surface=data.siteModel?createSiteSurface(data.siteModel,getTerrainConfig(data)):undefined,blocks=data.foundation==='Deck Blocks',depth=blocks?0:data.foundationDepthIn??48;
 return levels.flatMap((level,li)=>level.supports.map((p,pi)=>{
  const footprint=[{x:p.x-6,y:p.z-6},{x:p.x+6,y:p.z-6},{x:p.x+6,y:p.z+6},{x:p.x-6,y:p.z+6}],coverage=surface?.extrema([footprint],'proposed'),sample=sampleSiteHeight(data,p.x,p.z),complete=(!surface||coverage?.complete)&&Number.isFinite(sample),grade=complete?sample!:null,base=grade===null?null:grade+(blocks?6.5:4.5),height=base===null?null:Math.max(0,p.y-base);
  return {id:`footing:${li}:${pi}`,levelIndex:li,supportIndex:pi,x:p.x,z:p.z,bearingElevationIn:p.y,gradeElevationIn:grade,bottomElevationIn:grade===null?null:grade-depth,headTopElevationIn:grade===null?null:grade+(blocks?6:2),postBaseElevationIn:base,postHeightIn:height,status:!complete?'coverage-pending':p.y<=base!?'clearance-pending':'modeled',depthIn:depth,foundation:data.foundation} as FoundationDatum;
 }));
}

registerFoundationRuntime({foundationDatums});
