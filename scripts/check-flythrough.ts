import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {easeInOut,pathDuration,pathFromCameras,samplePath,showcaseTour,validateKeyframes,type CameraKeyframe,type Vec3} from '../src/features/deckcraft/components/viewer3d/cameraPath';
import {planFlythrough,assertDeviceCanRender,assertZipMemory,FLYTHROUGH_LIMITS,type FlythroughDevice} from '../src/features/deckcraft/components/viewer3d/flythroughBudget';
import {muxAvcMp4} from '../src/features/deckcraft/components/viewer3d/mp4Mux';
import {crc32,storedZipBytes} from '../src/features/deckcraft/components/viewer3d/storedZip';
import {sunDirectionAt,timeOfDayAt} from '../src/features/deckcraft/components/viewer3d/timeOfDay';
import {getFlythroughFlags,resetFlythrough,resolveSceneEvening} from '../src/features/deckcraft/components/viewer3d/flythroughState';
import {getShowcaseFlags} from '../src/features/deckcraft/showcaseMode';
import type {SavedSceneCamera} from '../src/features/deckcraft/scenePresentation';

let checks=0;
const check=(value:unknown,label?:string)=>{assert.ok(value,label);checks++;};
const close=(a:number,b:number,label?:string)=>check(Math.abs(a-b)<1e-4,label??`${a} ≈ ${b}`);
const vec=(v:Vec3,w:Vec3)=>v.every((n,i)=>Math.abs(n-w[i])<1e-4);
const camera=(id:string,position:Vec3,target:Vec3,fov=38):SavedSceneCamera=>({id,name:id,positionIn:position,targetIn:target,fov});
const frame=(partial:Partial<CameraKeyframe> & Pick<CameraKeyframe,'id'>):CameraKeyframe=>({
 name:partial.id,positionIn:[0,36,240],targetIn:[0,24,0],fov:38,style:'dolly',moveSec:2,holdSec:0,...partial,
});

check(easeInOut(0)===0&&easeInOut(1)===1&&Math.abs(easeInOut(.5)-.5)<1e-9,'Ease holds the ends and the midpoint');
check(resolveSceneEvening('Daylight',null)===false&&resolveSceneEvening('Evening',null)===true&&resolveSceneEvening('Daylight',true)===true&&resolveSceneEvening('Evening',false)===false);
check(!getFlythroughFlags().rendering&&getFlythroughFlags().evening===null&&!getShowcaseFlags().quality,'Loading the fly-through leaves the editor on its defaults');
resetFlythrough();

const straight=[frame({id:'a',moveSec:0,holdSec:0,positionIn:[0,60,240]}),frame({id:'b',style:'dolly',moveSec:2,holdSec:0,positionIn:[0,60,120]})];
const start=samplePath(straight,0),end=samplePath(straight,2),mid=samplePath(straight,1);
check(vec(start.position,[0,5,20])&&vec(end.position,[0,5,10]),'Dolly endpoints are the keyframes, in feet');
check(vec(mid.position,[0,5,15]),'An eased dolly passes the midpoint halfway through');
check(vec(samplePath(straight,-5).position,start.position)&&vec(samplePath(straight,9).position,end.position),'Times outside the path clamp to the ends');
const again=samplePath(straight,1);check(vec(again.position,mid.position)&&again.fov===mid.fov,'The same time always returns the same pose');

const orbit=[frame({id:'a',moveSec:0,positionIn:[240,48,0],targetIn:[0,24,0]}),frame({id:'b',style:'orbit',moveSec:4,positionIn:[0,48,240],targetIn:[0,24,0]})];
const orbitStart=samplePath(orbit,0),orbitEnd=samplePath(orbit,4),orbitMid=samplePath(orbit,2);
check(vec(orbitStart.position,[20,4,0])&&vec(orbitEnd.position,[0,4,20]));
const radius=(p:Vec3)=>Math.hypot(p[0],p[2]);
close(radius(orbitMid.position),20,'An orbit keeps its distance from the target');
check(orbitMid.position[0]>1&&orbitMid.position[2]>1,'The orbit midpoint is on the arc, not the chord');

