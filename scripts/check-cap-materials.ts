import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import * as THREE from 'three';
import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
import {HARDSCAPE_PRODUCTS,hardscapeBody} from '../src/features/deckcraft/hardscapeCatalogue';
import {wallCapOptions} from '../src/features/deckcraft/wallCaps';
import {chooseRenderQuality} from '../src/features/deckcraft/components/viewer3d/renderQuality';
import {applyHardscapeFinish} from '../src/features/deckcraft/components/viewer3d/hardscapeFinish';
import {applyWallDaylight} from '../src/features/deckcraft/components/viewer3d/wallDaylight';
import {materialPatchKeys} from '../src/features/deckcraft/components/viewer3d/materialPatches';
import {bankTufts} from '../src/features/deckcraft/components/viewer3d/bankTufts';
import {exposedWallEnvelope} from '../src/features/deckcraft/components/viewer3d/wallFraming';
import {overviewCamera} from '../src/features/deckcraft/components/viewer3d/cameraFraming';
import type {YardBox} from '../src/features/deckcraft/yardModel';
import {visibleSkyElevation,visibleSkyHorizon,visibleSkyStrength,skyStrength,skyDomeSampleElevation,VISIBLE_SKY_MIN_DEG,VISIBLE_DAY_SKY_EXPOSURE} from '../src/features/deckcraft/components/viewer3d/skyModel';

