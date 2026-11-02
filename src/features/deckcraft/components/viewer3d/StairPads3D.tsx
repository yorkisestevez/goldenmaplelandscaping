import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import type {DeckData} from '../../types';
import type {DeckTakeoff} from '../../deckTakeoff';
import {stairPads} from '../../stairPads';
import {padPavers} from '../../stairPadPavers';
import {hardscapeAppearance} from './hardscapeAppearance';
import {setBoxInstance} from './instancing';

/** Permacon Melville's grey, shaded per paver the way the yard's pavers are (hardscapeAppearance). */
const PAVER_COLOUR=new THREE.Color('#9b968d');
/** Pavers stand this far proud of the lawn so the grass never shows through their tops. */
const PROUD_IN=.4;

/** The paver pad at the foot of each flight to the ground (stairPads.ts), one instanced paver per stone. Loaded on its
 * own (Deck3DViewer), so a design without a pad never downloads it. */
export default function StairPads3D({data,model}:{data:DeckData;model:DeckTakeoff}){
  const invalidate=useThree(s=>s.invalidate);
  const pavers=useMemo(()=>stairPads(data,model).flatMap(padPavers),[data,model]);
  const material=useMemo(()=>new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.92,metalness:0}),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  const ref=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{
    const mesh=ref.current;if(!mesh)return;
    const colour=new THREE.Color();
    pavers.forEach((p,i)=>{
      setBoxInstance(mesh,i,p.x,p.y+PROUD_IN,p.z,p.w,p.h,p.d,p.yaw);
      const shade=hardscapeAppearance({id:p.id,role:'paver'});
      mesh.setColorAt(i,colour.setRGB(PAVER_COLOUR.r*shade.r,PAVER_COLOUR.g*shade.g,PAVER_COLOUR.b*shade.b));
    });
    mesh.count=pavers.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();invalidate();
  },[pavers,invalidate]);
  if(!pavers.length)return null;
  return <instancedMesh name="stair-landing-pads" key={pavers.length} ref={ref} args={[undefined,undefined,pavers.length]} material={material} castShadow receiveShadow>
    <boxGeometry args={[1,1,1]}/>
  </instancedMesh>;
}
