import {getPoolModels} from '../../poolModel';
import React, {useMemo,useSyncExternalStore} from 'react';
import {isObjectVisible} from '../../editorOrganization';
import type {FootprintPlan} from '../../lib/deckGeometry';
import type {DeckData} from '../../types';
import House3D from './House3D';
import ShowcaseContext3D from './ShowcaseContext3D';
import Turf from './Turf';
import type {HouseInteraction} from './houseInteraction';
import type {YardModel} from '../../yardModel';
import {useThree} from '@react-three/fiber';
import {SCENE_LOOK} from './sceneLook';
import {getShowcaseFlags,getShowcaseServerFlags,subscribeShowcase} from './showcaseMode';
import {SKY_DATA,skyStrength,sunDirection} from './skyModel';

const SUN=sunDirection();
const GOLDEN_ELEVATION=18*Math.PI/180;

export const Environment3D=React.memo(function Environment3D({data,footprint,topY,cutaway=false,finished=true,yard,...interaction}:{data:DeckData;footprint:FootprintPlan;topY:number;planKey:string;cutaway?:boolean;finished?:boolean;yard:YardModel}&HouseInteraction){
  const evening=data.sceneLighting==='Evening',radius=Math.max(footprint.bounds.w,footprint.bounds.h)*3,shadowRange=radius/12;
  const flags=useSyncExternalStore(subscribeShowcase,getShowcaseFlags,getShowcaseServerFlags);
  const golden=flags.quality&&flags.post&&flags.hour==='golden'&&!evening;
  // Daylight keeps the HDRI sun. Showcase golden hour drops it to about 18° and warms the key.
  const sun=useMemo(()=>{const placed=SUN.clone().multiplyScalar(radius);if(!golden)return placed;const flat=Math.hypot(placed.x,placed.z)||1;placed.y=flat*Math.tan(GOLDEN_ELEVATION);return placed.normalize().multiplyScalar(radius);},[radius,golden]);
  const daySun=skyStrength(evening?'evening':'day').sun;
  // renderPipeline fits the frustum to what casts; the sun's map is as large as this GPU allows, up to 4096.
  const mapSize=Math.min(SCENE_LOOK.sunShadow.mapSize,useThree(state=>state.gl.capabilities.maxTextureSize));
  // The daylight key shares the HDRI's direction (Sky3D.tsx); the evening sky has no directional key.
  return <group>
    <directionalLight name="sun" castShadow={!evening} color={(golden?[1,.68,.38]:SKY_DATA.day.sunColor) as [number,number,number]} intensity={golden?daySun*.82:daySun} position={sun.toArray()} shadow-mapSize={[mapSize,mapSize]} shadow-camera-left={-shadowRange} shadow-camera-right={shadowRange} shadow-camera-top={shadowRange} shadow-camera-bottom={-shadowRange} shadow-camera-near={.5} shadow-camera-far={radius/3} shadow-bias={-.00015} shadow-normalBias={.025} shadow-radius={SCENE_LOOK.sunShadow.radius}/>
    {!cutaway&&<>{isObjectVisible(data.editorOrganization,'site')&&<Turf pools={getPoolModels(data)} landscapeObjects={data.landscapeObjects} width={footprint.bounds.w} depth={footprint.bounds.h} radius={radius} yard={yard} finished={finished}/>}<House3D data={data} width={footprint.bounds.w} {...interaction}/><ShowcaseContext3D data={data}/></>}
  </group>;
});
