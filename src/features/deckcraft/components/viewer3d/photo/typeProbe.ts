// THROWAWAY G0 spike: do three-gpu-pathtracer 0.0.24's typings compile against @types/three 0.185 (no @ts-nocheck)?
import * as THREE from 'three';
import {WebGLPathTracer,DenoiseMaterial,GradientEquirectTexture,PhysicalSpotLight} from 'three-gpu-pathtracer';
import {MeshBVH,SAH} from 'three-mesh-bvh';
export function typeProbe(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
  const pt=new WebGLPathTracer(renderer);
  pt.tiles.set(2,2);pt.bounces=6;pt.filterGlossyFactor=.5;pt.renderDelay=0;pt.minSamples=1;
  pt.setScene(scene,camera);pt.renderSample();
  const d=new DenoiseMaterial({map:pt.target.texture});
  const g=new GradientEquirectTexture(64);g.topColor.set('#fff');g.update();
  const s=new PhysicalSpotLight(0xffffff,1);s.radius=.1;
  const bvh=new MeshBVH(new THREE.BoxGeometry(),{strategy:SAH});
  return [pt.samples,d,g,s,bvh];
}
