import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';

export interface WindowReflection {
  texture:{value:THREE.Texture|null}; matrix:{value:THREE.Matrix4}; ready:{value:number};
}
interface FacadeReflection {facade:THREE.Group;binding:WindowReflection;mirror:Reflector|null}
const facades=new WeakMap<THREE.Scene,Set<FacadeReflection>>();
export function reflectionBinding():WindowReflection {
  return {texture:{value:null},matrix:{value:new THREE.Matrix4()},ready:{value:0}};
}
export function registerWindowReflection(scene:THREE.Scene,facade:THREE.Group,binding:WindowReflection){
  const set=facades.get(scene)??new Set<FacadeReflection>();facades.set(scene,set);
  const entry={facade,binding,mirror:null} as FacadeReflection;set.add(entry);
  return ()=>{set.delete(entry);entry.mirror?.geometry.dispose();entry.mirror?.dispose();binding.ready.value=0;binding.texture.value=null;};
}

/** One clipped, mirrored-camera view per visible house facade, shared by all its panes.
 * Runs before BOTH the live beauty pass and proposal capture; never from a recursive mesh callback. */
export function renderWindowReflections(gl:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera){
  const entries=facades.get(scene);if(!entries?.size)return;
  const hidden:THREE.Object3D[]=[];
  scene.traverse(o=>{if(o.userData.houseWindow&&o.visible){hidden.push(o);o.visible=false;}});
  const target=gl.getRenderTarget(),viewport=gl.getViewport(new THREE.Vector4()),scissor=gl.getScissor(new THREE.Vector4());
  const scissorTest=gl.getScissorTest(),xr=gl.xr.enabled,auto=gl.shadowMap.autoUpdate,needs=gl.shadowMap.needsUpdate;
  let rendered=false;
  try{
    gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=false;
    const cameraPosition=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    for(const entry of entries){
      const {facade,binding}=entry;
      let visible=true;for(let p:THREE.Object3D|null=facade;p;p=p.parent)if(!p.visible)visible=false;
      const normal=new THREE.Vector3(0,0,1).transformDirection(facade.matrixWorld);
      const origin=new THREE.Vector3(0,0,.8).applyMatrix4(facade.matrixWorld);
      if(!visible||cameraPosition.clone().sub(origin).dot(normal)<=0){binding.ready.value=0;continue;}
      if(!entry.mirror){
        const edge=gl.domElement.clientWidth<600?768:1024;
        entry.mirror=new Reflector(new THREE.PlaneGeometry(1,1),{textureWidth:edge,textureHeight:edge,multisample:Math.min(2,gl.capabilities.maxSamples),clipBias:.001});
        if(!gl.extensions.has('EXT_color_buffer_float')&&!gl.extensions.has('EXT_color_buffer_half_float'))entry.mirror.getRenderTarget().texture.type=THREE.UnsignedByteType;
        binding.texture.value=entry.mirror.getRenderTarget().texture;
      }
      const mirror=entry.mirror;
      mirror.matrixWorld.copy(facade.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(0,0,.8));
      // Consume a changed sun shadow once in the first reflection; the following beauty pass reuses it.
      gl.shadowMap.needsUpdate=needs&&!rendered;
      mirror.onBeforeRender(gl,scene,camera,mirror.geometry,mirror.material as THREE.Material,null as never);
      rendered=true;
      binding.matrix.value.copy((mirror.material as THREE.ShaderMaterial).uniforms.textureMatrix.value).multiply(mirror.matrixWorld.clone().invert());
      binding.ready.value=1;
    }
  }finally{
    hidden.forEach(o=>{o.visible=true;});
    gl.xr.enabled=xr;gl.shadowMap.autoUpdate=auto;gl.shadowMap.needsUpdate=needs&&!rendered;
    gl.setRenderTarget(target);gl.setViewport(viewport);gl.setScissor(scissor);gl.setScissorTest(scissorTest);
  }
}
