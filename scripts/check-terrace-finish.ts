import assert from 'node:assert/strict';
import {gradeDiscontinuities,siteElevationWarnings} from '../src/features/deckcraft/siteElevationChecks';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {YardFeature} from '../src/features/deckcraft/types';
import type {YardBox,YardFeatureModel} from '../src/features/deckcraft/yardModel';
import {createPlanningPool} from '../src/features/deckcraft/poolAssembly';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {getPoolModels} from '../src/features/deckcraft/poolModel';
import {poolRenderMeshes} from '../src/features/deckcraft/poolRenderMeshes';
import {poolBufferGeometry,poolMaterial} from '../src/features/deckcraft/components/viewer3d/Pool3D';
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const triangle=(x:number,h:number)=>({vertices:[{xIn:0,zIn:0,elevationIn:h},{xIn:0,zIn:120,elevationIn:h},{xIn:x,zIn:0,elevationIn:h}] as never,plane:{x:0,z:0,constant:h},existingPlane:{x:0,z:0,constant:0}});
const surface={proposedTriangles:[triangle(120,0),triangle(-120,24)]};
const config:YardFeature={id:'stairs',name:'Solid stairs',kind:'patio',enabled:true,xFt:0,zFt:5,widthFt:10,depthFt:1,heightIn:30,rotationDeg:0,productId:'segmental-concrete',color:'#777',stoneSteps:{} as never};
const stock=(bottom:number,top:number,z:number,d:number,patch:Partial<YardBox>={}):YardBox=>({id:'stock',featureId:'stairs',role:'stone-step',x:0,z,y:(bottom+top)/2,w:12,d,h:top-bottom,color:'#777',...patch});
const model=(boxes:YardBox[],patch:Partial<YardFeatureModel>={}):YardFeatureModel=>({config,footprints:[],topIn:30,boxes,members:[],warnings:[],quantities:{unsupportedBearingAreaSqft:0},excluded:false,...patch});
const wall=model([stock(-6,30,30,60,{role:'wall-block'})],{config:{...config,id:'wall',kind:'retaining-wall',stoneSteps:undefined}});
const stair=model([stock(-6,6,90,60),stock(6,12,90,60),stock(12,18,90,60),stock(18,30,90,60)]);
const joint=gradeDiscontinuities(surface,[wall,stair])[0];ok(joint.wallId==='wall'&&joint.stepId==='stairs','Adjacent wall and solid step stack jointly cover one terrain span');
ok(!gradeDiscontinuities(surface,[wall])[0].wallId,'Wall alone cannot hide its stair opening');
ok(!gradeDiscontinuities(surface,[wall,model(stair.boxes.slice(1))])[0].stepId,'Missing lowest support leaves the grade conflict unresolved');
ok(!gradeDiscontinuities(surface,[wall,model(stair.boxes,{quantities:{unsupportedBearingAreaSqft:1}})])[0].stepId,'Unsupported bearing cannot contain retained grade');
ok(!gradeDiscontinuities(surface,[wall,model([])])[0].stepId,'Aggregate-supported stairs supply no solid containment');
ok(!gradeDiscontinuities(surface,[wall,{...stair,excluded:true}])[0].stepId,'Excluded stairs cannot resolve a ground conflict');
ok(!gradeDiscontinuities(surface,[wall,{...stair,config:{...config,enabled:false}}])[0].stepId,'Disabled stairs cannot resolve a ground conflict');
const edge=model([stock(-6,30,60,120,{polygon:[{x:-12,y:0},{x:0,y:0},{x:0,y:120},{x:-12,y:120}]})]);
ok(gradeDiscontinuities(surface,[edge])[0].stepId==='stairs','Exact stock edge is included, including the closed right boundary');
ok(siteElevationWarnings(DEFAULT_DECK,surface,[wall,stair]).some(w=>/retaining installation remain pending/.test(w)),'Geometric contact keeps retaining installation unresolved');
for(const rotationDeg of [0,31,90]){
 const pool=createPlanningPool({id:'coping-'+rotationDeg,xIn:600,zIn:600,copingTopElevationIn:9,shape:rotationDeg===31?'rounded-rectangle':'rectangle'}),data={...structuredClone(DEFAULT_DECK),pools:[{...pool,rotationDeg}]};
 await ensureLiveDesignExtensions(data);const physical=getPoolModels(data)[0],before=JSON.stringify(physical),meshes=poolRenderMeshes(physical).filter(p=>p.role==='coping');ok(meshes.length>0,'Pool has actual rigid coping units');
 for(const mesh of meshes){const g=poolBufferGeometry(mesh);g.computeBoundingBox();const bounds=g.boundingBox!,nominal=mesh.vertices;
  for(const axis of ['x','y','z'] as const){const lo=Math.min(...nominal.map(p=>p[axis])),hi=Math.max(...nominal.map(p=>p[axis]));ok(bounds.min[axis]>=lo-.001&&bounds.max[axis]<=hi+.001,`${mesh.name} ${axis}: coping relief ${bounds.min[axis]}..${bounds.max[axis]} outside ${lo}..${hi}`);if(axis==='y')ok(Math.abs(bounds.min[axis]-lo)<.001&&Math.abs(bounds.max[axis]-hi)<.001,'Coping retains its stock thickness and fixed top');}
  ok(g.getAttribute('position').count>mesh.vertices.length,'Coping has resolved edge relief');ok(Array.from(g.getAttribute('position').array).every(Number.isFinite),'Coping render vertices remain finite');g.dispose();
 }
 ok(JSON.stringify(physical)===before,'Appearance geometry leaves physical quantities and solids unchanged');
}
const water=poolMaterial({role:'water',color:'#ffffff'});ok('ior' in water&&water.ior===1.333,'Water retains its dielectric index');ok('clearcoat' in water&&water.clearcoat===0,'Water uses one reflective interface');water.dispose();
console.log(`${checks} terrace finish checks passed.`);
