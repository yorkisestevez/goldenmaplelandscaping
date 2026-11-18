import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {generateSketchDesign,parseSketchDocument} from '../src/features/deckcraft/sketch/sketchToDesign';
import {cleanStairPath,snapStairPath} from '../src/features/deckcraft/sketch/sketchStairPath';
import type {SketchDocument,SketchShape} from '../src/features/deckcraft/sketch/sketchTypes';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {serializeDeckReleaseDesign,parseDeckReleaseDesign,calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {describeDesign} from '../src/features/deckcraft/designFacts';
const source={...DEFAULT_DECK,deckType:'Freestanding' as const,houseVisible:false};
const main:SketchShape={id:'main',kind:'deck',label:'Deck',points:[{x:100,y:100},{x:420,y:100},{x:420,y:340},{x:100,y:340}],widthFt:16,depthFt:12,heightIn:30};
const path=(points:SketchShape['points'],extra:Partial<SketchShape>={}):SketchShape=>({id:'steps',kind:'stairs',label:'Steps',drawing:'edge-path',points,...extra});
let assertions=0;
const check=(value:unknown,message:string)=>{assert.ok(value,message);assertions++;};
function generate(s:SketchShape){const doc:SketchDocument={version:1,shapes:[main,s]},before=JSON.stringify(source),result=generateSketchDesign(doc,source);check(result.ok,result.errors.join(';'));assert.equal(JSON.stringify(source),before);const data={...source,...result.patch};assert.deepEqual(parseDeckReleaseDesign(serializeDeckReleaseDesign(data)).stairPath,data.stairPath);assertions+=2;return {data,model:buildDeckTakeoff(data)};}
const line=generate(path([{x:180,y:340},{x:300,y:340}]));
assert.deepEqual(line.data.stairPath?.points,[{x:48,y:144},{x:120,y:144}]);assertions++;
check(line.model.flights.some(f=>f.kind==='grade'&&f.width===72),'Single drawn edge produces its measured opening width');
for(const points of [[{x:100,y:340},{x:420,y:340},{x:420,y:100}],[{x:420,y:100},{x:420,y:340},{x:100,y:340}]]){
 const {data,model}=generate(path(points,{riserCount:5,treadDepthIn:12}));
 const flights=model.flights.filter(f=>f.kind==='grade');check(flights.length===2,'L generates both edge spans');check(flights.every(f=>f.risers===5&&f.run===12&&f.rise===6),'Entered count and tread depth reach the model');
 const estimate=calculateDeckReleaseEstimate(data);check(Number.isFinite(estimate.total)&&estimate.total>0,'Path stair quantities produce a finite priced estimate');check(Math.abs(estimate.total-estimate.subtotal-estimate.hst)<.001,'Pricing reconciles');
 const words=describeDesign(data,estimate);check(words.summary.includes('Wrapped stairs:')&&words.summary.includes('16 ft')&&words.summary.includes('12 ft')&&words.summary.includes('5 risers'),'Quote summary describes the actual L spans and edited count');check(words.proposalFacts.some(s=>s.includes('Wrapped stairs:')&&s.includes('5 risers')),'Proposal retains the real wrapped stair scope');
}
const noisy=[{x:100,y:340},{x:200,y:341},{x:300,y:340},{x:420,y:340},{x:420,y:200},{x:419,y:100}];
check(cleanStairPath(noisy).length===3,'Open pen strokes simplify to the L without a closing chord');
const snapped=snapStairPath([{x:0,y:146},{x:193,y:145},{x:192,y:0}],[{x:0,y:0},{x:192,y:0},{x:192,y:144},{x:0,y:144}]);
assert.deepEqual(snapped,[{x:0,y:144},{x:192,y:144},{x:192,y:0}]);assertions++;
for(const s of [path([{x:100,y:300},{x:420,y:300}]),path([{x:400,y:340},{x:420,y:340}]),path([{x:100,y:340},{x:420,y:100}]),path([{x:100,y:340},{x:420,y:340},{x:100,y:340}])])check(!generateSketchDesign({version:1,shapes:[main,s]},source).ok,'Off-edge, too-short, diagonal and doubled-back paths fail clearly');
assert.throws(()=>parseSketchDocument({version:1,shapes:[{...main,drawing:'edge-path'}]}));assertions++;
check(parseSketchDocument({version:1,shapes:[main,path([{x:180,y:340},{x:300,y:340}])]}).shapes[1].points.length===2,'Private draft preserves an open line');
check(Object.hasOwn(generateSketchDesign({version:1,shapes:[main]},line.data).patch!,'stairPath'),'A fresh sketch explicitly clears old path geometry');
console.log(JSON.stringify({checks:assertions,status:'passed'}));