const crane=[frame({id:'a',moveSec:0,positionIn:[0,36,180],targetIn:[0,24,0]}),frame({id:'b',style:'crane',moveSec:4,positionIn:[0,36,60],targetIn:[0,24,0]})];
const craneMid=samplePath(crane,2);
check(craneMid.position[1]>samplePath(crane,0).position[1]+2&&craneMid.position[1]>samplePath(crane,4).position[1]+2,'A crane rises above both keyed heights');
check(vec(samplePath(crane,0).position,[0,3,15])&&vec(samplePath(crane,4).position,[0,3,5]));

const fly=[
 frame({id:'a',moveSec:0,positionIn:[0,48,240],targetIn:[0,24,0]}),
 frame({id:'b',style:'fly',moveSec:2,positionIn:[120,72,120],targetIn:[40,24,40]}),
 frame({id:'c',style:'fly',moveSec:2,positionIn:[0,48,0],targetIn:[0,24,80]}),
];
check(vec(samplePath(fly,0).position,[0,4,20])&&vec(samplePath(fly,4).position,[0,4,0]));
check(vec(samplePath(fly,2).position,[10,6,10]),'A fly-through arrives on the middle keyframe');
const flyMid=samplePath(fly,1);
check(Math.abs(flyMid.position[0]-5)>0.2,'The fly curve leaves the straight chord');
const before=JSON.stringify(fly);samplePath(fly,1);check(JSON.stringify(fly)===before,'Sampling does not mutate keyframes');

const held=[frame({id:'a',moveSec:0,holdSec:1,fov:30}),frame({id:'b',style:'dolly',moveSec:2,holdSec:1,fov:50,positionIn:[120,36,120]})];
check(samplePath(held,.4).fov===30&&samplePath(held,3.4).fov===50,'Holds stay on the keyed camera');
close(pathDuration(held),4);

const saved=[
 camera('pool',[240,72,360],[80,20,80],36),
 camera('steps',[40,48,140],[20,30,40],42),
 camera('yard',[-180,96,300],[0,24,60],32),
];
const savedText=JSON.stringify(saved);
for(const count of [1,2,3,12]){
 const source=count<=saved.length?saved.slice(0,count):Array.from({length:count},(_,i)=>camera(`c${i}`,[Math.cos(i)*180,60+i,Math.sin(i)*180],[0,24,0],30+i));
 const tour=showcaseTour(source);
 const duration=pathDuration(tour);
 check(duration>=FLYTHROUGH_LIMITS.showcaseMinSec&&duration<=FLYTHROUGH_LIMITS.showcaseMaxSec,`${count} cameras tour ${duration}s`);
 check(tour[0].moveSec===0&&tour.every((item,index)=>index===0||item.moveSec>=.2));
 for(const item of source){
  const keyed=tour.find(frame=>frame.id===`tour-cam-${item.id}`);
  check(!!keyed&&vec(keyed!.positionIn,item.positionIn)&&vec(keyed!.targetIn,item.targetIn)&&keyed!.fov===item.fov,`Tour keeps ${item.id}`);
  const arrival=pathDuration(tour.slice(0,tour.indexOf(keyed!)+1));
  const pose=samplePath(tour,Math.max(0,arrival-.05));
  check(vec(pose.position,item.positionIn.map(n=>n/12) as Vec3),`${item.id} is on screen at its hold`);
 }
}
check(JSON.stringify(saved)===savedText,'The showcase tour does not mutate saved cameras');
const one=showcaseTour([saved[0]]);
check(one.some(frame=>frame.style==='crane')&&one.some(frame=>frame.style==='orbit')&&one.some(frame=>frame.style==='dolly')&&one.some(frame=>frame.style==='fly'),'One saved camera still gets crane, orbit, dolly and fly moves');
check(JSON.stringify(showcaseTour(saved))===JSON.stringify(showcaseTour(saved)),'The tour is deterministic');
assert.throws(()=>showcaseTour([]));checks++;
const fromSaved=pathFromCameras(saved);
check(fromSaved.length===3&&fromSaved[1].style==='orbit'&&fromSaved[2].style==='dolly'&&pathDuration(fromSaved)===14.5);
assert.throws(()=>validateKeyframes([frame({id:'only',moveSec:0})]));checks++;
assert.throws(()=>validateKeyframes([frame({id:'a',moveSec:0}),frame({id:'a'})]));checks++;

