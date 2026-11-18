/** Smooth camera paths for fly-throughs. Positions are project inches on the keyframes
 * (the same unit as a saved camera) and feet in a sample, which is the 3D scene's unit.
 * Nothing here reads the clock: frame i is always the pose at i / fps. */
import type {SavedSceneCamera} from '../../scenePresentation';

export type PathStyle='orbit'|'dolly'|'crane'|'fly';
export type Vec3=[number,number,number];
export interface CameraKeyframe{
 id:string;name:string;positionIn:Vec3;targetIn:Vec3;fov:number;
 /** How to travel from the previous keyframe. Ignored on the first. */
 style:PathStyle;
 /** Seconds spent moving here from the previous keyframe. Zero on the first. */
 moveSec:number;
 /** Seconds to hold once the camera arrives. */
 holdSec:number;
}
export interface CameraSample{position:Vec3;target:Vec3;fov:number}
export interface PathSpan{t0:number;t1:number;kind:'move'|'hold';from:number;to:number;style:PathStyle}
const STYLES:PathStyle[]=['orbit','dolly','crane','fly'];

const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export function easeInOut(t:number){const x=clamp(t,0,1);return x*x*(3-2*x);}
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dist=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const lerpVec=(a:Vec3,b:Vec3,t:number):Vec3=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];

function vec(value:Vec3,label:string):Vec3{
 if(!Array.isArray(value)||value.length!==3||value.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1_200_000))throw Error(`Invalid ${label}.`);
 return [value[0],value[1],value[2]];
}
/** Rejects a path the exporter should not run. Does not modify the keyframes. */
export function validateKeyframes(keyframes:readonly CameraKeyframe[]){
 if(!Array.isArray(keyframes)||keyframes.length<2||keyframes.length>24)throw Error('A fly-through needs between 2 and 24 keyframes.');
 const ids=new Set<string>();
 keyframes.forEach((frame,index)=>{
  if(!frame||typeof frame.id!=='string'||!frame.id.trim()||frame.id.length>100||ids.has(frame.id))throw Error('Each keyframe needs its own name.');
  ids.add(frame.id);
  if(typeof frame.name!=='string'||!frame.name.trim()||frame.name.length>100)throw Error('Each keyframe needs a name.');
  const position=vec(frame.positionIn,'camera position'),target=vec(frame.targetIn,'camera target');
  if(Math.hypot(position[0]-target[0],position[1]-target[1],position[2]-target[2])<1)throw Error('A keyframe camera must be separated from its target.');
  if(typeof frame.fov!=='number'||!Number.isFinite(frame.fov)||frame.fov<15||frame.fov>80)throw Error('Keyframe field of view must be 15–80 degrees.');
  if(!STYLES.includes(frame.style))throw Error('Choose an orbit, dolly, crane or fly-through move.');
  if(typeof frame.holdSec!=='number'||!Number.isFinite(frame.holdSec)||frame.holdSec<0||frame.holdSec>20)throw Error('A hold must be between 0 and 20 seconds.');
  if(typeof frame.moveSec!=='number'||!Number.isFinite(frame.moveSec)||(index===0?frame.moveSec!==0:frame.moveSec<0.2||frame.moveSec>40))throw Error(index===0?'The first keyframe is the start of the path.':'Each move must be between 0.2 and 40 seconds.');
 });
}

function poseOf(frame:CameraKeyframe):CameraSample{
 return {position:frame.positionIn.map(n=>n/12) as Vec3,target:frame.targetIn.map(n=>n/12) as Vec3,fov:frame.fov};
}
function lerpPose(a:CameraSample,b:CameraSample,e:number):CameraSample{
 return {position:lerpVec(a.position,b.position,e),target:lerpVec(a.target,b.target,e),fov:lerp(a.fov,b.fov,e)};
}
function catmull(p0:Vec3,p1:Vec3,p2:Vec3,p3:Vec3,t:number):Vec3{
 const t2=t*t,t3=t2*t;
 return [0,1,2].map(axis=>{
  const a=p0[axis],b=p1[axis],c=p2[axis],d=p3[axis];
  return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
 }) as Vec3;
}
function orbit(a:CameraSample,b:CameraSample,e:number):CameraSample{
 const target=lerpVec(a.target,b.target,e),off0=sub(a.position,a.target),off1=sub(b.position,b.target);
 const r0=Math.hypot(off0[0],off0[2]),r1=Math.hypot(off1[0],off1[2]);
 if(r0<.05&&r1<.05)return lerpPose(a,b,e);
 const yaw0=Math.atan2(off0[2],off0[0]),yaw1=Math.atan2(off1[2],off1[0]);
 const delta=Math.atan2(Math.sin(yaw1-yaw0),Math.cos(yaw1-yaw0)),yaw=yaw0+delta*e,radius=lerp(r0,r1,e),y=lerp(off0[1],off1[1],e);
 return {position:[target[0]+Math.cos(yaw)*radius,target[1]+y,target[2]+Math.sin(yaw)*radius],target,fov:lerp(a.fov,b.fov,e)};
}
function crane(a:CameraSample,b:CameraSample,e:number):CameraSample{
 const base=lerpPose(a,b,e),travel=Math.hypot(b.position[0]-a.position[0],b.position[2]-a.position[2]);
 const lift=Math.max(3,travel*.18);
 return {position:[base.position[0],base.position[1]+Math.sin(Math.PI*e)*lift,base.position[2]],target:base.target,fov:base.fov};
}
function at(keys:readonly CameraKeyframe[],index:number){return poseOf(keys[clamp(index,0,keys.length-1)]);}

