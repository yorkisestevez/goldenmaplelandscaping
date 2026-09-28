import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import type {FixturePlacement} from '../../extrasLayout';
import {fixtureGlow,kelvinLinear} from '../../fixtureLight';

/**
 * The soft glow round every lit lens at night, in one draw: camera-facing quads with a procedural falloff (no texture
 * unit), added over the scene and depth-tested so a rail in front still hides it. Each glow is pulled toward the camera
 * by its lens size, so the cap or tread it sits in doesn't cut it in half, and fades by how squarely the lens faces
 * the camera: a step light's lens (facing down) shows no glow from above, and a cap light's none from below the cap.
 * The peak stays under 1.0, so a bloom pass on top (G1) still blooms only the lens itself.
 */
const VERTEX=`
attribute vec3 iPos;
attribute vec3 iNormal;
attribute vec3 iColor;
attribute float iSize;
varying vec2 vQuad;
varying vec3 vColor;
void main() {
	vec4 mv = viewMatrix * vec4( iPos, 1.0 );
	vec3 toCamera = normalize( - mv.xyz );
	float facing = 1.0;
	if ( dot( iNormal, iNormal ) > 0.0 ) facing = smoothstep( - 0.02, 0.4, dot( normalize( ( viewMatrix * vec4( iNormal, 0.0 ) ).xyz ), toCamera ) );
	mv.xyz += toCamera * iSize * 1.2;
	mv.xy += position.xy * iSize * 3.0;
	vQuad = position.xy;
	vColor = iColor * facing;
	gl_Position = projectionMatrix * mv;
}`;
const FRAGMENT=`
varying vec2 vQuad;
varying vec3 vColor;
void main() {
	float r = length( vQuad );
	if ( r >= 1.0 || dot( vColor, vColor ) <= 0.0 ) discard;
	float glow = ( exp( - r * r * 30.0 ) + pow( 1.0 - r, 2.5 ) * 0.45 ) / 1.45;
	gl_FragColor = vec4( vColor * glow, 1.0 );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;

export default function FixtureGlows({items,evening,enabled}:{items:FixturePlacement[];evening:boolean;enabled:boolean}){
  const geometry=useMemo(()=>{
    if(!evening||!enabled)return null;
    const pos:number[]=[],normal:number[]=[],colour:number[]=[],size:number[]=[];
    for(const f of items){
      const g=fixtureGlow(f);if(!g)continue;
      const c=kelvinLinear(g.kelvin).map(v=>v*g.strength);
      // A strip glows along its length as a row of small glows.
      const n=g.lengthFt>0?Math.max(1,Math.round(g.lengthFt/(g.radiusFt*2.5))):1;
      for(let k=0;k<n;k++){const t=n>1?(k/(n-1)-.5)*(g.lengthFt-g.radiusFt*2):0;pos.push(...g.position.map((v,a)=>v+g.axis[a]*t));normal.push(...g.normal);colour.push(...c);size.push(g.radiusFt);}
    }
    if(!size.length)return null;
    const geo=new THREE.InstancedBufferGeometry(),quad=new THREE.PlaneGeometry(2,2);
    geo.index=quad.index;geo.setAttribute('position',quad.getAttribute('position'));
    geo.setAttribute('iPos',new THREE.InstancedBufferAttribute(new Float32Array(pos),3));
    geo.setAttribute('iNormal',new THREE.InstancedBufferAttribute(new Float32Array(normal),3));
    geo.setAttribute('iColor',new THREE.InstancedBufferAttribute(new Float32Array(colour),3));
    geo.setAttribute('iSize',new THREE.InstancedBufferAttribute(new Float32Array(size),1));
    geo.instanceCount=size.length;
    return geo;
  },[items,evening,enabled]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  const material=useMemo(()=>new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,depthTest:true,toneMapped:true,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor}),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  return geometry?<mesh name="fixture-lens-glows" geometry={geometry} material={material} frustumCulled={false} renderOrder={5} raycast={()=>null}/>:null;
}
