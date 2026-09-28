import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {generateSketchDesign,parseSketchDocument} from '../src/features/deckcraft/sketch/sketchToDesign';
import {cleanSketchOutline} from '../src/features/deckcraft/sketch/sketchGeometry';
import type {SketchDocument,SketchShape} from '../src/features/deckcraft/sketch/sketchTypes';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateDeckReleaseEstimate,parseDeckReleaseDesign,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import {getHouseBlocks} from '../src/features/deckcraft/houseFootprint';
import {getStairSupport} from '../src/features/deckcraft/stairConstruction';
import {encodeDesignLink,decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;},equal=(actual:unknown,expected:unknown,message:string)=>{assert.deepEqual(actual,expected,message);checks++;},near=(a:number,b:number,message:string)=>ok(Math.abs(a-b)<1e-6,`${message}: ${a} vs ${b}`);
const rect=(x:number,y:number,w:number,h:number)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const shape=(id:string,kind:SketchShape['kind'],x:number,y:number,w:number,h:number,patch:Partial<SketchShape>={}):SketchShape=>({id,kind,label:id,points:rect(x,y,w,h),...patch});
const doc=(...shapes:SketchShape[]):SketchDocument=>({version:1,shapes});
const house=shape('Measured house','house',-20,0,240,200,{id:'house',widthFt:24,depthFt:20});
const main=shape('Main deck','deck',0,200,160,120,{id:'main',widthFt:16,depthFt:12,heightIn:36});
const current:DeckData={...structuredClone(DEFAULT_DECK),customerName:'Preserved customer',projectAddress:'Preserved local address',materialMarkup:41,soilCondition:'Unknown',scopeOfWork:'Preserved scope',deckingMaterial:'tt_prime_plus',deckingColor:'Dark Cocoa'};
const before=JSON.stringify(current);
function generated(document:SketchDocument,data:DeckData=current){const result=generateSketchDesign(document,data);ok(result.ok,`${document.shapes.map(s=>s.label).join('/')}: ${result.errors.join('; ')}`);const raw={...data,...result.patch},parsed=parseDeckReleaseDesign(serializeDeckReleaseDesign(raw));for(const key of ['width','length','height','levels','width2','length2','height2','stairFlights','stairWidth','stairPosition','stairOffset','level2Position','level2Offset'] as const)if(result.patch?.[key]!==undefined)equal(parsed[key],raw[key],`${key} survives canonical release parsing`);return {data:parsed,result,model:buildDeckTakeoff(parsed)};}

const basic=generated(doc(house,main));
equal(basic.data.deckOutlines?.main,[{x:0,y:0},{x:16,y:0},{x:16,y:12},{x:0,y:12}],'Known measurements produce expected editable feet outline');
near(basic.model.quantities.area,192,'Known main area is 192sqft');near(getHouseContact(basic.data).ledgerLf,16,'House shared wall produces real16ft ledger');
equal(basic.data.customerName,current.customerName,'Customer retained');equal(basic.data.projectAddress,current.projectAddress,'Address retained');equal(basic.data.scopeOfWork,current.scopeOfWork,'Scope retained');equal({...current,...basic.result.patch}.materialMarkup,41,'Converter retains current pricing settings before intentional public-release rate normalization');equal(basic.data.deckingColor,'Dark Cocoa','Product colour retained');
equal(JSON.stringify(current),before,'Conversion preview never mutates current design');ok(Object.hasOwn(basic.result.patch!,'boardLayout')&&basic.result.patch!.boardLayout===undefined,'Geometry-bound layout reset is explicit for one discrete Undo');ok(basic.result.summary.some(s=>s.includes('Geometry-bound')),'Removed old geometry is disclosed');
const estimate=calculateDeckReleaseEstimate(basic.data,DECK_SETTINGS);near(estimate.total,estimate.subtotal+estimate.hst,'Generated pricing reconciles');ok(Number.isFinite(estimate.total)&&estimate.total>0,'Generated actual estimate is finite');

const snapped=generated(doc(house,{...main,points:main.points.map(p=>({x:p.x,y:p.y+2.5}))}));
equal(snapped.data.deckOutlines?.main,basic.data.deckOutlines?.main,'3in incidental house gap closes exactly');ok(snapped.result.warnings.some(s=>s.includes('3.00 inches')),'Exact3in group translation is disclosed');
const wideGap=generateSketchDesign(doc(house,{...main,points:main.points.map(p=>({x:p.x,y:p.y+8/1.2}))}),current);ok(!wideGap.ok&&wideGap.errors.some(s=>s.includes('meet at least')),'8in gap fails rather than large snap');

