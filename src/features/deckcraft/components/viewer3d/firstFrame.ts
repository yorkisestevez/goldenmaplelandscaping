import * as THREE from 'three';

/**
 * The opening frame of the live 3D view. On a device with no GPU shader cache yet (a new install, a first visit), each
 * shader compiles the first time something draws with it, and the page stops until it has. Drawing as the scene filled
 * in compiled about 90 programs one after another (the page froze 6-8 s on a desktop GPU), most of them for states the
 * view left at once: before the sky's light, with the screen's tone mapping, and with the editor's shadows before the
 * realistic look's contact shadows loaded. So the first frame (renderPipeline.tsx) waits until those shadows are loaded
 * (when wanted) and the sky is in, starts every shader it draws with compiling at once (KHR_parallel_shader_compile, off
 * the main thread), and draws when they are done. After FIRST_FRAME_WAIT_MS it draws regardless, as it did before.
 */
export const FIRST_FRAME_WAIT_MS=4000;

/** Starts compiling what compile() returns for drawing into target (null: the screen) and counts those still compiling.
 * Not three's compileAsync: its readiness poll throws when a material's program is replaced mid-poll. */
export function compileFor(gl:THREE.WebGLRenderer,target:THREE.WebGLRenderTarget|null,compile:()=>Set<THREE.Material>){
  const previous=gl.getRenderTarget();gl.setRenderTarget(target);
  try{
    let compiling=0;
    for(const material of compile()){const program=(gl.properties.get(material) as {currentProgram?:{isReady:()=>boolean}}).currentProgram;if(program&&!program.isReady())compiling++;}
    return compiling;
  }finally{gl.setRenderTarget(previous);}
}

// The attributes three's FullScreenQuad draws with: they are part of the program's cache key.
const QUAD=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([-1,3,0,-1,-1,0,3,-1,0],3)).setAttribute('uv',new THREE.Float32BufferAttribute([0,2,0,0,2,0],2));
/** Full-screen passes' materials as a scene compile() takes. */
export function passScene(materials:THREE.Material[]){
  const scene=new THREE.Scene();
  for(const material of materials)scene.add(new THREE.Mesh(QUAD,material));
  return scene;
}
