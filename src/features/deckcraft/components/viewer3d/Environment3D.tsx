import React from 'react';
import type {FootprintPlan} from '../../lib/deckGeometry';
import type {DeckData} from '../../types';
import House3D from './House3D';
import Turf from './Turf';
import type {HouseInteraction} from './houseInteraction';
import type {YardModel} from '../../yardModel';
import {useThree} from '@react-three/fiber';
import {SCENE_LOOK} from './sceneLook';

export const Environment3D=React.memo(function Environment3D({data,footprint,topY,cutaway=false,yard,...interaction}:{data:DeckData;footprint:FootprintPlan;topY:number;planKey:string;cutaway?:boolean;yard:YardModel}&HouseInteraction){
  const evening=data.sceneLighting==='Evening',radius=Math.max(footprint.bounds.w,footprint.bounds.h)*3,shadowRange=radius/12;
  // renderPipeline fits the frustum to what casts; the sun's map is as large as this GPU allows, up to 4096.
  const mapSize=Math.min(SCENE_LOOK.sunShadow.mapSize,useThree(state=>state.gl.capabilities.maxTextureSize));
  return <group>
    <hemisphereLight args={[evening?'#667f9d':'#eaf2ff',evening?'#283022':'#788565',evening?.13:.55]}/>
    <directionalLight name="sun" castShadow color={evening?'#9eb5e4':'#fff7ed'} intensity={evening?.18:2} position={[radius*.45,radius*.8,radius*.65]} shadow-mapSize={[mapSize,mapSize]} shadow-camera-left={-shadowRange} shadow-camera-right={shadowRange} shadow-camera-top={shadowRange} shadow-camera-bottom={-shadowRange} shadow-camera-near={.5} shadow-camera-far={radius/3} shadow-bias={-.00015} shadow-normalBias={.025} shadow-radius={SCENE_LOOK.sunShadow.radius}/>
    {!cutaway&&<><Turf width={footprint.bounds.w} depth={footprint.bounds.h} radius={radius} yard={yard}/><House3D data={data} width={footprint.bounds.w} {...interaction}/></>}
  </group>;
});