const lower=shape('Supported landing','landing',40,320,80,80,{id:'lower',widthFt:8,depthFt:8,heightIn:12});
const support=getStairSupport(current,.1875),gradeDepth=support.runIn+support.treadNosingIn;
const stairs=shape('Grade stair','stairs',60,400,40,gradeDepth/1.2,{id:'stairs',widthFt:4,depthFt:gradeDepth/12,heightIn:12});
const split=generated(doc(house,main,lower,stairs));
equal(split.data.deckOutlineOffsets?.second,{x:4,y:12},'Landing absolute location is preserved in saved feet');near(split.model.quantities.area,256,'Two measured surfaces total256sqft');equal(split.model.levels.filter(l=>l.kind==='deck').length,2,'Landing becomes an actual second editable deck level');equal(split.model.connections.length,1,'Actual modeled connection exists');equal(split.model.levels[1].offset,{x:48,y:0,z:144},'Lower level world origin follows drawing');
const grade=split.model.flights.find(f=>f.kind==='grade')!;ok(!!grade,'Grade stairs are built');equal(grade.start.y,12,'Grade stairs depart actual lowest level');near(grade.width,48,'Measured48in stair width');near(grade.end.y,0,'Stairs reach grade');near(grade.end.z-grade.start.z,support.runIn,'Shared manufacturer run is used');ok(split.result.summary.some(s=>s.includes('supported deck section')),'Landing interpretation is explicitly disclosed');
const shiftedSplit=generated(doc(house,...[main,lower,stairs].map(s=>({...s,points:s.points.map(p=>({x:p.x,y:p.y+2.5}))}))));
equal(shiftedSplit.data.deckOutlineOffsets,split.data.deckOutlineOffsets,'Common3in house snap preserves all relative surface positions');near(shiftedSplit.model.flights.find(f=>f.kind==='grade')!.start.z,grade.start.z,'Stair position translates with entire group');

const third=shape('Third section','deck',40,400,60,60,{id:'third',widthFt:6,depthFt:6,heightIn:12});
const three=generated(doc(house,main,lower,third));equal(three.data.levels,3,'Third measured section is created');equal(three.data.level3?.parent,2,'Third section joins actual second level');equal(three.data.deckOutlineOffsets?.third,{x:4,y:20},'Third saved world origin is correct');near(three.model.quantities.area,292,'Three measured surfaces total292sqft');equal(three.model.connections.length,2,'Both actual level connections survive');

const irregular:SketchShape={...main,points:[{x:0,y:200},{x:160,y:200},{x:160,y:260},{x:80,y:260},{x:80,y:320},{x:0,y:320}]};
const l=generated(doc(house,irregular));near(l.model.quantities.area,144,'Concave L outline retains actual144sqft, not bounding192sqft');equal(l.data.deckOutlines?.main?.length,6,'Concave corners remain editable');
const wood=generated(doc(house,main),{...current,deckingMaterial:'cedar',deckingColor:'Western Red Cedar'});equal(wood.data.deckingMaterial,'cedar','Wood product preserved');
const treated:DeckData={...current,deckingMaterial:'pressure_treated',deckingColor:'Pressure Treated'},treatedRun=getStairSupport(treated,.25).runIn,treatedStair={...stairs,depthFt:(treatedRun+.5)/12,points:rect(60,400,40,(treatedRun+.5)/1.2)},treatedSplit=generated(doc(house,main,lower,treatedStair),treated);
near(treatedSplit.model.flights.find(f=>f.kind==='grade')!.run,treatedRun,'Pressure-treated stair run uses actual wood board gap');ok(!treatedSplit.result.warnings.some(s=>s.includes('reconciles')),'Exact wood stair footprint needs no false reconciliation');
const wing=shape('House wing','house',220,0,60,200,{id:'wing',widthFt:6,depthFt:20});const winged=generated(doc(house,main,wing));equal(winged.data.houseConfig?.footprint?.rects?.length,1,'Attached rectangular house block is represented');near(getHouseBlocks(winged.data)[1].rect.x0,264,'Measured wing left edge preserved');

