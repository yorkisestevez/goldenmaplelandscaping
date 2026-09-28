import {useEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {SelectionState} from '../../designer/selectionState';
export interface ObjectPick {partId?:string;board?:{level:number;index:number}}
/** Metadata belongs to the actual rendered mesh/group; an instance uses its exact model entry. */
export function objectPick(object:THREE.Object3D,instanceId?:number):ObjectPick|null{
 for(let node:THREE.Object3D|null=object;node;node=node.parent){
  if(node.name==='privacy-screen-drag-handles'||node.name==='selection-outline')return null;
  const board=instanceId===undefined?node.userData.pickBoard:node.userData.pickBoards?.[instanceId];
  const partId=instanceId===undefined?node.userData.pickPartId:node.userData.pickPartIds?.[instanceId]??node.userData.pickPartId;
  if(board)return {board};if(partId)return {partId};
 }
 return null;
}
export default function SelectionBridge({enabled,selection,onPick,revision}:{enabled:boolean;selection:SelectionState;onPick?:(pick:ObjectPick,toggle:boolean)=>void;revision?:unknown}){
 const {gl,scene,camera,invalidate}=useThree(),group=useMemo(()=>new THREE.Group(),[]);
 useEffect(()=>{group.name='selection-outline';scene.add(group);return ()=>{scene.remove(group);};},[group,scene]);
 useEffect(()=>{
  const clear=()=>{for(const child of [...group.children]){group.remove(child);const line=child as THREE.LineSegments;line.geometry?.dispose();(line.material as THREE.Material)?.dispose();}};
  clear();if(!enabled)return;
  scene.updateMatrixWorld(true);
  const matches=(p:ObjectPick|null)=>!!p&&(p.partId?selection.partIds.includes(p.partId):!!p.board&&selection.boards.some(b=>b.level===p.board!.level&&b.index===p.board!.index));
  const add=(geometry:THREE.BufferGeometry,matrix:THREE.Matrix4)=>{const line=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:'#d9902f',depthTest:false,transparent:true,opacity:.95}));line.applyMatrix4(matrix);line.renderOrder=100;line.raycast=()=>{};group.add(line);};
  scene.traverse(object=>{if(object.name==='selection-outline'||!object.visible)return;const mesh=object as THREE.Mesh;if(!mesh.isMesh||!mesh.geometry)return;
   if((mesh as THREE.InstancedMesh).isInstancedMesh){const instances=mesh as THREE.InstancedMesh;for(let i=0;i<instances.count;i++)if(matches(objectPick(mesh,i))){const matrix=new THREE.Matrix4();instances.getMatrixAt(i,matrix);add(mesh.geometry,mesh.matrixWorld.clone().multiply(matrix));}}
   else if(matches(objectPick(mesh)))add(mesh.geometry,mesh.matrixWorld);
  });invalidate();return clear;
 },[enabled,selection,scene,group,invalidate,revision]);
 useEffect(()=>{if(!enabled||!onPick)return;const canvas=gl.domElement,ray=new THREE.Raycaster();let active:{id:number;x:number;y:number;max:number}|null=null,multiple=false;
  const down=(e:PointerEvent)=>{if(active){multiple=true;return;}if(e.button!==0)return;multiple=false;active={id:e.pointerId,x:e.clientX,y:e.clientY,max:0};};
  const move=(e:PointerEvent)=>{if(active?.id===e.pointerId)active.max=Math.max(active.max,Math.hypot(e.clientX-active.x,e.clientY-active.y));};
  const up=(e:PointerEvent)=>{const start=active;if(!start||start.id!==e.pointerId)return;active=null;if(multiple||start.max>5||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;const box=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1),camera);scene.updateMatrixWorld(true);for(const hit of ray.intersectObjects(scene.children,true)){let visible=true;for(let node:THREE.Object3D|null=hit.object;node;node=node.parent)if(!node.visible)visible=false;if(!visible)continue;const pick=objectPick(hit.object,hit.instanceId);if(pick){onPick(pick,e.shiftKey||e.ctrlKey||e.metaKey);break;}}};
  const cancel=()=>{active=null;multiple=false;};canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);
  return ()=>{canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);};
 },[enabled,onPick,gl,scene,camera]);return null;
}
