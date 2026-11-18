import * as THREE from 'three';
import {SKY_PARS,SKY_RADIANCE,skyUniforms} from './skyShade';

/**
 * A distant tree line all round the yard, so the lawn never meets the sky in a bare straight line (a backyard's horizon
 * is trees and hedges). Two thin rings stand on the far lawn, a nearer one and a paler one behind it; the crowns are
 * drawn by the shader, so there are no textures or models to load. Their haze is the far lawn's (skyShade.ts), from the
 * same sky colour and the same distance, so the trees' bases and the ground in front of them agree.
 * Plain module, so the check scripts can read it.
 */
export const BELT={nearMinFt:500,nearMaxFt:1000,yardFactor:2.2,farFt:1300,refFt:600,buryFt:30,topRef:60,segments:192};

/** The two rings' radii (feet) round the yard's middle: the near one well outside the yard, the far one inside the
 * lawn's 1500 ft rim. Heights scale with distance (refFt), so both rings look the same size. */
export function beltRadii(yardHalfDiagonalFt:number):[number,number]{
  return [Math.min(BELT.nearMaxFt,Math.max(BELT.nearMinFt,BELT.yardFactor*yardHalfDiagonalFt)),BELT.farFt];
}

/** Two open cylinders in inches round the origin, facing in (drawn front side only, so a camera outside a ring sees
 * nothing of it), from below the ground to the tallest crown; the far ring first, so the
 * near one blends over it in the same draw. */
export function beltGeometry(nearFt:number,farFt:number){
  const positions:number[]=[];
  for(const radius of [farFt,nearFt]){
    const r=radius*12,k=radius/BELT.refFt,bottom=-BELT.buryFt*12,top=BELT.topRef*k*12;
    for(let i=0;i<BELT.segments;i++){
      const a0=i/BELT.segments*Math.PI*2,a1=(i+1)/BELT.segments*Math.PI*2,x0=Math.cos(a0)*r,z0=Math.sin(a0)*r,x1=Math.cos(a1)*r,z1=Math.sin(a1)*r;
      positions.push(x0,bottom,z0,x1,bottom,z1,x1,top,z1,x0,bottom,z0,x1,top,z1,x0,top,z0);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));return g;
}

