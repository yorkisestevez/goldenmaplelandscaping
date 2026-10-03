import {hardscapeAppearance} from './hardscapeAppearance';
import {poolDepthSampler,WATER_OPTICS} from './waterOptics';
import {applyHardscapeFinish} from './hardscapeFinish';
import {addMaterialPatch} from './materialPatches';
import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import type {PoolFeatureModel} from '../../poolModel';
import {poolRenderMeshes,type PoolRenderMesh} from '../../poolRenderMeshes';
import {useFixtureLit} from './fixtureLighting';
import {useRenderQuality} from './SceneRenderQuality';
import {yardFinishGeometry} from './yardFinishGeometry';
import {applyWallDaylight} from './wallDaylight';
/** Physical vertices stay in project inches, inside the existing inch-scaled scene group. */
export function poolBufferGeometry(mesh:PoolRenderMesh,depthAt?:(x:number,z:number)=>number|null){
 if(mesh.role==='coping'&&mesh.vertices.length===8&&mesh.vertices.slice(4).every((p,i,ring)=>{const a=ring[(i+3)%4],b=ring[(i+1)%4];return Math.abs((a.x-p.x)*(b.x-p.x)+(a.z-p.z)*(b.z-p.z))<.00001*Math.hypot(a.x-p.x,a.z-p.z)*Math.hypot(b.x-p.x,b.z-p.z);})){ 
  // Relief applies to rectangular stock; arbitrary cut polygons retain their
  // physical faces rather than letting a bevel expand an acute cut corner.
  // Edge relief is inside the stock envelope; ordering, physical exports and
  // the recorded coping top retain their exact nominal geometry.
  const top=mesh.vertices.slice(mesh.vertices.length/2),xs=top.map(p=>p.x),zs=top.map(p=>p.z),ys=mesh.vertices.map(p=>p.y),lo=Math.min(...ys),hi=Math.max(...ys),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);
  const g=yardFinishGeometry({id:mesh.name,featureId:mesh.poolId,role:'wall-cap',color:mesh.color,x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2,y:(lo+hi)/2,w,d,h:hi-lo,polygon:top.map(p=>({x:p.x,y:p.z}))});
  const p=g.getAttribute('position'),uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)/24;uv[i*2+1]=p.getZ(i)/24;}g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('poolDepth',new THREE.Float32BufferAttribute(new Float32Array(p.count),1));g.computeBoundingSphere();return g;
 }
 const positions:number[]=[],uv:number[]=[],depth:number[]=[];
 for(const f of mesh.faces)for(let i=1;i+1<f.length;i++)for(const index of [f[0],f[i],f[i+1]]){const p=mesh.vertices[index];positions.push(p.x,p.y,p.z);uv.push(p.x/24,p.z/24);depth.push(mesh.role==='water'?depthAt?.(p.x,p.z)??0:0);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('poolDepth',new THREE.Float32BufferAttribute(depth,1));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
/** Recorded tint plus unmeasured generic mineral finish; never a claimed supplier scan. */
export function poolMaterial(part:Pick<PoolRenderMesh,'color'|'role'>){
  if(part.role==='water'){
   const m=new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.055,metalness:0,transparent:true,opacity:1,clearcoat:0,ior:1.333,depthWrite:false});
   const shallow=new THREE.Color(WATER_OPTICS.shallow),deep=new THREE.Color(WATER_OPTICS.deep);
   // Evaluate calm ripples per fragment in project feet. Geometry is never
   // displaced and demand rendering needs no timer or frame animation.
   addMaterialPatch(m,{key:'pool-depth-water-v3',apply:s=>{
    s.uniforms.poolShallow={value:shallow};s.uniforms.poolDeep={value:deep};
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float poolDepth;varying float vPoolDepth;varying vec2 vPoolPosition;varying vec3 vPoolX,vPoolUp,vPoolZ;')
     .replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
vPoolDepth=poolDepth/12.;vPoolPosition=position.xz/12.;
vPoolX=normalize(normalMatrix*vec3(1.,0.,0.));vPoolUp=normalize(normalMatrix*vec3(0.,1.,0.));vPoolZ=normalize(normalMatrix*vec3(0.,0.,1.));`);
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 poolShallow,poolDeep;varying float vPoolDepth;varying vec2 vPoolPosition;varying vec3 vPoolX,vPoolUp,vPoolZ;')
     .replace('#include <color_fragment>',`#include <color_fragment>
float poolAbsorption=1.-exp(-${WATER_OPTICS.extinctionPerFt}*max(vPoolDepth,0.));
diffuseColor.rgb*=mix(poolShallow,poolDeep,poolAbsorption);
diffuseColor.a=mix(${WATER_OPTICS.minimumAlpha},${WATER_OPTICS.maximumAlpha},poolAbsorption);`)
     .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
float poolWaveA=cos(dot(vPoolPosition,vec2(2.1,1.4))),poolWaveB=cos(dot(vPoolPosition,vec2(-1.2,3.3))+1.7),poolWaveC=cos(dot(vPoolPosition,vec2(5.3,-2.2))+.8);
vec2 poolGradient=.008*vec2(2.1,1.4)*poolWaveA+.005*vec2(-1.2,3.3)*poolWaveB+.002*vec2(5.3,-2.2)*poolWaveC;
normal=normalize(vPoolUp-poolGradient.x*vPoolX-poolGradient.y*vPoolZ);`);
   }});return m;
  }
  const m=new THREE.MeshStandardMaterial({color:part.color,vertexColors:true,roughness:part.role==='floor'||part.role==='wall'?.27:.86,metalness:0,side:THREE.DoubleSide});
  if(part.role==='coping'||part.role==='collar'){
   applyWallDaylight(m);
   applyHardscapeFinish(m);
   addMaterialPatch(m,{key:'pool-mineral-color-normal-v1',apply:shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 poolGrainCell=vMineralPosition/.035;
float poolGrainFootprint=max(length(dFdx(poolGrainCell)),length(dFdy(poolGrainCell)));
float poolGrainWeight=1.-smoothstep(.5,2.,poolGrainFootprint);
float poolGrain=mineralNoise(poolGrainCell);
diffuseColor.rgb*=1.+(poolGrain-.5)*.035*poolGrainWeight;`)
     .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 poolDx=dFdx(-vViewPosition),poolDy=dFdy(-vViewPosition);
vec3 poolR1=cross(poolDy,normal),poolR2=cross(normal,poolDx);
float poolDet=dot(poolDx,poolR1);
if(abs(poolDet)>1e-10)normal=normalize(abs(poolDet)*normal-.00008*sign(poolDet)*(dFdx(poolGrain)*poolR1+dFdy(poolGrain)*poolR2)*poolGrainWeight);`);
   }});
  }
  return m;

}
function PoolPart({parts,pool}:{parts:PoolRenderMesh[];pool:PoolFeatureModel}){
 const part=parts[0];
 const quality=useRenderQuality(),geometry=useMemo(()=>{const positions:number[]=[],uv:number[]=[],depth:number[]=[],colors:number[]=[];const sample=poolDepthSampler(pool);for(const p of parts){const g=poolBufferGeometry(p,sample);positions.push(...g.getAttribute('position').array);uv.push(...g.getAttribute('uv').array);depth.push(...g.getAttribute('poolDepth').array);const finish=(p.role==='coping'||p.role==='collar')?hardscapeAppearance({id:p.name,unitId:p.stockId,role:'wall-cap'}):{r:1,g:1,b:1};for(let i=0;i<g.getAttribute('position').count;i++)colors.push(finish.r,finish.g,finish.b);g.dispose();}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('poolDepth',new THREE.Float32BufferAttribute(depth,1));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;},[parts,pool]);
 const material=useMemo(()=>poolMaterial(part),[part.color,part.role]);useFixtureLit(material);
 useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
 return <mesh name={part.name} geometry={geometry} material={material} dispose={null} receiveShadow castShadow={part.role!=='water'&&quality.tier!=='constrained'} renderOrder={part.role==='water'?2:0} userData={{pickHardscape:{kind:'pool',id:part.poolId,part:part.role},pickPartId:'pool/'+part.poolId,poolId:part.poolId,poolRole:part.role,planning:part.planning,stockIds:parts.flatMap(p=>p.stockId?[p.stockId]:[]),physicalMeshNames:parts.map(p=>p.name),coversGround:false}}/>;
}
export default function Pool3D({pools,inspection=false}:{pools:PoolFeatureModel[];inspection?:boolean}){
 const parts=useMemo(()=>pools.flatMap(poolRenderMeshes).filter(p=>inspection?p.role!=='water':['floor','wall','water','coping','setting-bed'].includes(p.role)),[pools,inspection]);
 const batches=useMemo(()=>{const groups=new Map<string,PoolRenderMesh[]>();for(const p of parts){const key=[p.poolId,p.role,p.color,p.planning].join('/'),g=groups.get(key)??[];g.push(p);groups.set(key,g);}return groups;},[parts]);
 return <group name="physical-pools" userData={{planningPoolIds:pools.filter(p=>p.status!=='ready').map(p=>p.config.id)}}>{[...batches].map(([key,parts])=><PoolPart key={key} parts={parts} pool={pools.find(p=>p.config.id===parts[0].poolId)!}/>)}</group>;
}
