import * as THREE from 'three';
import {yardClip,type YardRole,type YardModel} from '../../yardModel';
import type {PoolFeatureModel} from '../../poolModel';
export const CONSTRUCTION_YARD_ROLES:ReadonlySet<YardRole>=new Set(['base','wall-drainage','backfill','geogrid','pump','drain-pipe','water-pipe']);
/** Finished terrain is the proposed surface. Only permanent water openings stay
 * open; excavation/working-clearance envelopes belong to inspection. */
export function groundDisplayCuts(yard:YardModel,pools:PoolFeatureModel[],finished:boolean){
 return yardClip(finished?
  [...yard.features.filter(f=>!f.excluded&&f.config.kind==='water-feature').flatMap(f=>f.footprints),...pools.flatMap(p=>p.permanentExclusionFootprints)]:
  [...yard.excavationRegions.map(e=>e.polygon),...pools.flatMap(p=>p.excavationFootprints)]);
}
/** The joint sand's actual top stays visible between rigid pavers. Its buried
 * sides/bottom belong to construction inspection, not a new support surface. */
export function jointSurfaceGeometry(input:THREE.BufferGeometry){
 const source=input.index?input.toNonIndexed():input.clone(),positions=source.getAttribute('position'),normals=source.getAttribute('normal'),kept:number[]=[];
 for(let i=0;i<positions.count;i+=3)if(normals.getY(i)>.5)for(let j=0;j<3;j++)kept.push(positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j));
 source.dispose();const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(kept,3));result.computeVertexNormals();return result;
}