const map=JSON.parse(readFileSync('public/deckcraft/hardscape-swatches.json','utf8'));
const manifest=JSON.parse(readFileSync('public/deckcraft/other-cap-sources.json','utf8'));
let checks=0;const check=(value:unknown,message?:string)=>{assert.ok(value,message);checks++;};
for(const e of manifest.samples){
 const data=readFileSync('public/deckcraft/hardscape/'+e.file);
 check(createHash('sha256').update(data).digest('hex')===e.sha256);
 const metadata=await sharp(data).metadata();check(metadata.width===e.width&&metadata.height===e.height);
 const finish=e.product==='techo-portofino-cap'?'fossil-stone':'smooth';
 check(map.swatches[e.product][finish][e.color]===e.file);
 const w=map.sampleWindows[e.product+'/'+finish+'/'+e.color];check(w.u0>0&&w.u0<w.u1&&w.u1<1&&w.v0>0&&w.v0<w.v1&&w.v1<1);
}
check(manifest.samples.length===13);
const reachable=new Map<string,ReturnType<typeof wallCapOptions>[number]>();
for(const p of HARDSCAPE_PRODUCTS.filter(p=>p.category==='wall'))for(const f of p.finishes)for(const c of f.colors)for(const u of f.units.filter(u=>hardscapeBody(u.role)))for(const cap of wallCapOptions(HARDSCAPE_PRODUCTS,p,f,c.id,u,120))reachable.set(cap.sourceProductId+'/'+cap.sourceFinishId+'/'+cap.sourceColorId,cap);
for(const [key,cap] of reachable){
 check(!!cap.swatchKey,'No cap sample key: '+key);
 const [p,f,c]=cap.swatchKey!.split('/');check(!!map.swatches[p]?.[f]?.[c],'Unresolved sample: '+key);
 check([cap.widthMm,cap.lengthMm,cap.heightMm].every(n=>n>0));
}
for(const [name,expected] of [['techo-portofino-cap',4],['oaks-nueva-coping',4],['oaks-modan-coping',5]] as const)check([...reachable.values()].filter(c=>c.sourceProductId===name).length===expected);
const high={renderer:'NVIDIA RTX',memoryGb:8,cores:12,maxTextureSize:16384,maxSamples:8};
const low=chooseRenderQuality({...high,renderer:'ANGLE SwiftShader'},false),phone=chooseRenderQuality(high,true),desktop=chooseRenderQuality(high,false);
check(low.tier==='constrained'&&low.dpr===1&&low.grassBudget===8000&&low.msaaSamples===0);
check(phone.tier==='balanced'&&phone.grassBudget===16000&&phone.shadowSize===2048);
check(desktop.tier==='high'&&desktop.grassBudget===28000&&desktop.msaaSamples===4);
for(const facts of [{...high,memoryGb:2},{...high,cores:2},{...high,maxTextureSize:2048},{...high,renderer:'llvmpipe'}])check(chooseRenderQuality(facts,false).tier==='constrained');
check(chooseRenderQuality({maxTextureSize:8192,maxSamples:1},false).msaaSamples===1);
const balancedFacts={renderer:'Hardware GPU',memoryGb:4,cores:4,maxTextureSize:8192,maxSamples:4};
const balanced=chooseRenderQuality(balancedFacts,true),balancedAgain=chooseRenderQuality(balancedFacts,true,false);
check(balanced.tier==='balanced'&&balanced.dpr===1.25&&balanced.grassBudget===16000&&balanced.shadowSize===2048&&balanced.msaaSamples===2&&balanced.aoSamples===12&&balanced.aoResolution===.45&&balanced.anisotropy===8);
assert.deepEqual(balanced,balancedAgain);checks++;
const showcase=chooseRenderQuality({...high,renderer:'ANGLE SwiftShader',maxSamples:4,maxTextureSize:8192},false,true);
check(showcase.tier==='high'&&showcase.dpr===2&&showcase.grassBudget===60000&&showcase.aoSamples===16&&showcase.aoResolution===.75&&showcase.msaaSamples===4&&showcase.shadowSize===4096&&showcase.anisotropy===16);
check(chooseRenderQuality({...high,renderer:'ANGLE SwiftShader'},false,false).tier==='constrained','Showcase stays off unless the caller opts in');
const material=applyWallDaylight(applyHardscapeFinish(new THREE.MeshStandardMaterial()));
check(materialPatchKeys(material).length===2);
const shader={uniforms:{},vertexShader:'#include <common>\n#include <worldpos_vertex>',fragmentShader:'#include <common>\n#include <roughnessmap_fragment>\n#include <lights_fragment_maps>'} as THREE.WebGLProgramParametersWithUniforms;
material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
check(shader.vertexShader.includes('vMineralPosition=(modelMatrix'));
check(shader.fragmentShader.includes('roughnessFactor=clamp')&&shader.fragmentShader.includes('wallLum'));
check(!shader.fragmentShader.includes('Math.'));
material.dispose();
// The bank plane's elevation is known analytically. A patio mask and cap strip
// exclude roots, and repeated calls remain stable after unrelated scene edits.
const bank=new THREE.BufferGeometry();bank.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,120,12,0,0,6,120,120,12,0,120,18,120,0,6,120],3));
const masks=[[{x:30,y:30},{x:90,y:30},{x:90,y:90},{x:30,y:90}],[{x:0,y:0},{x:120,y:0},{x:120,y:4},{x:0,y:4}]];
const bankGrass=bankTufts(bank,300,masks);check(bankGrass.length===300);
assert.deepEqual(bankTufts(bank,300,masks),bankGrass);checks++;
for(const t of bankGrass){check(Math.abs(t.y-(t.x/10+t.z/20+.01))<1e-6);check(!(t.x>=30&&t.x<=90&&t.z>=30&&t.z<=90));check(t.z>4);check(Object.values(t).every(Number.isFinite));}
check(bankTufts(bank,0,masks).length===0);check(bankTufts(bank,300,[[{x:0,y:0},{x:120,y:0},{x:120,y:120},{x:0,y:120}]]).length===0);bank.dispose();
const stock={id:'battered-top',featureId:'wall',role:'wall-cap',x:120,y:90,z:150,w:28,h:4,d:16,angle:.8,color:'#999'} as YardBox;
const envelope=exposedWallEnvelope([stock,{...stock,id:'grid',role:'geogrid',z:999},{...stock,id:'buried',role:'wall-block',y:-20}],{elevationIn:0,slopePct:0});
check(envelope.length===8);check(envelope.every(p=>p.z<20&&p.y>0));
for(const aspect of [.5,.72,1.72]){
 const fit=overviewCamera({w:16,d:12,height:8,cx:8,cz:6,aspect,points:envelope}),camera=new THREE.PerspectiveCamera(38,aspect,.01,10000);camera.position.set(...fit.position);camera.lookAt(...fit.target);camera.updateMatrixWorld(true);
 for(const p of envelope){const v=new THREE.Vector3(p.x,p.y,p.z).project(camera);check(Math.abs(v.x)<1/1.12+1e-6&&Math.abs(v.y)<1/1.12+1e-6);}
}
const minimum=VISIBLE_SKY_MIN_DEG*Math.PI/180;
for(const angle of [-Math.PI/2,0,.2,.6,1,Math.PI/2])check(visibleSkyElevation(angle)>=minimum&&visibleSkyElevation(angle)<=Math.PI/2);
check(visibleSkyElevation(0)===minimum&&Math.abs(visibleSkyElevation(Math.PI/2)-Math.PI/2)<1e-12);
const skyBytes=new Float32Array(8*36*4);for(let y=0;y<36;y++)for(let x=0;x<8;x++){const i=(y*8+x)*4;skyBytes[i]=y/36;skyBytes[i+1]=.2;skyBytes[i+2]=.3;skyBytes[i+3]=1;}
const skyMap=new THREE.DataTexture(skyBytes,8,36,THREE.RGBAFormat,THREE.FloatType);
for(const flip of [false,true]){skyMap.flipY=flip;const v=minimum/Math.PI+.5,row=Math.floor((flip?1-v:v)*36),horizon=visibleSkyHorizon(skyMap)!;check(Math.abs(horizon[0]-row/36)<1e-6&&Math.abs(horizon[1]-.2)<1e-6&&Math.abs(horizon[2]-.3)<1e-6);}
const rawHorizon=visibleSkyHorizon(skyMap,0)!;check(Math.abs(rawHorizon[0]-.5)<1e-6&&rawHorizon[0]!==visibleSkyHorizon(skyMap)![0],'A raw elevation samples the photographed horizon, not the remapped upper sky');
for(const el of [-.2,0,.04,.2,.5,1,Math.PI/2]){const min=VISIBLE_SKY_MIN_DEG*Math.PI/180,displayed=Math.max(0,el),clean=min+displayed*(1-min/(Math.PI/2));check(Math.abs(skyDomeSampleElevation(el,0)-clean)<1e-12,'Horizon band off matches the editor sky');}
check(skyDomeSampleElevation(0,1)===0&&skyDomeSampleElevation(Math.PI/2,1)>1.2,'The neighbourhood band opens the photographed horizon and keeps the zenith');
skyMap.dispose();
const halfBytes=new Uint16Array(8*36*4);for(let i=0;i<halfBytes.length;i++)halfBytes[i]=THREE.DataUtils.toHalfFloat([.2,.3,.4,1][i%4]);const halfMap=new THREE.DataTexture(halfBytes,8,36,THREE.RGBAFormat,THREE.HalfFloatType);const halfHorizon=visibleSkyHorizon(halfMap)!;check(halfHorizon.every((c,i)=>Math.abs(c-[.2,.3,.4][i])<.001));halfMap.dispose();
check(visibleSkyHorizon(new THREE.Texture())===null);
// Use the actual shipped HDR, not a synthetic orientation fixture, to guard
// against sampling ground or displaying sun-normalised daylight too dark.
const hdrFile=readFileSync('src/features/deckcraft/components/viewer3d/assets/sky/sky-day-ibl.hdr');
const hdr=new HDRLoader().parse(hdrFile.buffer.slice(hdrFile.byteOffset,hdrFile.byteOffset+hdrFile.byteLength));
const actualSky=new THREE.DataTexture(hdr.data,hdr.width,hdr.height,THREE.RGBAFormat,hdr.type);actualSky.flipY=hdr.flipY;
const actualHorizon=visibleSkyHorizon(actualSky)!;
check(actualHorizon[2]>actualHorizon[1]&&actualHorizon[1]>actualHorizon[0],'Real upper daylight sky is blue, not the grassy lower hemisphere');
const displayedLuminance=(actualHorizon[0]*.2126+actualHorizon[1]*.7152+actualHorizon[2]*.0722)*visibleSkyStrength('day');
check(displayedLuminance>.3&&displayedLuminance<.5,'Actual daylight horizon has a readable display exposure');
check(visibleSkyStrength('day')===skyStrength('day').background*VISIBLE_DAY_SKY_EXPOSURE&&VISIBLE_DAY_SKY_EXPOSURE===4);
check(visibleSkyStrength('evening')===skyStrength('evening').background,'Dusk background exposure remains unchanged');
actualSky.dispose();
console.log(JSON.stringify({checks,reachableCapFinishes:reachable.size,newManufacturerPhotos:manifest.samples.length,photoBytes:manifest.samples.reduce((n:number,e:{bytes:number})=>n+e.bytes,0),qualityProfiles:{desktop,phone,software:low}},null,2));