let previous=timeOfDayAt(0);
check(previous.phase==='day'&&!previous.evening&&previous.warmth===0&&previous.sunGain===1);
for(let step=1;step<=20;step++){
 const look=timeOfDayAt(step/20);
 check(look.sunElevationDeg<=previous.sunElevationDeg+1e-9,'The sun only descends');
 previous=look;
}
const golden=timeOfDayAt(.66),night=timeOfDayAt(1),day=timeOfDayAt(0);
check(timeOfDayAt(.55).phase==='golden'&&golden.phase==='golden'&&!golden.evening&&golden.warmth>.8&&golden.sunColor[0]>golden.sunColor[2],'Golden hour is warm and still on the day sky');
check(night.phase==='night'&&night.evening&&night.sunGain===0&&night.warmth===0,'Night ends on the evening sky with the sun down');
check(JSON.stringify(timeOfDayAt(.66))===JSON.stringify(golden));
const sun=sunDirectionAt(0,0);close(Math.hypot(...sun),1);check(sun[1]===0);

const wide:FlythroughDevice={maxTextureSize:8192,maxRenderbufferSize:8192,memoryGb:16};
const phone:FlythroughDevice={maxTextureSize:4096,maxRenderbufferSize:4096,memoryGb:4};
const software:FlythroughDevice={maxTextureSize:2048,maxRenderbufferSize:2048,memoryGb:8};
const job=(over:Partial<Parameters<typeof planFlythrough>[0]>={})=>planFlythrough({keyframes:fromSaved,fps:30,width:1920,height:1080,format:'mp4',timeOfDay:false,...over});
const hd=job();
check(hd.frames===Math.round(pathDuration(fromSaved)*30)&&hd.msaa&&hd.times[0]===0&&(hd.times.at(-1)??0)<=hd.end);
assertDeviceCanRender(hd,wide);checks++;
assert.throws(()=>assertDeviceCanRender(job({width:3840,height:2160,fps:24}),phone));checks++;
assert.throws(()=>assertDeviceCanRender(job({width:3840,height:2160,fps:60}),{...wide,memoryGb:4}));checks++;
assert.throws(()=>assertDeviceCanRender(job({width:3840,height:2160,fps:24}),software),/4K/);checks++;
const fourK=job({width:3840,height:2160,fps:24});
check(!fourK.msaa,'4K skips a second multisample pass');
assertDeviceCanRender(fourK,{...wide,memoryGb:undefined});checks++;
const slice=job({startSec:2,endSec:4,fps:24});
check(slice.frames===48&&slice.times[0]===2);
assert.throws(()=>job({fps:12 as 24}));checks++;
assert.throws(()=>job({width:1280 as 1920,height:720 as 1080}));checks++;
const long=Array.from({length:8},(_,i)=>frame({id:`l${i}`,moveSec:i===0?0:10,holdSec:2,positionIn:[i*120,48,240]}));
assert.throws(()=>planFlythrough({keyframes:long,fps:60,width:1920,height:1080,format:'mp4',timeOfDay:false}),/3,600 frames/);checks++;
const png=job({format:'png-zip',fps:60,startSec:0,endSec:pathDuration(fromSaved)});
assert.throws(()=>assertZipMemory(png,false),/PNG sequence/);checks++;
assertZipMemory(png,true);checks++;
assert.throws(()=>assertZipMemory(job({format:'png-zip',width:3840,height:2160,fps:60}),false));checks++;