const BELT_VERTEX=/* glsl */`
#include <fog_pars_vertex>
varying vec3 vBelt,vWorld,vCentre;
void main(){vBelt=position;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vCentre=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;

/** Crowns: a rolling hedge floor, two sizes of overlapping round crowns with a few ragged conifers, a leafy top that
 * fades out before it can shimmer, an anti-aliased edge, and canopy shading lit from above. Heights are in reference
 * feet (BELT.refFt away). Every hash is periodic round the ring, so there is no seam. */
export const BELT_FRAGMENT=/* glsl */`${SKY_PARS}${SKY_RADIANCE}
uniform float uR1,uR2;
varying vec3 vBelt,vWorld,vCentre;
#include <fog_pars_fragment>
float beltHash(float i,float n,float seed){return fract(sin(mod(i,n)*12.9898+seed*78.233)*43758.5453);}
float beltNoise(float x,float n,float seed){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(beltHash(i,n,seed),beltHash(i+1.,n,seed),f);}
float beltHash2(vec2 c,float n){return fract(sin(dot(vec2(mod(c.x,n),c.y),vec2(127.1,311.7)))*43758.5453);}
float beltNoise2(vec2 p,float n){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(beltHash2(i,n),beltHash2(i+vec2(1.,0.),n),f.x),mix(beltHash2(i+vec2(0.,1.),n),beltHash2(i+1.,n),f.x),f.y);}
float beltCrowns(float s,float cells,float far,float seed,float scale){
  float top=0.;
  for(int j=-1;j<=1;j++){
    float i=floor(s)+float(j),h=beltHash(i,cells,seed),spire=step(.93,beltHash(i,cells,seed+2.));
    float centre=i+.5+(beltHash(i,cells,seed+4.)-.5)*.6,width=mix(.5+.35*beltHash(i,cells,seed+6.),.18,spire),x=(s-centre)/width;
    float rise=scale*mix(mix(7.+10.*h,3.+5.*h,far),mix(11.+12.*h,6.+6.*h,far),spire);
    top=max(top,rise*mix(pow(max(0.,1.-x*x),.6),pow(max(0.,1.-abs(x)),1.3),spire));
  }
  return top;
}
void main(){
  vec3 p=vBelt/12.;
  float r=length(p.xz),far=step((uR1+uR2)*.5,r),radius=mix(uR1,uR2,far),k=radius/${BELT.refFt.toFixed(1)};
  float t=atan(p.z,p.x)/(2.*PI)+.5,C=2.*PI*radius/k,y=p.y/k;
  float n1=floor(C/260.),n2=floor(C/90.),cells=floor(C/28.),small=floor(C/13.),s=t*cells;
  float base=9.+mix(6.,4.,far)*beltNoise(t*n1,n1,1.+far)+3.*beltNoise(t*n2,n2,3.+far);
  float top=base+max(beltCrowns(s,cells,far,5.+far,1.),beltCrowns(t*small,small,far,31.+far,.55));
  // Seam-safe, as skyRadiance's u: t wraps from 1 to 0 on the ring's -x side.
  float edge=min(fwidth(t),fwidth(fract(t+.5)))*C,leafy=1.-smoothstep(1.,3.5,edge);
  top+=(1.6*(beltNoise(t*cells*6.,cells*6.,13.)-.5)+.8*(beltNoise(t*cells*17.,cells*17.,19.)-.5))*leafy;
  float cover=clamp((top-y)/max(fwidth(y)*1.2,1e-4)+.5,0.,1.);
  // Leaves: dark green by day, near black at dusk (the sky's strength), richer with the grade, warm at golden hour;
  // lit on top, shaded below, each crown its own tone, the canopy in clumps.
  vec3 leaf=vec3(.036,.058,.026)*clamp(strength*.25,.03,1.2)*mix(1.,1.15,uRich)*mix(vec3(1.),vec3(1.18,.92,.62),uWarm);
  float up=clamp((y-base*.5)/max(top-base*.5,1.),0.,1.),clump=beltNoise2(vec2(t*cells*3.,y*.35),cells*3.);
  float lit=(.75+.3*beltNoise(s,cells,41.))*(.62+.38*up)*(1.+.4*(clump-.5)*leafy*(1.-smoothstep(.4,.9,fwidth(y*.35))));
  // The far lawn's air at this distance (lawnSurface.ts), with a little mist round the trunks.
  vec2 h=vWorld.xz-cameraPosition.xz;float d=max(length(h),1.),q=clamp((1./uAerialNear-1./d)/(1./uAerialNear-1./uAerialFar),0.,1.);
  float air=clamp(q*q*(3.-2.*q)+.1*(1.-smoothstep(0.,14.,y)),0.,1.);
  vec3 colour=leaf*lit;
  // The scene's fog first, exactly as the lawn standing in front of the trees gets it.
  #ifdef USE_FOG
   #ifdef FOG_EXP2
   colour=mix(colour,fogColor,1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth));
   #else
   colour=mix(colour,fogColor,smoothstep(fogNear,fogFar,vFogDepth));
   #endif
  #endif
  // A camera orbiting out towards a ring (Overview on a large design) would meet a flat wall: the ring fades first.
  float inside=1.-smoothstep(.78,.94,length(cameraPosition.xz-vCentre.xz)/mix(uR1,uR2,far));
  gl_FragColor=vec4(mix(colour,skyRadiance(vec3(h.x,0.,h.y)/d),air),cover*inside*step(.5,uSkyReady));
}`;

/** The belt's material: the renderer's shared sky uniforms (skyShade.ts) plus its two radii. Drawn behind the yard's
 * transparent objects, writing no depth, in the scene's fog; it casts no shadow, and the path-traced photo skips it
 * (userData.photoSkip). */
export function beltMaterial(renderer:object,nearFt:number,farFt:number){
  return new THREE.ShaderMaterial({uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),...skyUniforms(renderer),uR1:{value:nearFt},uR2:{value:farFt}},vertexShader:BELT_VERTEX,fragmentShader:BELT_FRAGMENT,
    transparent:true,depthWrite:false,fog:true,side:THREE.FrontSide});
}
