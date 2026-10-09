import {getPoolModels} from '../../poolModel';
import React from 'react';
import {isObjectVisible} from '../../editorOrganization';
import type {FootprintPlan} from '../../lib/deckGeometry';
import type {DeckData} from '../../types';
import House3D from './House3D';
import ShowcaseContext3D from './ShowcaseContext3D';
import Turf from './Turf';
import type {HouseInteraction} from './houseInteraction';
import type {YardModel} from '../../yardModel';
import {useThree} from '@react-three/fiber';
import {useSyncExternalStore} from 'react';
import {SCENE_LOOK} from './sceneLook';
import {SKY_DATA,skyStrength,sunDirection} from './skyModel';
import {getShowcaseFlags,showcaseGolden,subscribeShowcase} from './showcaseMode';

const SUN=sunDirection();
/** Low warm key for showcase stills only. The saved day and evening suns stay put. */
function goldenSun(){
 const el=16*Math.PI/180,az=SCENE_LOOK.sky.sunAzimuthDeg*Math.PI/180;
 return SUN.clone().set(Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az));
}

export const Environment3D=React.memo(function Environment3D({data,footprint,topY,cutaway=false,finished=true,yard,...interaction}:{data:DeckData;footprint:FootprintPlan;topY:number;planKey:string;cutaway?:boolean;finished?:boolean;yard:YardModel}&HouseInteraction){
  const evening=data.sceneLighting==='Evening',radius=Math.max(footprint.bounds.w,footprint.bounds.h)*3,shadowRange=radius/12;
  const golden=useSyncExternalStore(subscribeShowcase,showcaseGolden,()=>false);
  const showcase=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().quality,()=>false);
  // renderPipeline fits the frustum to what casts; the sun's map is as large as this GPU allows, up to 4096.
  const mapSize=Math.min(SCENE_LOOK.sunShadow.mapSize,useThree(state=>state.gl.capabilities.maxTextureSize));
  const daySun=SUN.clone().multiplyScalar(radius),sun=golden&&!evening?goldenSun().multiplyScalar(radius):daySun;
  const sunColor:string|[number,number,number]=golden&&!evening?'#ffb36b':SKY_DATA.day.sunColor as [number,number,number];
  const sunIntensity=skyStrength(evening?'evening':'day').sun*(golden&&!evening?1.22:1);
  // A wide penumbra on a software rasterizer reads as blotches. Showcase stills use a tight kernel.
  const shadowRadius=showcase?1:SCENE_LOOK.sunShadow.radius;
  // The daylight key shares the HDRI's direction (Sky3D.tsx); the evening sky has no directional key.
  return <group>
    <directionalLight name="sun" castShadow={!evening} color={sunColor} intensity={sunIntensity} position={sun.toArray()} shadow-mapSize={[mapSize,mapSize]} shadow-camera-left={-shadowRange} shadow-camera-right={shadowRange} shadow-camera-top={shadowRange} shadow-camera-bottom={-shadowRange} shadow-camera-near={.5} shadow-camera-far={radius/3} shadow-bias={-.00015} shadow-normalBias={.025} shadow-radius={shadowRadius}/>
    {!cutaway&&<>{isObjectVisible(data.editorOrganization,'site')&&<Turf pools={getPoolModels(data)} landscapeObjects={data.landscapeObjects} width={footprint.bounds.w} depth={footprint.bounds.h} radius={radius} yard={yard} finished={finished}/>}<House3D data={data} width={footprint.bounds.w} {...interaction}/><ShowcaseContext3D data={data}/></>}
  </group>;
});
