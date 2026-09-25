import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import sharp from 'sharp';
import * as THREE from 'three';
import {SCENE_LOOK} from '../src/features/deckcraft/components/viewer3d/sceneLook';
import {fitSun,shadowKey} from '../src/features/deckcraft/components/viewer3d/shadowCache';
import {ATLAS_WIDTH,STRIP_ROWS,buildSwatchMaps,deltaE,grainIsVertical,rotate90} from '../src/features/deckcraft/components/viewer3d/swatchMaps';
import {PATCHED_CHUNKS,boardVariation,boxVariant,surfaceMaterial} from '../src/features/deckcraft/components/viewer3d/surfaceShaders';
import {DECKING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
import {SKY_DATA,skyStrength,skyYaw,sunDirection} from '../src/features/deckcraft/components/viewer3d/skyModel';
import {FAR_RING_IN,LAWN_CHUNKS,groundGeometry} from '../src/features/deckcraft/components/viewer3d/lawnSurface';
import {occlusionUv} from '../src/features/deckcraft/components/viewer3d/groundOcclusion';
import {buildYardModel,yardClip} from '../src/features/deckcraft/yardModel';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';

/**
 * DeckCraft's photographic look (the "Real Life" track, plan phases G1–G8). G1 is the render pipeline: ambient
 * occlusion from the scene's own depth, evening-only bloom, tone mapping after the effects, shadow maps redrawn only
 * when something that casts changes, the sun's shadow fitted to what casts, and the proposal pictures drawn through
 * the same pipeline. G2 is the boards: each swatch photo turned into an atlas of its own boards that keeps the photo's
 * colour, repeats without a seam and runs the grain along the board, and a shader that gives every board its own strip.
 * G3 is the sky and the ground: a real HDRI with its sun painted out and replaced by the scene's sun, a sky dome, haze,
 * and a photoscanned lawn that runs to the horizon and is shaded under what covers it.
 */
let checks=0;
const ok=(condition:unknown,message:string)=>{assert(condition,message);checks++;};
const read=(path:string)=>readFileSync(path,'utf8');
const VIEWER='src/features/deckcraft/components/viewer3d/';

// The look is plain data, shared with the photo engine.
ok(!/from ['"](three|@react-three)/.test(read(`${VIEWER}sceneLook.ts`)),'sceneLook.ts stays free of three.js');
ok(SCENE_LOOK.toneMapping==='Neutral'&&SCENE_LOOK.exposure===1,'Tone mapping stays Khronos PBR Neutral at exposure 1, so product colours stay faithful');
ok(SCENE_LOOK.bloom.threshold>1,'Only HDR light sources glow: the bloom threshold is above white');
ok(SCENE_LOOK.ao.intensity.day<=1&&SCENE_LOOK.ao.intensity.evening<SCENE_LOOK.ao.intensity.day,'Ambient occlusion is lighter in the evening, when fixtures carry the light');
ok(SCENE_LOOK.powderCoat.metalness===0&&SCENE_LOOK.powderCoat.clearcoat>0,'Powder coat is paint with a clear coat, not metal');

// Wiring.
const pipeline=read(`${VIEWER}renderPipeline.tsx`),viewer=read(`${VIEWER}Deck3DViewer.tsx`),environment=read(`${VIEWER}Environment3D.tsx`);
ok(pipeline.includes('this.gtao.setGBuffer(this.beauty.depthTexture!)'),'Ambient occlusion reads the scene’s own depth, so the scene is drawn once per frame');
ok(/if\(evening\)\{[\s\S]{0,80}UnrealBloomPass/.test(pipeline),'Bloom runs in the evening only');
ok(pipeline.includes('gl.shadowMap.autoUpdate=false')&&/if\(key!==state\.key\)\{[^}]*gl\.shadowMap\.needsUpdate=true;\}/.test(pipeline),'Shadow maps are drawn only when the shadow key changes');
ok(/catch\(error\)\{fail\(error\);\}\s*gl\.render\(scene,camera\);/.test(pipeline),'Any failure falls back to the plain renderer');
ok(viewer.includes('<RenderPipeline evening={evening}/>')&&viewer.includes('const pipeline=pipelineFor(gl);if(pipeline)pipeline.capture(scale);else gl.render(scene,camera);'),'The live view and the proposal pictures both draw through the pipeline');
ok(viewer.includes('shadows="percentage"')&&viewer.includes('antialias:false'),'Multisampling lives in the pipeline’s own target, and shadows use PCF (r185 retires PCFSoft)');
ok(environment.includes('<directionalLight name="sun" castShadow'),'The sun is named, so its shadow can be fitted');

// The shadow key: it changes when a shadow would, and not when only the camera or a colour does.
function sceneWithSun(){
  const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial();
  const deck=new THREE.Mesh(new THREE.BoxGeometry(16,1,12),material);deck.position.set(0,3,6);deck.castShadow=true;
  const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.3,3,.3),material,3);posts.castShadow=true;
  [[-7,1.5,1],[7,1.5,1],[0,1.5,11]].forEach(([x,y,z],i)=>posts.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,y,z)));posts.computeBoundingSphere();
  // A thin 20 ft pole (a pergola column): its shadow's tip lands far past anything a bounding sphere covers.
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,20),material);pole.position.set(-10,10,-2);pole.castShadow=true;
  const lawn=new THREE.Mesh(new THREE.PlaneGeometry(400,400),material);lawn.receiveShadow=true;
  const sun=new THREE.DirectionalLight('#fff',2);sun.name='sun';sun.castShadow=true;sun.position.set(21.6,38.4,31.2);
  Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:.5,far:192});
  scene.add(deck,posts,pole,lawn,sun);scene.updateMatrixWorld();
  return {scene,deck,posts,pole,sun,material};
}
{
  const {scene,deck,posts,sun,material}=sceneWithSun(),key=()=>{scene.updateMatrixWorld();return shadowKey(scene);},start=key();
  ok(key()===start,'The same scene gives the same key');
  material.color.set('#123456');new THREE.PerspectiveCamera().position.set(9,9,9);
  ok(key()===start,'A colour change or a camera move leaves the shadow maps alone');
  deck.position.x+=.5;const moved=key();ok(moved!==start,'Moving a caster redraws the shadow maps');
  posts.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-6,1.5,1));posts.instanceMatrix.needsUpdate=true;const shifted=key();ok(shifted!==moved,'Moving one instance redraws them');
  posts.count=2;const fewer=key();ok(fewer!==shifted,'Fewer instances redraw them');
  deck.visible=false;const hidden=key();ok(hidden!==fewer,'Hiding a caster redraws them');
  deck.visible=true;material.alphaTest=.5;material.needsUpdate=true;const cut=key();ok(cut!==hidden,'A material change that can cut a shadow redraws them');
  sun.target.position.set(0,0,-4);ok(key()!==cut,'Re-aiming a shadow-casting light redraws them');
}

