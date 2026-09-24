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

/** Lattice openings as an alpha map (white = slat, black = open): slats at 45° both ways, one tile per 12 in. */
function latticeAlpha(){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d')!;
  g.fillStyle='#000';g.fillRect(0,0,64,64);g.strokeStyle='#fff';g.lineWidth=9;
  for(let k=-2;k<=4;k++){g.beginPath();g.moveTo(k*32,0);g.lineTo(k*32+64,64);g.stroke();g.beginPath();g.moveTo(k*32,64);g.lineTo(k*32+64,0);g.stroke();}
  const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.channel=1;tex.needsUpdate=true;return tex;
}

/**
 * One geometry for many skirting pieces, each a slab with its bottom and top at both ends (a trapezoid on a slope).
 * The first UV set follows the board: 48 in per swatch repeat along its grain and 0 to 1 across it (the grain runs up a
 * vertical board). The second, in world inches, carries the lattice's open pattern.
 */
function slabGeometry(slabs:SkirtingSlab[],grain:'along'|'up'){
  const pos:number[]=[],uv:number[]=[],uv1:number[]=[];
  for(const s of slabs){
    const dx=s.b.x-s.a.x,dz=s.b.y-s.a.y,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len,h=s.thick/2;
    const corner=(end:number,top:number,side:number)=>{
      const p=end?s.b:s.a,bottom=end?s.bottomB:s.bottomA,height=end?s.topB:s.topA,y=top?height:bottom,k=side?h:-h,x=p.x+s.out.x*k,z=p.y+s.out.y*k;
      pos.push(x,y,z);
      uv.push(...(grain==='along'?[end*len/48,top]:[y/48,end]));
      uv1.push((x*ux+z*uz)/12,y/12);
    };
    const quad=(c:[number,number,number][])=>{for(const i of [0,1,2,0,2,3])corner(...c[i]);};
    quad([[0,0,1],[1,0,1],[1,1,1],[0,1,1]]);quad([[1,0,0],[0,0,0],[0,1,0],[1,1,0]]);
    quad([[0,1,1],[1,1,1],[1,1,0],[0,1,0]]);quad([[0,0,0],[1,0,0],[1,0,1],[0,0,1]]);
    quad([[0,0,0],[0,0,1],[0,1,1],[0,1,0]]);quad([[1,0,1],[1,0,0],[1,1,0],[1,1,1]]);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv1,2));
  g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function Slabs({slabs,material,grain='along',name}:{slabs:SkirtingSlab[];material:THREE.Material;grain?:'along'|'up';name:string}){
  const geometry=useMemo(()=>slabGeometry(slabs,grain),[slabs,grain]),invalidate=useThree(s=>s.invalidate);
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
  useEffect(()=>{
    // Both sides draw (a thin slab seen from under the deck), and lattice lets the ground show through its openings.
    const alpha=lattice?latticeAlpha():null;
    face.side=THREE.DoubleSide;face.alphaMap=alpha;face.alphaTest=alpha?.5:0;face.needsUpdate=true;invalidate();
    return ()=>{face.alphaMap=null;face.alphaTest=0;face.needsUpdate=true;alpha?.dispose();};
  },[face,lattice,invalidate]);
  if(!plan)return null;
  return <group name="deck-skirting">{finished
    ?<><Slabs slabs={plan.faces} material={face} grain={plan.style==='Vertical boards'?'up':'along'} name="skirting-face"/><Slabs slabs={plan.frames} material={trim} name="skirting-access-panels"/></>
    :<><Slabs slabs={plan.backing} material={wood} name="skirting-backing"/><Slabs slabs={plan.frames} material={wood} name="skirting-access-frames"/></>}</group>;
}
