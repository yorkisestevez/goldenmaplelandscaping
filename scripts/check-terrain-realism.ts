import {illustrativeBanksVisible} from '../src/features/deckcraft/components/viewer3d/finishedGrade';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {buildYardModel} from '../src/features/deckcraft/yardModel';
import {getPoolModels} from '../src/features/deckcraft/poolModel';
import {poolRenderMeshes} from '../src/features/deckcraft/poolRenderMeshes';
import {poolBufferGeometry,poolMaterial} from '../src/features/deckcraft/components/viewer3d/Pool3D';
import {poolDepthSampler,waterOpacity} from '../src/features/deckcraft/components/viewer3d/waterOptics';
import {poolFloorElevation} from '../src/features/deckcraft/poolGeometry';
import {applyHardscapeFinish} from '../src/features/deckcraft/components/viewer3d/hardscapeFinish';
import {hardscapeAppearance} from '../src/features/deckcraft/components/viewer3d/hardscapeAppearance';
import {CONSTRUCTION_YARD_ROLES,groundDisplayCuts,jointSurfaceGeometry,patioDisplayFootprints,sunkenStepDisplayFootprints} from '../src/features/deckcraft/components/viewer3d/finishedSurfaceGeometry';
import {groundEdgeGeometry,groundGeometry,soilFaceMaterial} from '../src/features/deckcraft/components/viewer3d/lawnSurface';
import {lawnGround} from '../src/features/deckcraft/components/viewer3d/lawnGround';
import {insideRings} from '../src/features/deckcraft/patioGroundContact';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {chooseRenderQuality} from '../src/features/deckcraft/components/viewer3d/renderQuality';
import {sceneQuality} from '../src/features/deckcraft/components/viewer3d/sceneLook';
import {Chain} from '../src/features/deckcraft/components/viewer3d/renderPipeline';
import {reflectionBudget} from '../src/features/deckcraft/components/viewer3d/windowReflections';
import {createFixtureLighting,litMaterial} from '../src/features/deckcraft/components/viewer3d/fixtureLighting';
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},near=(a:number,b:number,m:string,t=1e-4)=>ok(Math.abs(a-b)<t,`${m}: ${a}/${b}`);
const data={...structuredClone(DEFAULT_DECK),...JSON.parse(readFileSync(new URL('./pool-profile-layout-fixture.json',import.meta.url),'utf8'))};await ensureLiveDesignExtensions(data);
const before=calculateEstimate(data),yard=buildYardModel(data,before.model),pool=getPoolModels(data,before.model)[0],sample=poolDepthSampler(pool),saved=JSON.stringify(data),quantities=JSON.stringify({yard:yard.quantities,pool:pool.quantities,estimate:before.subtotal});
for(const part of poolRenderMeshes(pool)){
 const g=poolBufferGeometry(part,sample),positions=g.getAttribute('position'),depth=g.getAttribute('poolDepth');
 for(let i=0;i<positions.count;i++){const p={x:positions.getX(i),y:positions.getY(i),z:positions.getZ(i)};if(part.role==='water'){const actual=pool.waterElevationIn-poolFloorElevation(pool.config,{x:p.x,y:p.z});near(depth.getX(i),actual,'Water optical depth follows actual rotated basin floor',.001);}}
 g.dispose();
}
for(const d of [0,1,12,24,48,72,120]){ok(waterOpacity(d)>=.14&&waterOpacity(d)<=.66,'Water alpha stays physically subdued');if(d)ok(waterOpacity(d)>waterOpacity(d-1),'Deeper water increases attenuation');}
const fixture=createFixtureLighting();
for(const material of [poolMaterial({role:'water',color:'#91cddd'}),poolMaterial({role:'coping',color:'#b3a690'}),applyHardscapeFinish(new THREE.MeshStandardMaterial({color:'#b9b8b5'})),soilFaceMaterial()]){
 const color=(material as THREE.MeshStandardMaterial).color.getHex();litMaterial(material,fixture);
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as THREE.WebGLProgramParametersWithUniforms;material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
 ok(shader.fragmentShader.includes('fxCount'),'Every material composes with actual fixture lighting');ok(!shader.vertexShader.includes('position.y+=')&&!shader.vertexShader.includes('sin(time'),'Shaders neither displace geometry nor require animation');near((material as THREE.MeshStandardMaterial).color.getHex(),color,'Material patches preserve selected product colors',1);
 if(shader.fragmentShader.includes('poolAbsorption'))ok(shader.vertexShader.includes('poolDepth')&&shader.fragmentShader.includes('poolGradient'),'Water shader uses depth and per-fragment calm ripples');
 else ok(shader.fragmentShader.includes('mineralDet')&&shader.fragmentShader.includes('mineralNormalFade'),'Mineral normals use physically scaled, filtered relief');
 const a=material.customProgramCacheKey();const again={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as THREE.WebGLProgramParametersWithUniforms;material.onBeforeCompile(again,{} as THREE.WebGLRenderer);assert.equal(shader.fragmentShader,again.fragmentShader);assert.equal(a,material.customProgramCacheKey());checks+=2;material.dispose();
}
fixture.dispose();
const source=new THREE.BoxGeometry(48,4,36),joint=jointSurfaceGeometry(source),p=joint.getAttribute('position');ok(p.count===6,'Finished joint layer retains only its actual top');for(let i=0;i<p.count;i++)near(p.getY(i),2,'Joint-sand top elevation remains unchanged');joint.dispose();source.dispose();
ok(CONSTRUCTION_YARD_ROLES.has('base')&&CONSTRUCTION_YARD_ROLES.has('geogrid')&&!CONSTRUCTION_YARD_ROLES.has('paver'),'Construction-only roles stay separate from finished units');
const inspect=groundEdgeGeometry(yard,'proposed',[],true),finished=groundEdgeGeometry(yard,'proposed',[],false);ok(inspect.getAttribute('position').count>=finished.getAttribute('position').count,'Survey-only cut faces are confined to inspection');inspect.dispose();finished.dispose();
ok(illustrativeBanksVisible({features:[{config:{}}]}),'Legacy absent fields retain their saved illustrative presentation');
for(const model of [{terrain:{elevationIn:1},features:[{config:{}}]},{terrain:{slopePct:2},features:[{config:{}}]},{features:[{config:{patioSlope:{xPct:0,zPct:0}}}]},{features:[{config:{wallTopSteps:[]}}]}])ok(!illustrativeBanksVisible(model),'Physical planning terrain and finished settings never invent decorative banks');
const stock={id:'cap-fragment',unitId:'stock-17',role:'wall-cap' as const};assert.deepEqual(hardscapeAppearance(stock),hardscapeAppearance({...stock,id:'other-fragment'}));checks++;assert.deepEqual(hardscapeAppearance(stock),hardscapeAppearance(stock));checks++;
const facts={renderer:'Hardware GPU',maxTextureSize:8192,maxSamples:4};
for(const [tier,q] of [['high',chooseRenderQuality(facts,false)],['balanced',chooseRenderQuality(facts,true)],['constrained',chooseRenderQuality({...facts,renderer:'SwiftShader'},false)]] as const){
 const budget=sceneQuality(q,{maxTextureSize:4096,maxSamples:2}),reflect=reflectionBudget(q,{maxTextureSize:512,maxSamples:1});ok(q.tier===tier,'Quality tier matches fixture');ok(budget.msaaSamples<=2&&reflect.samples<=1&&reflect.edge<=512,'Targets respect actual GPU limits');
 const gl={extensions:{has:()=>false},capabilities:{maxSamples:2,maxTextureSize:4096}} as unknown as THREE.WebGLRenderer,chain=new Chain(gl,new THREE.Scene(),new THREE.PerspectiveCamera(),q.msaaSamples,q);chain.setSize(1000,600,1);
 ok(chain.beauty.texture.type===THREE.UnsignedByteType,'Missing float-buffer extensions use the real SDR fallback target');near(chain.beauty.samples,budget.msaaSamples,'Actual MSAA target uses capability budget',1e-6);near(chain.gtao.width,Math.ceil(1000*q.aoResolution),'Actual AO target uses quality resolution',1e-6);near(chain.gtao.height,Math.ceil(600*q.aoResolution),'Actual AO height uses quality resolution',1e-6);
 let disposed=0;chain.beauty.addEventListener('dispose',()=>disposed++);chain.post.addEventListener('dispose',()=>disposed++);chain.dispose();ok(disposed===2,'Pipeline target cleanup disposes actual render targets');
 if(tier==='constrained')ok(budget.msaaSamples===0&&budget.denoiseRadius===3&&reflect.samples===0&&budget.bloomResolution===.5,'Constrained tier reduces actual pass and reflection budgets');
}
assert.equal(JSON.stringify(data),saved);checks++;const after=calculateEstimate(data),afterYard=buildYardModel(data,after.model),afterPool=getPoolModels(data,after.model)[0];assert.equal(JSON.stringify({yard:afterYard.quantities,pool:afterPool.quantities,estimate:after.subtotal}),quantities);checks++;
// Stone steps down into a sunken lounge open the finished lawn; steps that rise from it do not. The opening is display
// only: the same yard's quantities and price stay put, and grade faces are not drawn across a tread the lawn no longer covers.
{
 const lounge:YardFeature={id:'lounge',name:'Sunken lounge',kind:'patio',enabled:true,xFt:50,zFt:50,widthFt:10,depthFt:8,heightIn:0,rotationDeg:0,finishedElevationIn:-18,productId:'permacon-mondrian-plus',color:'#c4bfb4'};
 const flight=(id:string,name:string,xFt:number,zFt:number,lower:number,upper:number,rotationDeg=0):YardFeature=>({id,name,kind:'patio',enabled:true,xFt,zFt,widthFt:4,depthFt:3,heightIn:0,rotationDeg,productId:'permacon-mondrian-plus',color:'#b8b5ae',finishedElevationIn:upper,stoneSteps:{lowerElevationIn:lower,riserCount:3,treadRunIn:12,stockWidthIn:48,stockDepthIn:12,stockThicknessIn:6,baseDepthIn:6,settingBedIn:1,jointIn:0,productName:'Cut stone treads'}});
 const downZ=(lounge.zFt*12+lounge.depthFt*6+.02+18)/12;
 const scene:DeckData={...structuredClone(DEFAULT_DECK),houseVisible:false,stairFlights:0,railingType:'None',yardFeatures:[lounge,flight('down','Steps down',50,downZ,-18,0),flight('up','Steps up',80,50,0,18,25)],terrainConfig:{widthFt:160,depthFt:160,elevationIn:0,slopePct:0}};
 await ensureLiveDesignExtensions(scene);const sceneSaved=JSON.stringify(scene),sceneEstimate=calculateEstimate(scene),sceneYard=buildYardModel(scene,sceneEstimate.model),sceneQuantities=JSON.stringify(sceneYard.quantities);
 const lawn=lawnGround(sceneYard),treads=(id:string)=>sceneYard.features.find(f=>f.config.id===id)!.boxes.filter(b=>b.role==='stone-step'&&b.polygon&&(!b.stonePart||b.stonePart==='tread')),below=(b:{y:number;h:number;x:number;z:number})=>b.y+b.h/2<lawn.height(b.x,b.z)+.05;
 const sunken=treads('down').filter(below),rising=[...treads('down').filter(b=>!below(b)),...treads('up')],openings=sunkenStepDisplayFootprints(sceneYard),patios=patioDisplayFootprints(sceneYard);
 ok(sunken.length>=2&&rising.length>=4&&sunken.every(b=>insideRings(openings,b.x,b.z))&&rising.every(b=>!insideRings(openings,b.x,b.z)),'Finished lawn opens over sunken treads and not over treads at or above the lawn');
 ok(sunken.every(b=>insideRings(groundDisplayCuts(sceneYard,[],true),b.x,b.z))&&rising.every(b=>!insideRings(groundDisplayCuts(sceneYard,[],true),b.x,b.z)),'Finished ground cuts follow those openings and leave rising steps whole');
 const width=scene.width*12,depth=scene.length*12,tw=sceneYard.terrain.widthFt*12,td=sceneYard.terrain.depthFt*12,bounds={minX:width/2-tw/2,minZ:depth/2-td/2,width:tw,depth:td};
 const mesh=groundGeometry(sceneYard,groundDisplayCuts(sceneYard,[],true),width,depth,bounds,'proposed'),pos=mesh.getAttribute('position');
 const hit=(x:number,z:number)=>{for(let i=0;i<pos.count;i+=3){const ax=pos.getX(i),az=pos.getZ(i),bx=pos.getX(i+1),bz=pos.getZ(i+1),cx=pos.getX(i+2),cz=pos.getZ(i+2),abx=bx-ax,abz=bz-az,acx=cx-ax,acz=cz-az,den=abx*acz-acx*abz;if(Math.abs(den)<1e-8)continue;const px=x-ax,pz=z-az,u=(px*acz-acx*pz)/den,v=(abx*pz-px*abz)/den;if(u>=-1e-4&&v>=-1e-4&&u+v<=1+1e-4)return true;}return false;};
 ok(sunken.every(b=>!hit(b.x,b.z))&&rising.every(b=>hit(b.x,b.z)),'The drawn lawn covers rising treads and leaves sunken treads clear');
 const faces=groundEdgeGeometry(sceneYard,'proposed',[...patios,...openings],true,patios),bare=groundEdgeGeometry(sceneYard,'proposed',patios,true,patios);
 ok(faces.getAttribute('position').count<=bare.getAttribute('position').count,'Stair openings only remove grade faces');
 const fp=faces.getAttribute('position');let crossed=false;for(let i=0;i<fp.count;i+=3){const x=(fp.getX(i)+fp.getX(i+1)+fp.getX(i+2))/3,z=(fp.getZ(i)+fp.getZ(i+1)+fp.getZ(i+2))/3;if(sunken.some(b=>Math.hypot(x-b.x,z-b.z)<Math.min(b.w,b.d)/4))crossed=true;}
 ok(!crossed,'Grade faces are not drawn across a sunken tread');
 faces.dispose();bare.dispose();mesh.dispose();
 ok(JSON.stringify(scene)===sceneSaved&&JSON.stringify(sceneYard.quantities)===sceneQuantities&&calculateEstimate(scene).subtotal===sceneEstimate.subtotal,'The stair lawn opening leaves quantities and pricing unchanged');
}
console.log(`${checks} terrain/water realism, shader composition, stock identity, actual pass budgets, cleanup and quantity-invariant checks passed.`);
