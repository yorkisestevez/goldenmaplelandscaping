import {useLayoutEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RUN_FT_S,TURN_RAD_S,WALK_EYE_FT,WALK_FOV,WALK_FT_S,WALK_RADIUS_FT,onWalkPad,stepFloor,walkPad} from './walk';

type Point={x:number;z:number};
type OrbitTarget={target:THREE.Vector3;update():void};
type Solid={object:THREE.Object3D;box:THREE.Box3};

/** Instanced meshes with this many copies are grass, leaves and blooms: the walker passes through them. */
const SOFT_INSTANCES=1500;
/** A down-ray starts this far above the floor: it finds a railing's top rail (at most 42 in) but not a pergola's beams. */
const PROBE_FT=4,WAIST_FT=2.5,HEAD_FT=WALK_EYE_FT+.5,LOOK_RAD_PX=.005,PITCH_LIMIT=1.2;
/** The longest time one frame moves the walker for, and the longest single step checked against stairs and walls. */
const MAX_FRAME_S=.5,MAX_STEP_FT=.25;
/** Where a step's floor is sampled, along the way: behind, at and ahead of the step. */
const FOOT_FT=[-1/3,0,1/3];
/** Where the walk may start, in feet in front of the deck: the first spot standing on open ground wins. */
const START_FT=[10,8,12,6,14,16,4];
const KEYS:Record<string,true>={KeyW:true,ArrowUp:true,KeyS:true,ArrowDown:true,KeyA:true,KeyD:true,ArrowLeft:true,KeyQ:true,ArrowRight:true,KeyE:true};
const DOWN=new THREE.Vector3(0,-1,0),UP=new THREE.Vector3(0,1,0);

const isWater=(object:THREE.Object3D)=>(object.userData.pickHardscape as {part?:string}|undefined)?.part==='water';
/** What the walker can stand on or bump into: the scene's visible meshes, glass included (a glass door or railing stops
 * them), but not the sky, grass and leaves, a light's glow, or pool water (a pool reads as the drop it is). */
function solids(scene:THREE.Scene,water:THREE.Object3D[]){
  const found:Solid[]=[];
  scene.traverseVisible(object=>{
    const mesh=object as THREE.Mesh&{isInstancedMesh?:boolean;count?:number};
    if(!mesh.isMesh||object.name==='sky-dome')return;
    if(mesh.isInstancedMesh&&(mesh.count??0)>=SOFT_INSTANCES)return;
    const materials=([] as THREE.Material[]).concat(mesh.material);
    if(materials.every(m=>!m.visible||m.blending===THREE.AdditiveBlending))return;
    if(isWater(object)){water.push(object);return;}
    found.push({object,box:new THREE.Box3().setFromObject(object)});
  });
  return found;
}
/** A key the walker should leave alone: typing, a shortcut with a modifier, an open dialog, or a focused tab or menu. */
function notForWalking(e:KeyboardEvent){
  const target=e.target instanceof HTMLElement?e.target:null;
  if(e.ctrlKey||e.metaKey||e.altKey)return true;
  if(target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.closest('[role=tab],[role=menu],[role=menuitem],[role=radio],[role=option],[role=slider],[role=listbox]')))return true;
  return [...document.querySelectorAll('dialog[open],[role=dialog],[role=menu]')].some(el=>el.getClientRects().length>0);
}

/**
 * Eye-level walking in the 3D view (S7). It stands the visitor on open ground in front of the deck, looking at `look`,
 * and hands the camera back to the orbit view as it was when it unmounts. Keys: W A S D or the arrows walk and turn,
 * Shift runs, Esc stops.
 */
