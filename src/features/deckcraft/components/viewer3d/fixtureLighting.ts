import {createContext,useCallback,useContext,useLayoutEffect} from 'react';
import * as THREE from 'three';
import {FX_MAX_FIXTURES,FX_TEXELS,kelvinSrgb} from '../../fixtureLight';
import {addMaterialPatch} from './materialPatches';

/**
 * Near-field fixture light (under-step, post and screen-post lights) on the materials that receive it. Every such
 * fixture is one row of a small float texture (packFixtureLights in fixtureLight.ts), and a shader patch adds a loop
 * over those rows right after three's own lights, calling three's RE_Direct, so each fixture shades exactly like a
 * three SpotLight without shadows. Unlike real lights there's no count limit and no uniform per light: the patch
 * costs one texture unit and one int, and nothing runs by day (the count is 0).
 */
export interface FixtureLighting{uniforms:{fxData:{value:THREE.DataTexture};fxCount:{value:number}};
  /** Loads packed fixtures. Only the texture is re-uploaded; no material recompiles. */
  update:(packed:{data:Float32Array;count:number})=>void;dispose:()=>void}

export function createFixtureLighting():FixtureLighting{
  const texture=new THREE.DataTexture(new Float32Array(FX_TEXELS*FX_MAX_FIXTURES*4),FX_TEXELS,FX_MAX_FIXTURES,THREE.RGBAFormat,THREE.FloatType);
  texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  const uniforms={fxData:{value:texture},fxCount:{value:0}};
  return {uniforms,
    update:({data,count})=>{(texture.image.data as Float32Array).set(data);texture.needsUpdate=true;uniforms.fxCount.value=count;},
    dispose:()=>texture.dispose()};
}

const PARS='uniform highp sampler2D fxData;\nuniform int fxCount;\n';
// Positions are world feet. The fragment's world position is recovered from its view position with the view matrix,
// and a strip light shades from its closest point to the fragment (a representative-point line light).
const LOOP=`
#if defined( RE_Direct )
{
	vec3 fxP = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
	IncidentLight fxLight;
	for ( int i = 0; i < ${FX_MAX_FIXTURES}; i ++ ) {
		if ( i >= fxCount ) break;
		vec4 fxA = texelFetch( fxData, ivec2( 0, i ), 0 );
		vec4 fxS = texelFetch( fxData, ivec2( 3, i ), 0 );
		float fxT = clamp( dot( fxP - fxA.xyz, fxS.xyz ) / max( dot( fxS.xyz, fxS.xyz ), 1e-6 ), - 1.0, 1.0 );
		vec3 fxToLight = fxA.xyz + fxS.xyz * fxT - fxP;
		float fxD = length( fxToLight );
		if ( fxD >= fxA.w ) continue;
		vec4 fxB = texelFetch( fxData, ivec2( 1, i ), 0 );
		vec4 fxC = texelFetch( fxData, ivec2( 2, i ), 0 );
		vec3 fxL = fxToLight / max( fxD, 1e-4 );
		float fxK = getSpotAttenuation( fxB.w, fxC.w, dot( - fxL, fxB.xyz ) );
		if ( fxK <= 0.0 ) continue;
		fxLight.direction = normalize( ( viewMatrix * vec4( fxL, 0.0 ) ).xyz );
		// Inverse square softened by the lens radius, faded to nothing at the range (three's own window).
		float fxWindow = saturate( 1.0 - pow4( fxD / fxA.w ) );
		fxLight.color = fxC.rgb * fxK * fxWindow * fxWindow / ( fxD * fxD + fxS.w * fxS.w + 1e-4 );
		fxLight.visible = true;
		RE_Direct( fxLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
}
#endif
`;

/** Adds the fixture light patch to a material, reading this viewer's fixture texture. */
export function litMaterial(material:THREE.Material,fx:FixtureLighting){
  addMaterialPatch(material,{key:`fx${FX_MAX_FIXTURES}`,apply:shader=>{
    if(!shader.fragmentShader.includes('#include <lights_fragment_begin>'))return;
    shader.uniforms.fxData=fx.uniforms.fxData;shader.uniforms.fxCount=fx.uniforms.fxCount;
    shader.fragmentShader=PARS+shader.fragmentShader.replace('#include <lights_fragment_begin>',`#include <lights_fragment_begin>\n${LOOP}`);
  }});
}

/** A fixture's rated colour temperature as a three colour (illustrative). */
export const kelvinColour=(kelvin:number)=>{const [r,g,b]=kelvinSrgb(kelvin);return new THREE.Color().setRGB(r,g,b,THREE.SRGBColorSpace);};
/** Lens brightness: HDR at night, so tone mapping compresses it to a warm near-white instead of clipping it white. */
export const lensGlow=(enabled:boolean,evening:boolean)=>enabled?(evening?6:.35):0;

/** This 3D view's fixture light, provided inside the Canvas (Deck3DViewer). */
export const FixtureLightContext=createContext<FixtureLighting|null>(null);
/** Lets a material receive fixture light. Outside a 3D view (no provider) it does nothing. */
export function useFixtureLit<M extends THREE.Material|null|undefined>(material:M):M{
  const fx=useContext(FixtureLightContext);
  useLayoutEffect(()=>{if(material&&fx)litMaterial(material,fx);},[material,fx]);
  return material;
}
/** The same for a material declared in JSX: pass it as the material's ref. */
export function useFixtureLitRef(){
  const fx=useContext(FixtureLightContext);
  return useCallback((material:THREE.Material|null)=>{if(material&&fx)litMaterial(material,fx);},[fx]);
}