check(crc32(new TextEncoder().encode('123456789'))===0xcbf43926);
const zipped=storedZipBytes([{name:'frame-00001.png',data:Uint8Array.of(137,80,78,71,1,2,3)},{name:'frame-00002.png',data:Uint8Array.of(4,5,6,7)}]);
const opened=unzipSync(zipped);
check(opened['frame-00001.png'][0]===137&&opened['frame-00002.png'].length===4);
assert.throws(()=>storedZipBytes([{name:'big.bin',data:new Uint8Array(32)}],40));checks++;
check(JSON.stringify(storedZipBytes([{name:'a.txt',data:Uint8Array.of(1)}]))===JSON.stringify(storedZipBytes([{name:'a.txt',data:Uint8Array.of(1)}])),'The ZIP is deterministic');

function boxes(file:Uint8Array){
 const out:{type:string;start:number;size:number}[]=[];let offset=0;
 while(offset+8<=file.length){const size=new DataView(file.buffer,file.byteOffset+offset,4).getUint32(0);const type=new TextDecoder().decode(file.subarray(offset+4,offset+8));if(size<8)break;out.push({type,start:offset,size});offset+=size;}
 return out;
}
const samples=[{data:Uint8Array.of(0,0,0,1,9),key:true},{data:Uint8Array.of(0,0,0,2,1,2),key:false},{data:Uint8Array.of(0,0,0,1,9),key:true}];
const mp4=muxAvcMp4(samples,{width:1920,height:1080,fps:24,avcC:Uint8Array.of(1,0x64,0,0x1f)});
const found=boxes(mp4);
check(found.map(box=>box.type).join(',')==='ftyp,moov,mdat',found.map(box=>box.type).join(','));
const mdat=found.find(box=>box.type==='mdat')!;
const stcoType=new TextEncoder().encode('stco');
let stco=-1;
for(let index=0;index<=mp4.length-4;index++){if(stcoType.every((byte,offset)=>mp4[index+offset]===byte)){stco=index;break;}}
const stcoView=new DataView(mp4.buffer,mp4.byteOffset+stco,16);
check(stco>8&&stcoView.getUint32(4)===0&&stcoView.getUint32(8)===1&&stcoView.getUint32(12)===mdat.start+8,'Frame bytes start where the MP4 header says they do');
const payload=mp4.subarray(mdat.start+8,mdat.start+mdat.size);
check(payload.length===samples.reduce((n,sample)=>n+sample.data.length,0)&&payload[4]===9);
const text=new TextDecoder();
check(text.decode(mp4).includes('avc1')&&mp4.includes(1920>>8));
const hasSize=(file:Uint8Array,width:number,height:number)=>{const bytes=[(width>>8)&255,width&255,(height>>8)&255,height&255];return file.some((_,index)=>bytes.every((byte,offset)=>file[index+offset]===byte));};
check(hasSize(mp4,1920,1080),'The MP4 names the frame size');
assert.throws(()=>muxAvcMp4([{data:Uint8Array.of(1),key:false}],{width:64,height:64,fps:30,avcC:Uint8Array.of(1)}));checks++;
const fourKFile=muxAvcMp4([{data:Uint8Array.of(1,2,3,4),key:true}],{width:3840,height:2160,fps:60,avcC:Uint8Array.of(1)});
check(boxes(fourKFile).some(box=>box.type==='mdat')&&fourKFile.length<1000+8);

console.log(JSON.stringify({checks,tourSeconds:pathDuration(showcaseTour(saved)),formats:['mp4','png-zip'],resolutions:['1920x1080','3840x2160'],fps:[24,30,60]},null,2));
