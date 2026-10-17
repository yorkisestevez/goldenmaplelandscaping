/**
 * Placed-plant render foundation (R-P0, 2026-10-17): the canvas is opaque, and leaf cards are honest summer foliage.
 * - The WebGL context is created opaque. three always asks for alpha:true and its alpha option only sets the clear alpha,
 *   so alpha-to-coverage leaf edges let the page show through as white speckle (proved with a magenta page).
 * - Leaves: no albedo lift, matte (no roughness or normal map on cards), light through the leaf added before the diffuse
 *   sum (the v1 terms were added after it and never rendered), crown-bent normals, and a mip-aware alpha so distant
 *   canopies and needles do not dissolve. The species tint colours leaves only.
 * - Photo mode mirrors it: the atlas as it is, no faked glow, opaque leaf cards, and the real sun size.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FOLIAGE,applyFoliageLighting,crownBend,isLeafMaterial,leafTransmitUniform} from '../src/features/deckcraft/components/viewer3d/foliageLighting';
import {createFixtureLighting,litMaterial} from '../src/features/deckcraft/components/viewer3d/fixtureLighting';
import {materialPatchKeys} from '../src/features/deckcraft/components/viewer3d/materialPatches';
import {SUN_ANGULAR_RADIUS_DEG} from '../src/features/deckcraft/photoGrade';

let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const source=(path:string)=>readFileSync(path,'utf8');

// 1. Opaque canvas.
const viewer=source('src/features/deckcraft/components/viewer3d/Deck3DViewer.tsx');
ok(/getContext\('webgl2',\{alpha:false,/.test(viewer)&&viewer.includes('new THREE.WebGLRenderer({canvas,...context?{context}:{},antialias:false})'),'The 3D view creates its own opaque WebGL2 context and hands it to three');
ok(viewer.includes('renderer.setClearColor(DAY_BACKGROUND,1);renderer.clear();')&&viewer.includes("const DAY_BACKGROUND='#e9edf0';"),'The opaque buffer starts as the day sky, so opening the 3D view never flashes black');
ok(viewer.indexOf('renderer.setClearColor(0x000000,0);')>viewer.indexOf('renderer.setClearColor(DAY_BACKGROUND,1);renderer.clear();'),'The renderer then goes back to the black, alpha-0 clear the post chain (SMAA edges) and environment cube expect');
const engine=source('src/features/deckcraft/components/viewer3d/photoEngine.ts');
ok(/gl\.setPixelRatio\(1\);[\s\S]{0,260}if\(pixelRatio!==1\)\{const pipeline=pipelineFor\(gl\);if\(pipeline\)pipeline\.capture\(1\);else gl\.render\(scene,camera\);\}[\s\S]{0,40}gl\.domElement\.dataset\.photoTrace='1'/.test(engine),'Starting a photo at another pixel ratio redraws the view first, so the opaque canvas does not sit black during warm-up');
ok(viewer.includes('gl={opaqueRenderer}')&&!/gl=\{\{[^}]*toneMapping/.test(viewer),'The Canvas uses that renderer, not three\'s alpha:true default');
ok(viewer.includes('gl.toneMapping=THREE.NeutralToneMapping;gl.toneMappingExposure=SCENE_LOOK.exposure;'),'Neutral tone mapping and the scene exposure are set on creation (R3F stops applying gl props for a factory)');

// 2. Leaf material v2, compiled against three's own standard shaders.
const compile=(material:THREE.Material)=>{
 const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{} as Record<string,{value:unknown}>};
 material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
 return shader;
};
const leafMap=new THREE.DataTexture(new Uint8Array([60,90,40,255]),1,1);
const leaf=new THREE.MeshStandardMaterial({map:leafMap,alphaTest:.4,roughness:.4,roughnessMap:leafMap,normalMap:leafMap});
ok(isLeafMaterial(leaf)&&isLeafMaterial(new THREE.MeshStandardMaterial({name:'fern-clump'}))&&!isLeafMaterial(new THREE.MeshStandardMaterial({name:'bark'})),'Leaf cards are the alpha-tested atlases and the fern');
applyFoliageLighting(leaf,{center:new THREE.Vector3(0,2,0),bend:crownBend('deciduous-tree')});
ok(leaf.roughness===FOLIAGE.roughness&&leaf.roughnessMap===null&&leaf.normalMap===null&&leaf.metalness===0,'Leaf cards are matte: no glossy roughness map or card normal map');
ok(materialPatchKeys(leaf).includes('foliage-summer-v2-crown'),'A canopy leaf carries the crown variant of the v2 patch');
const fx=createFixtureLighting();litMaterial(leaf,fx);
const lit=compile(leaf);
ok(!/pow\(max\(diffuseColor/.test(lit.fragmentShader)&&!lit.fragmentShader.includes('vec3(1.04,1.12,0.9)'),'No albedo lift or green gain: the atlas colour is used as it is');
const pars=lit.fragmentShader.indexOf('#include <lights_physical_pars_fragment>'),leafFn=lit.fragmentShader.indexOf('void RE_Direct_Leaf'),define=lit.fragmentShader.indexOf('#define RE_Direct RE_Direct_Leaf'),main=lit.fragmentShader.indexOf('void main');
ok(pars>=0&&leafFn>pars&&define>leafFn&&main>define,'Light through the leaf wraps RE_Direct before main, so every shadowed direct light adds it before the diffuse sum');
ok(lit.fragmentShader.includes('saturate(dot(-geometryNormal,directLight.direction))*BRDF_Lambert(material.diffuseColor)'),'Transmission is the shadowed light reaching the far side of the leaf, through its own colour');
ok(lit.fragmentShader.includes('if(uLeafTransmit>0.0&&dot(directLight.direction,directionalLights[0].direction)>0.9999)')&&lit.fragmentShader.includes('uniform float uLeafTransmit;')&&lit.uniforms.uLeafTransmit===leafTransmitUniform(leaf),'Only the shadowed sun passes through a leaf: fixture lights and the golden-hour rim do not, and the switch is shared per material');
ok(lit.fragmentShader.includes('fxLight')&&lit.fragmentShader.indexOf('fxLight')>main,'Fixture lights still compose with the leaf patch (they call the wrapped RE_Direct)');
ok(/#if defined\( USE_MAP \) && defined\( USE_ALPHATEST \)[\s\S]*leafLod[\s\S]*diffuseColor\.a\*=1\.0\+max\(0\.0,leafLod\)\*0\.22/.test(lit.fragmentShader),'Alpha rises gently in distant mips, only for mapped, alpha-tested cards');
ok(lit.fragmentShader.includes('normal=normalize(vNormal);')&&lit.fragmentShader.includes('if(leafNV<0.0)normal=normalize(normal-2.0*leafNV*leafView);')&&lit.fragmentShader.includes('nonPerturbedNormal=normal;'),'A canopy keeps its outward crown normal on both faces of a card, mirrored into the view side where it faces away (no grazing sheen)');
ok(lit.vertexShader.startsWith('uniform vec3 uCrownCenter;')&&/#include <beginnormal_vertex>\n\{ vec3 leafOut=position-uCrownCenter;/.test(lit.vertexShader)&&(lit.uniforms.uCrownBend?.value as number)===.6,'Card normals lean out from the crown centre');
const blade=new THREE.MeshStandardMaterial({map:leafMap,alphaTest:.3});
applyFoliageLighting(blade,{center:new THREE.Vector3(),bend:crownBend('reed-grass')});
const bladeShader=compile(blade);
ok(crownBend('reed-grass')===.2&&crownBend('fern-clump')===.2&&materialPatchKeys(blade).includes('foliage-summer-v2')&&!bladeShader.fragmentShader.includes('normal=normalize(vNormal);'),'Grass blades and fronds lean little and keep the usual two-sided normal');
const bark=new THREE.MeshStandardMaterial({name:'bark',roughness:.9});
applyFoliageLighting(bark,{center:new THREE.Vector3(),bend:.6});
ok(bark.roughness===.9&&materialPatchKeys(bark).length===0,'Bark and trunks are left alone');

// 3. Plants in the scene.
const landscape=source('src/features/deckcraft/components/viewer3d/Landscape3D.tsx');
ok(landscape.includes("leafTint?tintPlantInstance(color,plantFoliageTint(o.speciesRecord?.id),o.id):color.set('#ffffff')")&&landscape.includes('const leafTint=foliage&&(isLeafMaterial(original)||!(original as THREE.MeshStandardMaterial).map);'),'The species tint colours leaves (and untextured trunks, as before); textured bark keeps its own colour');
ok(landscape.includes('if(foliage)leafTransmitUniform(material).value=instance.castShadow?1:0;'),'Light through the leaf is on only where the plant casts its shadow (not LOD2 or the constrained tier)');
ok(landscape.includes('applyFoliageLighting(m,{center:source.geometry.boundingBox!.getCenter(new THREE.Vector3()),bend:crownBend(assetId??\'\')})'),'Each plant part leans its normals out from the centre of its own leaves');

// 4. Photo mode.
const photo=source('src/features/deckcraft/components/viewer3d/photoMaterials.ts');
ok(!/liftLeafMap|leafGlow|photoLeafLift|LEAF_GAIN/.test(photo)&&photo.includes("patches.some(key=>key.startsWith('foliage-summer-v2'))"),'Photo mode no longer bakes a lifted atlas or a leaf glow');
ok(!/\.transmission=/.test(photo.slice(photo.indexOf("patches.some(key=>key.startsWith('foliage-summer-v2'))"),photo.indexOf("}else if(patches.includes('bloom-lift-v1'))"))),'Photo leaves stay opaque cards: the tracer\'s transmission is see-through glass, not leaf translucency');
ok(SUN_ANGULAR_RADIUS_DEG.day===.27&&SUN_ANGULAR_RADIUS_DEG.golden<=.4&&SUN_ANGULAR_RADIUS_DEG.night===0,'The photo sun is the real sun: 0.27° by day, a little wider at golden hour');

console.log(`PLANT FOLIAGE OK — opaque canvas, honest leaves (no lift, matte, light through the leaf before the diffuse sum, crown normals, mip-aware alpha), sun-only light through the leaf, leaf-only tint, matching Photo mode; ${checks} checks.`);
