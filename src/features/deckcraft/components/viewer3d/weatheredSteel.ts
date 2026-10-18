import * as THREE from 'three';
import {applyHardscapeFinish} from './hardscapeFinish';
import {addMaterialPatch} from './materialPatches';

/** Dark weathered steel edging: slightly rough, mottled where it has weathered. Raised-bed edging and the flush edging of
 * plain beds share it. */
export function weatheredSteelMaterial(){
 const material=applyHardscapeFinish(new THREE.MeshStandardMaterial({color:'#4a3b32',roughness:.78,metalness:.35,side:THREE.DoubleSide}));
 addMaterialPatch(material,{key:'weathered-steel-v1',apply:s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
diffuseColor.rgb*=.8+.28*mineralNoise(vMineralPosition/.6)+.08*mineralNoise(vMineralPosition/.08);`);}});
 return material;
}
