import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {validateScenePresentation} from '../src/features/deckcraft/scenePresentation';
import {overviewCamera} from '../src/features/deckcraft/components/viewer3d/cameraFraming';
import {landscapeCamera} from '../src/features/deckcraft/components/viewer3d/landscapeCamera';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {createPlanningPool} from '../src/features/deckcraft/poolAssembly';
import {buildYardModel} from '../src/features/deckcraft/yardModel';
import {getPoolModels} from '../src/features/deckcraft/poolModel';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {exportProjectBundle,importProjectBundle} from '../src/features/deckcraft/projectBundle';
import {designLinkJson,decodeDesignLinkFile} from '../src/features/deckcraft/designLink';
import * as THREE from 'three';
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},eq=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;},bad=(v:unknown)=>{assert.throws(()=>validateScenePresentation(v));checks++;};
const settings=validateScenePresentation({viewMode:'finished',cameraPreset:'pool',cameras:[{id:'saved',name:'Pool close',positionIn:[600,250,800],targetIn:[300,10,400],fov:38}],activeCameraId:'saved'});
bad({viewMode:'x'});bad({cameraPreset:'bad'});bad({activeCameraId:'missing'});bad({cameras:Array(2)});bad({cameras:Array.from({length:13},()=>settings.cameras![0])});bad({cameras:[settings.cameras![0],settings.cameras![0]]});bad({cameras:[{...settings.cameras![0],fov:NaN}]});bad({cameras:[{...settings.cameras![0],targetIn:settings.cameras![0].positionIn}]});bad({secret:1});
let reads=0;const getter=[1,2,3];Object.defineProperty(getter,'0',{enumerable:true,get(){reads++;return 1;}});bad({cameras:[{...settings.cameras![0],positionIn:getter}]});eq(reads,0,'Camera getter is rejected without execution');
const data={...structuredClone(DEFAULT_DECK),houseVisible:false,pools:[createPlanningPool({id:'pool',xIn:300,zIn:400,copingTopElevationIn:3})]};await ensureLiveDesignExtensions(data);
const yard=buildYardModel(data),presented={...data,scenePresentation:settings};eq(buildYardModel(presented),yard,'Presentation reuses the same physical model');eq(parseDesign(serializeDesign(presented)).scenePresentation,settings,'Public saved design preserves cameras');eq((await decodeDesignLinkFile('1j'+Buffer.from(designLinkJson(presented)).toString('base64url'))).design.scenePresentation,settings,'Public link preserves scene settings');
const zip=await exportProjectBundle(presented,{includeSurvey:false}),round=await importProjectBundle(zip);eq(round.scenePresentation,settings,'Portable project preserves scene settings');
for(const aspect of [16/9,390/390,.5,2])for(const direction of [[.9,.8,1.3],[0,.32,1]] as [number,number,number][]){
 const points=[{x:-20,y:0,z:0},{x:20,y:12,z:0},{x:20,y:4,z:45},{x:-20,y:-6,z:45}],frame=overviewCamera({w:40,d:45,cx:0,cz:22.5,height:12,aspect,points,direction}),camera=new THREE.PerspectiveCamera(38,aspect,.25,2400);camera.position.set(...frame.position);camera.lookAt(new THREE.Vector3(...frame.target));camera.updateMatrixWorld();for(const p of points){const q=new THREE.Vector3(p.x,p.y,p.z).project(camera);ok(Math.abs(q.x)<1&&Math.abs(q.y)<1&&q.z<1,'Preset keeps each physical corner within the frustum');}
}
for(const preset of ['terrace','pool'] as const){const frame=landscapeCamera(preset,yard,getPoolModels(data),16/9);ok(frame&&[...frame.position,...frame.target].every(Number.isFinite),'Landscape camera fits actual pool geometry');}
eq(landscapeCamera('wall',yard,getPoolModels(data),1),undefined,'Missing wall keeps the current camera');
console.log(`${checks} scene validation, camera fit, quantity isolation and portable checks passed.`);