// The sun's shadow: fitted tightly round everything that casts, with room beyond for the ground it lands on.
{
  const {scene,deck,posts,pole,sun}=sceneWithSun();fitSun(scene);
  const cam=sun.shadow.camera,area=(cam.right-cam.left)*(cam.top-cam.bottom);
  ok(area<96*96/4,`The fitted shadow covers a quarter or less of the old fixed square (${area.toFixed(0)} of ${96*96} sq ft), so its texels are four times as fine`);
  const inside=(p:THREE.Vector3)=>{const v=p.clone().applyMatrix4(cam.matrixWorldInverse);return v.x>=cam.left&&v.x<=cam.right&&v.y>=cam.bottom&&v.y<=cam.top&&-v.z>=cam.near&&-v.z<=cam.far;};
  const corners=new THREE.Box3().setFromObject(deck).getSize(new THREE.Vector3());
  ok([-1,1].every(sx=>[-1,1].every(sz=>inside(new THREE.Vector3(deck.position.x+sx*corners.x/2,deck.position.y,deck.position.z+sz*corners.z/2)))),'Every corner of the deck is inside the sun’s shadow');
  ok([0,1,2].every(i=>{const m=new THREE.Matrix4();posts.getMatrixAt(i,m);return inside(new THREE.Vector3().setFromMatrixPosition(m));}),'Every post is inside it');
  // Where the deck's shadow falls on the lawn: along the sunlight from each corner down to the ground.
  const toSun=sun.position.clone().normalize();
  ok([-1,1].every(sx=>[-1,1].every(sz=>{const c=new THREE.Vector3(deck.position.x+sx*8,deck.position.y,deck.position.z+sz*6);return inside(c.clone().addScaledVector(toSun,-c.y/toSun.y));})),'The ground the deck’s shadow lands on is inside it too');
  const tip=new THREE.Vector3(pole.position.x,20,pole.position.z);
  ok(inside(tip.clone().addScaledVector(toSun,-tip.y/toSun.y)),'So is the tip of a tall post’s shadow, well past the post itself');
  const empty=new THREE.Scene(),lonely=new THREE.DirectionalLight();lonely.name='sun';lonely.castShadow=true;empty.add(lonely);empty.updateMatrixWorld();
  const before={...lonely.shadow.camera};fitSun(empty);
  ok(lonely.shadow.camera.left===before.left&&lonely.shadow.camera.far===before.far,'With nothing casting, the sun’s shadow is left as it was');
}

