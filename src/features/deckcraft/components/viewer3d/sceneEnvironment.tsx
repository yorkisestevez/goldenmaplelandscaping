import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {createPortal,useThree} from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The two pieces of drei's <Environment> the sky uses, without drei's loader for every image format (EXR, gain maps),
 * which would otherwise ride in the 3D viewer chunk. Behaviour matches drei 10.7: the previous environment, intensity
 * and rotation come back when the component goes.
 */
function applyEnvironment(scene:THREE.Scene,texture:THREE.Texture,intensity:number,rotation:THREE.Euler){
  const previous={environment:scene.environment,intensity:scene.environmentIntensity,rotation:scene.environmentRotation.clone()};
  scene.environment=texture;scene.environmentIntensity=intensity;scene.environmentRotation.copy(rotation);
  return ()=>{scene.environment=previous.environment;scene.environmentIntensity=previous.intensity;scene.environmentRotation.copy(previous.rotation);};
}

const NO_TURN=new THREE.Euler();
/** An equirectangular light probe as the scene's environment (drei EnvironmentMap). */
export function EnvironmentMap({map,environmentIntensity=1,environmentRotation=NO_TURN}:{map:THREE.Texture;environmentIntensity?:number;environmentRotation?:THREE.Euler}){
  const scene=useThree(s=>s.scene);
  useLayoutEffect(()=>applyEnvironment(scene,map,environmentIntensity,environmentRotation));
  return null;
}

/** Children (light panels) rendered once into a cube map that lights the scene (drei EnvironmentPortal, frames=1). */
export function EnvironmentPortal({children,resolution=256,near=.1,far=1000,environmentIntensity=1}:{children:ReactNode;resolution?:number;near?:number;far?:number;environmentIntensity?:number}){
  const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useRef<THREE.CubeCamera>(null);
  const [virtualScene]=useState(()=>new THREE.Scene());
  const target=useMemo(()=>{const fbo=new THREE.WebGLCubeRenderTarget(resolution);fbo.texture.type=THREE.HalfFloatType;return fbo;},[resolution]);
  useEffect(()=>()=>target.dispose(),[target]);
  useLayoutEffect(()=>{
    const autoClear=gl.autoClear;gl.autoClear=true;camera.current?.update(gl,virtualScene);gl.autoClear=autoClear;
    return applyEnvironment(scene,target.texture,environmentIntensity,NO_TURN);
  },[children,virtualScene,target,scene,gl,environmentIntensity]);
  return <>{createPortal(<>{children}<cubeCamera ref={camera} args={[near,far,target]}/></>,virtualScene)}</>;
}
