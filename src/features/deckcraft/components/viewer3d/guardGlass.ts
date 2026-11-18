import * as THREE from 'three';

/** Clear low-iron guard glass. Distances are inches, converted by the scene's 1/12 scale. */
export const GUARD_GLASS={ior:1.52,roughness:.018,thicknessIn:.5};
export function guardGlass(){
  const material=new THREE.MeshPhysicalMaterial({
    color:'#000000',metalness:0,transmission:0,ior:GUARD_GLASS.ior,
    roughness:GUARD_GLASS.roughness,thickness:GUARD_GLASS.thicknessIn,
    attenuationColor:'#effaf3',attenuationDistance:1200,transparent:true,opacity:1,
    depthWrite:false,envMapIntensity:.25,premultipliedAlpha:true,
  });
  material.userData.photoRole='glass';
  // Thin flat panes barely bend the view. Blend the physical Fresnel reflection with the actual scene behind
  // the pane rather than refracting a screen texture through an instanced unit box. The PBR reflection already
  // contains Fresnel, so do not multiply RGB by alpha a second time in premultiplied-alpha blending.
  const f0=((GUARD_GLASS.ior-1)/(GUARD_GLASS.ior+1))**2;
  material.customProgramCacheKey=()=>'dc-clear-guard-v2';
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <premultiplied_alpha_fragment>',
      `gl_FragColor.a=${f0.toFixed(6)}+${(1-f0).toFixed(6)}*pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),5.);`);
  };
  return material;
}
