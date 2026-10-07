import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import type {YardModel} from '../../yardModel';
import type {PoolFeatureModel} from '../../poolModel';
import {applyHardscapeFinish} from './hardscapeFinish';
import {addMaterialPatch} from './materialPatches';
import {lawnGround} from './lawnGround';
import {patioEdgeSpans,insideAny} from '../../patioGroundContact';
import {yardFeatureOutline} from '../../yardPathGeometry';
import {waterDisplayFootprints} from './finishedSurfaceGeometry';

/**
 * A patio's edge where it meets the lawn in the finished views (the dig still to grade, its base left standing, or the
 * stone edge course holding its raised side). Loaded by Turf only when the yard has a patio, so the 3D view of a design
 * without one never fetches it. Display only: quantities and exports are the yard model's.
 */
/** Where a plain patio's edge meets the lawn as drawn, for the finished views. Ground higher than the paving is the dig
 * still to be graded (`dig`, earth from the paving's top up to the lawn); ground lower than the paving's underside is the
 * base course left standing (`base`, from the pavers down to just under the lawn), so a patio never sits buried in grass
 * or floats over it. On a patio whose raised side a stone edge course holds (ground fit lowEdge 'stone') those faces
 * are the course (`edge`). Once the ground is graded to the patio they shrink to nothing. Display only: quantities and
 * exports are the yard model's. `avoid` is ground that is not lawn (pools, ponds); the patio's own outline (deck-post
 * cut-outs), other paving and deck supports are left out too, as the yard model's edge check leaves them out. */
