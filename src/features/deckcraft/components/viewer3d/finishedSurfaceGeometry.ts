import * as THREE from 'three';
import {yardClip,type YardRole,type YardModel} from '../../yardModel';
import type {PoolFeatureModel} from '../../poolModel';
export const CONSTRUCTION_YARD_ROLES:ReadonlySet<YardRole>=new Set(['base','wall-drainage','backfill','geogrid','pump','drain-pipe','water-pipe']);
/** Plain paving (not stone steps), which the finished lawn never runs under: where the ground is higher than a patio
 * the patio sits in its dig rather than under grass (PatioEdges3D.tsx patioEdgeGeometry draws the dig's sides). */
export const patioDisplayFootprints=(yard:YardModel)=>yard.features.filter(f=>!f.excluded&&f.config.kind==='patio'&&!f.config.stoneSteps&&!f.config.stepAssembly).flatMap(f=>f.footprints);
/** Ground in the finished views that is water, not lawn: ponds and pools. */
export const waterDisplayFootprints=(yard:YardModel,pools:PoolFeatureModel[])=>[...yard.features.filter(f=>!f.excluded&&f.config.kind==='water-feature').flatMap(f=>f.footprints),...pools.flatMap(p=>p.permanentExclusionFootprints)];
/** Finished terrain is the proposed surface. Permanent water openings stay open and paving
 * stands in its own opening; excavation/working-clearance envelopes belong to inspection. */
export function groundDisplayCuts(yard:YardModel,pools:PoolFeatureModel[],finished:boolean){
 return yardClip(finished?
  [...waterDisplayFootprints(yard,pools),...patioDisplayFootprints(yard)]:
  [...yard.excavationRegions.map(e=>e.polygon),...pools.flatMap(p=>p.excavationFootprints)]);
}
/** The joint sand's actual top stays visible between rigid pavers. Its buried
 * sides/bottom belong to construction inspection, not a new support surface. */
export function jointSurfaceGeometry(input:THREE.BufferGeometry){
 const source=input.index?input.toNonIndexed():input.clone(),positions=source.getAttribute('position'),normals=source.getAttribute('normal'),kept:number[]=[];
 for(let i=0;i<positions.count;i+=3)if(normals.getY(i)>.5)for(let j=0;j<3;j++)kept.push(positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j));
 source.dispose();const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(kept,3));result.computeVertexNormals();return result;
}
