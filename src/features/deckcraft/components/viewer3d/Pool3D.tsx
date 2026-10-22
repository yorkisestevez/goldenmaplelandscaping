import {hardscapeAppearance} from './hardscapeAppearance';
import {poolDepthSampler,NIGHT_WATER_OPTICS,WATER_OPTICS} from './waterOptics';
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
/** Recorded tint plus unmeasured generic mineral finish; never a claimed supplier scan.
 * Day keeps the clear outdoor surface. Night is a separate material: the same
 * calm ripples, a dark teal body, a faint panorama, and the glow of any underwater lights. */
/** An underwater light as the night water sees it: position (project inches) and the way its beam leaves the wall. */
export type PoolLamp={x:number;z:number;angle:number};
/** The most underwater lights one water surface glows from. */
export const MAX_POOL_LAMPS=8;
/** Glow the water carries from each underwater light: a warm core at the lens fading into a soft teal fan across the
 * pool (the light scattering in the water and off a light shell). Render-only coefficients, not photometry. */
export const POOL_LAMP_GLOW={teal:'#2bb5ad',tealStrength:.95,warm:'#ffdcae',warmStrength:.5,reachFt:8,spreadFt:1.6,fanPerFt:.6};
export function poolMaterial(part:Pick<PoolRenderMesh,'color'|'role'>,evening=false,lamps:PoolLamp[]=[],edgeWarmth=1){
  if(part.role==='water'){
   const night=evening?NIGHT_WATER_OPTICS:null,look=night??WATER_OPTICS,ripple=night?.ripple??([.008,.005,.002] as [number,number,number]);
   const m=new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:night?.roughness??.055,metalness:0,transparent:true,opacity:1,clearcoat:0,ior:1.333,depthWrite:false,envMapIntensity:night?.envMapIntensity??1,emissive:night?.emissive??'#000000',emissiveIntensity:night?.emissiveIntensity??0});
   const shallow=new THREE.Color(look.shallow),deep=new THREE.Color(look.deep);
   // Evaluate calm ripples per fragment in project feet. Geometry is never
   // displaced and demand rendering needs no timer or frame animation.
   const lit=night&&lamps.length?lamps.slice(0,MAX_POOL_LAMPS):[];
   const lampData=Array.from({length:MAX_POOL_LAMPS},(_,i)=>{const l=lit[i];return l?new THREE.Vector4(l.x/12,l.z/12,Math.sin(l.angle),Math.cos(l.angle)):new THREE.Vector4();});
   const teal=new THREE.Color(POOL_LAMP_GLOW.teal).multiplyScalar(POOL_LAMP_GLOW.tealStrength),warm=new THREE.Color(POOL_LAMP_GLOW.warm).multiplyScalar(POOL_LAMP_GLOW.warmStrength*edgeWarmth);
   addMaterialPatch(m,{key:night?(lit.length?'pool-depth-water-night-v3-lamps':'pool-depth-water-night-v2'):'pool-depth-water-v3',apply:s=>{
    s.uniforms.poolShallow={value:shallow};s.uniforms.poolDeep={value:deep};
    s.uniforms.poolLamp={value:lampData};s.uniforms.poolLampCount={value:lit.length};s.uniforms.poolLampTeal={value:teal};s.uniforms.poolLampWarm={value:warm};
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float poolDepth;varying float vPoolDepth;varying vec2 vPoolPosition;varying vec3 vPoolX,vPoolUp,vPoolZ;')
     .replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
vPoolDepth=poolDepth/12.;vPoolPosition=position.xz/12.;
vPoolX=normalize(normalMatrix*vec3(1.,0.,0.));vPoolUp=normalize(normalMatrix*vec3(0.,1.,0.));vPoolZ=normalize(normalMatrix*vec3(0.,0.,1.));`);
    s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nuniform vec3 poolShallow,poolDeep;varying float vPoolDepth;varying vec2 vPoolPosition;varying vec3 vPoolX,vPoolUp,vPoolZ;${lit.length?`\nuniform vec4 poolLamp[${MAX_POOL_LAMPS}];uniform int poolLampCount;uniform vec3 poolLampTeal,poolLampWarm;`:''}`)
     .replace('#include <color_fragment>',`#include <color_fragment>
float poolAbsorption=1.-exp(-${look.extinctionPerFt}*max(vPoolDepth,0.));
diffuseColor.rgb*=mix(poolShallow,poolDeep,poolAbsorption);
diffuseColor.a=mix(${look.minimumAlpha},${look.maximumAlpha},poolAbsorption);
${night?`float poolRipple=cos(dot(vPoolPosition,vec2(2.1,1.4)))*.65+cos(dot(vPoolPosition,vec2(-1.2,3.3))+1.7)*.35;
diffuseColor.rgb*=1.+poolRipple*.14;`:''}`)
     .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
float poolWaveA=cos(dot(vPoolPosition,vec2(2.1,1.4))),poolWaveB=cos(dot(vPoolPosition,vec2(-1.2,3.3))+1.7),poolWaveC=cos(dot(vPoolPosition,vec2(5.3,-2.2))+.8);
vec2 poolGradient=${ripple[0]}*vec2(2.1,1.4)*poolWaveA+${ripple[1]}*vec2(-1.2,3.3)*poolWaveB+${ripple[2]}*vec2(5.3,-2.2)*poolWaveC;
normal=normalize(vPoolUp-poolGradient.x*vPoolX-poolGradient.y*vPoolZ);`)
     .replace('#include <emissivemap_fragment>',night?`#include <emissivemap_fragment>
totalEmissiveRadiance*=1.+poolRipple*.22;${lit.length?`
vec3 poolLampGlow=vec3(0.);
for(int i=0;i<${MAX_POOL_LAMPS};i++){
 if(i>=poolLampCount)break;
 vec4 L=poolLamp[i];vec2 d=vPoolPosition-L.xy;
 float along=dot(d,L.zw),across=dot(d,vec2(-L.w,L.z)),ahead=max(along,0.);
 float width=${POOL_LAMP_GLOW.spreadFt.toFixed(2)}+ahead*${POOL_LAMP_GLOW.fanPerFt.toFixed(2)};
 float fan=exp(-across*across/(2.*width*width))*exp(-ahead/${POOL_LAMP_GLOW.reachFt.toFixed(1)})*smoothstep(-1.,.6,along);
 float core=exp(-dot(d,d)/1.6);
 poolLampGlow+=poolLampTeal*fan+poolLampWarm*core;
}
totalEmissiveRadiance+=poolLampGlow*(1.+poolRipple*.16);`:''}`:'#include <emissivemap_fragment>')
     .replace('#include <lights_fragment_end>',night?`#include <lights_fragment_end>
reflectedLight.indirectSpecular*=${night.mirrorScale};
reflectedLight.indirectDiffuse*=${night.ambientScale};
reflectedLight.directDiffuse*=${night.directScale};
reflectedLight.directSpecular*=${night.specularScale};`:'#include <lights_fragment_end>');
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
function PoolPart({parts,pool,evening,lamps,edgeWarmth=1}:{parts:PoolRenderMesh[];pool:PoolFeatureModel;evening:boolean;lamps:PoolLamp[];edgeWarmth?:number}){
 const part=parts[0];
 const quality=useRenderQuality(),geometry=useMemo(()=>{const positions:number[]=[],uv:number[]=[],depth:number[]=[],colors:number[]=[];const sample=poolDepthSampler(pool);for(const p of parts){const g=poolBufferGeometry(p,sample);positions.push(...g.getAttribute('position').array);uv.push(...g.getAttribute('uv').array);depth.push(...g.getAttribute('poolDepth').array);const finish=(p.role==='coping'||p.role==='collar')?hardscapeAppearance({id:p.name,unitId:p.stockId,role:'wall-cap'}):{r:1,g:1,b:1};for(let i=0;i<g.getAttribute('position').count;i++)colors.push(finish.r,finish.g,finish.b);g.dispose();}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('poolDepth',new THREE.Float32BufferAttribute(depth,1));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;},[parts,pool]);
 const lampKey=part.role==='water'?JSON.stringify(lamps):'';
 const material=useMemo(()=>poolMaterial(part,evening,part.role==='water'?lamps:[],edgeWarmth),[part.color,part.role,evening,lampKey,edgeWarmth]);useFixtureLit(material);
 useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
 return <mesh name={part.name} geometry={geometry} material={material} dispose={null} receiveShadow castShadow={part.role!=='water'&&quality.tier!=='constrained'} renderOrder={part.role==='water'?2:0} userData={{pickHardscape:{kind:'pool',id:part.poolId,part:part.role},pickPartId:'pool/'+part.poolId,poolId:part.poolId,poolRole:part.role,planning:part.planning,stockIds:parts.flatMap(p=>p.stockId?[p.stockId]:[]),physicalMeshNames:parts.map(p=>p.name),coversGround:false}}/>;
}
export default function Pool3D({pools,inspection=false,evening=false,lamps=[],edgeWarmth=1}:{pools:PoolFeatureModel[];inspection?:boolean;evening?:boolean;lamps?:PoolLamp[];edgeWarmth?:number}){
 const parts=useMemo(()=>pools.flatMap(poolRenderMeshes).filter(p=>inspection?p.role!=='water':['floor','wall','water','coping','setting-bed'].includes(p.role)),[pools,inspection]);
 const batches=useMemo(()=>{const groups=new Map<string,PoolRenderMesh[]>();for(const p of parts){const key=[p.poolId,p.role,p.color,p.planning].join('/'),g=groups.get(key)??[];g.push(p);groups.set(key,g);}return groups;},[parts]);
 return <group name="physical-pools" userData={{planningPoolIds:pools.filter(p=>p.status!=='ready').map(p=>p.config.id)}}>{[...batches].map(([key,parts])=><PoolPart key={key} parts={parts} pool={pools.find(p=>p.config.id===parts[0].poolId)!} evening={evening} lamps={lamps} edgeWarmth={edgeWarmth}/>)}</group>;
}
