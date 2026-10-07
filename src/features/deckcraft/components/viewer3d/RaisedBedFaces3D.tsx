import {useEffect,useLayoutEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject,LandscapePoint} from '../../landscapeTypes';
import {raisedBedFaces} from '../../landscapeSurfaceGeometry';
import {yardWallPath} from '../../yardPathGeometry';
import {swatchUrl} from '../../lib/swatches';
import {useSwatchTexture} from './useSwatchTexture';
import {timberFaceGeometry} from './raisedBedTimber';
import {soilFaceMaterial} from './lawnSurface';
import {applyHardscapeFinish} from './hardscapeFinish';
import {addMaterialPatch} from './materialPatches';
import {useFixtureLit} from './fixtureLighting';

/** Weathered timber: the swatch a little darker and greyer, and a dark seam between courses. */
function weatherTimber(material:THREE.MeshStandardMaterial){
 material.side=THREE.DoubleSide;material.color.set('#cbbda9');
 addMaterialPatch(material,{key:'raised-bed-timber-v1',apply:s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
{float dcCourse=fract(vDcUv.y),dcSeam=fwidth(vDcUv.y);diffuseColor.rgb*=mix(.42,1.,smoothstep(dcSeam,.04+dcSeam,min(dcCourse,1.-dcCourse)));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.3,.59,.11))),.3);}`);}});
}
/** Dark weathered steel edging: slightly rough, mottled where it has weathered. */
function steelMaterial(){
 const material=applyHardscapeFinish(new THREE.MeshStandardMaterial({color:'#4a3b32',roughness:.78,metalness:.35,side:THREE.DoubleSide}));
 addMaterialPatch(material,{key:'weathered-steel-v1',apply:s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
diffuseColor.rgb*=.8+.28*mineralNoise(vMineralPosition/.6)+.08*mineralNoise(vMineralPosition/.08);`);}});
 return material;
}

/** A raised bed's soil face, or its timber or steel edging, where it stands over the ground; a linked wall's run is left
 * to the yard renderer. Loaded with the first raised bed. */
export default function RaisedBedFaces3D({data,object,polys}:{data:DeckData;object:LandscapeObject;polys:LandscapePoint[][]}){
 const kind=object.edge?.kind==='timber'||object.edge?.kind==='steel'?object.edge.kind:'soil',invalidate=useThree(s=>s.invalidate);
 const geometry=useMemo(()=>{
  const wall=object.edge?.kind==='wall'?data.yardFeatures?.find(f=>f.id===object.edge!.wallFeatureId&&f.kind==='retaining-wall'&&f.enabled):undefined;let path:{x:number;y:number}[]=[];try{path=wall?yardWallPath(wall):[];}catch{path=[];}
  const reach=wall?wall.depthFt*6+3:0,covered=path.length>1?(x:number,z:number)=>path.slice(1).some((b,i)=>{const a=path[i],dx=b.x-a.x,dz=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.y)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a.x-t*dx,z-a.y-t*dz)<=reach;}):undefined;
  const faces=raisedBedFaces(data,object,polys,covered);if(kind==='timber')return timberFaceGeometry(faces);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));if(faces.length)g.computeVertexNormals();return g;},[data,object,polys,kind]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const wood=useSwatchTexture(kind==='timber'?swatchUrl('wood-pressure-treated.jpg'):'','#8a7356');
 useLayoutEffect(()=>{if(kind==='timber'){weatherTimber(wood);invalidate();}},[wood,kind,invalidate]);
 const plain=useMemo(()=>kind==='steel'?steelMaterial():kind==='soil'?soilFaceMaterial():null,[kind]);
 useEffect(()=>()=>plain?.dispose(),[plain]);useFixtureLit(plain);
 return <mesh geometry={geometry} material={plain??wood} castShadow receiveShadow userData={{pickPartId:'landscape/'+object.id,landscapeIds:[object.id],raisedEdge:kind}}/>;
}
