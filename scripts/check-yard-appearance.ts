import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {newYardFeature} from '../src/features/deckcraft/yardSettings';
import {buildYardModel,yardClip,type YardBox} from '../src/features/deckcraft/yardModel';
import {HARDSCAPE_PRODUCTS,hardscapeProduct} from '../src/features/deckcraft/hardscapeCatalogue';
import {wallCapOptions} from '../src/features/deckcraft/wallCaps';
import {supplierFaceUv} from '../src/features/deckcraft/components/viewer3d/hardscapeSurface';
import {hardscapeAppearance,sampleInteriorUv} from '../src/features/deckcraft/components/viewer3d/hardscapeAppearance';
import {lawnTufts} from '../src/features/deckcraft/components/viewer3d/lawnTufts';
import {lawnHeight} from '../src/features/deckcraft/components/viewer3d/lawnSurface';

const patio={...newYardFeature('patio',DEFAULT_DECK),id:'appearance-patio',xFt:20,zFt:30,widthFt:16,depthFt:12};
const wall={...newYardFeature('retaining-wall',DEFAULT_DECK),id:'appearance-wall',xFt:20,zFt:50,widthFt:16};
const yard=buildYardModel({...structuredClone(DEFAULT_DECK),terrainConfig:{widthFt:100,depthFt:100,elevationIn:3,slopePct:2},yardFeatures:[patio,wall]});
assert.ok(yard.features.every(f=>!f.excluded));
const before=JSON.stringify(yard),masks=yardClip(yard.features.flatMap(f=>f.footprints));
const inside=(x:number,z:number)=>{let hit=false;for(const polygon of masks){let local=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)local=!local;}if(local)hit=!hit;}return hit;};
let checks=0;const check=(condition:unknown)=>{assert.ok(condition);checks++;};
const start=performance.now(),tufts=lawnTufts(yard,192,144,masks);
check(tufts.length>10000&&tufts.length<=28000);
check(tufts.some(t=>t.z>wall.zFt*12+24));
for(const t of tufts){
 check(Object.values(t).every(Number.isFinite));
 check(!inside(t.x,t.z));
 check(Math.abs(t.y-(lawnHeight(yard.terrain,t.z)-.04))<1e-6);
 check(t.height>=1.3&&t.height<=2.4);
}
assert.deepEqual(lawnTufts(yard,192,144,masks),tufts);checks++;
check(lawnTufts(yard,192,144,masks,16000).length<=16000);
assert.deepEqual(lawnTufts(yard,192,144,masks,0),[]);checks++;
check(JSON.stringify(yard)===before);
for(const role of ['paver','wall-block','wall-cap'] as const){
 const stock={id:'fragment-a',unitId:'same-stock-piece',role};
 assert.deepEqual(hardscapeAppearance(stock),hardscapeAppearance({...stock,id:'fragment-b'}));checks++;
 const different=hardscapeAppearance({...stock,unitId:'other-stock-piece'});
 assert.notDeepEqual(hardscapeAppearance(stock),different);checks++;
 check([different.r,different.g,different.b].every(v=>v>.9&&v<1.06));
}
for(const value of [-2,0,.5,1,3])for(const phase of [0,.5,1])for(const directional of [false,true]){
 const uv=sampleInteriorUv(value,phase,directional);check(uv>=.03&&uv<=.97000001);
}
const swatches=JSON.parse(readFileSync('public/deckcraft/hardscape-swatches.json','utf8'));
for(const key of [
 ['techo-blu60-smooth-slab','smooth-modular','chestnut-brown'],
 ['techo-raffinato-wall','smooth','greyed-nickel'],
]){
 const file=swatches.swatches[key[0]][key[1]][key[2]];
 const {data,info}=await sharp('public/deckcraft/hardscape/'+file).raw().toBuffer({resolveWithObject:true});
 const pixel=(u:number,v:number)=>{const i=(Math.floor(v*(info.height-1))*info.width+Math.floor(u*(info.width-1)))*info.channels;return [data[i],data[i+1],data[i+2]];};
 check(pixel(0,0).every(c=>c>245));
 for(const u of [0,1])for(const v of [0,1]){
  const sampled=pixel(sampleInteriorUv(u,.5),sampleInteriorUv(v,.5));
  check(sampled.some(c=>c<235));
 }
}
// Every exposed face spans two texture axes, including the end of a rotated wall.
const stockBox={...yard.boxes.find(b=>b.role==='wall-block')!,id:'uv-fragment-a',unitId:'uv-stock',x:0,y:3,z:0,h:6,surface:{swatchKey:'techo-raffinato-wall/smooth/greyed-nickel',cx:0,cz:0,angle:0,lengthIn:28,widthIn:14,heightIn:6,kind:'wall',sourceUrl:''}} as YardBox;
for(const angle of [0,.3,Math.PI/2,Math.PI]){
 const stock={...stockBox,surface:{...stockBox.surface!,angle}},co=Math.cos(angle),si=Math.sin(angle);
 const project=(u:number,y:number,v:number)=>supplierFaceUv(stock,{x:u*co-v*si,y,z:u*si+v*co},{x:co,y:0,z:si});
 const low=project(14,0,-7),wide=project(14,0,7),high=project(14,6,-7);
 check(Math.abs(wide[0]-low[0]-.84)<1e-8);
 check(Math.abs(high[1]-low[1]-.84)<1e-8);
 check(Math.abs(high[0]-low[0])<1e-8);
 check(Math.abs(wide[1]-low[1])<1e-8);
}
const point={x:3,y:6,z:2},up={x:0,y:1,z:0};
assert.deepEqual(supplierFaceUv(stockBox,point,up),supplierFaceUv({...stockBox,id:'other-cut-fragment'},point,up));checks++;
const wood={...stockBox,surface:{...stockBox.surface!,swatchKey:'techo-borealis-wall/wood-grain/brown'}};
const grainA=supplierFaceUv(wood,{x:-14,y:6,z:-7},up),grainB=supplierFaceUv(wood,{x:14,y:6,z:-7},up);
check(Math.abs(grainB[0]-grainA[0]-.94)<1e-8&&Math.abs(grainB[1]-grainA[1])<1e-8);

