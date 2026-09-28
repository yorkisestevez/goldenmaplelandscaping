import {useMemo,useEffect,useRef,useLayoutEffect} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import colorUrl from './assets/lawn-color.webp';
import normalUrl from './assets/lawn-normal.webp';
import roughnessUrl from './assets/lawn-roughness.webp';
import {yardClip,type YardModel} from '../../yardModel';
import {GroundOcclusion,publishGroundOcclusion,type GroundBounds} from './groundOcclusion';
import {LAWN_MEAN,groundGeometry,lawnMaterial} from './lawnSurface';
import {onShadowChange} from './renderPipeline';
import {useFixtureLit,useFixtureLitRef} from './fixtureLighting';

/** The ground's shade waits this long after the last change to what casts before it redraws. */
const OCCLUSION_SETTLE_MS=250;

/**
 * Mown lawn (Real Life G3): a photoscan (Poly Haven leafy_grass, graded to a kept lawn by scripts/build-deck-textures.ts),
 * never visibly repeating (two offset lookups blended by noise, Inigo Quilez's technique 3), with gentle 30 ft and 8 ft
 * variation and the odd drier patch, fading to its mean colour in the distance. It runs past the yard to the horizon on
 * a far ring that flattens out, and small blades stand in it near the deck. The sky's light is shaded under what covers
 * it (groundOcclusion.ts).
 */
/** The lawn material with its scanned maps loaded (Turf's ground, and the graded ground behind a retaining wall). */
export function useLawnMaterial(){
 const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate);
 const material=useMemo(lawnMaterial,[]);
 useFixtureLit(material);
 useEffect(()=>{let cancelled=false;const loaded:THREE.Texture[]=[];const loader=new THREE.TextureLoader();
   [colorUrl,normalUrl,roughnessUrl].forEach((url,index)=>loader.load(url,texture=>{if(cancelled){texture.dispose();return;}loaded.push(texture);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(16,gl.capabilities.getMaxAnisotropy());texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
    if(index===0){texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;}else if(index===1)material.normalMap=texture;else material.roughnessMap=texture;material.needsUpdate=true;invalidate();
   }));return ()=>{cancelled=true;loaded.forEach(t=>t.dispose());material.map=null;material.normalMap=null;material.roughnessMap=null;};
 },[material,gl,invalidate]);
 useEffect(()=>()=>material.dispose(),[material]);
 return material;
}

export default function Turf({width,depth,radius:_radius,yard,finished=true}:{width:number;depth:number;radius:number;yard:YardModel;finished?:boolean}){
 const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),invalidate=useThree(s=>s.invalidate),ref=useRef<THREE.InstancedMesh>(null);
 const material=useLawnMaterial(),litBlades=useFixtureLitRef();
 // The lawn opens over each excavation. Once the job is done a retaining wall's trench is backfilled and turfed (its
 // bank is Yard3D's), so the finished views keep the lawn there; the construction views show the trench.
 const cuts=useMemo(()=>{const walls=new Set(yard.features.filter(f=>f.config.kind==='retaining-wall').map(f=>f.config.id));return yardClip(yard.excavationRegions.filter(e=>!finished||!walls.has(e.featureId)).map(e=>e.polygon));},[yard,finished]);
 const bounds=useMemo<GroundBounds>(()=>{const tw=yard.terrain.widthFt*12,td=yard.terrain.depthFt*12;return {minX:width/2-tw/2,minZ:depth/2-td/2,width:tw,depth:td};},[yard,width,depth]);
 const geometry=useMemo(()=>groundGeometry(yard,cuts,width,depth,bounds),[yard,cuts,width,depth,bounds]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
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
 const count=18000;
 // Blades darken toward the root (vertex colour), in the lawn's own green.
 const blade=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.1,0,0,.1,0,0,.14,1,0,0,0,-.1,0,0,.1,0,1,.14],3));g.setAttribute('color',new THREE.Float32BufferAttribute([.55,.55,.55,.55,.55,.55,1,1,1,.55,.55,.55,.55,.55,.55,1,1,1],3));g.computeVertexNormals();return g;},[]);
 useEffect(()=>()=>blade.dispose(),[blade]);
 useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion();let seed=317;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let used=0;
  for(let i=0;i<count;i++){const x=-width*.7+random()*width*2.4,z=-18+random()*(depth+width*.8),h=.45+random()*.8;let inside=false;for(const poly of cuts){let hit=false;for(let a=0,b=poly.length-1;a<poly.length;b=a++){const p=poly[a],q=poly[b];if((p.y>z)!==(q.y>z)&&x<(q.x-p.x)*(z-p.y)/(q.y-p.y)+p.x)hit=!hit;}if(hit)inside=!inside;}if(inside)continue;q.setFromAxisAngle(new THREE.Vector3(0,1,0),random()*Math.PI*2);m.compose(new THREE.Vector3(x,yard.terrain.elevationIn+z*yard.terrain.slopePct/100-.55,z),q,new THREE.Vector3(.75+random(),h,.75+random()));ref.current.setMatrixAt(used,m);const shade=1.5+random()*.7;ref.current.setColorAt(used,new THREE.Color(LAWN_MEAN[0]*shade,LAWN_MEAN[1]*shade,LAWN_MEAN[2]*shade));used++;}
  ref.current.count=used;ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();
 },[width,depth,invalidate,yard,cuts]);
 return <group name="textured-lawn">
  <mesh name="lawn-to-the-horizon" receiveShadow geometry={geometry}><primitive object={material} attach="material"/></mesh>
  <instancedMesh name="close-view-grass-blades" ref={ref} args={[blade,undefined,count]} receiveShadow><meshStandardMaterial ref={litBlades} color="#ffffff" vertexColors roughness={.95} side={THREE.DoubleSide}/></instancedMesh>
 </group>;
}
