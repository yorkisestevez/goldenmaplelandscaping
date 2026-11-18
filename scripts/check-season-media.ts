/**
 * Seasons S3 (2026-10-20): photo mode and fly-throughs show the season.
 * - The path tracer never runs shader patches, so winter photos bake the snow into vertex colours on surfaces that are
 *   mostly snow (and give everything back when the photo ends); fall and spring leaves use a grey atlas (S1).
 * - A fly-through can run "through the seasons": spring, summer, fall, winter, a quarter of the path each, with settled
 *   snow only (falling snow runs on the wall clock and would jump between frames). The view's own season comes back after.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {applyPhotoScene} from '../src/features/deckcraft/components/viewer3d/photoMaterials';
import {SNOW,SNOW_ON,setSnowRole} from '../src/features/deckcraft/components/viewer3d/seasonSnow';
import {seasonAt} from '../src/features/deckcraft/components/viewer3d/plantSeasons';

let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const source=(path:string)=>readFileSync(path,'utf8');
const viewer='src/features/deckcraft/components/viewer3d/';

// 1. Fly-through seasons.
ok(seasonAt(0)==='spring'&&seasonAt(.3)==='summer'&&seasonAt(.6)==='fall'&&seasonAt(.99)==='winter'&&seasonAt(1)==='winter'&&seasonAt(-1)==='spring','A fly-through runs spring, summer, fall, winter in equal quarters');
const recorder=source(viewer+'FlythroughRecorder.tsx'),tools=source(viewer+'FlythroughTools.tsx');
ok(recorder.includes("const season=job.seasons?seasonAt(plan.duration?time/plan.duration:0):null;")&&recorder.includes('setSeason(previousSeason);'),'The recorder steps the season per frame and gives the view its own season back afterwards');
ok(recorder.includes("'season-snowfall'"),'Videos keep settled snow but not falling snow');
ok(tools.includes('Through the seasons</label>')&&tools.includes('timeOfDay,seasons,startSec'),'The fly-through tools offer "Through the seasons"');

// 2. Winter photos: snow baked into a copy of each snowy mesh, everything restored after.
const scene=new THREE.Scene();
const lawnMaterial=new THREE.MeshStandardMaterial({color:'#4a7a2a'});
const lawn=new THREE.Mesh(new THREE.PlaneGeometry(40,40,20,20).rotateX(-Math.PI/2),lawnMaterial);lawn.name='lawn';
const wallMaterial=new THREE.MeshStandardMaterial({color:'#b0a090'});
const wall=new THREE.Mesh(new THREE.PlaneGeometry(10,8,4,4),wallMaterial);wall.name='wall';
const deckMaterial=setSnowRole(new THREE.MeshStandardMaterial({color:'#8a6a4a'}),'dust');
const deck=new THREE.Mesh(new THREE.PlaneGeometry(12,12,4,4).rotateX(-Math.PI/2),deckMaterial);deck.position.y=3;
// A two-sided roof drawn with its normals facing down still faces the sky.
const roofMaterial=new THREE.MeshStandardMaterial({color:'#4a4a4a',side:THREE.DoubleSide});
const roof=new THREE.Mesh(new THREE.PlaneGeometry(12,12,4,4).rotateX(Math.PI/2),roofMaterial);roof.position.y=14;
// A wall cap: a level top on a box, so most of its area holds snow though few of its corners face up.
const capMaterial=new THREE.MeshStandardMaterial({color:'#9a948a'});
const cap=new THREE.Mesh(new THREE.BoxGeometry(12,.33,1.2),capMaterial);cap.position.y=2;
// A material that an instanced mesh also draws cannot be baked (the instances carry no snow colours), so it is left alone.
const sharedMaterial=new THREE.MeshStandardMaterial({color:'#506040'});
const sharedPlain=new THREE.Mesh(new THREE.PlaneGeometry(6,6).rotateX(-Math.PI/2),sharedMaterial);sharedPlain.position.set(20,0,20);
const sharedInstanced=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),sharedMaterial,1);sharedInstanced.setMatrixAt(0,new THREE.Matrix4().makeTranslation(25,0,25));
scene.add(lawn,wall,deck,roof,cap,sharedPlain,sharedInstanced);
const lawnGeometry=lawn.geometry,wallGeometry=wall.geometry;
let restore=applyPhotoScene(scene,'day',null);
ok(lawn.geometry===lawnGeometry&&!lawnMaterial.vertexColors,'Out of winter, photos leave the lawn as it is');
restore();
SNOW_ON.value=1;
restore=applyPhotoScene(scene,'day',null);
const colors=lawn.geometry.getAttribute('color');
ok(lawn.geometry!==lawnGeometry&&colors&&lawnMaterial.vertexColors&&lawnMaterial.map===null&&lawnMaterial.color.getHex()===0xffffff,'In winter the lawn draws a copy of its geometry with the snow in its vertex colours');
let white=0;for(let i=0;i<colors.count;i++)if(colors.getX(i)>.6)white++;
ok(white/colors.count>.7&&Math.abs(colors.getX(0)-SNOW.color[0])<.2,'Most of a level lawn is snow in a winter photo');
ok(wall.geometry===wallGeometry&&!wallMaterial.vertexColors,'A wall holds no snow and keeps its own look');
ok(!deckMaterial.vertexColors,'A shovelled deck keeps its own boards in a winter photo');
ok(capMaterial.vertexColors,'A wall cap takes snow: coverage is by area, not by corner');
ok(!sharedMaterial.vertexColors&&sharedMaterial.color.getHexString()==='506040','A material an instanced mesh also draws keeps its own look');
ok(roofMaterial.vertexColors&&roof.geometry.getAttribute('color').getX(0)>.6,'A two-sided roof takes snow whichever way its normals face');
restore();
ok(lawn.geometry===lawnGeometry&&lawnMaterial.vertexColors===false&&lawnMaterial.color.getHexString()==='4a7a2a','After the photo, the lawn has its own geometry and colour back');
SNOW_ON.value=0;

const engine=source(viewer+'photoEngine.ts');
ok(engine.includes("seasonal=look==='day'&&season.elevationDeg!==null")&&engine.includes('irradiance*(seasonal?season.gain:1)'),'By day, the photo sun stands at the season\'s height and strength');

console.log(`check-season-media: ${checks} checks passed`);
