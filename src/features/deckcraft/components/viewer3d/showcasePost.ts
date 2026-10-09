import * as THREE from 'three';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {SMAAPass} from 'three/examples/jsm/postprocessing/SMAAPass.js';
import {SHOWCASE_DOF,SHOWCASE_GRADES,gradeLinear,presentationHour,type ShowcaseGrade} from './showcaseGrade';
import {getShowcaseFlags,showcasePostEnabled,type ShowcaseHour} from './showcaseMode';

/**
 * Showcase-only passes that sit in linear HDR, ahead of OutputPass: depth of field, SMAA, and the
 * filmic grade with its vignette. SMAA's lookup images decode once and are shared by the live view
 * and a still capture. Nothing here is constructed until showcase post is on.
 */
const VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const DOF_FRAG=`uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 resolution;uniform float cameraNear;uniform float cameraFar;uniform float focus;uniform float focusScale;uniform float focusBias;uniform float maxRadius;varying vec2 vUv;
float dcViewZ(float depth){return(cameraNear*cameraFar)/((cameraFar-cameraNear)*depth-cameraFar);}
void main(){
  vec4 base=texture2D(tColor,vUv);
  float dist=-dcViewZ(texture2D(tDepth,vUv).r);
  float coc=clamp(abs(dist-focus)/(focus*focusScale+focusBias),0.0,1.0)*maxRadius;
  vec2 texel=coc/resolution;
  vec3 color=base.rgb;
  color+=texture2D(tColor,vUv+texel*vec2(0.55,0.15)).rgb;
  color+=texture2D(tColor,vUv+texel*vec2(-0.4,0.55)).rgb;
  color+=texture2D(tColor,vUv+texel*vec2(-0.55,-0.25)).rgb;
  color+=texture2D(tColor,vUv+texel*vec2(0.15,-0.6)).rgb;
  color+=texture2D(tColor,vUv+texel*vec2(0.95,-0.35)).rgb;
  color+=texture2D(tColor,vUv+texel*vec2(-0.85,-0.75)).rgb;
  color+=texture2D(tColor,vUv+texel*vec2(0.25,0.95)).rgb;
  color+=texture2D(tColor,vUv+texel*vec2(-0.15,0.35)).rgb;
  gl_FragColor=vec4(color/9.0,base.a);
}`;
const GRADE_FRAG=`uniform sampler2D tColor;uniform vec3 slope;uniform vec3 offset;uniform vec3 power;uniform float contrast;uniform float pivot;uniform vec3 shadowTint;uniform vec3 highlightTint;uniform float split;uniform float vignette;varying vec2 vUv;
void main(){
  vec3 c=texture2D(tColor,vUv).rgb;
  c=pow(max(c*slope+offset,0.0),power);
  c=(c-pivot)*contrast+pivot;
  float luma=dot(c,vec3(0.2126,0.7152,0.0722));
  float t=clamp((luma-0.04)/0.4,0.0,1.0);
  vec3 tint=mix(shadowTint,highlightTint,t);
  float edge=smoothstep(0.35,1.15,length((vUv-0.5)*vec2(1.15,1.0)));
  c*=(1.0-split+split*tint)*(1.0-vignette*edge);
  gl_FragColor=vec4(c,1.0);
}`;
const BLEND_FRAG=`uniform sampler2D tColor;uniform sampler2D tAcc;uniform float weight;uniform float accumulate;varying vec2 vUv;
void main(){vec3 color=texture2D(tColor,vUv).rgb*weight;if(accumulate>0.5)color+=texture2D(tAcc,vUv).rgb;gl_FragColor=vec4(color,1.0);}`;

function screenMaterial(fragmentShader:string,uniforms:Record<string,THREE.IUniform>){
  return new THREE.ShaderMaterial({uniforms,vertexShader:VERT,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false});
}
export function createDofMaterial(){return screenMaterial(DOF_FRAG,{tColor:{value:null},tDepth:{value:null},resolution:{value:new THREE.Vector2(1,1)},cameraNear:{value:.25},cameraFar:{value:2400},focus:{value:20},focusScale:{value:SHOWCASE_DOF.apertureScale},focusBias:{value:SHOWCASE_DOF.apertureBias},maxRadius:{value:SHOWCASE_DOF.maxRadiusPx}});}
export function createGradeMaterial(){return screenMaterial(GRADE_FRAG,{tColor:{value:null},slope:{value:new THREE.Vector3(1,1,1)},offset:{value:new THREE.Vector3()},power:{value:new THREE.Vector3(1,1,1)},contrast:{value:1},pivot:{value:.18},shadowTint:{value:new THREE.Vector3(1,1,1)},highlightTint:{value:new THREE.Vector3(1,1,1)},split:{value:0},vignette:{value:0}});}
export function createBlendMaterial(){return screenMaterial(BLEND_FRAG,{tColor:{value:null},tAcc:{value:null},weight:{value:1},accumulate:{value:0}});}