export default function WalkMode({from,look,onExit}:{from:Point;look:{x:number;y:number;z:number};onExit:()=>void}){
  const get=useThree(s=>s.get),scene=useThree(s=>s.scene),gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate);
  const exit=useRef(onExit);exit.current=onExit;
  const walker=useRef({x:from.x,z:from.z,floor:0,eye:0,yaw:0,pitch:0,keys:new Set<string>(),run:false,solids:[] as Solid[],water:[] as THREE.Object3D[],seen:0});
  const ray=useRef(new THREE.Raycaster());

  const cast=(origin:THREE.Vector3,direction:THREE.Vector3,far:number,near:THREE.Object3D[])=>{const r=ray.current;r.set(origin,direction);r.far=far;return r.intersectObjects(near,false);};
  /** The solids around the walker: three tests every triangle of anything the ray's line meets, near or far. */
  const around=(x:number,z:number,reach:number)=>{
    const w=walker.current,box=new THREE.Box3(new THREE.Vector3(x-reach,w.floor-WALK_EYE_FT,z-reach),new THREE.Vector3(x+reach,w.floor+HEAD_FT+PROBE_FT,z+reach));
    return w.solids.filter(s=>s.box.intersectsBox(box)).map(s=>s.object);
  };
  const refresh=()=>{
    const w=walker.current;w.water=[];w.solids=solids(scene,w.water);w.seen=performance.now();
    // The design can change under the walker (a deck raised or removed): stand on what is there now.
    const floor=cast(new THREE.Vector3(w.x,w.floor+PROBE_FT,w.z),DOWN,60,around(w.x,w.z,1))[0];
    if(floor)w.floor=floor.point.y;
  };
  /** The lowest surface at (x, z) with head room above it, or null where that is pool water. */
  const ground=(x:number,z:number)=>{
    const w=walker.current,hits=cast(new THREE.Vector3(x,500,z),DOWN,1000,[...w.solids.map(s=>s.object),...w.water]);
    for(let i=hits.length-1;i>=0;i--){
      const above=hits[i-1];
      if(above&&above.point.y-hits[i].point.y<HEAD_FT)continue;
      return isWater(hits[i].object)?null:hits[i].point.y;
    }
    return null;
  };
  /** One step to (nx, nz): the new floor, or null when a wall, rail, glass, a low beam, a climb or a drop stops it. */
  const tryStep=(nx:number,nz:number,near:THREE.Object3D[])=>{
    const w=walker.current,dx=nx-w.x,dz=nz-w.z,length=Math.hypot(dx,dz);if(!length)return null;
    const ux=dx/length,uz=dz/length,side=WALK_RADIUS_FT/2;
    // Waist rays from the centre and both shoulders, so balusters and cables do not slip between them. (A knee ray would
    // meet the next stair risers.)
    for(const offset of [0,side,-side]){
      if(cast(new THREE.Vector3(w.x-uz*offset,w.floor+WAIST_FT,w.z+ux*offset),new THREE.Vector3(ux,0,uz),length+WALK_RADIUS_FT,near).length)return null;
    }
    // A foot is wider than one ray: the floor is the highest surface at the step and a third of a foot either side of it
    // along the way, so the gap between two tread boards (open stringer stairs) never drops the walker through.
    const floorAt=(x:number,z:number)=>{
      let top:number|null=null;
      for(const o of FOOT_FT){const hit=cast(new THREE.Vector3(x+ux*o,w.floor+PROBE_FT,z+uz*o),DOWN,60,near)[0];if(hit&&(top===null||hit.point.y>top))top=hit.point.y;}
      return top;
    };
    // One radius ahead on a stair can be two treads up.
    if(stepFloor(w.floor,floorAt(nx+ux*WALK_RADIUS_FT,nz+uz*WALK_RADIUS_FT),false,2)===null)return null;
    const floor=stepFloor(w.floor,floorAt(nx,nz),false);
    // Head room: a deck, stair or beam lower than the walker's head stops them.
    if(floor===null||cast(new THREE.Vector3(nx,floor+.5,nz),UP,HEAD_FT-.5,near).length)return null;
    return floor;
  };
  const place=()=>{
    const w=walker.current,camera=get().camera as THREE.PerspectiveCamera;
    if(!camera.isPerspectiveCamera)return;
    // The view's own camera effect resets the field of view on a resize; walking keeps its wider one.
    if(camera.fov!==WALK_FOV){camera.fov=WALK_FOV;camera.updateProjectionMatrix();}
    camera.position.set(w.x,w.eye,w.z);camera.rotation.set(w.pitch,w.yaw,0,'YXZ');camera.updateMatrixWorld();
    Object.assign(gl.domElement.dataset,{walk:'1',walkEye:`${w.x.toFixed(2)},${w.eye.toFixed(2)},${w.z.toFixed(2)}`,walkFloor:w.floor.toFixed(2)});
  };

  // A layout effect: its clean-up puts the orbit view back before the next camera button's own layout effect places it.
  useLayoutEffect(()=>{
    const camera=get().camera as THREE.PerspectiveCamera,controls=get().controls as unknown as OrbitTarget|null;
    const saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),order:camera.rotation.order,fov:camera.fov,target:controls?.target.clone()};
    const w=walker.current;refresh();
    const start=START_FT.map(ahead=>({x:from.x,z:from.z+ahead-START_FT[0]})).map(p=>({...p,floor:ground(p.x,p.z)})).find(p=>p.floor!==null);
    if(start){w.x=start.x;w.z=start.z;w.floor=start.floor!;}
    w.eye=w.floor+WALK_EYE_FT;
    w.yaw=Math.atan2(-(look.x-w.x),-(look.z-w.z));
    w.pitch=Math.max(-PITCH_LIMIT,Math.min(PITCH_LIMIT,Math.atan2(look.y-w.eye,Math.hypot(look.x-w.x,look.z-w.z))));
    place();invalidate();

    const down=(e:KeyboardEvent)=>{
      if(notForWalking(e))return;
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();exit.current();return;}
      if(e.key==='Shift')w.run=true;
      if(!KEYS[e.code])return;
      // Walking keys stay with the walker, not the designer's shortcuts.
      e.preventDefault();e.stopPropagation();w.keys.add(e.code);invalidate();
    };
    const up=(e:KeyboardEvent)=>{if(e.key==='Shift')w.run=false;if(w.keys.delete(e.code))e.stopPropagation();};
    const blur=()=>{w.keys.clear();w.run=false;};
    let drag:{x:number;y:number;id:number}|null=null;
    const press=(e:PointerEvent)=>{if(e.button===0)drag={x:e.clientX,y:e.clientY,id:e.pointerId};};
    const move=(e:PointerEvent)=>{
      if(!drag||e.pointerId!==drag.id)return;
      // A release outside the window never reaches us: no button held means the drag is over.
      if(e.pointerType==='mouse'&&!(e.buttons&1)){drag=null;return;}
      w.yaw-=(e.clientX-drag.x)*LOOK_RAD_PX;w.pitch=Math.max(-PITCH_LIMIT,Math.min(PITCH_LIMIT,w.pitch-(e.clientY-drag.y)*LOOK_RAD_PX));
      drag={...drag,x:e.clientX,y:e.clientY};place();invalidate();
    };
    const release=(e:PointerEvent)=>{if(drag?.id===e.pointerId)drag=null;};
    const canvas=gl.domElement;
    addEventListener('keydown',down,{capture:true});addEventListener('keyup',up,{capture:true});addEventListener('blur',blur);
    canvas.addEventListener('pointerdown',press);addEventListener('pointermove',move);addEventListener('pointerup',release);addEventListener('pointercancel',release);
    const quitPad=onWalkPad(invalidate);
    return ()=>{
      removeEventListener('keydown',down,{capture:true});removeEventListener('keyup',up,{capture:true});removeEventListener('blur',blur);
      canvas.removeEventListener('pointerdown',press);removeEventListener('pointermove',move);removeEventListener('pointerup',release);removeEventListener('pointercancel',release);
      quitPad();
      camera.position.copy(saved.position);camera.rotation.order=saved.order;camera.quaternion.copy(saved.quaternion);camera.fov=saved.fov;camera.updateProjectionMatrix();
      if(controls&&saved.target){controls.target.copy(saved.target);controls.update();}
      for(const key of ['walk','walkEye','walkFloor'])delete canvas.dataset[key];
      invalidate();
    };
    // The walk starts once; the orbit view comes back on unmount.
  },[]);

  useFrame((_,delta)=>{
    // A slow device draws few frames: each one covers the time that passed (up to half a second), so walking keeps its
    // speed, and moves in short substeps so the stair and wall checks see the same small steps as at full frame rate.
    const w=walker.current,dt=Math.min(delta,MAX_FRAME_S),keys=w.keys;
    const forward=(keys.has('KeyW')||keys.has('ArrowUp')||walkPad.forward?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')||walkPad.back?1:0);
    const side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
    const turn=(keys.has('ArrowLeft')||keys.has('KeyQ')||walkPad.turnLeft?1:0)-(keys.has('ArrowRight')||keys.has('KeyE')||walkPad.turnRight?1:0);
    w.yaw+=turn*TURN_RAD_S*dt;
    if(forward||side){
      // The design can change while walking: look for solids again every so often.
      if(performance.now()-w.seen>1500)refresh();
      const distance=(w.run?RUN_FT_S:WALK_FT_S)*dt,steps=Math.ceil(distance/MAX_STEP_FT),speed=distance/steps,sin=Math.sin(w.yaw),cos=Math.cos(w.yaw);
      const mx=(-sin*forward+cos*side)*speed,mz=(-cos*forward-sin*side)*speed,near=around(w.x,w.z,WALK_RADIUS_FT*2+distance);
      for(let step=0;step<steps;step++){
        // Slide along whatever stops the full step; stop once nothing moves.
        let moved=false;
        for(const [nx,nz] of [[w.x+mx,w.z+mz],[w.x+mx,w.z],[w.x,w.z+mz]]){
          if(nx===w.x&&nz===w.z)continue;
          const floor=tryStep(nx,nz,near);
          if(floor!==null){w.x=nx;w.z=nz;w.floor=floor;moved=true;break;}
        }
        if(!moved)break;
      }
    }
    // The eye eases onto each new floor, so a stair reads as steps rather than a jolt.
    const eye=w.floor+WALK_EYE_FT,settling=Math.abs(eye-w.eye)>.005;
    w.eye=settling?w.eye+(eye-w.eye)*Math.min(1,dt*10):eye;
    place();
    if(forward||side||turn||settling)invalidate();
  });
  return null;
}
