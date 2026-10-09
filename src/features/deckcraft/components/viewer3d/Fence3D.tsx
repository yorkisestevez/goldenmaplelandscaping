import {useLayoutEffect,useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {isObjectVisible} from '../../editorOrganization';
import {fenceSolids,type FenceSolid,type FenceSurface} from '../../fenceTypes';
import {sampleSiteHeight} from '../../siteSurface';
import type {DeckData} from '../../types';

function grain(){
  const n=128,bytes=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const band=.62+.38*Math.sin(y*.42+Math.sin(x*.07)*2),speck=(Math.abs(Math.sin(x*12.1+y*3.7))*43758.5453)%1;
    const v=Math.max(0,Math.min(1,band*.85+speck*.15)),i=(y*n+x)*4;
    bytes[i]=bytes[i+1]=bytes[i+2]=v*255;bytes[i+3]=255;
  }
  const t=new THREE.DataTexture(bytes,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;return t;
}
const CEDAR_GRAIN=grain();

function piece(s:FenceSolid){
  const g=s.role==='collar'?new THREE.CylinderGeometry(s.w/2,s.w/2,s.h,16):new THREE.BoxGeometry(s.w,s.h,s.d);
  if(s.role!=='collar')g.rotateY(s.angle);
  g.translate(s.x,s.y,s.z);
  const c=new THREE.Color(s.color).multiplyScalar(s.shade),n=g.getAttribute('position').count,colors=new Float32Array(n*3);
  for(let i=0;i<n;i++){colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  return g;
}
function merged(items:FenceSolid[]){
  if(!items.length)return null;
  const g=mergeGeometries(items.map(piece),false);
  g.computeVertexNormals();
  return g;
}

const SURFACES:FenceSurface[]=['cedar','composite','metal','glass','concrete'];

/** Freestanding fence, in the viewer's inch group (the parent scales by 1/12). */
export default function Fence3D({data}:{data:DeckData}){
  const solids=useMemo(()=>fenceSolids((data.fences??[]).filter(f=>f.enabled&&isObjectVisible(data.editorOrganization,f.id)),(x,z)=>{try{return sampleSiteHeight(data,x,z);}catch{return 0;}}),[data]);
  const groups=useMemo(()=>SURFACES.map(surface=>({surface,geometry:merged(solids.filter(s=>s.surface===surface))})),[solids]);
  useLayoutEffect(()=>()=>{for(const g of groups)g.geometry?.dispose();},[groups]);
  return <group name="fence">
    {groups.map(({surface,geometry})=>geometry&&<mesh key={surface} geometry={geometry} castShadow={surface!=='glass'} receiveShadow={surface!=='glass'}>
      {surface==='glass'
        ?<meshPhysicalMaterial vertexColors color="#d7e8ea" roughness={.08} metalness={0} transmission={.65} thickness={.5} ior={1.5} transparent opacity={.55} side={THREE.DoubleSide} depthWrite={false}/>
        :<meshStandardMaterial vertexColors roughness={surface==='metal'?.4:surface==='composite'?.55:surface==='concrete'?.92:.72} metalness={surface==='metal'?.82:0} bumpMap={surface==='cedar'?CEDAR_GRAIN:undefined} bumpScale={surface==='cedar'?.35:0}/>}
    </mesh>)}
  </group>;
}
