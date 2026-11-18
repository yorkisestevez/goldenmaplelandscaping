/**
 * Seasons S2 (2026-10-20): winter snow, fall leaves, and the lawn and sun by season.
 * - Snow is one patch: level surfaces turn white in drifts, walkable finishes are shovelled to a dusting (owner's call),
 *   and glass, water and lit fixtures never take snow. One shared switch turns it off again with no recompile.
 * - Photo mode's baked snow uses the same drift noise as the raster shader.
 * - The sun stands lower in fall and lower still in winter; summer keeps the sky's own sun.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {SNOW,SNOW_ON,applySnowCover,setSnowRole,snowCover,snowRole} from '../src/features/deckcraft/components/viewer3d/seasonSnow';
import {materialPatchKeys} from '../src/features/deckcraft/components/viewer3d/materialPatches';
import {SEASON_LAWN,SEASON_SUN} from '../src/features/deckcraft/components/viewer3d/seasonLook';


let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const source=(path:string)=>readFileSync(path,'utf8');
const viewer='src/features/deckcraft/components/viewer3d/';
function compile(material:THREE.Material){
 const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{} as Record<string,{value:unknown}>};
 material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
 return shader;
}

// 1. Which surfaces hold snow.
ok(snowRole(new THREE.MeshStandardMaterial())==='full','A plain surface (lawn, roof, rail, cap, foliage) takes full snow');
ok(snowRole(setSnowRole(new THREE.MeshStandardMaterial(),'dust'))==='dust','A marked walkable finish is shovelled to a dusting');
ok(snowRole(new THREE.MeshPhysicalMaterial({transmission:.4}))==='none','Water and glass (transmission) never take snow');
ok(snowRole(new THREE.MeshStandardMaterial({transparent:true,opacity:.6}))==='none','See-through surfaces never take snow');
ok(snowRole(new THREE.MeshStandardMaterial({emissive:'#ffffff',emissiveIntensity:2}))==='none','A lit fixture or flame never takes snow');
ok(snowRole(new THREE.MeshBasicMaterial())==='none'&&!applySnowCover(new THREE.MeshBasicMaterial()),'Unlit and shader materials (sky, horizon, snowfall) are left alone');

// 2. The patch: level surfaces, drifts in world space, and one shared switch.
const lawn=new THREE.MeshStandardMaterial();
ok(applySnowCover(lawn)&&materialPatchKeys(lawn).includes('snow-cover-v1'),'A full-snow surface carries the snow patch');
const shader=compile(lawn);
ok(shader.uniforms.uSnowOn===SNOW_ON&&(shader.uniforms.uSnowDepth as {value:number}).value===SNOW.depth.full,'Every program reads the one shared winter switch, at its own depth');
ok(/vSnowWorld=\(modelMatrix\*snowAt\)\.xyz;/.test(shader.vertexShader)&&/#ifdef USE_INSTANCING\n snowAt=instanceMatrix\*snowAt;/.test(shader.vertexShader),'Drifts follow world position (instances included), so they stay put as the camera moves');
ok(shader.fragmentShader.indexOf('snowCover')>shader.fragmentShader.indexOf('#include <lights_physical_fragment>')&&shader.fragmentShader.indexOf('snowCover')<shader.fragmentShader.indexOf('#include <lights_fragment_begin>'),'Snow changes the surface before it is lit, so it shades and takes shadow like snow');
ok(shader.fragmentShader.includes('material.diffuseContribution=mix(material.diffuseContribution,snowWhite,snowCover);')&&shader.fragmentShader.includes('material.specularColorBlended=mix('),'Snow writes the colours three r185 actually lights with (diffuseContribution, specularColorBlended)');
ok(shader.fragmentShader.includes('if(uSnowOn>0.0){'),'Out of winter the patched program draws the surface exactly as before');
ok(SNOW_ON.value===0,'The switch starts off');
const deck=setSnowRole(new THREE.MeshStandardMaterial(),'dust');applySnowCover(deck);
ok((compile(deck).uniforms.uSnowDepth as {value:number}).value===SNOW.depth.dust&&SNOW.depth.dust<.5,'A shovelled deck or patio keeps under half the snow');

// 3. Photo mode bakes the same drifts.
ok(snowCover(1,3.2,7.1)>.5&&snowCover(0,3.2,7.1)===0,'Photo snow: level ground holds snow, a wall does not');
ok(Math.abs(snowCover(.6,10,10)-snowCover(.6,10,10))<1e-12&&snowCover(.55,0,0)!==snowCover(.55,1.37,2.91),'Photo snow drifts vary over the ground and repeat exactly for a point');

// 4. Sun and lawn.
ok(SEASON_SUN.summer.elevationDeg===null&&SEASON_SUN.summer.gain===1,'Summer keeps the sky\'s own sun');
ok(SEASON_SUN.winter.elevationDeg!<SEASON_SUN.fall.elevationDeg!&&SEASON_SUN.fall.elevationDeg!<SEASON_SUN.spring.elevationDeg!&&SEASON_SUN.spring.elevationDeg!<64.17,'The sun stands lower in fall and lowest in winter (Barrie noon about 22°)');
ok(SEASON_LAWN.summer.every(v=>v===1)&&SEASON_LAWN.fall[2]<1&&SEASON_LAWN.spring[1]>1,'Summer\'s lawn is as scanned; spring greener, fall yellower');

// 5. Wiring.
const environment=source(viewer+'Environment3D.tsx'),scene=source(viewer+'SeasonScene.tsx'),blades=source(viewer+'GrassBlades.tsx'),yard=source(viewer+'Yard3D.tsx'),surfaces=source(viewer+'surfaceShaders.ts'),landscape=source(viewer+'Landscape3D.tsx'),deck3d=source(viewer+'Deck3DViewer.tsx');
ok(environment.includes('season.elevationDeg')&&environment.includes('season.gain'),'The sun takes the season\'s height and strength');
ok(scene.includes('useFrame(()=>{if(winter&&cover())invalidate();});')&&scene.includes("falling=winter&&q.tier!=='constrained'&&!coarse")&&scene.includes('SNOW_ON.value=winter?1:0'),'Falling snow on computers only; settled snow everywhere');
ok(blades.includes("visible={season!=='winter'}")&&!blades.includes("season==='winter')return null"),'No grass blades poke through the snow, and they come back as they were after winter (kept mounted)');
ok(yard.includes("if(role==='paver'||role==='stone-step'||role==='fire-pad')material.userData.snow='dust';")&&yard.includes('const material=useMemo<THREE.Material>(()=>shovelled(role,')&&surfaces.includes("material.userData.snow='dust';")&&yard.includes("material.userData.snow='dust'"),'Pavers, stone steps and deck boards are shovelled');
ok(landscape.includes("season==='fall'&&<FallenLeaves"),'Fallen leaves lie under the broadleaf trees in fall only');
ok(deck3d.includes('{winter&&<Suspense fallback={null}><SeasonScene/></Suspense>}')&&deck3d.includes("const SeasonScene=lazy(()=>import('./SeasonScene'));"),'The winter scene loads lazily, only while winter shows');

const turf=source(viewer+'Turf.tsx'),lawnSrc=source(viewer+'lawnSurface.ts');
ok(lawnSrc.includes('shader.uniforms.uMean=mean;')&&turf.includes('mean?.value.set(LAWN_MEAN[0]*r,LAWN_MEAN[1]*g,LAWN_MEAN[2]*b)'),'The far lawn takes the season tint too, so near and far lawn agree');

console.log(`check-season-snow: ${checks} checks passed`);
