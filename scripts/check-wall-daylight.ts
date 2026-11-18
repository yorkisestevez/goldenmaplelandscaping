import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyWallDaylight,wallDiffuseIrradiance} from '../src/features/deckcraft/components/viewer3d/wallDaylight';
import {createFixtureLighting,litMaterial} from '../src/features/deckcraft/components/viewer3d/fixtureLighting';
import {materialPatchKeys} from '../src/features/deckcraft/components/viewer3d/materialPatches';
const l=(v:number[])=>v[0]*.2126+v[1]*.7152+v[2]*.0722;let checks=0;
for(const rgb of [[.15,.38,.24],[1.2,.8,.3],[.5,.5,.5]] as [number,number,number][]){const result=wallDiffuseIrradiance(rgb,2.2);assert.ok(Math.abs(l(rgb)-l(result))<1e-10);checks++;assert.deepEqual(wallDiffuseIrradiance(rgb,.16),rgb);checks++;assert.ok(Math.max(...result)-Math.min(...result)<=(Math.max(...rgb)-Math.min(...rgb))*.20001);checks++;}
const m=applyWallDaylight(new THREE.MeshStandardMaterial({color:'#b2b0ab'})),fx=createFixtureLighting();litMaterial(m,fx);const s={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as THREE.WebGLProgramParametersWithUniforms;m.onBeforeCompile(s,{} as THREE.WebGLRenderer);
assert.ok(s.fragmentShader.includes('float wallNeutral'));checks++;assert.ok(s.fragmentShader.includes('RE_Direct( fxLight'));checks++;assert.ok(s.fragmentShader.includes('radiance += getIBLRadiance'));checks++;assert.ok(s.fragmentShader.includes('#include <shadowmap_pars_fragment>'));checks++;assert.equal(m.color.getHexString(),'b2b0ab');checks++;assert.equal(materialPatchKeys(m).length,2);checks++;m.dispose();fx.dispose();console.log(`Wall daylight passed ${checks} checks: luminance, evening, supplier albedo, sky specular, direct fixture and shadow preservation.`);
