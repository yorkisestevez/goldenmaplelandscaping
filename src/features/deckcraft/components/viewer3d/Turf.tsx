import type {PoolFeatureModel} from '../../poolModel';
import {groundDisplayCuts,patioDisplayFootprints} from './finishedSurfaceGeometry';
import {useMemo,useEffect,useState,useRef,lazy,Suspense} from 'react';
import {useThree,useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import colorUrl from './assets/lawn-color.webp';
import normalUrl from './assets/lawn-normal.webp';
import roughnessUrl from './assets/lawn-roughness.webp';
if(typeof window!=='undefined'){for(const url of [colorUrl,normalUrl,roughnessUrl]){const img=new Image();img.decoding='async';img.src=url;}}
import {yardClip,type YardModel} from '../../yardModel';
import {GroundOcclusion,publishGroundOcclusion,type GroundBounds} from './groundOcclusion';
import {groundGeometry,groundEdgeGeometry,lawnMaterial,soilFaceMaterial} from './lawnSurface';
import {onShadowChange} from './renderPipeline';
import {useFixtureLit} from './fixtureLighting';
import {lawnTufts} from './lawnTufts';
import GrassBlades from './GrassBlades';
import {useRenderQuality} from './SceneRenderQuality';
import type {LandscapeObject} from '../../landscapeTypes';
import {landscapeBedAreas} from '../../landscapeModel';

// A patio's edge faces (dig, standing base, stone edge course) load only for a yard with a patio.
const PatioEdges3D=lazy(()=>import('./PatioEdges3D'));
/** The ground's shade waits this long after the last change to what casts before it redraws. */
const OCCLUSION_SETTLE_MS=250;

/**
 * Mown lawn (Real Life G3): a photoscan (Poly Haven leafy_grass, graded to a kept lawn by scripts/build-deck-textures.ts),
 * never visibly repeating (two offset lookups blended by noise, Inigo Quilez's technique 3), with gentle 30 ft and 8 ft
 * variation, fading to its mean colour in the distance. It runs past the yard to the horizon on
 * a far ring that flattens out, and small blades stand around the designed yard. The sky's light is shaded under what covers
 * it (groundOcclusion.ts).
 */
/** The lawn material with its scanned maps loaded (Turf's ground, and the graded ground behind a retaining wall). */
export function useLawnMaterial(){
 const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate),quality=useRenderQuality();
 const material=useMemo(lawnMaterial,[]);
 useFixtureLit(material);
 useEffect(()=>{let cancelled=false;const loaded:THREE.Texture[]=[];const loader=new THREE.TextureLoader();
   [colorUrl,normalUrl,roughnessUrl].forEach((url,index)=>loader.load(url,texture=>{if(cancelled){texture.dispose();return;}loaded.push(texture);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(quality.anisotropy,gl.capabilities.getMaxAnisotropy());texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
    if(index===0){texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;}else if(index===1)material.normalMap=texture;else material.roughnessMap=texture;material.needsUpdate=true;invalidate();
   }));return ()=>{cancelled=true;loaded.forEach(t=>t.dispose());material.map=null;material.normalMap=null;material.roughnessMap=null;};
 },[material,gl,invalidate,quality.anisotropy]);
 useEffect(()=>()=>material.dispose(),[material]);
 return material;
}