export function bindDof(material:THREE.ShaderMaterial,color:THREE.Texture,depth:THREE.Texture,camera:THREE.Camera,focus:number,w:number,h:number){
  const u=material.uniforms,perspective=camera as THREE.PerspectiveCamera;
  u.tColor.value=color;u.tDepth.value=depth;u.resolution.value.set(w,h);u.focus.value=Math.max(.5,focus);
  u.cameraNear.value=perspective.isPerspectiveCamera?perspective.near:.25;u.cameraFar.value=perspective.isPerspectiveCamera?perspective.far:2400;
  u.maxRadius.value=perspective.isPerspectiveCamera?SHOWCASE_DOF.maxRadiusPx:0;
}
export function bindGrade(material:THREE.ShaderMaterial,color:THREE.Texture,hour:ShowcaseHour){
  const g:ShowcaseGrade=SHOWCASE_GRADES[hour],u=material.uniforms;
  u.tColor.value=color;u.slope.value.set(...g.slope);u.offset.value.set(...g.offset);u.power.value.set(...g.power);
  u.contrast.value=g.contrast;u.pivot.value=g.pivot;u.shadowTint.value.set(...g.shadow);u.highlightTint.value.set(...g.highlight);u.split.value=g.split;u.vignette.value=g.vignette;
}
export function activeGradeHour(evening:boolean){return presentationHour(evening,getShowcaseFlags().hour);}

let smaa:SMAAPass|null=null,smaaReady:Promise<void>=Promise.resolve(),readyNow=false;
const readyListeners=new Set<()=>void>();
function smaaImages(pass:SMAAPass){
  const raw=pass as unknown as {_areaTexture?:THREE.Texture;_searchTexture?:THREE.Texture};
  return [raw._areaTexture?.image,raw._searchTexture?.image].filter((image):image is HTMLImageElement=>image instanceof HTMLImageElement);
}
function imageReady(image:HTMLImageElement){
  if(image.complete&&image.naturalWidth>0)return Promise.resolve();
  return new Promise<void>(resolve=>{image.addEventListener('load',()=>resolve(),{once:true});image.addEventListener('error',()=>resolve(),{once:true});});
}
export function ensureShowcaseSmaa(w:number,h:number){
  if(!smaa){
    smaa=new SMAAPass();smaa.renderToScreen=false;
    const images=smaaImages(smaa);
    smaaReady=Promise.all(images.map(imageReady)).then(()=>{readyNow=true;for(const listen of readyListeners)listen();});
  }
  smaa.setSize(Math.max(1,w),Math.max(1,h));
  return smaaReady;
}
export function showcaseSmaa(){return readyNow?smaa:null;}
export function onShowcasePostReady(listen:()=>void){readyListeners.add(listen);return()=>{readyListeners.delete(listen);};}
export function showcasePostActive(){return showcasePostEnabled();}

export function halton(index:number,base:number){let f=1,r=0;while(index>0){f/=base;r+=f*(index%base);index=Math.floor(index/base);}return r;}
export function jitterCamera(camera:THREE.PerspectiveCamera,w:number,h:number,sample:number){
  camera.setViewOffset(w,h,halton(sample+1,2)-.5,halton(sample+1,3)-.5,w,h);
}
export function focusDistance(camera:THREE.Camera,controls:unknown){
  const target=controls&&typeof controls==='object'&&'target' in controls?(controls as {target:THREE.Vector3}).target:null;
  return target?camera.position.distanceTo(target):Math.max(1,camera.position.length());
}
export function blit(gl:THREE.WebGLRenderer,quad:FullScreenQuad,material:THREE.Material,target:THREE.WebGLRenderTarget|null){
  quad.material=material;const clear=gl.autoClear;gl.autoClear=false;gl.setRenderTarget(target);quad.render(gl);gl.autoClear=clear;
}

/** Keeps the CPU grade and the shader grade on the same curve at the frame centre. */
export function gradeMatchesShader(rgb:[number,number,number],hour:ShowcaseHour){return gradeLinear(rgb,hour,0);}
