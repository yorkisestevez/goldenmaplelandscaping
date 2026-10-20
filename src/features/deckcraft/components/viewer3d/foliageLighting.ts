import * as THREE from 'three';
import {addMaterialPatch} from './materialPatches';

/** Stable 0–1 hash so one species is not one flat colour across the bed. */
export function plantColorHash(id:string,salt=1){
 let h=2166136261^salt;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return ((h>>>0)%10000)/10000;
}
/** Species tint, shifted a little per plant: warmer or cooler, lighter or deeper. */
export function tintPlantInstance(color:THREE.Color,speciesTint:string,objectId:string){
 color.set(speciesTint);
 const u=plantColorHash(objectId,3),v=plantColorHash(objectId,9);
 color.offsetHSL((u-.5)*.05,(v-.5)*.1,(u-.5)*.08);
 return color;
}
/** The light-through-the-leaf switch of a leaf material (1 on, 0 off), shared by every program it compiles to. */
export function leafTransmitUniform(material:THREE.Material):{value:number}{
 const data=material.userData as {leafTransmit?:{value:number}};
 return data.leafTransmit??=({value:1});
}
/** Leaf cards: alpha-tested atlases, plus the fern, whose GLB has no texture. */
export const isLeafMaterial=(material:THREE.Material)=>{const m=material as THREE.MeshStandardMaterial;return m.alphaTest>0||/fern/i.test(m.name);};
/** Honest summer foliage. Real leaves are matte (roughness about 0.6) and pass light through: about as much reaches the
 * shaded side as a leaf reflects, a little yellower. */
export const FOLIAGE={roughness:.66,transmit:[.85,.95,.55] as [number,number,number],mipAlpha:.22};
/** Crown lean from this bend up keeps the outward normal on both faces of a card. */
const CROWN_KEEP_FACE=.3;
/** How far card normals lean out of the crown: canopies and mounds read as volumes; blades and fronds stay mostly flat. */
export const crownBend=(assetId:string)=>/grass|fern/.test(assetId)?.2:.6;
/**
 * Summer leaves, v2. The atlas colour is used as it is (no lift). The roughness and normal maps go: on cards they read
 * as glossy glints, not leaves. Each card's normal leans out from the crown centre, so a canopy shades as a volume, and
 * the lean is kept on both faces of a card. Every direct light, already shadowed, also passes through the leaf to its
 * other side; this goes in before the diffuse sum, so it renders. Alpha is raised a little in distant mips so thin
 * canopies and needles do not dissolve. Light through the leaf comes from the sun only, and only where the leaf casts
 * its own shadow. Bark and trunks are left alone.
 */
/** crown.outAttribute: each instance carries its own outward direction (aCrownOut, in the card's own frame) in place of
 * the crown centre, for plants whose every leaf is an instance (the hydrangea models). */
export function applyFoliageLighting(material:THREE.Material,crown?:{center:THREE.Vector3;bend:number;outAttribute?:boolean}){
 const standard=material as THREE.MeshStandardMaterial;
 if(!isLeafMaterial(standard))return;
 standard.roughness=FOLIAGE.roughness;standard.roughnessMap=null;standard.normalMap=null;standard.metalness=0;
 const center=crown?.center.clone()??new THREE.Vector3(),bend=crown?.bend??0,perLeaf=!!crown?.outAttribute,[tr,tg,tb]=FOLIAGE.transmit;
 // Light through the leaf needs the leaf's own shadow to be right, so it is on only while this part casts shadows
 // (Landscape3D turns it off for LOD2 and the constrained tier).
 const transmit=leafTransmitUniform(material);
 addMaterialPatch(material,{key:(bend>=CROWN_KEEP_FACE?'foliage-summer-v2-crown':'foliage-summer-v2')+(perLeaf?'-instanced':''),apply(shader){
  shader.uniforms.uCrownCenter={value:center};shader.uniforms.uCrownBend={value:bend};shader.uniforms.uLeafTransmit=transmit;
  shader.vertexShader=`uniform vec3 uCrownCenter;
uniform float uCrownBend;
${perLeaf?'attribute vec3 aCrownOut;\n':''}`+shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
{ vec3 leafOut=${perLeaf?'aCrownOut':'position-uCrownCenter'}; if(dot(leafOut,leafOut)>1e-8)objectNormal=normalize(mix(objectNormal,normalize(leafOut),uCrownBend)); }`);
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <map_fragment>',`#include <map_fragment>
#if defined( USE_MAP ) && defined( USE_ALPHATEST )
{ vec2 leafTexel=vMapUv*vec2(textureSize(map,0));
 float leafLod=0.5*log2(max(max(dot(dFdx(leafTexel),dFdx(leafTexel)),dot(dFdy(leafTexel),dFdy(leafTexel))),1e-8));
 diffuseColor.a*=1.0+max(0.0,leafLod)*${FOLIAGE.mipAlpha.toFixed(2)}; }
#endif`)
   // A crown-bent normal points out of the canopy on both faces of a card; flipping it for the back face would turn half
   // the canopy inside out. A leaf on the far side of the crown, seen through a gap, has its normal mirrored into the view
   // side (not clamped, which three would shade at full grazing sheen). Blades and fronds keep the usual two-sided flip.
   .replace('#include <normal_fragment_begin>',bend>=CROWN_KEEP_FACE?`#include <normal_fragment_begin>
#ifndef FLAT_SHADED
normal=normalize(vNormal);
{ vec3 leafView=isOrthographic?vec3(0.0,0.0,1.0):normalize(vViewPosition); float leafNV=dot(normal,leafView); if(leafNV<0.0)normal=normalize(normal-2.0*leafNV*leafView); }
nonPerturbedNormal=normal;
#endif`:'#include <normal_fragment_begin>')
   .replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
uniform float uLeafTransmit;
void RE_Direct_Leaf(const in IncidentLight directLight,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){
 RE_Direct_Physical(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
 #if NUM_DIR_LIGHTS > 0
 // The sun only: fixture lights and the golden-hour rim carry no leaf shadow, so their light would glow through the crown.
 if(uLeafTransmit>0.0&&dot(directLight.direction,directionalLights[0].direction)>0.9999)reflectedLight.directDiffuse+=uLeafTransmit*directLight.color*saturate(dot(-geometryNormal,directLight.direction))*BRDF_Lambert(material.diffuseColor)*vec3(${tr.toFixed(2)},${tg.toFixed(2)},${tb.toFixed(2)});
 #endif
}
#undef RE_Direct
#define RE_Direct RE_Direct_Leaf`);
 }});
}
/** Flower heads stay their own colour in shade. No green multiply, so purple and gold are not pushed toward leaf. */
export function applyBloomLighting(material:THREE.Material){
 addMaterialPatch(material,{key:'bloom-lift-v1',apply(shader){
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`reflectedLight.indirectDiffuse+=diffuseColor.rgb*0.42;
#if NUM_DIR_LIGHTS > 0
 reflectedLight.directSpecular+=vec3(1.0,0.9,0.7)*pow(saturate(dot(normal,directionalLights[0].direction)),2.0)*0.12;
#endif
#include <opaque_fragment>`);
 }});
}
/** Linear luminance of a leaf atlas's opaque texels, measured once per texture: the recolour keeps each leaf's own light
 * and dark against it, so a fall leaf is as detailed as a summer one. */