export function pathTimeline(keyframes:readonly CameraKeyframe[]){
 validateKeyframes(keyframes);
 const spans:PathSpan[]=[];let t=0;
 const push=(dur:number,kind:PathSpan['kind'],from:number,to:number,style:PathStyle)=>{if(dur<=0)return;spans.push({t0:t,t1:t+dur,kind,from,to,style});t+=dur;};
 push(keyframes[0].holdSec,'hold',0,0,keyframes[0].style);
 for(let i=1;i<keyframes.length;i++){push(keyframes[i].moveSec,'move',i-1,i,keyframes[i].style);push(keyframes[i].holdSec,'hold',i,i,keyframes[i].style);}
 if(t<=0)throw Error('The fly-through needs a duration.');
 return {spans,duration:t};
}
export function pathDuration(keyframes:readonly CameraKeyframe[]){return pathTimeline(keyframes).duration;}

/** Pose at an absolute time, in seconds from the start of the path. */
export function samplePath(keyframes:readonly CameraKeyframe[],timeSec:number):CameraSample{
 const {spans,duration}=pathTimeline(keyframes),time=clamp(timeSec,0,duration);
 let span=spans[0];
 for(const candidate of spans)if(candidate.t0<=time+1e-9)span=candidate;
 const a=at(keyframes,span.from),b=at(keyframes,span.to);
 let sample:CameraSample;
 if(span.kind==='hold'||span.t1<=span.t0)sample={position:[...a.position],target:[...a.target],fov:a.fov};
 else{
  const u=clamp((time-span.t0)/(span.t1-span.t0),0,1);
  if(span.style==='fly'){
   const prev=at(keyframes,span.from-1),next=at(keyframes,span.to+1);
   sample={position:catmull(prev.position,a.position,b.position,next.position,u),target:catmull(prev.target,a.target,b.target,next.target,u),fov:lerp(a.fov,b.fov,u)};
  }else{
   const e=easeInOut(u);
   sample=span.style==='dolly'?lerpPose(a,b,e):span.style==='crane'?crane(a,b,e):orbit(a,b,e);
  }
 }
 const gap=dist(sample.position,sample.target);
 if(gap<1/12){const fallback:Vec3=gap>1e-6?sub(sample.position,sample.target):[0,.2,1];const scale=(1/12)/Math.max(Math.hypot(...fallback),1e-6);sample={...sample,position:[sample.target[0]+fallback[0]*scale,sample.target[1]+fallback[1]*scale,sample.target[2]+fallback[2]*scale]};}
 return sample;
}