for(const [name,input] of [
 ['bowtie',doc(house,{...main,points:[{x:0,y:200},{x:160,y:320},{x:160,y:200},{x:0,y:320}]})],
 ['nonrectangular house',doc({...house,points:[{x:-20,y:0},{x:220,y:0},{x:220,y:100},{x:100,y:100},{x:100,y:200},{x:-20,y:200}]},main)],
 ['floating landing',doc(house,main,{...lower,points:lower.points.map(p=>({x:p.x,y:p.y+10}))})],
 ['overlapping landing',doc(house,main,{...lower,points:lower.points.map(p=>({x:p.x,y:p.y-20}))})],
 ['wrong stair run',doc(house,main,lower,{...stairs,depthFt:4})],
 ['wrong stair rise',doc(house,main,lower,{...stairs,heightIn:36})],
 ['ambiguous landing',doc(house,main,lower,shape('Ambiguous','landing',120,260,60,140,{id:'ambiguous',widthFt:6,depthFt:14,heightIn:12}))],
 ['missing scale',doc({...main,widthFt:undefined,depthFt:undefined,label:'Deck20by12 handwritten'})],
 ['extra stairs',doc(house,main,stairs,{...stairs,id:'stairs2'})],
 ['unsupported house height',doc({...house,heightIn:36},main)],
 ['unsupported block height',doc(house,main,{...wing,heightIn:137})],
] as const){const result=generateSketchDesign(input,current);ok(!result.ok&&!result.patch&&result.errors.length>0,`${name} rejected with actionable error and no partial patch`);}

const plain=getHouseBlocks(basic.data);ok(plain.length===1,'Single house has no invented blocks');
const retained=generated(doc(main),{...current,houseConfig:basic.data.houseConfig,housePlacement:basic.data.housePlacement});equal(retained.data.houseConfig,basic.data.houseConfig,'Without a drawn house, existing measured house is preserved safely');
const noisy={...main,points:[{x:0,y:200},{x:80,y:203},{x:160,y:200},{x:163,y:260},{x:160,y:320},{x:80,y:318},{x:0,y:320},{x:2,y:260},{x:1,y:201}]};const cleaned=generated(doc(house,noisy));ok(cleaned.result.warnings.some(s=>s.includes('straightened')),'Finger rectangle correction is disclosed');
const winding=cleanSketchOutline([...main.points].reverse());ok(winding.reduce((n,p,i)=>{const q=winding[(i+1)%winding.length];return n+p.x*q.y-q.x*p.y;},0)>0,'Stroke winding is normalized safely');
for(const value of [{version:2,shapes:[main]},doc({...main,widthFt:'16' as unknown as number}),doc({...main,points:[{x:NaN,y:0},...main.points.slice(1)]}),doc({...main,label:''}),{version:1,shapes:[{...main,unexpected:true}]},doc({...main,heightIn:Infinity})]){assert.throws(()=>parseSketchDocument(value));checks++;}
let getterCalls=0;const hostile=[main];Object.defineProperty(hostile,'0',{get(){getterCalls++;return main;},enumerable:true});assert.throws(()=>parseSketchDocument({version:1,shapes:hostile}));checks++;equal(getterCalls,0,'Accessor arrays rejected without invoking getter');
const sparse=new Array(1),extra=[main],symbol=[main],proto=[main];Object.defineProperty(extra,'private',{value:true});Object.defineProperty(symbol,Symbol('unknown'),{value:true});Object.setPrototypeOf(proto,Object.create(Array.prototype));
for(const shapes of [sparse,extra,symbol,proto]){assert.throws(()=>parseSketchDocument({version:1,shapes}));checks++;}
const corrupt=Object.assign(Object.create({inherited:true}),main);assert.throws(()=>parseSketchDocument({version:1,shapes:[corrupt]}));checks++;
const linked=await decodeDesignLink(designLinkFromHash(new URL(await encodeDesignLink(split.data)).hash)!);equal(linked.deckOutlines,split.data.deckOutlines,'Sketch generated outlines survive sharing');equal(linked.deckOutlineOffsets,split.data.deckOutlineOffsets,'Sketch relative positions survive sharing');equal(linked.stairWidth,48,'Sketch grade stair survives sharing');
console.log(`Sketch conversion: ${checks} checks passed (measured polygons, house/levels/stairs, finger correction, strict inputs, preservation, pricing and sharing).`);