const product=hardscapeProduct('techo-raffinato-wall')!,finish=product.finishes.find(f=>f.id==='smooth')!,unit=finish.units.find(u=>u.role==='standard'||u.role==='wall')??finish.units[0];
const caps=wallCapOptions(HARDSCAPE_PRODUCTS,product,finish,'greyed-nickel',unit,36).filter(c=>c.sourceProductId==='techo-raffinato-cap');
check(caps.length===20);
for(const cap of caps){
 const key=cap.swatchKey!;check(key===`techo-raffinato-cap/${cap.sourceFinishId}/${cap.sourceColorId}`);
 const file=swatches.swatches[cap.sourceProductId][cap.sourceFinishId][cap.sourceColorId],window=swatches.sampleWindows[key];
 check(!!file&&!!window);
 check(cap.lengthMm===356&&cap.widthMm===(cap.sourceFinishId==='smooth'?711:812));
 check(cap.heightMm===(cap.sourceFinishId==='smooth'&&cap.stockUnitId.endsWith('-90')?90:60));
 const box={...stockBox,role:'wall-cap',surface:{...stockBox.surface!,swatchKey:key}} as YardBox;
 for(const corner of [{x:-14,y:6,z:-7},{x:14,y:6,z:-7},{x:14,y:6,z:7},{x:-14,y:6,z:7}]){
  const uv=supplierFaceUv(box,corner,up,window);
  check(uv[0]>=window.u0&&uv[0]<=window.u1&&uv[1]>=window.v0&&uv[1]<=window.v1);
 }
}
const provenance=JSON.parse(readFileSync('public/deckcraft/raffinato-cap-sources.json','utf8'));
for(const sample of provenance.samples){
 const file=swatches.swatches['techo-raffinato-cap']['hd2-smooth'][sample.color];
 check(createHash('sha256').update(readFileSync('public/deckcraft/hardscape/'+file)).digest('hex')===sample.sha256);
}
console.log(`Yard appearance passed: ${checks} checks, ${tufts.length} lawn instances. Terrain and stock finishes preserved; all 20 Raffinato cap choices resolve original manufacturer photos; rotated block ends retain depth and height UVs.`);