function cameraPose(camera:SavedSceneCamera):CameraSample{
 return {position:camera.positionIn.map(n=>n/12) as Vec3,target:camera.targetIn.map(n=>n/12) as Vec3,fov:camera.fov};
}
function orderCameras(cameras:readonly SavedSceneCamera[]){
 let start=0;
 for(let i=1;i<cameras.length;i++){
  const d0=dist(cameraPose(cameras[start]).position,cameraPose(cameras[start]).target),d1=dist(cameraPose(cameras[i]).position,cameraPose(cameras[i]).target);
  if(d1>d0+1e-6||(Math.abs(d1-d0)<=1e-6&&cameras[i].id<cameras[start].id))start=i;
 }
 const poses=cameras.map(cameraPose),cx=poses.reduce((s,p)=>s+p.target[0],0)/poses.length,cz=poses.reduce((s,p)=>s+p.target[2],0)/poses.length;
 const angle=(camera:SavedSceneCamera)=>Math.atan2(camera.targetIn[2]/12-cz,camera.targetIn[0]/12-cx);
 const origin=angle(cameras[start]);
 const wrap=(n:number)=>(n+Math.PI*2)%(Math.PI*2);
 const rest=cameras.filter((_,i)=>i!==start).slice().sort((a,b)=>{
  const da=wrap(angle(a)-origin),db=wrap(angle(b)-origin);
  if(Math.abs(da-db)>1e-9)return da-db;
  return a.id<b.id?-1:1;
 });
 return [cameras[start],...rest];
}
function pullBack(pose:CameraSample,liftFt:number):CameraSample{
 const off=sub(pose.position,pose.target),d=Math.max(dist(pose.position,pose.target),1),k=(d+Math.max(8,d*.45))/d;
 return {position:[pose.target[0]+off[0]*k,pose.target[1]+off[1]*k+liftFt,pose.target[2]+off[2]*k],target:[...pose.target],fov:Math.min(80,pose.fov+4)};
}
function yawPose(pose:CameraSample,yawDeg:number,liftFt:number):CameraSample{
 const off=sub(pose.position,pose.target),yaw=yawDeg*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw);
 return {position:[pose.target[0]+off[0]*c-off[2]*s,pose.target[1]+off[1]+liftFt,pose.target[2]+off[0]*s+off[2]*c],target:[...pose.target],fov:pose.fov};
}
function dollyToward(pose:CameraSample,scale:number):CameraSample{
 const off=sub(pose.position,pose.target),d=Math.max(dist(pose.position,pose.target),1),next=Math.max(1.25,d*scale),k=next/d;
 return {position:[pose.target[0]+off[0]*k,pose.target[1]+off[1]*k,pose.target[2]+off[2]*k],target:[...pose.target],fov:pose.fov};
}
interface Draft{id:string;name:string;pose:CameraSample;style:PathStyle;saved:boolean;camera?:SavedSceneCamera}
function showcaseDrafts(cameras:readonly SavedSceneCamera[]):Draft[]{
 const ordered=orderCameras(cameras),first=cameraPose(ordered[0]);
 const drafts:Draft[]=[
  {id:'tour-establish',name:'Establish',pose:pullBack(first,6),style:'crane',saved:false},
  {id:`tour-cam-${ordered[0].id}`,name:ordered[0].name,pose:first,style:'crane',saved:true,camera:ordered[0]},
 ];
 ordered.slice(1).forEach((camera,index)=>drafts.push({id:`tour-cam-${camera.id}`,name:camera.name,pose:cameraPose(camera),style:STYLES[index%STYLES.length],saved:true,camera}));
 if(ordered.length===1){
  drafts.push(
   {id:'tour-orbit',name:'Orbit',pose:yawPose(first,110,1.5),style:'orbit',saved:false},
   {id:'tour-around',name:'Around the yard',pose:yawPose(first,220,.4),style:'fly',saved:false},
   {id:'tour-dolly',name:'Dolly in',pose:dollyToward(first,.62),style:'dolly',saved:false},
  );
 }
 const last=drafts[drafts.length-1].pose;
 drafts.push({id:'tour-close',name:'Closing orbit',pose:yawPose(last,75,2.2),style:'orbit',saved:false});
 return drafts;
}
const round3=(n:number)=>Math.round(n*1000)/1000;
const sum=(values:number[])=>values.reduce((n,v)=>n+v,0);
/** A 30–60s tour. One saved camera still gets an establishing crane, an orbit, a dolly and a close. */
export function showcaseTour(cameras:readonly SavedSceneCamera[]):CameraKeyframe[]{
 if(!cameras.length)throw Error('Save at least one camera to build a showcase tour.');
 if(cameras.length>12)throw Error('A showcase tour uses at most 12 saved cameras.');
 const drafts=showcaseDrafts(cameras),target=clamp(24+cameras.length*7,30,60);
 let moves:number[]=drafts.map((draft,index)=>index===0?0:Math.max(.45,dist(drafts[index-1].pose.position,draft.pose.position)/14));
 let holds:number[]=drafts.map(draft=>draft.saved?1.7:.85);
 const scale=target/(sum(moves)+sum(holds));
 moves=moves.map(n=>n*scale);holds=holds.map(n=>n*scale);
 let total=sum(moves)+sum(holds);
 const fitted=clamp(total,30,60)/total;
 moves=moves.map(n=>n*fitted);holds=holds.map(n=>n*fitted);
 moves=moves.map(round3);holds=holds.map(round3);
 let drift=round3(clamp(round3(sum(moves)+sum(holds)),30,60)-(sum(moves)+sum(holds)));
 const last=moves.length-1;
 moves[last]=round3(moves[last]+drift);
 total=round3(sum(moves)+sum(holds));
 if(total>60||total<30){
  const again=clamp(total,30,60)/total;
  moves=moves.map(round3);holds=holds.map(n=>round3(n*again));moves=moves.map(n=>round3(n*again));
  moves[last]=round3(moves[last]+round3(clamp(round3(sum(moves)+sum(holds)),30,60)-(sum(moves)+sum(holds))));
 }
 const inch=(n:number)=>Math.round(n*12*1000)/1000;
 return drafts.map((draft,index)=>{
  const saved=draft.camera;
  return {
   id:draft.id,name:draft.name,fov:saved?saved.fov:draft.pose.fov,style:draft.style,moveSec:index===0?0:moves[index],holdSec:holds[index],
   positionIn:saved?[...saved.positionIn]:draft.pose.position.map(inch) as Vec3,
   targetIn:saved?[...saved.targetIn]:draft.pose.target.map(inch) as Vec3,
  };
 });
}
/** The saved cameras in their stored order, with a default eased move between each. */
export function pathFromCameras(cameras:readonly SavedSceneCamera[]):CameraKeyframe[]{
 if(cameras.length<2)throw Error('Save at least two cameras, or add a keyframe from the current view.');
 return cameras.map((camera,index)=>({
  id:`saved-${camera.id}`,name:camera.name,positionIn:[...camera.positionIn] as Vec3,targetIn:[...camera.targetIn] as Vec3,fov:camera.fov,
  style:STYLES[(index+STYLES.length-1)%STYLES.length],moveSec:index===0?0:5,holdSec:1.5,
 }));
}
