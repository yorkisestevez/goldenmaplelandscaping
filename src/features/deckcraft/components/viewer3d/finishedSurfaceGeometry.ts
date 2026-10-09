import * as THREE from 'three';
import {yardClip,type YardRole,type YardModel} from '../../yardModel';
import type {PoolFeatureModel} from '../../poolModel';
import {lawnGround} from './lawnGround';
export const CONSTRUCTION_YARD_ROLES:ReadonlySet<YardRole>=new Set(['base','wall-drainage','backfill','geogrid','pump','drain-pipe','water-pipe']);
/** Plain paving (not stone steps), which the finished lawn never runs under: where the ground is higher than a patio
 * the patio sits in its dig rather than under grass (PatioEdges3D.tsx patioEdgeGeometry draws the dig's sides). */
export const patioDisplayFootprints=(yard:YardModel)=>yard.features.filter(f=>!f.excluded&&f.config.kind==='patio'&&!f.config.stoneSteps&&!f.config.stepAssembly).flatMap(f=>f.footprints);
/** Stone-step treads set below the finished lawn (steps down into a sunken patio): the lawn is opened over them, as it is
 * over plain paving, so it never covers a lower tread. Treads at or above grade stand on the lawn and leave it whole.
 * Each tread is widened by STEP_CUT_MARGIN_IN to close the hairline seam against the neighbouring paving's opening. */
const STEP_CUT_MARGIN_IN=.5;
export function sunkenStepDisplayFootprints(yard:YardModel){
 const treads=yard.features.filter(f=>!f.excluded&&f.config.kind==='patio'&&(f.config.stoneSteps||f.config.stepAssembly)).flatMap(f=>f.boxes.filter(b=>b.role==='stone-step'&&b.polygon&&(!b.stonePart||b.stonePart==='tread'||b.stonePart==='landing')));
 if(!treads.length)return [];
 const ground=lawnGround(yard);
 return treads.filter(b=>b.y+b.h/2<ground.height(b.x,b.z)+.05).map(b=>widen(b.polygon!,STEP_CUT_MARGIN_IN));
}
/** A convex outline pushed out by d (each side moved outward, corners re-met). */
function widen(p:{x:number;y:number}[],d:number){
 const n=p.length,area=p.reduce((a,v,i)=>a+v.x*p[(i+1)%n].y-p[(i+1)%n].x*v.y,0),sign=area>0?1:-1;
 const lines=p.map((a,i)=>{const b=p[(i+1)%n],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,nx=sign*dy/l,ny=-sign*dx/l;return {x:a.x+nx*d,y:a.y+ny*d,dx,dy};});
 return lines.map((l,i)=>{const k=lines[(i+n-1)%n],den=k.dx*l.dy-k.dy*l.dx;if(Math.abs(den)<1e-9)return {x:l.x,y:l.y};const t=((l.x-k.x)*l.dy-(l.y-k.y)*l.dx)/den;return {x:k.x+k.dx*t,y:k.y+k.dy*t};});
}
/** Ground in the finished views that is water, not lawn: ponds and pools. */
export const waterDisplayFootprints=(yard:YardModel,pools:PoolFeatureModel[])=>[...yard.features.filter(f=>!f.excluded&&f.config.kind==='water-feature').flatMap(f=>f.footprints),...pools.flatMap(p=>p.permanentExclusionFootprints)];
/** Finished terrain is the proposed surface. Permanent water openings stay open and paving
 * stands in its own opening; excavation/working-clearance envelopes belong to inspection. */
export function groundDisplayCuts(yard:YardModel,pools:PoolFeatureModel[],finished:boolean){
 return yardClip(finished?
  [...waterDisplayFootprints(yard,pools),...patioDisplayFootprints(yard),...sunkenStepDisplayFootprints(yard)]:
  [...yard.excavationRegions.map(e=>e.polygon),...pools.flatMap(p=>p.excavationFootprints)]);
}
/** The joint sand's actual top stays visible between rigid pavers. Its buried
 * sides/bottom belong to construction inspection, not a new support surface. */
export function jointSurfaceGeometry(input:THREE.BufferGeometry){
 const source=input.index?input.toNonIndexed():input.clone(),positions=source.getAttribute('position'),normals=source.getAttribute('normal'),kept:number[]=[];
 for(let i=0;i<positions.count;i+=3)if(normals.getY(i)>.5)for(let j=0;j<3;j++)kept.push(positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j));
 source.dispose();const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(kept,3));result.computeVertexNormals();return result;
}