export default function Turf({width,depth,radius:_radius,yard,finished=true,landscapeObjects=[],pools=[]}:{width:number;depth:number;radius:number;yard:YardModel;finished?:boolean;landscapeObjects?:LandscapeObject[];pools?:PoolFeatureModel[]}){
 const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),invalidate=useThree(s=>s.invalidate),quality=useRenderQuality();
 const material=useLawnMaterial(),soil=useMemo(soilFaceMaterial,[]);
 useEffect(()=>()=>soil.dispose(),[soil]);
 // Finished grading closes construction excavations; pools and permanent water openings remain open.
 const cuts=useMemo(()=>groundDisplayCuts(yard,pools,finished),[yard,finished,pools]);
 const bounds=useMemo<GroundBounds>(()=>{const tw=yard.terrain.widthFt*12,td=yard.terrain.depthFt*12;const b=yard.siteSurface?.bounds,points=pools.flatMap(p=>p.excavationFootprints.flat()),xs=points.map(p=>p.x),zs=points.map(p=>p.y),minX=Math.min(width/2-tw/2,b?.minX??Infinity,...xs.map(x=>x-24)),minZ=Math.min(depth/2-td/2,b?.minZ??Infinity,...zs.map(z=>z-24)),maxX=Math.max(width/2+tw/2,b?.maxX??-Infinity,...xs.map(x=>x+24)),maxZ=Math.max(depth/2+td/2,b?.maxZ??-Infinity,...zs.map(z=>z+24));return {minX,minZ,width:maxX-minX,depth:maxZ-minZ};},[yard,width,depth,pools]);
 const geometry=useMemo(()=>groundGeometry(yard,cuts,width,depth,bounds,finished?'proposed':'existing'),[yard,cuts,width,depth,bounds,finished]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 // The survey perimeter is bridged in both views: a measured patch higher or lower than the illustrative
 // lawn otherwise leaves an open seam (sky shows through). The faces are display only, as in inspection.
 const edges=useMemo(()=>groundEdgeGeometry(yard,finished?'proposed':'existing',finished?[...pools.flatMap(p=>p.permanentExclusionFootprints),...patioDisplayFootprints(yard)]:pools.flatMap(p=>p.excavationFootprints),true,finished?patioDisplayFootprints(yard):[]),[yard,finished,pools]);
 useEffect(()=>()=>edges.dispose(),[edges]);
 // The sky's shade under what covers the ground, redrawn when that changes.
 const occlusion=useMemo(()=>new GroundOcclusion(),[]);
 useEffect(()=>{
   const redraw=()=>{occlusion.render(gl,scene,bounds);if(material.aoMap!==occlusion.texture){occlusion.texture.channel=1;material.aoMap=occlusion.texture;material.aoMapIntensity=.75;material.needsUpdate=true;}publishGroundOcclusion({texture:occlusion.texture,bounds});invalidate();};
   // Once edits settle (a drag changes what casts on every frame), then a frame of its own.
   let timer:ReturnType<typeof setTimeout>|undefined;
   const stop=onShadowChange(gl,()=>{clearTimeout(timer);timer=setTimeout(redraw,OCCLUSION_SETTLE_MS);});invalidate();
   return ()=>{stop();clearTimeout(timer);};
 },[occlusion,gl,scene,bounds,material,invalidate]);
 useEffect(()=>()=>{publishGroundOcclusion(null);material.aoMap=null;occlusion.dispose();},[occlusion,material]);
 const wallBanks=finished&&yard.features.some(f=>!f.excluded&&f.config.kind==='retaining-wall'),budget=Math.floor(quality.grassBudget*(wallBanks?.8:1)),bladeMasks=useMemo(()=>yardClip([...cuts,...yard.features.filter(f=>!f.excluded).flatMap(f=>f.footprints),...[...landscapeBedAreas(landscapeObjects).values()].flat().map(ring=>ring.map(p=>({x:p.x,y:p.z})))]),[cuts,yard,landscapeObjects]);
 const camera=useThree(s=>s.camera),[focus,setFocus]=useState<{x:number;z:number}|undefined>(),focusKey=useRef(''),cameraScratch=useMemo(()=>({p:new THREE.Vector3(),d:new THREE.Vector3()}),[]);
 useFrame(()=>{camera.getWorldPosition(cameraScratch.p);camera.getWorldDirection(cameraScratch.d);const {p,d}=cameraScratch,reach=Math.min(12,Math.max(0,p.y/Math.max(.25,-d.y))),x=Math.round((p.x+d.x*reach)/4)*48,z=Math.round((p.z+d.z*reach)/4)*48,close=Math.abs(p.y)<24,key=close?x+':'+z:'far';if(key!==focusKey.current){focusKey.current=key;setFocus(close?{x,z}:undefined);}});
 // Blades are the same set either way. Building them after the first frame keeps that frame from waiting on tens of thousands of tufts.
 const [bladesReady,setBladesReady]=useState(false);
 useEffect(()=>{let cancel=false,inner=0;const outer=requestAnimationFrame(()=>{inner=requestAnimationFrame(()=>{if(!cancel)setBladesReady(true);});});return()=>{cancel=true;cancelAnimationFrame(outer);cancelAnimationFrame(inner);};},[]);
 const tufts=useMemo(()=>bladesReady?lawnTufts(yard,width,depth,bladeMasks,budget,focus):[],[bladesReady,yard,width,depth,bladeMasks,budget,focus]);
 return <group name="textured-lawn">
  <mesh name="lawn-to-the-horizon" receiveShadow geometry={geometry}><primitive object={material} attach="material"/></mesh>
  {edges.getAttribute('position').count>0&&<mesh name={finished?"defined-grade-earth-faces":"survey-construction-cut-faces"} geometry={edges} material={soil} dispose={null} userData={{constructionInspection:!finished,measuredTransition:finished}} receiveShadow></mesh>}
  {/* Where a patio meets ground higher or lower than itself: the dig still to grade, its base left standing, or the
      stone edge course holding its raised side (PatioEdges3D.tsx; it draws nothing for a yard without plain paving). */}
  {finished&&yard.features.some(f=>f.config.kind==='patio')&&<Suspense fallback={null}><PatioEdges3D yard={yard} pools={pools} soil={soil}/></Suspense>}
  <GrassBlades tufts={tufts} budget={bladesReady?budget:0}/>
 </group>;
}
