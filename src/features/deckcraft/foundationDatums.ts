import type {DeckData,FoundationType} from './types';
import type {Box,DeckLevel} from './deckTakeoff';
export interface FoundationDatum {id:string;levelIndex:number;supportIndex:number;x:number;z:number;bearingElevationIn:number;gradeElevationIn:number|null;bottomElevationIn:number|null;headTopElevationIn:number|null;postBaseElevationIn:number|null;postHeightIn:number|null;status:'modeled'|'coverage-pending'|'clearance-pending';depthIn:number;foundation:FoundationType}
export interface FoundationCylinder {part:'concrete-pier'|'pile-shaft'|'pile-helix';x:number;z:number;bottom:number;top:number;radius:number}
/** Circular radius and axial length stay exact; new mesh area error is <0.1%. */
export const FOUNDATION_RADIAL_SEGMENTS=96;
export const foundationRadialSegments=(data:Pick<DeckData,'siteModel'|'terrainConfig'|'stairTargets'|'yardFeatures'>)=>data.siteModel||data.terrainConfig||data.stairTargets?.length||data.yardFeatures?.some(f=>f.finishedElevationIn!==undefined||f.patioSlope!==undefined||f.wallTopSteps!==undefined)?FOUNDATION_RADIAL_SEGMENTS:16;
/** Positions are taken from framing. Local ground sets the foundation datum;
 * neither deck elevations nor generated bearing elevations are moved. */
type Runtime=Pick<typeof import('./foundationDatumsRuntime'),'foundationDatums'>;
let runtime:Runtime|undefined;
export function registerFoundationRuntime(value:Runtime){runtime=value;}
export function foundationDatums(data:DeckData,levels:DeckLevel[]):FoundationDatum[]{
 if(data.siteModel||data.terrainConfig&&(data.terrainConfig.elevationIn!==0||data.terrainConfig.slopePct!==0)){if(!runtime)throw Error('Local foundation geometry is loading. Prepare the design before calculating or exporting.');return runtime.foundationDatums(data,levels);}
 const blocks=data.foundation==='Deck Blocks',depth=blocks?0:data.foundationDepthIn??48,base=blocks?6.5:4.5;
 return levels.flatMap((l,li)=>l.supports.map((p,pi)=>({id:`footing:${li}:${pi}`,levelIndex:li,supportIndex:pi,x:p.x,z:p.z,bearingElevationIn:p.y,gradeElevationIn:0,bottomElevationIn:-depth,headTopElevationIn:blocks?6:2,postBaseElevationIn:base,postHeightIn:Math.max(0,p.y-base),status:p.y<=base?'clearance-pending':'modeled',depthIn:depth,foundation:data.foundation} as FoundationDatum)));
}
/** Shared schematic stock solids: viewer and all mesh exports use these datums. */
export function foundationSolids(d:FoundationDatum):{boxes:(Box&{part:'deck-block'|'post-base'|'post'})[];cylinders:FoundationCylinder[]}{
 const boxes:(Box&{part:'deck-block'|'post-base'|'post'})[]=[],cylinders:FoundationCylinder[]=[];
 if(d.gradeElevationIn===null||d.bottomElevationIn===null||d.headTopElevationIn===null||d.postBaseElevationIn===null)return {boxes,cylinders};
 const grade=d.gradeElevationIn;
 if(d.foundation==='Deck Blocks')boxes.push({part:'deck-block',x:d.x,y:grade+3,z:d.z,w:12,h:6,d:12});
 else if(d.foundation==='Helical Piles'){cylinders.push({part:'pile-shaft',x:d.x,z:d.z,bottom:d.bottomElevationIn,top:d.headTopElevationIn,radius:1.4},{part:'pile-helix',x:d.x,z:d.z,bottom:d.bottomElevationIn+4,top:d.bottomElevationIn+4.3,radius:6});}
 else cylinders.push({part:'concrete-pier',x:d.x,z:d.z,bottom:d.bottomElevationIn,top:d.headTopElevationIn,radius:6});
 boxes.push({part:'post-base',x:d.x,y:d.postBaseElevationIn-.25,z:d.z,w:7,h:.4,d:7});
 if(d.postHeightIn!>0)boxes.push({part:'post',x:d.x,y:(d.bearingElevationIn+d.postBaseElevationIn)/2,z:d.z,w:5.5,h:d.postHeightIn!,d:5.5});
 return {boxes,cylinders};
}
