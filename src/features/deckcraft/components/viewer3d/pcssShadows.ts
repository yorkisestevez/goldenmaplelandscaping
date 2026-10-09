import * as THREE from 'three';
import {showcasePostEnabled} from './showcaseMode';

/**
 * Contact-hardening shadows for showcase post. three.js 0.185's PCF sampler is a comparison
 * sampler, so the penumbra has to be read from BasicShadowMap's depth texture. The editor
 * stays on percentage-closer filtering; this patch is applied only while showcase post is on,
 * and only the basic getShadow is replaced.
 */
const BASIC_MARK='#else // SHADOWMAP_TYPE_BASIC';
const POINT_MARK='#if NUM_POINT_LIGHT_SHADOWS > 0';
const PCSS=`#else // SHADOWMAP_TYPE_BASIC

		vec2 dcVogel(int index, int count, float phi){
			float golden=2.39996323;
			float r=sqrt((float(index)+0.5)/float(count));
			float theta=float(index)*golden+phi;
			return vec2(cos(theta),sin(theta))*r;
		}

		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

			float shadow = 1.0;

			shadowCoord.xyz /= shadowCoord.w;

			#ifdef USE_REVERSED_DEPTH_BUFFER

				shadowCoord.z -= shadowBias;

			#else

				shadowCoord.z += shadowBias;

			#endif

			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

			if ( frustumTest ) {

				vec2 texel=vec2(1.0)/shadowMapSize;
				float phi=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))*6.2831853;
				float search=max(shadowRadius,1.0)*texel.x*4.0;
				float blockers=0.0;
				float blockerSum=0.0;
				for(int i=0;i<8;i++){
					float depth=texture2D(shadowMap,shadowCoord.xy+dcVogel(i,8,phi)*search).r;
					#ifdef USE_REVERSED_DEPTH_BUFFER
						float blocked=step(shadowCoord.z,depth);
					#else
						float blocked=step(depth,shadowCoord.z);
					#endif
					blockers+=blocked;
					blockerSum+=depth*blocked;
				}
				if(blockers<0.5){
					shadow=1.0;
				}else{
					float average=blockerSum/blockers;
					float penumbra=clamp(abs(shadowCoord.z-average)/max(average,0.0001),0.0,1.0);
					float radius=texel.x*mix(1.15,max(shadowRadius,1.0)*2.6,penumbra);
					float sum=0.0;
					for(int i=0;i<8;i++){
						float depth=texture2D(shadowMap,shadowCoord.xy+dcVogel(i,8,phi+1.7)*radius).r;
						#ifdef USE_REVERSED_DEPTH_BUFFER
							sum+=step(depth,shadowCoord.z);
						#else
							sum+=step(shadowCoord.z,depth);
						#endif
					}
					shadow=sum/8.0;
				}

			}

			return mix( 1.0, shadow, shadowIntensity );

		}

	`;

let original:string|undefined,applied=false;

function patched(source:string){
  const start=source.indexOf(BASIC_MARK),end=source.indexOf(POINT_MARK,start);
  if(start<0||end<0||!source.slice(start,end).includes('float getShadow( sampler2D shadowMap'))return source;
  return source.slice(0,start)+PCSS+'\n\t'+source.slice(end);
}
function dropMaps(scene:THREE.Scene){
  scene.traverse(o=>{
    const light=o as THREE.DirectionalLight;
    if(!light.isLight||!light.shadow?.map)return;
    light.shadow.map.dispose();light.shadow.map=null;light.shadow.mapPass?.dispose();
  });
}
function retint(scene:THREE.Scene,want:boolean){
  scene.traverse(o=>{
    const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
    const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const material of list){if(!material||Boolean(material.userData.deckPcss)===want)continue;material.userData.deckPcss=want;material.needsUpdate=true;}
  });
}

/** Switches the renderer to contact-hardening shadows, or back to percentage-closer filtering. Once per change. */
export function syncShowcaseShadows(gl:THREE.WebGLRenderer,scene:THREE.Scene){
  const want=showcasePostEnabled();
  if(want===applied)return;
  const chunk=THREE.ShaderChunk as unknown as Record<string,string>;
  if(want){original??=chunk.shadowmap_pars_fragment;chunk.shadowmap_pars_fragment=patched(original);gl.shadowMap.type=THREE.BasicShadowMap;}
  else if(original){chunk.shadowmap_pars_fragment=original;gl.shadowMap.type=THREE.PCFShadowMap;}
  dropMaps(scene);retint(scene,want);applied=want;
}
