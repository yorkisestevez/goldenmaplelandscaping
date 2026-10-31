import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import sharp from 'sharp';
import * as THREE from 'three';
import ts from 'typescript';
import {SCENE_LOOK} from '../src/features/deckcraft/components/viewer3d/sceneLook';
import {SHOWCASE_BLOOM,SHOWCASE_STILL_SAMPLES,daySkyLinear,goldenSkyLinear,gradeLinear} from '../src/features/deckcraft/components/viewer3d/showcaseGrade';
import {buildSurfaceDetail,type DetailKind} from '../src/features/deckcraft/components/viewer3d/detailMaps';
import {cameraSetback} from '../src/features/deckcraft/components/viewer3d/cameraFraming';
import {railGeometry} from '../src/features/deckcraft/components/viewer3d/EasedRails';
import {fitSun,shadowKey} from '../src/features/deckcraft/components/viewer3d/shadowCache';
import {ATLAS_WIDTH,BOARD_FACE_IN,STRIP_ROWS,buildSwatchMaps,deltaE,grainIsVertical,rotate90} from '../src/features/deckcraft/components/viewer3d/swatchMaps';
import {BOARD_PIECE,EDGE_SHADE,GRAIN_BLEND,PATCHED_CHUNKS,edgeShade,RELIEF_EDGE,RELIEF_FULL,boardVariation,boxVariant,grainBlend,grainPick,reliefWeight,surfaceMaterial} from '../src/features/deckcraft/components/viewer3d/surfaceShaders';
import {BOARD_EASE_IN,GAP_UNDERLAY,boardPieceGeometry,gapUnderlayOutlines,outlineGeometry} from '../src/features/deckcraft/components/viewer3d/boardPieces';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {insidePolygon} from '../src/features/deckcraft/lib/polygonCuts';
import {DECKING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
import {SKY_DATA,skyStrength,skyYaw,sunDirection} from '../src/features/deckcraft/components/viewer3d/skyModel';
import {FAR_RING_IN,LAWN_CHUNKS,groundGeometry,lawnMaterial} from '../src/features/deckcraft/components/viewer3d/lawnSurface';
import {lawnAerial} from '../src/features/deckcraft/components/viewer3d/skyShade';
import {BELT,BELT_FRAGMENT,beltGeometry,beltRadii} from '../src/features/deckcraft/components/viewer3d/horizonBelt';
import {occlusionUv} from '../src/features/deckcraft/components/viewer3d/groundOcclusion';
import {buildYardModel,yardClip} from '../src/features/deckcraft/yardModel';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {HOUSE_CHUNKS,HOUSE_SURFACES,backingSurface,claddingSurface} from '../src/features/deckcraft/components/viewer3d/houseSurfaceKinds';
import {WINDOW_ROOM,paneGeometry,windowGlass} from '../src/features/deckcraft/components/viewer3d/windowGlass';
import type {DeckData,HouseCladding,YardFeature} from '../src/features/deckcraft/types';
import {BANK_RUN,GRADED_ROLES,bankGeometry,retainedBankGeometry,seatOnLawn,illustrativeBanksVisible} from '../src/features/deckcraft/components/viewer3d/finishedGrade';
import {yardWallPath} from '../src/features/deckcraft/yardPathGeometry';
import {lawnHeight} from '../src/features/deckcraft/components/viewer3d/lawnSurface';
import {slabGeometry} from '../src/features/deckcraft/components/viewer3d/slabGeometry';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {yardFinishGeometry} from '../src/features/deckcraft/components/viewer3d/yardFinishGeometry';

/**
 * DeckCraft's photographic look (the "Real Life" track, plan phases G1–G8). G1 is the render pipeline: ambient
 * occlusion from the scene's own depth, evening-only bloom, tone mapping after the effects, shadow maps redrawn only
 * when something that casts changes, the sun's shadow fitted to what casts, and the proposal pictures drawn through
 * the same pipeline. G2 is the boards: each swatch photo turned into an atlas of its own boards that keeps the photo's
 * colour, repeats without a seam and runs the grain along the board, and a shader that gives every board its own strip.
 * G3 is the sky and the ground: a real HDRI with its sun painted out and replaced by the scene's sun, a sky dome, haze,
 * and a photoscanned lawn that runs to the horizon and is shaded under what covers it.
 * G4 is the house: window glass that reflects like double glazing with a room behind it, and scanned or painted
 * detail on the cladding that keeps the colour the customer picked.
 * G5 is the yard: scanned detail on paving, walls and rocks, chamfered pavers whose joints show, calm water, and the
 * earthwork finished in the finished views (a lawn bank over a retaining wall's backfill, rocks set into the lawn).
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
ok(SHOWCASE_BLOOM.threshold>1&&SHOWCASE_BLOOM.strength<SCENE_LOOK.bloom.strength,'Showcase night bloom stays above white and weaker than the evening default, so landscape lights glow without blowing the deck out');
{
  const toSrgb=(v:number)=>{const c=Math.min(1,Math.max(0,v));return (c<=.0031308?c*12.92:1.055*c**(1/2.4)-.055)*255;};
  const pair=(rgb:readonly[number,number,number])=>rgb.map(toSrgb) as number[];
  const grey:[number,number,number]=[.18,.18,.18],brown:[number,number,number]=[.28,.16,.09];
  ok(deltaE(pair(grey),pair(gradeLinear(grey,'day')))<1.25,'The day grade leaves a mid grey within a barely visible ΔE of the swatch');
  ok(deltaE(pair(brown),pair(gradeLinear(brown,'day')))<3,'The day grade leaves a decking brown close to the product colour');
  const warm=gradeLinear([.7,.55,.3],'golden');ok(warm[0]>warm[2],'Golden hour warms the highlights');
  const cyan:[number,number,number]=[.03,.073,.119],lifted=daySkyLinear(cyan,4,1),plain=daySkyLinear(cyan,4,0);
  ok(lifted[0]>0.14&&lifted[0]>lifted[2]*0.35,'Showcase day sky keeps red above the neutral toe on a cyan photograph');
  ok(Math.abs(plain[0]-cyan[0]*4)<1e-6&&Math.abs(plain[2]-cyan[2]*4)<1e-6,'Editor and night skies stay on the photograph');
  const goldenSky=goldenSkyLinear(cyan,4,1),goldenOff=goldenSkyLinear(cyan,4,0),gradedSky=gradeLinear(goldenSky,'golden');
  ok(goldenSky[0]/goldenSky[2]>(cyan[0]*4)/(cyan[2]*4)&&goldenSky[2]>goldenSky[0]&&gradedSky[2]>gradedSky[0],'Showcase golden hour warms a cyan sky and keeps its blue');
  ok(Math.abs(goldenOff[0]-cyan[0]*4)<1e-6,'The golden sky recolor is off for day, night and the editor');
  const leaf=gradeLinear([.05,.12,.03],'golden'),shade=gradeLinear([.06,.07,.09],'golden');
  ok(leaf[1]>leaf[0]&&leaf[1]>leaf[2],'Golden hour leaves green foliage green');
  ok(shade[2]>=shade[0],'Golden hour open shade stays lightly cool');
  for(const kind of ['paver','slab','cap','stone','deck','siding'] as DetailKind[]){
    const map=buildSurfaceDetail(kind,32);let sum=0,z=0,facesOut=true;const n=map.size*map.size;
    for(let i=0;i<n;i++){sum+=map.albedo[i*4];const b=map.normal[i*4+2];z+=b;if(b<128)facesOut=false;}
    ok(Math.abs(sum/n-128)<.51&&facesOut&&z/n>180,`${kind} detail is a zero-mean colour modulation whose normals face out`);
  }
  const span=(kind:DetailKind)=>{const map=buildSurfaceDetail(kind,128);let lo=255,hi=0;for(let i=0;i<map.albedo.length;i+=4){lo=Math.min(lo,map.albedo[i]);hi=Math.max(hi,map.albedo[i]);}return hi-lo;};
  const pavers=buildSurfaceDetail('paver',128),at=(x:number,y:number)=>pavers.albedo[(y*128+x)*4];
  ok(span('paver')>48&&Math.abs(at(12,12)-at(38,12))>8,'Paver joints sit below the slab, and neighbouring slabs do not share one tone');
  ok(span('siding')>40,'Siding courses keep a shadow line under each lap');
}
for(const size of [[.75,36,.75],[3.5,42,3.5],[192,1.75,1.75]] as [number,number,number][]){
  const geometry=railGeometry(size);geometry.computeBoundingBox();
  const extent=geometry.boundingBox!.getSize(new THREE.Vector3()).toArray(),pos=geometry.getAttribute('position'),norm=geometry.getAttribute('normal');
  ok(extent.every((v,i)=>Math.abs(v-size[i])<1e-5),'Rail edge easing preserves the extrusion dimensions');
  let outward=true;for(let i=0;i<pos.count;i++)if(new THREE.Vector3().fromBufferAttribute(pos,i).dot(new THREE.Vector3().fromBufferAttribute(norm,i))<=0)outward=false;
  ok(outward,'Eased rail normals point outwards on short pickets and long handrails');geometry.dispose();
}

// Wiring.
const pipeline=read(`${VIEWER}renderPipeline.tsx`),viewer=read(`${VIEWER}Deck3DViewer.tsx`),environment=read(`${VIEWER}Environment3D.tsx`);
ok(pipeline.includes('this.gtao.setGBuffer(this.beauty.depthTexture!)'),'Ambient occlusion reads the scene’s own depth, so the scene is drawn once per frame');
ok(/if\(evening\)\{[\s\S]{0,80}UnrealBloomPass/.test(pipeline),'Bloom runs in the evening only');
{
  const ast=ts.createSourceFile('renderPipeline.tsx',pipeline,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),updates:ts.BinaryExpression[]=[];
  const visit=(node:ts.Node)=>{if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&node.left.getText(ast)==='gl.shadowMap.needsUpdate'&&node.right.kind===ts.SyntaxKind.TrueKeyword)updates.push(node);ts.forEachChild(node,visit);};visit(ast);
  const guarded=(node:ts.Node)=>{let parent=node.parent;while(parent){if(ts.isIfStatement(parent)&&parent.expression.getText(ast).replace(/\s/g,'')==='key!==state.key')return parent.thenStatement.pos<=node.pos&&node.end<=parent.thenStatement.end;parent=parent.parent;}return false;};
  ok(pipeline.includes('gl.shadowMap.autoUpdate=false')&&updates.length===1&&updates.every(guarded),'Shadow maps are drawn only when the shadow key changes, including nested quality-size changes');
}
ok(/catch\(error\)\{fail\(error\);\}\s*gl\.render\(scene,camera\);/.test(pipeline),'Any failure falls back to the plain renderer');
ok(viewer.includes('<RenderPipeline evening={evening}/>')&&viewer.includes('const pipeline=pipelineFor(gl);if(pipeline)pipeline.capture(scale);else gl.render(scene,camera);'),'The live view and the proposal pictures both draw through the pipeline');
ok(viewer.includes('shadows="percentage"')&&viewer.includes('antialias:false'),'Multisampling lives in the pipeline’s own target, and shadows use PCF (r185 retires PCFSoft)');
ok(environment.includes('<directionalLight name="sun" castShadow'),'The sun is named, so its shadow can be fitted');
ok(environment.includes('GOLDEN_ELEVATION=7*Math.PI/180')&&environment.includes('name="golden-rim"')&&environment.includes('daySun*2.05'),'Showcase golden hour uses a low raking sun and a warm rim');

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
const SWATCH_SOURCES=JSON.parse(readFileSync(`${SWATCHES}sources.json`,'utf8')).swatches as Record<string,unknown>;
let worstDelta=0,worstSeam=0;
for(const file of files){
  const {data,info}=await sharp(SWATCHES+file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const photo={width:info.width,height:info.height,data},maps=await buildSwatchMaps(photo,file.startsWith('wood-')?'wood':'composite');
  // TimberTech's square photos show four boards (Premier+ Natural Oak is a close-up of one surface), and the strips
  // stop before the board across them on the right.
  if(file.startsWith('tt-')&&Math.abs(info.width/info.height-1)<.35&&file!=='tt-premierplus-natural-oak.jpg')ok(maps.layout.kind==='boards'&&maps.strips===4&&maps.layout.strips.every(s=>s.x1<info.width*.82),`${file}: four boards, clear of the board across them`);
  // Deckorators' installed close-ups (sources.json) are four boards with one across them, mirrored so it is on the right.
  else if(file.startsWith('dk-')&&SWATCH_SOURCES[file])ok(maps.layout.kind==='boards'&&maps.strips===4&&maps.layout.strips.every(s=>s.x1<info.width*.82),`${file}: four boards, clear of the board across them`);
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
  // Real-scale grain: a photo of whole boards repeats over the length of board it shows (its boards are BOARD_FACE_IN
  // wide); a close-up of one surface, with no board to measure, keeps the 48 in repeat.
  if(maps.layout.kind==='boards'){const s=maps.layout.strips[0],whole=Math.max(...maps.layout.strips.map(t=>t.y1-t.y0)),shown=BOARD_FACE_IN*(s.x1-s.x0)*.875/(whole/.8);ok(Math.abs(maps.repeatIn-shown)<.01&&maps.repeatIn>=8&&maps.repeatIn<=24,`${file}: the grain repeats over the ${maps.repeatIn.toFixed(1)} in of board the photo shows`);}
  else ok(maps.repeatIn===48,`${file}: a one-surface close-up keeps the 48 in repeat`);
}
ok(grainIsVertical(rotate90({width:2,height:2,data:new Uint8Array(16)}))===false,'A flat picture has no grain to turn');
{
  const w=48,h=36,data=new Uint8Array(w*h*4);
  for(let i=0;i<data.length;i+=4){data[i]=90;data[i+1]=62;data[i+2]=40;data[i+3]=255;}
  const wide=await buildSwatchMaps({width:w,height:h,data},'composite',async()=>{},128);
  const narrow=await buildSwatchMaps({width:w,height:h,data},'composite');
  const spread=(bytes:Uint8Array)=>{let lo=255,hi=0;for(let i=0;i<bytes.length;i+=4){lo=Math.min(lo,bytes[i]);hi=Math.max(hi,bytes[i]);}return hi-lo;};
  ok(wide.width===128&&wide.normal.some((v,i)=>i%4===3&&v!==255)&&deltaE(wide.sourceMean,wide.atlasMean)<1,'A wider atlas keeps the photo mean and packs height into the normal alpha');
  ok(spread(wide.roughness)>spread(narrow.roughness)+12,'Showcase composite decking varies roughness, so the grain can catch a sheen');
}
ok(!/from ['"](three|@react-three)/.test(read(`${VIEWER}swatchMaps.ts`)),'swatchMaps.ts stays free of three.js');

// Board photos sharp enough for a close look: the manufacturers' 1000 px close-ups. The photos still below that are
// listed here, and the list only shrinks: a listed photo that has been replaced fails until it is taken off.
const MIN_SOURCE_EDGE=1000;
const LOW_RES_SWATCHES=new Set(['dk-border-dark-slate','dk-summit-boulder','dk-summit-cliffside','dk-summit-glacier','tt-harvest-brownstone','tt-harvest-kona','tt-harvest-slate-gray','tt-harvestplus-timber-gray','tt-harvestplus-toasted-wheat','tt-landmark-american-walnut','tt-landmark-boardwalk','tt-landmark-castle-gate','tt-landmark-french-white-oak','tt-legacy-ashwood','tt-legacy-espresso','tt-legacy-mocha','tt-legacy-pecan','tt-legacy-tigerwood','tt-legacy-whitewash-cedar','tt-premier-dark-teak','tt-premier-maritime-gray','tt-premierplus-natural-oak','tt-prime-dark-teak','tt-prime-maritime-gray','tt-primeplus-coconut-husk','tt-primeplus-dark-cocoa','tt-primeplus-sea-salt-gray','tt-reserve-antique-leather','tt-reserve-dark-roast','tt-reserve-driftwood','tt-reserve-reclaimed-chestnut','tt-terrain-brown-oak','tt-terrain-silver-maple','tt-terrainplus-dark-oak','tt-terrainplus-natural-white-oak','tt-terrainplus-weathered-oak','tt-vintage-coastline','tt-vintage-cypress','tt-vintage-dark-hickory','tt-vintage-english-walnut','tt-vintage-mahogany','tt-vintage-weathered-teak','wood-cedar','wood-pressure-treated'].map(n=>`${n}.jpg`));
for(const file of files){
  const {width=0,height=0}=await sharp(SWATCHES+file).metadata(),edge=Math.min(width,height);
  ok(LOW_RES_SWATCHES.has(file)?edge<MIN_SOURCE_EDGE:edge>=MIN_SOURCE_EDGE,LOW_RES_SWATCHES.has(file)?`${file}: replaced (${width}×${height}); take it off LOW_RES_SWATCHES`:`${file}: at least ${MIN_SOURCE_EDGE} px on its short side (${width}×${height})`);
}
// Every sharper photo cites where it came from (sources.json). Shoreline arrived at 2000 px before citations were kept.
const SOURCES=JSON.parse(read(`${SWATCHES}sources.json`)).swatches as Record<string,{url:string;retrieved:string;edit:string}>,UNCITED=new Set(['dk-venture-shoreline.jpg']);
ok(files.filter(f=>!LOW_RES_SWATCHES.has(f)&&!UNCITED.has(f)).every(f=>/^https:\/\/(www\.deckorators\.com\/cdn\/shop\/files|shop\.timbertech\.com\/wp-content\/uploads)\//.test(SOURCES[f]?.url??'')&&SOURCES[f].retrieved&&SOURCES[f].edit)&&Object.keys(SOURCES).every(f=>files.includes(f)&&!LOW_RES_SWATCHES.has(f)),'Every sharper swatch cites its manufacturer photo, and every citation is a swatch on disk');
ok([...LOW_RES_SWATCHES].every(f=>files.includes(f))&&LOW_RES_SWATCHES.size<=44,'Every low-resolution swatch listed is still on disk, and the list never grows');
{const hook=read(`${VIEWER}useSwatchTexture.ts`);ok(!/import\s*\{[^}]*buildSwatchMaps/.test(hook)&&hook.includes("import('./swatchMaps').then(m => m.buildSwatchMaps("),'The atlas builder stays out of the 3D viewer chunk: the worker runs it, and the main thread loads it only when no worker can start');}
ok(/HIGH_READ_EDGE\s*=\s*2048/.test(read(`${VIEWER}useSwatchTexture.ts`))&&read(`${VIEWER}useSwatchTexture.ts`).includes('width > ATLAS_WIDTH ? HIGH_READ_EDGE : READ_EDGE'),'The high tier reads the photo at up to 2048 px for its 2048 atlas');

// Repetition along a long board: every 48 in tile of a board takes its own strip and offset (the shader's grainPick),
// crossfading over the tile's last GRAIN_BLEND, so a 16 ft board does not show one stretch of grain four times.
let repeatMean=0;
{
  const {data,info}=await sharp(SWATCHES+'tt-harvest-brownstone.jpg').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const maps=await buildSwatchMaps({width:info.width,height:info.height,data},'composite'),W=maps.width,a=maps.albedo;
  const luma=(strip:number,u:number)=>{const x=((Math.floor(u*W)%W)+W)%W,i=((strip*STRIP_ROWS+STRIP_ROWS/2)*W+x)*4;return .2126*a[i]+.7152*a[i+1]+.0722*a[i+2];};
  const along=(seed:number[],u:number)=>{
    const tile=Math.floor(u),[sa,oa]=grainPick(seed[0],seed[1],tile,maps.strips),[sb,ob]=grainPick(seed[0],seed[1],tile+1,maps.strips),w=grainBlend(u-tile);
    return luma(sa,u+oa)*(1-w)+luma(sb,u+ob)*w;
  };
  const pearson=(p:number[],q:number[])=>{const m=(v:number[])=>v.reduce((s,x)=>s+x,0)/v.length,mp=m(p),mq=m(q);let n=0,sp=0,sq=0;p.forEach((x,i)=>{n+=(x-mp)*(q[i]-mq);sp+=(x-mp)**2;sq+=(q[i]-mq)**2;});return n/Math.sqrt(sp*sq||1);};
  let sum=0,count=0,steps=0,inner=0;const fs=Array.from({length:256},(_,i)=>i/256*(1-GRAIN_BLEND));
  for(let b=0;b<40;b++){
    const seed=boardVariation(b*5.6875,b*31.7);
    for(let k=0;k<3;k++){sum+=pearson(fs.map(f=>along(seed,k+f)),fs.map(f=>along(seed,k+1+f)));count++;}
    for(let k=1;k<4;k++){steps+=Math.abs(along(seed,k+.5/W)-along(seed,k-.5/W));inner+=Math.abs(along(seed,k+.3+.5/W)-along(seed,k+.3-.5/W));}
  }
  repeatMean=sum/count;
  ok(repeatMean<.35,`Grain along a long board does not repeat tile after tile (mean correlation ${repeatMean.toFixed(2)}; one strip repeated is 1)`);
  ok(steps<inner*2.5,`No seam where one tile's grain hands over to the next (${(steps/Math.max(inner,1e-9)).toFixed(2)}× an ordinary step)`);
  const pick=grainPick(.25,.5,3,4),again=grainPick(.25,.5,3,4);
  ok(pick[0]===again[0]&&pick[1]===again[1]&&Number.isInteger(pick[0])&&pick[0]>=0&&pick[0]<4&&pick[1]>=0&&pick[1]<1,'A tile keeps its strip and offset while the board stays put');
  ok(grainBlend(0)===0&&grainBlend(.5)===0&&grainBlend(1)===1,'A tile is its own grain until the handover at its end');
}
// Board lines that hold at a distance: each board's long edges shade over about a quarter inch, never thinner than a
// pixel, and the shading fades out once a whole board is only a few pixels wide.
{
  const close=.02,far=.08,tiny=.5,mid=(px:number)=>edgeShade(.5,px);
  ok(edgeShade(0,close)<mid(close)*(EDGE_SHADE.dark+1e-9)&&edgeShade(.02,close)<edgeShade(.04,close)&&mid(close)-1<.02,'Close up, a board is its own colour mid-face and darkens into its eased edges');
  ok(edgeShade(.04,far)/mid(far)<.99&&edgeShade(.04,close)/mid(close)>edgeShade(.04,far)/mid(far),'Further off the shaded line stays at least a pixel wide instead of vanishing');
  ok(edgeShade(0,tiny)===1,'Boards a few pixels wide are not striped dark');
  ok(edgeShade(0,0)===1&&edgeShade(1,0)===1,'A board’s long sides (one across value over the face) are not darkened: no fringe under a tread nosing or along the rim');
  let worstMean=0;for(const px of [.002,.01,.02,.05,.1,.15,.2,.25,.3,.4]){let s=0;const n=4000;for(let i=0;i<n;i++)s+=edgeShade((i+.5)/n,px);worstMean=Math.max(worstMean,Math.abs(s/n-1));}
  ok(worstMean<.003,`The edge shade keeps the board's mean colour at every distance (worst ${(worstMean*100).toFixed(2)}%)`);
  const compile=(m:THREE.Material)=>{const s={uniforms:{} as Record<string,THREE.IUniform>,defines:{} as Record<string,string>,vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(s as unknown as THREE.WebGLProgramParametersWithUniforms,undefined as never);return s;};
  const material=surfaceMaterial('#886644'),mesh=compile(material),box=compile(boxVariant(material));
  ok(mesh.fragmentShader.includes('if(vDcBoard<1.5||px<=')&&mesh.fragmentShader.includes(',band=max(0.045,px)')&&mesh.vertexShader.includes('vDcBoard=aVar.w;')&&box.vertexShader.includes('vDcBoard=0.;'),'Only finished board pieces shade their edges; box-projected rim and framing do not');
  ok(mesh.fragmentShader.includes('float gs=vDcBoard>1.5?uGrainScale:1.,gu=vDcUv.x*gs;')&&'uGrainScale' in mesh.uniforms,'Finished boards take their swatch’s real grain scale; every other piece keeps the 48 in repeat');
  ok(mesh.fragmentShader.includes('if(vDcBoard>1.5){')&&mesh.fragmentShader.includes('dcUvA=dcUvB=vec2(vDcUv.x+seed.y,(min(floor(seed.x*uStrips),uStrips-1.)+dcV)/uStrips);dcW=0.;'),'Fascia, cladding, skirting, timbers and box-projected framing keep one strip and offset over the piece, as before');
  ok(mesh.fragmentShader.includes('highp uint dcMix(highp uint h)')&&mesh.fragmentShader.includes('+uint(int(tile))')&&!/sin\([^)]*tile/.test(mesh.fragmentShader),'The per-tile pick is an integer hash, so both sides of a tile boundary agree exactly on every GPU');
  ok(mesh.fragmentShader.includes(`smoothstep(${EDGE_SHADE.fadeFrom},${EDGE_SHADE.fadeTo},px)`)&&mesh.fragmentShader.includes(`smoothstep(${1-GRAIN_BLEND},1.,gu-tile)`)&&mesh.fragmentShader.includes('uint(s.x*65536.0)'),'Shader constants are written as GLSL floats');
  const flat=boardVariation(3,4),board=boardVariation(3,4,true),viewer3=read(`${VIEWER}Deck3DViewer.tsx`);
  ok(flat[3]===0&&board[3]===BOARD_PIECE&&BOARD_PIECE>1.5&&flat.slice(0,3).every((v,i)=>v===board[i])&&(viewer3.match(/boardVariation\([^)]*,true\)/g)??[]).length===2&&!/boardVariation\([^)]*true/.test(read(`${VIEWER}slabGeometry.ts`)+read(`${VIEWER}raisedBedTimber.ts`)),'Deck board batches and cut pieces are marked as finished boards; skirting, raised-bed timbers and geometry with no grain attribute (notched stringers read WebGL’s default w=1) are not');
}

// Boards, not a slab: an eased top edge that catches its own highlight, and the dark cavity under the gaps.
{
  const g=boardPieceGeometry(96,1,5.5);g.computeBoundingBox();
  const size=g.boundingBox!.getSize(new THREE.Vector3()),pos=g.getAttribute('position'),norm=g.getAttribute('normal');
  ok(Math.abs(size.x-96)<1e-6&&Math.abs(size.y-1)<1e-6&&Math.abs(size.z-5.5)<1e-6,'A board keeps its real size with the ease');
  let flatEdge=0;const tilts=new Set<number>();
  for(let i=0;i<pos.count;i++){
    if(Math.abs(pos.getY(i)-.5)<1e-6&&Math.abs(norm.getY(i)-1)<1e-6)flatEdge=Math.max(flatEdge,Math.abs(pos.getZ(i)));
    // Along the long edge (no lean towards the board's end), from the top face round to the side.
    if(Math.abs(norm.getX(i))<1e-6&&norm.getZ(i)>=0&&norm.getY(i)>=0)tilts.add(Math.round(Math.acos(Math.min(1,norm.getY(i)))*180/Math.PI));
  }
  ok(BOARD_EASE_IN===.125&&Math.abs(flatEdge-(2.75-BOARD_EASE_IN))<1e-6,`The flat face stops ${BOARD_EASE_IN} in short of the edge (${(2.75-flatEdge).toFixed(3)} in)`);
  ok([...tilts].some(t=>t>20&&t<70),'The ease turns through the radius, so the edge catches a highlight of its own');
  g.dispose();
  // The cavity: each level's decking outline just under its boards, so it closes every gap and joint and never shows
  // past the outer boards, a mitre or a clipped corner (a slab per board stuck out under tread nosings and the rim).
  // A winder level has no boards of its own and its treads step down below its top, so it gets no cavity.
  const designs:[string,DeckData][]=[['Straight',DEFAULT_DECK],['Picture Frame',{...structuredClone(DEFAULT_DECK),pattern:'Picture Frame',pictureFrameRows:2}],['Winder',{...structuredClone(DEFAULT_DECK),height:72,stairType:'Winder'}],['Landing',{...structuredClone(DEFAULT_DECK),height:72,stairType:'Landing'}]];
  const area=(p:{x:number;y:number}[])=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0))/2;
  for(const [name,design] of designs){
    const model=buildDeckTakeoff(design),decked=model.levels.filter(l=>l.boards.length>0),cavities=gapUnderlayOutlines(model.levels);
    ok(cavities.length===decked.length&&cavities.every((c,i)=>{const l=decked[i],o=(l.deckingFootprint??l.footprint).outline;return c.points.length===o.length&&c.points.every((p,k)=>p.x===o[k].x+l.offset.x&&p.y===o[k].y+l.offset.z)&&Math.abs(c.y-(l.top-1-GAP_UNDERLAY.dropIn))<1e-9;}),`${name}: each decked level's cavity is its own decking outline, just under the 1 in boards; boardless levels get none`);
    ok(decked.every((l,i)=>l.boards.every(b=>insidePolygon({x:b.cx+l.offset.x,y:b.cy+l.offset.z},cavities[i].points))&&l.boards.reduce((s,b)=>s+(b.polygon?area(b.polygon):b.length*b.width),0)>=.85*area(cavities[i].points)),`${name}: boards cover their level's cavity, so it only shows through the gaps`);
    if(name==='Winder')ok(model.levels.some(l=>l.boards.length===0),'The winder design has a boardless winder level to test against');
  }
  const geometry=outlineGeometry(gapUnderlayOutlines(buildDeckTakeoff(DEFAULT_DECK).levels).concat([{y:0,points:[{x:0,y:0},{x:0,y:10},{x:10,y:10},{x:10,y:0}]}])),gp=geometry.getAttribute('position'),gi=geometry.getIndex()!;
  let facesUp=true;for(let t=0;t<gi.count;t+=3){const [a,b,cc]=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(gp,gi.getX(t+k)));if(new THREE.Vector3().crossVectors(b.clone().sub(a),cc.clone().sub(a)).y<=0)facesUp=false;}
  ok(facesUp&&gi.count>0,'The cavity faces up whichever way its outline winds, so it is never seen from under the deck');geometry.dispose();
  const c=new THREE.Color(GAP_UNDERLAY.color);ok(.2126*c.r+.7152*c.g+.0722*c.b<.01,'The cavity under a gap is near black');
  const pieces=read(`${VIEWER}boardPieces.tsx`);
  ok(pieces.includes("m.userData.snow='none'")&&pieces.includes('selectionPassthrough:true')&&!pieces.includes('DoubleSide'),'The cavity takes no snow, lets clicks through to what is under the deck, and is one-sided');
  const viewer=read(`${VIEWER}Deck3DViewer.tsx`);
  ok(viewer.includes('boardPieceGeometry(first.w,first.h,first.d)')&&viewer.includes('Math.min(BOARD_EASE_IN,item.h/6,minEdge/8)')&&(viewer.match(/<GapUnderlay /g)??[]).length===1&&/\{!structure&&<><GapUnderlay levels=\{model\.levels\}\/>/.test(viewer),'Deck boards use the eased board geometry and sit over the cavity; stairs have none');
}

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
  ok(reliefWeight(0.1)===0&&reliefWeight(0.08)===0&&reliefWeight(.8)===1&&reliefWeight((RELIEF_EDGE+RELIEF_FULL)/2)>.4,'A stair tread seen nearly edge-on drops atlas relief; a face-on board keeps the grain');
  const reliefMat=surfaceMaterial('#886644',true),reliefShader={uniforms:{} as Record<string,THREE.IUniform>,defines:{} as Record<string,string>,vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  reliefMat.onBeforeCompile(reliefShader as unknown as THREE.WebGLProgramParametersWithUniforms,undefined as never);
  ok(reliefShader.fragmentShader.includes(`smoothstep(${RELIEF_EDGE},${RELIEF_FULL}`)&&reliefShader.fragmentShader.includes('mix(nonPerturbedNormal,normal,dcKeep)')&&reliefShader.fragmentShader.includes('vec2 dcShift=dcView.xy*(dcHeight-.5)*.03*dcKeep;dcUvA+=dcShift;dcUvB+=dcShift;')&&!shader.fragmentShader.includes('dcKeep'),'Grazing stair treads keep the geometric surface; the editor shader is unchanged');
}
ok(SHOWCASE_STILL_SAMPLES===1&&pipeline.includes('SHOWCASE_STILL_SAMPLES'),'Showcase stills do not jitter the camera across thin stair treads');
ok(read(`${VIEWER}showcasePost.ts`).includes('abs(z-centerZ)'),'Depth of field leaves a thin tread instead of averaging in the ground behind it');
const viewer2=read(`${VIEWER}Deck3DViewer.tsx`);
{
 const ast=ts.createSourceFile('Deck3DViewer.tsx',viewer2,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),batch=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='BoardBatch')!,attributes:ts.CallExpression[]=[];
 const visit=(n:ts.Node)=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='setAttribute'&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])&&n.arguments[0].text==='aVar')attributes.push(n);ts.forEachChild(n,visit);};visit(batch);
 const memoized=(n:ts.Node)=>{let p=n.parent;while(p&&p!==batch){if(ts.isCallExpression(p)&&p.expression.getText(ast)==='useMemo')return p.arguments[1]?.getText(ast).includes('items.length');p=p.parent;}return false;};
 ok(attributes.length===1&&memoized(attributes[0])&&batch.getText(ast).includes("geometry.getAttribute('aVar')")&&batch.getText(ast).includes('variation.needsUpdate=true'),'A board batch allocates one grain attribute with its geometry and updates that buffer on edits; count changes rebuild and dispose the previous geometry');
}
ok(viewer2.includes("g.setAttribute('aVar',new THREE.Float32BufferAttribute(")&&/useMemo\(\(\)=>slabGeometry\(slabs,grain,courses(?:,eased)?\)/.test(read(`${VIEWER}Skirting3D.tsx`)),'Cut boards and skirting are wired to their grain variation geometry');
{
  const slabs=[{a:{x:0,y:0},b:{x:48,y:0},out:{x:0,y:-1},bottomA:0,bottomB:0,topA:36,topB:36,thick:1},{a:{x:60,y:0},b:{x:108,y:0},out:{x:0,y:-1},bottomA:0,bottomB:0,topA:36,topB:36,thick:1}],g=slabGeometry(slabs,'along'),p=g.getAttribute('position'),v=g.getAttribute('aVar');
  ok(v.itemSize===4&&v.count===p.count&&Array.from(v.array).every(Number.isFinite),'Every rendered skirting vertex carries a finite four-component grain variation');
  const first=Array.from(v.array).slice(0,4),second=Array.from(v.array).slice(36*4,37*4);
  ok(first.some((x,i)=>x!==second[i])&&first[0]>=0&&first[0]<1&&second[0]>=0&&second[0]<1,'Separate skirting boards receive distinct valid grain strips');g.dispose();
}
ok(viewer2.includes("useSwatchTexture(swatchUrl('wood-pressure-treated.jpg'),'#8a7356')")&&viewer2.includes('function useBoxMaterial('),'Framing lumber shows pressure-treated grain along each piece');

// G3: the sky's numbers, files and wiring.
const ASSETS=`${VIEWER}assets/`,readme=read(`${ASSETS}README.md`);
ok(cameraSetback(16/9)===1&&cameraSetback(2)===1&&cameraSetback(1)>1.3&&Number.isFinite(cameraSetback(0)),'Square phone framing adds horizontal clearance while wide desktop framing stays unchanged');
{
  const {day,evening}=SKY_DATA,up=Math.sin(day.sunElevationDeg*Math.PI/180);
  ok(day.sunElevationDeg>0&&day.sunElevationDeg<90&&(day.sunPainted?day.sunIntensity>0:day.sunIntensity===0),'A bright extracted sun becomes the directional light; a soft tree-filtered sky stays in the environment without a duplicate sun');
  ok(Math.abs(day.skyIrradiance+day.sunIntensity*up-Math.PI)<.03,'Sun and sky light a horizontal white card at irradiance π, so a sunlit board shows its swatch colour');
  const daylight=skyStrength('day'),dusk=skyStrength('evening');
  const sunLuminance=.2126*day.sunColor[0]+.7152*day.sunColor[1]+.0722*day.sunColor[2];
  ok(Math.abs(day.skyIrradiance*daylight.environment+daylight.sun*sunLuminance*up-Math.PI)<.03,'The rendered coloured sun and sky fill conserve horizontal white-card energy');
  ok(daylight.sun>0&&daylight.environment>0&&daylight.environment<=3,'Daylight has a directional key and bounded environment fill for readable cast shadows');
  ok(daylight.background===1&&dusk.background===SCENE_LOOK.sky.evening,'Illumination tuning leaves panorama exposure intact and dusk stays dim');
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
  const viewer3=read(`${VIEWER}Deck3DViewer.tsx`),environment3=read(`${VIEWER}Environment3D.tsx`),sky=read(`${VIEWER}Sky3D.tsx`)+read(`${VIEWER}skyShade.ts`);
  ok(viewer3.includes('<Suspense fallback={<StudioLight evening={evening}/>}><Sky3D evening={evening}/></Suspense>')&&viewer3.includes('near:SCENE_LOOK.sky.cameraNear,far:SCENE_LOOK.sky.cameraFar'),'The real sky loads behind the studio light, and the camera sees to the sky dome');
  ok(environment3.includes('castShadow={!evening}')&&environment3.includes('SUN.clone().multiplyScalar(radius)')&&!environment3.includes('hemisphereLight'),'The scene’s sun takes the HDRI’s place (none in the evening), and no hemisphere light doubles the sky');
  ok(sky.includes('name="sky-dome"')&&sky.includes('depthWrite:false,fog:false')&&sky.includes('scene.fog.color.setRGB(')&&viewer3.includes('<fogExp2 attach="fog" args={[')&&sky.includes('preloadEvening()')&&sky.includes("fallback={<SkyOf lighting=\"day\" strength={skyStrength('evening').background} illumination={skyStrength('evening').environment}/>}"),'The dome draws behind everything without fog; one haze lasts the viewer’s life (adding fog recompiles every material) and the sky only recolours it; the evening sky preloads once the day is in, and the dimmed day sky stands in while it loads');
  ok(sky.includes('lead*${DAY_SKY_RED}')&&sky.includes('${DAY_SKY_BLEND}*skyish')&&sky.includes('${DAY_SKY_GAIN}')&&sky.includes('${GOLDEN_SKY_GAIN}')&&sky.includes("dayBlue=graded&&flags.hour!=='golden'")&&sky.includes("goldenSky=graded&&flags.hour==='golden'"),'Showcase day recolors the sky after exposure, and golden hour warms the dome before the grade');
  ok(sky.includes('sampleEl=cleanEl+uHorizonBand*0.')&&sky.includes('smoothstep(0.22,0.0,el)*uSkyline')&&sky.includes('vec3(0.04,0.045,0.035)*strength')&&!sky.includes('band*uHorizonBand')&&sky.includes('goldenSky?SHOWCASE_GOLDEN_FILL:SHOWCASE_SKY_FILL')&&!sky.includes('?0.72:1'),'The dome keeps the clean upper sky, fades the horizon into a tree line, and applies golden fill once');
  ok(SCENE_LOOK.sky.domeRadiusFt<SCENE_LOOK.sky.cameraFar&&Math.exp(-((100*SCENE_LOOK.sky.fogDensity)**2))>.985,'The dome sits inside the far plane, and haze stays under 1.5% at 100 ft');
}
// The lawn: the chunks it patches, a natural mean colour, and ground that faces up all the way to the horizon.
for(const [name,lookup] of LAWN_CHUNKS)ok((THREE.ShaderChunk as Record<string,string>)[name]?.includes(lookup),`ShaderChunk.${name} still has "${lookup}"`);
{
  const lawn=JSON.parse(read(`${ASSETS}lawn.json`)),[r,g,b]=lawn.meanSrgb,saturation=(Math.max(r,g,b)-Math.min(r,g,b))/Math.max(r,g,b);
  ok(g>r&&g>b&&saturation<=.5,`The lawn is a natural green (mean sRGB ${lawn.meanSrgb.join(', ')}, saturation ${saturation.toFixed(2)})`);
  const yard0=buildYardModel(DEFAULT_DECK);
  const surface=lawnMaterial();ok(surface.normalScale.x<=.35&&surface.normalScale.y<=.35,'Short lawn relief stays fine rather than pebble-like');surface.dispose();
  // The far lawn ends in the dome's own colour (skyShade.ts), never over the yard or within AERIAL.nearFt of the camera.
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}} as unknown as THREE.WebGLProgramParametersWithUniforms;
  const air=lawnMaterial();air.onBeforeCompile(shader,{} as THREE.WebGLRenderer);air.dispose();
  ok(shader.fragmentShader.includes('vec3 skyRadiance(')&&shader.fragmentShader.includes('skyRadiance(vec3(lawnH.x,0.,lawnH.y)/lawnD)')&&!shader.fragmentShader.includes('#include <fog_fragment>')&&!shader.fragmentShader.includes('const float PI')&&'uSkyReady' in shader.uniforms&&'uLawnCentre' in shader.uniforms,'The far lawn fades into the sky dome’s own horizon colour, with the dome’s function and uniforms');
  const {aerial,horizonHaze}=SCENE_LOOK.sky,yardIn=Math.hypot(yard0.terrain.widthFt*12,yard0.terrain.depthFt*12)/2+aerial.yardMarginFt*12;
  ok([0,100,1000,2400].every(cam=>lawnAerial(cam,yardIn,yardIn,FAR_RING_IN)===0)&&[0,50,aerial.nearFt].every(cam=>lawnAerial(cam,FAR_RING_IN*.6,yardIn,FAR_RING_IN)===0),'No haze on the yard itself, or on lawn nearer the camera than the aerial ramp starts');
  ok([0,aerial.nearFt,aerial.farFt,2400].every(cam=>lawnAerial(cam,FAR_RING_IN*aerial.rimTo,yardIn,FAR_RING_IN)>=.999)&&lawnAerial(aerial.farFt,FAR_RING_IN*.8,yardIn,FAR_RING_IN)>=.999,'The far lawn is wholly the sky’s colour by the rim, from any camera');
  ok(horizonHaze.topRad<=.1&&SCENE_LOOK.sky.fogDensity===.0011,'The horizon haze stays within the lowest few degrees, and the scene’s fog is unchanged');
  // The distant tree line: outside the yard, inside the lawn's rim, hazed with the lawn's own air and sky colour.
  const [beltNear,beltFar]=beltRadii(Math.hypot(yard0.terrain.widthFt,yard0.terrain.depthFt)/2),belt=beltGeometry(beltNear,beltFar);
  ok(beltNear>=BELT.nearMinFt&&beltNear*12>yardIn+aerial.yardRampFt*12&&beltFar<.9*FAR_RING_IN/12&&beltFar>beltNear,`The tree line stands ${beltNear} and ${beltFar} ft out: past the yard, inside the lawn's rim`);
  ok(belt.getAttribute('position').count===BELT.segments*12&&BELT_FRAGMENT.includes('vec3 skyRadiance(')&&BELT_FRAGMENT.includes('skyRadiance(vec3(h.x,0.,h.y)/d)')&&BELT_FRAGMENT.includes('1./uAerialNear-1./d'),'The tree line is two rings shaded with the lawn’s air and the dome’s horizon colour');belt.dispose();
  const yard=yard0,tw=yard.terrain.widthFt*12,td=yard.terrain.depthFt*12,width=192,depth=144,bounds={minX:width/2-tw/2,minZ:depth/2-td/2,width:tw,depth:td};
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

// G4: the house's surfaces and its windows.
{
  const CLADDINGS:HouseCladding[]=['Brick','Siding','Stone','Stucco','Board & batten','Vertical siding','Fibre-cement lap','Cedar shakes','Ledgestone','Fieldstone','Norman brick','Roman brick','Horizontal metal'];
  ok(CLADDINGS.every(c=>c==='Horizontal metal'?claddingSurface(c)===undefined:!!claddingSurface(c)),'Every cladding but metal gets surface detail; metal stays smooth');
  ok(CLADDINGS.every(c=>['masonry','rock'].includes(claddingSurface(c)??'')?backingSurface(c)==='stucco':backingSurface(c)===undefined),'The mortar behind brick and stone takes the stucco detail; other walls keep their plain backing');
  ok(Object.values(HOUSE_SURFACES).every(v=>v.repeatIn>0&&v.normalScale>0&&v.normalScale<=1),'Each surface has a repeat and a relief strength');
  for(const [name,lookup] of HOUSE_CHUNKS)ok((THREE.ShaderChunk as Record<string,string>)[name]?.includes(lookup),`ShaderChunk.${name} still has "${lookup}"`);
  for(const scan of ['masonry','rock']){
    const stats=await sharp(`${ASSETS}${scan}-detail.webp`).stats(),mean=stats.channels[0].mean;
    ok(Math.abs(mean-127.5)<4,`${scan}-detail.webp averages ${mean.toFixed(1)} of 255 (linear 0.5), so the cladding colour doubled over it keeps its colour`);
  }
  ok(readme.includes('masonry-detail.webp')&&readme.includes('rock-detail.webp')&&readme.includes('concrete_floor_01')&&readme.includes('rock_face_03'),'The masonry and rock scans have their source and licence in assets/README.md');
  const day=windowGlass(false),night=windowGlass(true);
  ok(day!==night&&windowGlass(false)===day&&day.transmission===0&&day.ior===WINDOW_ROOM.ior&&day.color.getHex()===0&&day.userData.photoRole==='glass','Window glass is opaque, black, reflective (ior 2, about 11% head-on) and tagged for the photo engine, one material by day and one by night');
  ok(Math.abs(((WINDOW_ROOM.ior-1)/(WINDOW_ROOM.ior+1))**2-WINDOW_ROOM.f0)<.005,'The room behind the glass fades by the same Fresnel term the glass reflects with');
  const shader={uniforms:{} as Record<string,THREE.IUniform>,vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};
  night.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,undefined as never);
  ok(shader.fragmentShader.includes('totalEmissiveRadiance+=windowRoom()')&&shader.vertexShader.includes('vCamLocal=(inverse(modelMatrix)')&&!/\$\{/.test(shader.fragmentShader+shader.vertexShader)&&!/mix\([^)]*[^.\d]\d+,/.test(shader.fragmentShader.slice(shader.fragmentShader.indexOf('vec3 windowRoom'))),'The room shader is filled in: every number a GLSL float, the room added through the glass');
  const pane=paneGeometry(30,48),half=pane.getAttribute('aPane');
  ok(half.count===pane.getAttribute('position').count&&half.getX(0)===15&&half.getY(0)===24,'Each pane carries its half size, so its room fits it');
  const facade=read(`${VIEWER}HouseFacade.tsx`),house=read(`${VIEWER}House3D.tsx`),parts=read(`${VIEWER}HouseParts.tsx`);
  ok(!facade.includes('transmission={.25}')&&(facade.match(/<Glass /g)??[]).length>=6&&(facade.match(/<Glass [^>]*evening=\{evening\}/g)??[]).length===(facade.match(/<Glass /g)??[]).length,'Every window and door pane is the new glass, told whether it is evening');
  ok(facade.includes('surface={claddingSurface(look.cladding)}')&&facade.includes('surface={backingSurface(look.cladding)}')&&facade.includes('surface={claddingSurface(wainscot.cladding)}')&&house.includes('name="gable-accent-courses" surface={claddingSurface(look.cladding)}')&&facade.includes('name="house-foundation" items={parts.lower} color={HOUSE_FOUNDATION_COLOR} surface="stucco"')&&parts.includes('houseSurfaceMaterial(surface,'),'Walls, wainscots, gable accents and the foundation reveal take their surface detail through HouseParts');
}

// G5: the yard's hardscape and its finished earthwork.
{
  const yardView=read(`${VIEWER}Yard3D.tsx`),turf=read(`${VIEWER}Turf.tsx`),occlusion=read(`${VIEWER}groundOcclusion.ts`),environment5=read(`${VIEWER}Environment3D.tsx`),viewer5=read(`${VIEWER}Deck3DViewer.tsx`),surfaces=read(`${VIEWER}houseSurfaces.ts`);
  ok(/paver:\{set:'masonry'/.test(yardView)&&/'wall-block':\{set:'rock'/.test(yardView)&&/'wall-cap':\{set:'masonry'/.test(yardView)&&/rock:\{set:'rock'/.test(yardView)&&yardView.includes('scanMaterial(scanned.set,color,')&&surfaces.includes('color:new THREE.Color(color).multiplyScalar(2)'),'Pavers, wall blocks, caps and rocks take scanned detail over the product’s own colour (doubled over a detail map averaging 0.5)');
  ok(turf.includes('publishGroundOcclusion({texture:occlusion.texture,bounds})')&&turf.includes('publishGroundOcclusion(null)')&&yardView.includes('material.aoMap=occlusion?.texture??WHITE'),'Hardscape is shaded under a deck by the lawn’s own occlusion map, with a white stand-in until it is drawn');
  ok((yardView.match(/userData=\{GROUND_LEVEL\}/g)??[]).length===2&&occlusion.includes('o.castShadow&&o.userData.coversGround!==false'),'Paving, walls and the lawn bank lie on the ground, so they are not drawn as covering it (they would shade themselves)');
  const paving=yardFinishGeometry({id:'paver-check',featureId:'qa',role:'paver',color:'#aaa',x:0,y:12,z:0,w:24,d:12,h:3,polygon:[{x:-12,y:-6},{x:12,y:-6},{x:12,y:6},{x:-12,y:6}]});
  paving.computeBoundingBox();const envelope=paving.boundingBox!;
  ok(yardView.includes('yardFinishGeometry(b)')&&paving.getAttribute('position').count>36&&Math.abs(envelope.min.y-10.5)<1e-5&&Math.abs(envelope.max.y-13.5)<1e-5&&envelope.min.x>=-12.00001&&envelope.max.x<=12.00001&&envelope.min.z>=-6.00001&&envelope.max.z<=6.00001,'Real pavers retain bevel relief within their stock outline and full height through the shared finish geometry');paving.dispose();
  ok(yardView.includes("color={!inspection&&items[0].role==='bedding'?shade(items[0].color,JOINT_SHADE):items[0].color}"),'Joint sand reads darker than the pavers in the finished views only');
  const waves=JSON.parse((/RIPPLE_WAVES:[^=]*=(\[\[.*?\]\]);/.exec(yardView)?.[1]??'[]').replace(/([[,])(-?)\./g,'$1$20.')) as number[][];
  ok(waves.length>=5&&waves.every(([k,l])=>Number.isInteger(k)&&Number.isInteger(l)&&(k||l))&&new Set(waves.map(([k,l])=>(Math.atan2(l,k)+Math.PI)%Math.PI).map(a=>a.toFixed(3))).size===waves.length,'Still water’s ripples fit the tile a whole number of times (no seam) and run in different directions (no visible pattern)');
  ok(yardView.includes('if(!inspection&&(hidden.has(box.role)||GRADED_ROLES.includes(box.role)))continue;const b=inspection?box:seatOnLawn(box,model.terrain);')&&yardView.includes('{illustrativeBanksVisible(model,inspection)&&<RetainedBanks model={model} occlusion={occlusion} plantingBeds={plantingBeds}/>}'),'Finished views hide drainage/backfill and seat rocks; an illustrative bank is limited to legacy presentation, while construction views retain the built model');
  ok(turf.includes('groundDisplayCuts(yard,pools,finished)')&&environment5.includes('yard={yard} finished={finished}/>')&&viewer5.includes('cutaway={cutaway} finished={!inspection} yard={yard}'),'The lawn closes over a retaining wall’s trench in the finished views and opens over it in the construction views');
  ok(GRADED_ROLES.length===3&&GRADED_ROLES.includes('wall-drainage')&&GRADED_ROLES.includes('backfill')&&GRADED_ROLES.includes('geogrid'),'Wall drainage stone, backfill and geogrid are covered in the finished view');
  ok(illustrativeBanksVisible({features:[]}),'Saved legacy projects keep their illustrative bank presentation');
  ok(!illustrativeBanksVisible({features:[]},true),'Construction inspection has no decorative bank');
  ok(!illustrativeBanksVisible({features:[{config:{finishedElevationIn:0}}]}),'Even fixed zero-level objects use defined ground rather than invented banks');
  const base:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',houseVisible:false,terrainConfig:{widthFt:100,depthFt:100,elevationIn:0,slopePct:0}};
  const wallAt=(rotationDeg:number,heightIn:number):YardFeature=>({id:'wall',kind:'retaining-wall',name:'wall',enabled:true,xFt:40,zFt:40,widthFt:16,depthFt:1.5,heightIn,rotationDeg,productId:'segmental-concrete',color:'#8f877b'});
  for(const [rotationDeg,slopePct,heightIn] of [[0,0,20],[30,0,20],[-120,4,30],[0,0,48]]){
    const scene={...base,terrainConfig:{...base.terrainConfig!,slopePct},yardFeatures:[wallAt(rotationDeg,heightIn)]};await ensureLiveDesignExtensions(scene);const yard=buildYardModel(scene),f=yard.features[0];
    const drainage=f.boxes.find(b=>b.role==='wall-drainage')!,backfill=f.boxes.find(b=>b.role==='backfill')!,wall=f.boxes.filter(b=>b.role==='wall-block');
    const unchanged=JSON.stringify(f.boxes),g=retainedBankGeometry(f,yard.terrain)!;ok(!!g,'Below-grade aggregate placeholders still produce a finished bank from exposed wall geometry');
    const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),top=Math.max(...wall.map(b=>b.y+b.h/2));
    // The complete path avoids mistaking one clipped aggregate cell for the
    // whole rotated wall. The bank's rear boundary includes actual wall batter.
    const path=yardWallPath(f.config),a=path[0],c=path[path.length-1],len=Math.hypot(c.x-a.x,c.y-a.y),away={x:-(c.y-a.y)/len,y:(c.x-a.x)/len},depth=(x:number,z:number)=>(x-a.x)*away.x+(z-a.y)*away.y;
    const back=Math.max(...wall.flatMap(b=>b.polygon!.map(q=>depth(q.x,q.y)))),far=Math.max(...Array.from({length:pos.count},(_,i)=>depth(pos.getX(i),pos.getZ(i))));
    let high=-1e9,steepest=0,up=true,behind=true,toe=true;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),n=normal.getY(i);high=Math.max(high,y);if(n<=.5)up=false;steepest=Math.max(steepest,Math.hypot(normal.getX(i),normal.getZ(i))/n);
      if(depth(x,z)<back-1e-3)behind=false;
      if(far-depth(x,z)<1e-3&&Math.abs(y-(lawnHeight(yard.terrain,z)-1))>1e-3)toe=false;
    }
    ok(high<=top+.001&&high>top-1&&up&&behind&&toe&&steepest<.85,`A ${heightIn} in wall at ${rotationDeg}° on a ${slopePct}% slope holds an illustrative bank within 1 in of its top course, behind actual wall geometry, facing up, no steeper than ${steepest.toFixed(2)} (1 in ${BANK_RUN} on average), meeting the lawn at its far edge`);ok(JSON.stringify(f.boxes)===unchanged,'Finished bank leaves construction boxes and quantity geometry untouched');g.dispose();
  }
    const low=buildYardModel({...base,yardFeatures:[wallAt(0,1)]}).features[0];
    const bedWall=buildYardModel({...base,yardFeatures:[wallAt(0,20)]}),bedFeature=bedWall.features[0],bedBefore=JSON.stringify(bedFeature.boxes);
    const bed=[{x:450,y:505},{x:505,y:505},{x:505,y:550},{x:450,y:550}],bedBank=retainedBankGeometry(bedFeature,bedWall.terrain,undefined,[bed])!;
    const bp=bedBank.getAttribute('position'),bi=bedBank.getIndex()!;let coveredBedArea=0;
    for(let i=0;i<bi.count;i+=3){const triangle=[0,1,2].map(j=>({x:bp.getX(bi.getX(i+j)),y:bp.getZ(bi.getX(i+j))}));for(const poly of yardClip([triangle],[bed],'intersection'))coveredBedArea+=Math.abs(poly.reduce((sum,p,j)=>sum+p.x*poly[(j+1)%poly.length].y-poly[(j+1)%poly.length].x*p.y,0))/2;}
    ok(coveredBedArea<.01,'Finished retained soil is clipped out of enabled planting beds, including triangle edges across their footprint');
    ok(JSON.stringify(bedFeature.boxes)===bedBefore,'A planting-bed visual mask leaves the retained wall construction geometry unchanged');bedBank.dispose();
    ok(bankGeometry(low.boxes.find(b=>b.role==='wall-drainage')!,low.boxes.find(b=>b.role==='backfill')!,{elevationIn:0,slopePct:0})===null,'A wall that holds less than an inch gets no bank');
  const terrain={elevationIn:0,slopePct:0},rock={id:'r',featureId:'w',role:'rock' as const,color:'#8e938b',x:0,y:15,z:0,w:24,h:6,d:18},set=seatOnLawn(rock,terrain);
  ok(Math.abs(set.y+set.h/2-18)<1e-9&&Math.abs(set.y-set.h/2-(lawnHeight(terrain,0)-1))<1e-9&&seatOnLawn({...rock,y:-2},terrain).h===6&&seatOnLawn({...rock,role:'paver'},terrain).h===6,'A stone standing clear of the lawn reaches an inch into it with its top unchanged; a set stone and other pieces are left alone');
}

console.log(`DECK REALISM OK — look, pipeline wiring, shadow key and sun fit; ${files.length} swatch atlases (worst ΔE ${worstDelta.toFixed(2)}, worst repeat ${worstSeam.toFixed(2)}×; ${files.length-LOW_RES_SWATCHES.size} at ${MIN_SOURCE_EDGE}+ px), the board shader and its picks (grain repeat along a board ${repeatMean.toFixed(2)}); the sky, its sun and the lawn to the horizon; the house's glass and surfaces; the yard's hardscape and finished grade; ${checks} checks.`);