export function patioEdgeGeometry(yard:YardModel,avoid:{x:number;y:number}[][]=[],kind:'existing'|'proposed'='proposed'){
 const lawn=lawnGround(yard,kind),dig:number[]=[],base:number[]=[],edge:number[]=[],site=yard.siteSurface,triangles=site?(kind==='existing'?site.existingTriangles:site.proposedTriangles):[];
 const patios=yard.features.filter(f=>!f.excluded&&f.config.kind==='patio'&&!f.config.stoneSteps&&!f.config.stepAssembly&&f.footprints.length&&f.boxes.some(b=>b.role==='paver'));
 // The survey's triangle edges: where the drawn ground bends along a patio edge.
 const breaks=(a:{x:number;y:number},b:{x:number;y:number})=>{const out:number[]=[],dx=b.x-a.x,dz=b.y-a.y,minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minZ=Math.min(a.y,b.y),maxZ=Math.max(a.y,b.y);
  for(const t of triangles){const xs=t.vertices.map(v=>v.xIn),zs=t.vertices.map(v=>v.zIn);if(Math.max(...xs)<minX||Math.min(...xs)>maxX||Math.max(...zs)<minZ||Math.min(...zs)>maxZ)continue;
   for(let i=0;i<3;i++){const p=t.vertices[i],q=t.vertices[(i+1)%3],ex=q.xIn-p.xIn,ez=q.zIn-p.zIn,den=dx*ez-dz*ex;if(Math.abs(den)<1e-10)continue;const u=((p.xIn-a.x)*ez-(p.zIn-a.y)*ex)/den,v=((p.xIn-a.x)*dz-(p.zIn-a.y)*dx)/den;if(u>1e-9&&u<1-1e-9&&v>=-1e-9&&v<=1+1e-9)out.push(u);}}
  return out;};
 // A face between `lo` and `hi`, kept only where `show` is positive (all three straight along the piece).
 const face=(out:number[],a:{x:number;z:number},b:{x:number;z:number},lo:[number,number],hi:[number,number],show:[number,number])=>{
  const at=(t:number)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,lo:lo[0]+(lo[1]-lo[0])*t,hi:hi[0]+(hi[1]-hi[0])*t});
  let from=0,to=1;if(show[0]<=0&&show[1]<=0)return;if(show[0]<=0)from=show[0]/(show[0]-show[1]);else if(show[1]<=0)to=show[0]/(show[0]-show[1]);
  const p=at(from),q=at(to);if(Math.hypot(q.x-p.x,q.z-p.z)<.01)return;
  out.push(p.x,p.lo,p.z,q.x,q.lo,q.z,q.x,q.hi,q.z,p.x,p.lo,p.z,q.x,q.hi,q.z,p.x,p.hi,p.z);
 };
 for(const f of patios){
  const thick=Math.max(...f.boxes.filter(b=>b.role==='paver').map(b=>b.h)),plane=f.topPlane??{x:0,z:0,constant:f.topIn};
  const paving=yard.features.filter(o=>o!==f&&!o.excluded&&o.config.kind==='patio').map(o=>o.footprints),notLawn=insideAny([yardFeatureOutline(f.config),avoid,yard.deckClearance?.supportCutouts??[],...paving]),course=f.config.groundFit?.lowEdge==='stone'?edge:base;
  for(const s of patioEdgeSpans(f.footprints,plane,lawn.height,{breaks,skip:notLawn,probeIn:.05})){
   const ga=s.a.ground!,gb=s.b.ground!,a={x:s.a.x,z:s.a.z},b={x:s.b.x,z:s.b.z};
   face(dig,a,b,[s.a.top-.1,s.b.top-.1],[ga,gb],[ga-s.a.top,gb-s.b.top]);
   face(course,a,b,[ga-1,gb-1],[s.a.top-thick,s.b.top-thick],[s.a.top-thick-ga,s.b.top-thick-gb]);
  }
 }
 const geometry=(values:number[])=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));if(values.length)g.computeVertexNormals();return g;};
 return {dig:geometry(dig),base:geometry(base),edge:geometry(edge)};
}
/** Compacted granular base, as left standing at a raised patio edge before the ground is graded to it. */
export function baseFaceMaterial(){
 const material=applyHardscapeFinish(new THREE.MeshStandardMaterial({color:'#9a958a',roughness:1,side:THREE.DoubleSide}));
 addMaterialPatch(material,{key:'base-grain-v1',apply:s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float baseBroad=mineralNoise(vMineralPosition/.9),baseStone=mineralNoise(vMineralPosition/.22);
diffuseColor.rgb*=.86+.12*baseBroad+.14*smoothstep(.55,.8,baseStone);`);}});return material;
}

/** A stone edge course along a patio's raised side: dressed grey stone in blocks about 18 in long, a darker joint
 * between them and a little tone from block to block. Procedural, like the soil and base faces. */
export function edgeCourseMaterial(){
 const material=applyHardscapeFinish(new THREE.MeshStandardMaterial({color:'#8a847b',roughness:.92,side:THREE.DoubleSide}));
 addMaterialPatch(material,{key:'edge-course-v1',apply:s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float courseRun=(vMineralPosition.x+vMineralPosition.z)/1.5,courseAt=fract(courseRun);
float courseJoint=smoothstep(0.,.025,courseAt)*smoothstep(1.,.975,courseAt);
diffuseColor.rgb*=(.84+.12*mineralNoise(vMineralPosition/.7)+.06*mineralNoise(vMineralPosition/.06))*(.9+.14*mineralHash(vec3(floor(courseRun))))*mix(.55,1.,courseJoint);`);}});return material;
}

/** The three edge faces of every plain patio, drawn with Turf's soil material and their own gravel and stone. */
export default function PatioEdges3D({yard,pools,soil}:{yard:YardModel;pools:PoolFeatureModel[];soil:THREE.Material}){
 const gravel=useMemo(baseFaceMaterial,[]),stone=useMemo(edgeCourseMaterial,[]);
 useEffect(()=>()=>{gravel.dispose();stone.dispose();},[gravel,stone]);
 const patioEdges=useMemo(()=>patioEdgeGeometry(yard,waterDisplayFootprints(yard,pools)),[yard,pools]);
 useEffect(()=>()=>{patioEdges.dig.dispose();patioEdges.base.dispose();patioEdges.edge.dispose();},[patioEdges]);
 return <>
  {patioEdges.dig.getAttribute('position').count>0&&<mesh name="patio-ungraded-dig" geometry={patioEdges.dig} material={soil} receiveShadow/>}
  {patioEdges.base.getAttribute('position').count>0&&<mesh name="patio-exposed-base" geometry={patioEdges.base} material={gravel} castShadow receiveShadow/>}
  {patioEdges.edge.getAttribute('position').count>0&&<mesh name="patio-stone-edge-course" geometry={patioEdges.edge} material={stone} castShadow receiveShadow/>}
 </>;
}