// G2: every swatch becomes an honest, seamless atlas of its own boards.
const SWATCHES='src/features/deckcraft/assets/swatches/';
const files=readdirSync(SWATCHES).filter(f=>f.endsWith('.jpg')).sort();
const used=new Set(DECKING_CATALOGUE.flatMap(m=>m.colors.map(c=>c.swatch)));
ok([...used].every(f=>files.includes(f)),'Every catalogue colour has its swatch on disk');
let worstDelta=0,worstSeam=0;
for(const file of files){
  const {data,info}=await sharp(SWATCHES+file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const photo={width:info.width,height:info.height,data},maps=await buildSwatchMaps(photo,file.startsWith('wood-')?'wood':'composite');
  // TimberTech's square photos show four boards (Premier+ Natural Oak is a close-up of one surface), and the strips
  // stop before the board across them on the right.
  if(file.startsWith('tt-')&&Math.abs(info.width/info.height-1)<.35&&file!=='tt-premierplus-natural-oak.jpg')ok(maps.layout.kind==='boards'&&maps.strips===4&&maps.layout.strips.every(s=>s.x1<info.width*.82),`${file}: four boards, clear of the board across them`);
  else ok(maps.strips>=3,`${file}: at least three strips`);
  ok(maps.width===ATLAS_WIDTH&&maps.height===maps.strips*STRIP_ROWS&&maps.albedo.length===maps.width*maps.height*4,`${file}: the atlas is ${ATLAS_WIDTH} wide with ${STRIP_ROWS} rows a strip`);
  const delta=deltaE(maps.sourceMean,maps.atlasMean);worstDelta=Math.max(worstDelta,delta);
  ok(delta<1,`${file}: the atlas keeps the photo's colour (ΔE ${delta.toFixed(2)})`);
  // The grain runs along the atlas: across a row brightness changes less than down a column.
  ok(!grainIsVertical({width:maps.width,height:maps.height,data:maps.albedo}),`${file}: the grain runs along the board`);
  // Seamless along the grain: the last column runs on into the first about as smoothly as neighbours do.
  let wrap=0,inner=0,rows=0;
  for(let y=0;y<maps.height;y++){if(y%STRIP_ROWS<10||y%STRIP_ROWS>STRIP_ROWS-10)continue;rows++;const at=(x:number)=>maps.albedo[(y*maps.width+x)*4+1];wrap+=Math.abs(at(maps.width-1)-at(0));inner+=Math.abs(at(maps.width/2)-at(maps.width/2-1));}
  // A step under one grey level can't be seen, so a very even grain (cedar) is measured against that.
  const seam=wrap/Math.max(rows,inner);worstSeam=Math.max(worstSeam,seam);
  ok(seam<2.5,`${file}: no seam where the grain repeats (${seam.toFixed(2)}× an ordinary step)`);
  ok(maps.normal.every((v,i)=>i%4!==2||v>=128),`${file}: every normal faces out of the board`);
}
ok(grainIsVertical(rotate90({width:2,height:2,data:new Uint8Array(16)}))===false,'A flat picture has no grain to turn');
ok(!/from ['"](three|@react-three)/.test(read(`${VIEWER}swatchMaps.ts`)),'swatchMaps.ts stays free of three.js');

// The shader patch rewrites chunks three still has, and every board's pick is stable and in range.
for(const [name,lookup] of PATCHED_CHUNKS)ok((THREE.ShaderChunk as Record<string,string>)[name]?.includes(lookup),`ShaderChunk.${name} still has "${lookup}"`);
{
  const material=surfaceMaterial('#886644'),shader={uniforms:{} as Record<string,THREE.IUniform>,defines:{} as Record<string,string>,vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,undefined as never);
  ok(shader.vertexShader.includes('dcBoard();')&&shader.fragmentShader.includes('dcTex( map )')&&shader.fragmentShader.includes('dcTex( normalMap )')&&shader.fragmentShader.includes('dcTex( roughnessMap )')&&!/texture2D\( (map|normalMap|roughnessMap), v/.test(shader.fragmentShader),'The board shader samples colour, normal and roughness through each board’s own strip');
  ok('uStrips' in shader.uniforms&&!('DC_BOX_UV' in shader.defines),'A board material reads its own UVs');
  const box=boxVariant(material) as THREE.MeshStandardMaterial,boxShader={...shader,uniforms:{},defines:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  box.onBeforeCompile(boxShader as unknown as THREE.WebGLProgramParametersWithUniforms,undefined as never);
  ok('DC_BOX_UV' in boxShader.defines&&box!==material&&boxVariant(material)===box&&boxVariant(box)===box&&material.customProgramCacheKey()!==box.customProgramCacheKey(),'Rim, fascia and framing get one box-projected twin, compiled apart');
  const plain=new THREE.MeshStandardMaterial();ok(boxVariant(plain)===plain,'Other materials are left as they are');
  const a=boardVariation(12.5,-40),b=boardVariation(12.5,-40),c=boardVariation(18,-40);
  ok(a.every((v,i)=>v===b[i])&&a.some((v,i)=>v!==c[i])&&[a,c].every(v=>v[0]>=0&&v[0]<1&&v[1]>=0&&v[1]<1&&(v[2]===0||v[2]===1)),'A board keeps its strip while it stays put, and the next board gets another');
}
const viewer2=read(`${VIEWER}Deck3DViewer.tsx`);
ok(viewer2.includes("geometry.setAttribute('aVar',new THREE.InstancedBufferAttribute(variation,4))")&&viewer2.includes("g.setAttribute('aVar',new THREE.Float32BufferAttribute(")&&read(`${VIEWER}Skirting3D.tsx`).includes("g.setAttribute('aVar',"),'Boards, cut boards and skirting each carry their own pick');
ok(viewer2.includes("useSwatchTexture(swatchUrl('wood-pressure-treated.jpg'),'#8a7356')")&&viewer2.includes('function useBoxMaterial('),'Framing lumber shows pressure-treated grain along each piece');

// G3: the sky's numbers, files and wiring.
const ASSETS=`${VIEWER}assets/`,readme=read(`${ASSETS}README.md`);
{
  const {day,evening}=SKY_DATA,up=Math.sin(day.sunElevationDeg*Math.PI/180);
  ok(day.sunPainted&&day.sunElevationDeg>=25&&day.sunElevationDeg<=60,`The day sky's sun is painted out and stands ${day.sunElevationDeg}° up, a mid-day sun`);
  ok(Math.abs(day.skyIrradiance+day.sunIntensity*up-Math.PI)<.03,'Sun and sky light a horizontal white card at irradiance π, so a sunlit board shows its swatch colour');
  ok(Math.abs(evening.skyIrradiance+evening.sunIntensity*Math.max(0,Math.sin(evening.sunElevationDeg*Math.PI/180))-Math.PI)<.03&&!evening.sunPainted&&skyStrength('evening').sun===0,'The evening sky is normalised the same way, keeps its dusk glow and has no sun');
  ok([day,evening].every(d=>d.sunColor.every(c=>c>0&&c<=1)&&d.whiteBalance.every(w=>w>.6&&w<1.6)&&d.bandScale>0),'Sun colours, white balance and band scales are sane');
  // The HDRI turned by three's rule (world = R(yaw)·hdri) puts its sun where the scene's sun is.
  const el=day.sunElevationDeg*Math.PI/180,az=day.sunAzimuthDeg*Math.PI/180,hdriSun=new THREE.Vector3(Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az));
  const world=hdriSun.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0,skyYaw('day'),0)));
  ok(world.distanceTo(sunDirection())<1e-6,'The turned sky’s sun and the scene’s sun are the same direction, so shadows fall away from the bright sky');
  for(const name of ['day','evening']){
    const buffer=readFileSync(`${ASSETS}sky/sky-${name}-ibl.hdr`),hdr=new HDRLoader().setDataType(THREE.FloatType).parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength) as ArrayBuffer);
    const data=hdr.data as Float32Array;let peak=0,finite=true;for(let i=0;i<data.length;i+=4){const l=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];if(!Number.isFinite(l))finite=false;peak=Math.max(peak,l);}
    ok(hdr.width===1024&&hdr.height===512&&finite,`sky-${name}-ibl.hdr is a 1024 × 512 RGBE image that three reads`);
    ok(name==='evening'||peak<30,`The day lighting image has no sun left in it (brightest ${peak.toFixed(1)})`);
  }
}
const shipped=['lawn-color.webp','lawn-normal.webp','lawn-roughness.webp','lawn.json','sky-*-ibl.hdr','sky-*-band.webp','sky.json'];
ok(shipped.every(f=>readme.includes(f)),'Every shipped texture and sky file has its source and licence in assets/README.md');
const assetBytes=readdirSync(ASSETS,{recursive:true}).map(String).filter(f=>/\.(webp|hdr|jpg|png|json)$/.test(f)).reduce((n,f)=>n+readFileSync(`${ASSETS}${f}`).length,0);
ok(assetBytes<=15*1024*1024&&!readdirSync(ASSETS).some(f=>f.startsWith('grass008')),`The viewer's scanned assets total ${(assetBytes/1048576).toFixed(1)} MB, within 15 MB, and the old lawn is gone`);
{
  const viewer3=read(`${VIEWER}Deck3DViewer.tsx`),environment3=read(`${VIEWER}Environment3D.tsx`),sky=read(`${VIEWER}Sky3D.tsx`);
  ok(viewer3.includes('<Suspense fallback={<StudioLight evening={evening}/>}><Sky3D evening={evening}/></Suspense>')&&viewer3.includes('near:SCENE_LOOK.sky.cameraNear,far:SCENE_LOOK.sky.cameraFar'),'The real sky loads behind the studio light, and the camera sees to the sky dome');
  ok(environment3.includes('castShadow={!evening}')&&environment3.includes('SUN.clone().multiplyScalar(radius)')&&!environment3.includes('hemisphereLight'),'The scene’s sun takes the HDRI’s place (none in the evening), and no hemisphere light doubles the sky');
  ok(sky.includes('name="sky-dome"')&&sky.includes('depthWrite:false,fog:false')&&sky.includes('scene.fog.color.setRGB(')&&viewer3.includes('<fogExp2 attach="fog" args={[')&&sky.includes('preloadEvening()')&&sky.includes("fallback={<SkyOf lighting=\"day\" strength={skyStrength('evening').environment}/>}"),'The dome draws behind everything without fog; one haze lasts the viewer’s life (adding fog recompiles every material) and the sky only recolours it; the evening sky preloads once the day is in, and the dimmed day sky stands in while it loads');
  ok(SCENE_LOOK.sky.domeRadiusFt<SCENE_LOOK.sky.cameraFar&&Math.exp(-((100*SCENE_LOOK.sky.fogDensity)**2))>.985,'The dome sits inside the far plane, and haze stays under 1.5% at 100 ft');
}
// The lawn: the chunks it patches, a natural mean colour, and ground that faces up all the way to the horizon.
for(const [name,lookup] of LAWN_CHUNKS)ok((THREE.ShaderChunk as Record<string,string>)[name]?.includes(lookup),`ShaderChunk.${name} still has "${lookup}"`);
{
  const lawn=JSON.parse(read(`${ASSETS}lawn.json`)),[r,g,b]=lawn.meanSrgb,saturation=(Math.max(r,g,b)-Math.min(r,g,b))/Math.max(r,g,b);
  ok(g>r&&g>b&&saturation<=.5,`The lawn is a natural green (mean sRGB ${lawn.meanSrgb.join(', ')}, saturation ${saturation.toFixed(2)})`);
  const yard=buildYardModel(DEFAULT_DECK),tw=yard.terrain.widthFt*12,td=yard.terrain.depthFt*12,width=192,depth=144,bounds={minX:width/2-tw/2,minZ:depth/2-td/2,width:tw,depth:td};
  const geometry=groundGeometry(yard,yardClip(yard.excavationRegions.map(e=>e.polygon)),width,depth,bounds),pos=geometry.getAttribute('position');
  let down=0,far=0;const a=new THREE.Vector3(),b2=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<pos.count;i+=3){a.fromBufferAttribute(pos,i);b2.fromBufferAttribute(pos,i+1);c.fromBufferAttribute(pos,i+2);if(b2.clone().sub(a).cross(c.clone().sub(a)).y<=0)down++;for(const v of [a,b2,c])far=Math.max(far,Math.hypot(v.x-width/2,v.z-(bounds.minZ+td/2)));}
  ok(down===0,`Every ground triangle faces up (${down} face down)`);
  ok(far>FAR_RING_IN*.99,'The ground runs out to the horizon ring');
  const [u0,v0]=occlusionUv(bounds,bounds.minX,bounds.minZ),[u1,v1]=occlusionUv(bounds,bounds.minX+tw,bounds.minZ+td);
  ok(u0===0&&v0===1&&u1===1&&v1===0,'The occlusion map spans the yard: far side at the top, as its camera looking down sees it');
  const turf=read(`${VIEWER}Turf.tsx`),occlusion=read(`${VIEWER}groundOcclusion.ts`),pipeline3=read(`${VIEWER}renderPipeline.tsx`);
  ok(turf.includes('timer=setTimeout(redraw,OCCLUSION_SETTLE_MS)')&&turf.includes('occlusion.texture.channel=1')&&pipeline3.includes('for(const listen of shadowListeners.get(gl)??[])listen();gl.shadowMap.needsUpdate=true;')&&occlusion.includes('scene.overrideMaterial=this.cover'),'The lawn’s shade under the deck is redrawn once changes to what casts settle, never mid-drag');
}

console.log(`DECK REALISM OK — look, pipeline wiring, shadow key and sun fit; ${files.length} swatch atlases (worst ΔE ${worstDelta.toFixed(2)}, worst repeat ${worstSeam.toFixed(2)}×), the board shader and its picks; the sky, its sun and the lawn to the horizon; ${checks} checks.`);