const atlasLuminance=new WeakMap<THREE.Texture,number>();
const toLinear=(c:number)=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
export function leafAtlasLuminance(material:THREE.Material){
 const standard=material as THREE.MeshStandardMaterial,map=standard.map,base=standard.color??new THREE.Color(1,1,1);
 const plain=.2126*base.r+.7152*base.g+.0722*base.b;
 const image=map?.image as CanvasImageSource&{width?:number;height?:number}|undefined;
 if(!map||!image||typeof document==='undefined')return Math.max(.02,plain);
 const known=atlasLuminance.get(map);if(known!==undefined)return Math.max(.02,known*plain);
 let sum=0,count=0;
 try{
  const size=32,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const g=canvas.getContext('2d',{willReadFrequently:true})!;g.drawImage(image,0,0,size,size);
  const px=g.getImageData(0,0,size,size).data;
  for(let i=0;i<px.length;i+=4)if(px[i+3]>128){sum+=.2126*toLinear(px[i]/255)+.7152*toLinear(px[i+1]/255)+.0722*toLinear(px[i+2]/255);count++;}
 }catch{/* an image the canvas cannot read: treat the atlas as mid-grey */}
 // The texture's own mean is cached; each material scales it by its own colour.
 const mean=count?sum/count:.18;atlasLuminance.set(map,mean);return Math.max(.02,mean*plain);
}
/** How much a recoloured canopy varies leaf to leaf: fall mixes red, orange and yellow; spring and winter barely vary. */
export const SEASON_VARIETY={fall:1,spring:.35,winter:.25,summer:0} as const;
/**
 * Seasonal leaves on a summer atlas. The leaf's own luminance, relative to its atlas, keeps its detail; its colour then
 * comes from the instance colour (the season's leaf colour for that species). Patches of the atlas lean warmer or cooler,
 * so a fall maple is not one flat orange. Summer materials never carry this patch.
 */
export function applyLeafRecolor(material:THREE.Material,variety:number){
 const lum={value:leafAtlasLuminance(material)},mix={value:variety};
 addMaterialPatch(material,{key:'foliage-season-v1',apply(shader){
  shader.uniforms.uLeafLum=lum;shader.uniforms.uSeasonVariety=mix;
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',`#include <common>
uniform float uLeafLum;
uniform float uSeasonVariety;`)
   .replace('#include <color_fragment>',`{ float leafL=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 vec3 leafTone=vec3(mix(1.0,clamp(leafL/uLeafLum,0.0,2.2),.85));
#ifdef USE_MAP
 float leafPatch=fract(sin(dot(floor(vMapUv*7.0),vec2(12.9898,78.233)))*43758.5453);
 leafTone*=mix(vec3(1.0),mix(vec3(1.12,.78,.62),vec3(.9,1.1,1.18),leafPatch),uSeasonVariety);
#endif
 diffuseColor.rgb=leafTone; }
#include <color_fragment>`);
 }});
}
