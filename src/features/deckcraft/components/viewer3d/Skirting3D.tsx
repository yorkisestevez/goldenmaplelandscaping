import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import type {DeckData} from '../../types';
import type {DeckTakeoff} from '../../deckTakeoff';
import {skirtingPlan,type SkirtingSlab} from '../../skirting';
import {parseColourRef} from '../../boardFinishes';
import {swatchUrl} from '../../lib/swatches';
import {getMaterialFallbackColor} from '../../lib/deckGeometry';
import {useSwatchTexture} from './useSwatchTexture';
import {useFixtureLit} from './fixtureLighting';
import {slabGeometry} from './slabGeometry';

/** Lattice openings as an alpha map (white = slat, black = open): slats at 45° both ways, one tile per 12 in. */
function latticeAlpha(){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d')!;
  g.fillStyle='#000';g.fillRect(0,0,64,64);g.strokeStyle='#fff';g.lineWidth=9;
  for(let k=-2;k<=4;k++){g.beginPath();g.moveTo(k*32,0);g.lineTo(k*32+64,64);g.stroke();g.beginPath();g.moveTo(k*32,64);g.lineTo(k*32+64,0);g.stroke();}
  const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.channel=1;tex.needsUpdate=true;return tex;
}

export function Slabs({slabs,material,grain='along',courses=true,eased=false,name}:{slabs:SkirtingSlab[];material:THREE.Material;grain?:'along'|'up';courses?:boolean;eased?:boolean;name:string}){
  const geometry=useMemo(()=>slabGeometry(slabs,grain,courses,eased),[slabs,grain,courses,eased]),invalidate=useThree(s=>s.invalidate);
  useEffect(()=>{invalidate();return ()=>geometry.dispose();},[geometry,invalidate]);
  return slabs.length?<mesh name={name} geometry={geometry} material={material} castShadow receiveShadow/>:null;
}

/**
 * Skirting under the deck (skirting.ts). The finished views show its face, in its product colour, with the trim round
 * each access panel; the framing and below-ground views hide the face and show the 2×4 backing instead.
 */
export default function Skirting3D({data,model,finished,wood}:{data:DeckData;model:DeckTakeoff;finished:boolean;wood:THREE.Material}){
  const plan=useMemo(()=>skirtingPlan(data,model),[data,model]);
  const parsed=plan?parseColourRef(plan.colour):null,lattice=plan?.style==='Lattice',invalidate=useThree(s=>s.invalidate);
  const face=useSwatchTexture(parsed?swatchUrl(parsed.color.swatch):'',getMaterialFallbackColor(parsed?.material.id??''));
  const trim=useMemo(()=>new THREE.MeshStandardMaterial({color:'#3a342d',roughness:.75}),[]);
  useEffect(()=>()=>trim.dispose(),[trim]);
  useFixtureLit(trim);
  useEffect(()=>{
    // Both sides draw (a thin slab seen from under the deck), and lattice lets the ground show through its openings.
    const alpha=lattice?latticeAlpha():null;
    face.side=THREE.DoubleSide;face.alphaMap=alpha;face.alphaTest=alpha?.5:0;face.needsUpdate=true;invalidate();
    face.normalScale.set(.4,.4);
    return ()=>{face.alphaMap=null;face.alphaTest=0;face.needsUpdate=true;alpha?.dispose();};
  },[face,lattice,invalidate]);
  if(!plan)return null;
  return <group name="deck-skirting">{finished
    ?<><Slabs slabs={plan.faces} material={face} grain={plan.style==='Vertical boards'?'up':'along'} courses={false} name="skirting-face"/><Slabs slabs={plan.frames} material={trim} name="skirting-access-panels"/><Slabs slabs={plan.corners} material={face} grain="up" courses={false} name="skirting-corner-trim"/></>
    :<><Slabs slabs={plan.backing} material={wood} name="skirting-backing"/><Slabs slabs={plan.frames} material={wood} name="skirting-access-frames"/></>}</group>;
}
