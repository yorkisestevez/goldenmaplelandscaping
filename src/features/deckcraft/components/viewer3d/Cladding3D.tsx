import {useMemo} from 'react';
import type * as THREE from 'three';
import type {DeckData} from '../../types';
import type {DeckTakeoff} from '../../deckTakeoff';
import {claddingPlan} from '../../stairCladding';
import {Slabs} from './Skirting3D';

/**
 * The finish boards that close stairs and level joins (stairCladding.ts), in the fascia's finish: stepped panels over
 * the stair stringers, the ends of steps between levels, the face under a higher level's rim down to the lower deck, and
 * the filler at each outside rim corner. The framing and cutaway views leave them off to show the structure.
 */
export default function Cladding3D({data,model,material,finished}:{data:DeckData;model:DeckTakeoff;material:THREE.Material;finished:boolean}){
  const plan=useMemo(()=>claddingPlan(data,model),[data,model]);
  return <group name="stair-and-level-cladding">
    {finished&&<Slabs slabs={plan.slabs} material={material} name="stair-and-level-cladding-boards"/>}
    <Slabs slabs={plan.fillers} material={material} grain="up" courses={false} name="rim-corner-fillers"/>
  </group>;
}
