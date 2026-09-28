import type * as THREE from 'three';

/**
 * Shader patches on built-in materials that compose: each patch edits the shader three is about to compile (append after
 * an include; never replace another patch's chunk), and the program cache key names every patch on the material, so
 * two materials share a program only when they carry the same patches. A material's own onBeforeCompile, if it had one,
 * runs first. Adding a patch the material already has does nothing.
 */
export interface MaterialPatch{key:string;apply:(shader:THREE.WebGLProgramParametersWithUniforms,renderer:THREE.WebGLRenderer)=>void}
const applied=new WeakMap<THREE.Material,MaterialPatch[]>();

export function addMaterialPatch(material:THREE.Material,patch:MaterialPatch){
  const list=applied.get(material);
  if(list){if(list.some(p=>p.key===patch.key))return;list.push(patch);material.needsUpdate=true;return;}
  const patches=[patch];applied.set(material,patches);
  const ownCompile=material.onBeforeCompile.bind(material),ownKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{ownCompile(shader,renderer);for(const p of patches)p.apply(shader,renderer);};
  material.customProgramCacheKey=()=>`${ownKey()}|${patches.map(p=>p.key).join('|')}`;
  material.needsUpdate=true;
}
export const materialPatchKeys=(material:THREE.Material)=>applied.get(material)?.map(p=>p.key)??[];
