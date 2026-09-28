import {useSyncExternalStore} from 'react';
import * as THREE from 'three';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * The ground's shade from the sky (Real Life G3): the sky lights the scene through its environment map, which casts no
 * shadows, so without this the lawn under a deck is as bright as open lawn. Everything that casts a shadow is drawn
 * from straight above into a 512 × 512 map, black where something covers the ground, then blurred about 1.5 ft; the
 * lawn takes it as its aoMap (ambient light only, as the sky's is). Redrawn only when what casts changes
 * (renderPipeline's onShadowChange). Bounds are the terrain's, in the scene's inches.
 */
export const OCCLUSION_SIZE=512,OCCLUSION_BLUR_FT=1.5;
export interface GroundBounds{minX:number;minZ:number;width:number;depth:number}
/** The map's UVs for a point on the ground (inches): u along x, v from the far side (−z) at 1 to the near side at 0. */
export const occlusionUv=(b:GroundBounds,x:number,z:number):[number,number]=>[(x-b.minX)/b.width,1-(z-b.minZ)/b.depth];

const BLUR=/* glsl */`
uniform sampler2D source;uniform vec2 step;varying vec2 vUv;
void main(){
  float sum=0.,weight=0.;
  for(int i=-12;i<=12;i++){float w=exp(-float(i*i)/72.);sum+=texture2D(source,vUv+step*float(i)).r*w;weight+=w;}
  gl_FragColor=vec4(vec3(sum/weight),1.);
}`;

export class GroundOcclusion{
  readonly texture:THREE.Texture;
  private covered=new THREE.WebGLRenderTarget(OCCLUSION_SIZE,OCCLUSION_SIZE,{depthBuffer:true});
  private blurred=[this.covered.clone(),this.covered.clone()];
  private camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,4000);
  private cover=new THREE.MeshBasicMaterial({color:'#000000'});
  private blur=new THREE.ShaderMaterial({uniforms:{source:{value:null},step:{value:new THREE.Vector2()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:BLUR,depthTest:false,depthWrite:false});
  private quad=new FullScreenQuad(this.blur);
  constructor(){
    this.texture=this.blurred[1].texture;
    for(const t of [this.covered,...this.blurred])t.texture.wrapS=t.texture.wrapT=THREE.ClampToEdgeWrapping;
  }
  /** Draws what covers the ground inside bounds (inches; the scene's world is in feet) and blurs it. */
  render(gl:THREE.WebGLRenderer,scene:THREE.Scene,b:GroundBounds){
    const ft=1/12,cx=(b.minX+b.width/2)*ft,cz=(b.minZ+b.depth/2)*ft,cam=this.camera;
    cam.left=-b.width*ft/2;cam.right=b.width*ft/2;cam.top=b.depth*ft/2;cam.bottom=-b.depth*ft/2;cam.position.set(cx,2000,cz);cam.up.set(0,0,-1);cam.lookAt(cx,0,cz);cam.updateProjectionMatrix();cam.updateMatrixWorld();
    // Only what casts shadows covers the ground: the lawn, the grass, the sky and outlines are left out, and so is what
    // lies on the ground itself (userData.coversGround false: paving, walls, the lawn bank), which takes this map too.
    const hidden:THREE.Object3D[]=[];
    scene.traverse(o=>{if(!o.visible)return;const casts=(o as THREE.Mesh).isMesh&&o.castShadow&&o.userData.coversGround!==false;if(!casts&&((o as THREE.Mesh).isMesh||(o as THREE.Line).isLine||(o as THREE.Points).isPoints)){o.visible=false;hidden.push(o);}});
    const {background,fog,overrideMaterial}=scene,clear=gl.getClearColor(new THREE.Color()),alpha=gl.getClearAlpha(),target=gl.getRenderTarget();
    try{
      scene.background=null;scene.fog=null;scene.overrideMaterial=this.cover;
      gl.setRenderTarget(this.covered);gl.setClearColor('#ffffff',1);gl.clear();gl.render(scene,cam);
    }finally{
      scene.background=background;scene.fog=fog;scene.overrideMaterial=overrideMaterial;for(const o of hidden)o.visible=true;
    }
    // Two passes of a 25-tap Gaussian (sigma 6 texels), scaled so it spreads about OCCLUSION_BLUR_FT.
    const texelFt=Math.max(b.width,b.depth)*ft/OCCLUSION_SIZE,spread=OCCLUSION_BLUR_FT/(6*texelFt)/OCCLUSION_SIZE;
    this.blur.uniforms.source.value=this.covered.texture;this.blur.uniforms.step.value.set(spread,0);gl.setRenderTarget(this.blurred[0]);this.quad.render(gl);
    this.blur.uniforms.source.value=this.blurred[0].texture;this.blur.uniforms.step.value.set(0,spread);gl.setRenderTarget(this.blurred[1]);this.quad.render(gl);
    gl.setRenderTarget(target);gl.setClearColor(clear,alpha);
  }
  dispose(){this.covered.dispose();for(const t of this.blurred)t.dispose();this.cover.dispose();this.blur.dispose();this.quad.dispose();}
}

/** The lawn's occlusion map and its bounds, shared with the yard's hardscape (Real Life G5): a patio under a deck is
 * shaded from the sky as the lawn there is. Turf publishes it once drawn; null until then. */
export type SharedOcclusion={texture:THREE.Texture;bounds:GroundBounds}|null;
let shared:SharedOcclusion=null;const listeners=new Set<()=>void>();
export function publishGroundOcclusion(value:SharedOcclusion){if(shared?.texture===value?.texture&&shared?.bounds===value?.bounds)return;shared=value;for(const listen of listeners)listen();}
export function useGroundOcclusion(){return useSyncExternalStore(listen=>{listeners.add(listen);return ()=>{listeners.delete(listen);};},()=>shared,()=>null);}
