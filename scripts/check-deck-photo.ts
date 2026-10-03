import assert from 'node:assert/strict';
import {Ray,Vector3} from 'three';
import {DEFAULT_PHOTO_CALIBRATION,clampPhotoPoint,photoCalibrationError,loadHomePhoto,type PhotoCalibration} from '../src/features/deckcraft/photoMatch';
import {makePhotoCamera} from '../src/features/deckcraft/photoMatchCamera';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {serializeDesign} from '../src/features/deckcraft/designPersistence';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
let checks=0;function check(name:string,fn:()=>void){try{fn();checks++;}catch(e){throw new Error(name,{cause:e});}}
const c:PhotoCalibration={...DEFAULT_PHOTO_CALIBRATION,a:{x:.45,y:.32},b:{x:.45,y:.64},anchor:{x:.55,y:.65},distanceIn:80};
const origin=new Vector3(12,3,0);
check('uncalibrated photo cannot produce a model',()=>assert.throws(()=>makePhotoCamera(DEFAULT_PHOTO_CALIBRATION,1200,800,origin)));
for(const yaw of [-40,0,40])for(const pitch of [0,15,35])for(const roll of [-8,0,8])check(`reference scale and anchor fit at ${yaw}/${pitch}/${roll}`,()=>{
  const {camera,wall}=makePhotoCamera({...c,yaw,pitch,roll},1200,800,origin);
  const hit=(p:{x:number;y:number})=>new Ray(camera.position.clone(),new Vector3(p.x*2-1,1-p.y*2,.5).unproject(camera).sub(camera.position).normalize()).intersectPlane(wall,new Vector3())!;
  assert(Math.abs(hit(c.a!).distanceTo(hit(c.b!))*12-80)<1e-6);
  const anchor=origin.clone().project(camera);assert(Math.abs((anchor.x+1)/2-c.anchor!.x)<1e-8);assert(Math.abs((1-anchor.y)/2-c.anchor!.y)<1e-8);
});
check('normalized calibration is invariant under responsive resizing',()=>{
  const a=makePhotoCamera(c,1200,800,origin),b=makePhotoCamera(c,360,240,origin);assert(a.camera.position.distanceTo(b.camera.position)<1e-8);
  assert.deepEqual(a.camera.projectionMatrix.elements,b.camera.projectionMatrix.elements);
});
check('doubling known length doubles camera range, not deck dimensions',()=>{const a=makePhotoCamera(c,1200,800,origin),b=makePhotoCamera({...c,distanceIn:160},1200,800,origin);assert(Math.abs(b.range-a.range*2)<1e-8);});
check('camera handles portrait photos without stretching',()=>{const {camera}=makePhotoCamera(c,800,1200,origin);assert.equal(camera.aspect,2/3);});
check('invalid calibration values fail safely',()=>{
  for(const bad of [{distanceIn:NaN},{distanceIn:0},{distanceIn:Infinity},{distanceIn:2401},{yaw:66},{pitch:56},{roll:21},{fov:86},{a:null},{b:c.a},{anchor:{x:2,y:0}},{b:{x:.451,y:.321}}])assert(photoCalibrationError({...c,...bad},1200,800));
  assert(photoCalibrationError(c,0,800));assert(photoCalibrationError(c,Infinity,800));
});
check('orientation whose rays miss the wall is rejected',()=>assert.throws(()=>makePhotoCamera({...c,yaw:65,fov:85,a:{x:0,y:0},b:{x:1,y:0}},1200,800,origin)));
check('marker nudges cannot escape the image',()=>assert.deepEqual(clampPhotoPoint({x:-1,y:2}),{x:0,y:1}));
check('photo state is not saved into construction JSON or estimate',()=>{const d=structuredClone(DEFAULT_DECK),withPhoto={...d,photoCalibration:c,homePhoto:{url:'blob:test'}};assert.equal(serializeDesign(withPhoto),serializeDesign(d));assert.equal(calculateEstimate(withPhoto,DECK_SETTINGS).total,calculateEstimate(d,DECK_SETTINGS).total);});
await assert.rejects(loadHomePhoto(new File(['<svg/>'],'test.svg',{type:'image/svg+xml'})),/JPEG/);checks++;
await assert.rejects(loadHomePhoto(new File([new Uint8Array(21*1024*1024)],'large.jpg',{type:'image/jpeg'})),/20 MB/);checks++;
console.log(`DECK PHOTO OK — ${checks} reference-scale, projection, privacy-boundary and invalid-input checks.`);
