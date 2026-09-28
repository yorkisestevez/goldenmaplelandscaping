import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff,guardRuns} from '../src/features/deckcraft/deckTakeoff';
import {getFootprint} from '../src/features/deckcraft/lib/deckGeometry';
import {resolveStairPath,stairPathOffset,validateStairPath} from '../src/features/deckcraft/lib/stairPath';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import {polygonCut,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import {getStairBoards} from '../src/features/deckcraft/stairBoards';
import {calculateDeckReleaseEstimate,parseDeckReleaseDesign,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import type {DeckData} from '../src/features/deckcraft/types';
import {cleanJobDesign} from '../src/features/deckcraft/designer/jobRevisionLibrary';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
const base:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',width:16,length:12,height:30,levels:1,pictureFrameRows:0,pattern:'Straight',stairFlights:1,railingType:'Wood Picket'};
const pts=[{x:0,y:144},{x:192,y:144},{x:192,y:0}],data={...base,stairPath:{points:pts},stairRiserCount:5,stairTreadDepthIn:12};
let checks=0;const check=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},close=(a:number,b:number)=>check(Math.abs(a-b)<1e-6,`${a} equals ${b}`);
for(const points of [pts,[...pts].reverse()]){
 const d={...data,stairPath:{points}},m=buildDeckTakeoff(d),resolved=resolveStairPath(d,getFootprint(d));
 check(!resolved.issues.length,'Both cursor directions follow the same exposed perimeter');
 check(m.flights.length===2&&m.flights.every(f=>f.risers===5&&f.rise===6&&f.run===12),'Both sections have editable uniform steps to grade');
 check(m.treads.length===8&&m.riserBoards.length>10,'Full wide courses split riser stock rather than losing corner pieces');
 check(m.flights.every(f=>f.end.y===0),'Changed count still reaches grade');
 const corner=stairPathOffset(resolved.segments,12)[1];close(corner.x,204);close(corner.y,156);
 for(let r=0;r<4;r++){
  const a=m.treads[r].polygon!,b=m.treads[r+4].polygon!;
  close(polygonCut([a],[b]).reduce((n,p)=>n+Math.abs(signedArea(p)),0),0);
  check(a.some(p=>b.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-6)),'Each L course shares a mitre vertex without a corner gap');
 }
 const stairRails=guardRuns(m).filter(r=>Math.abs(r.a.y-r.b.y)>.01);
 check(stairRails.length===2,'Only the two outside stair sides have guards; no railing bisects the wrap');
 const boards=getStairBoards(d,m);check(boards.some(b=>Math.abs(b.angle!)<.01)&&boards.some(b=>Math.abs(Math.abs(b.angle!)-Math.PI/2)<.01),'Boards follow both adjoining stair directions');
 check(boards.every(b=>b.w<=m.stockLength+.001),'Actual treads split at stock length');
 const copy=parseDeckReleaseDesign(serializeDeckReleaseDesign(d));assert.deepEqual(copy.stairPath,d.stairPath);check(copy.stairRiserCount===5&&copy.stairTreadDepthIn===12,'Save/share retains count, going and exact perimeter points');
}
const stairs=(d:DeckData)=>calculateDeckReleaseEstimate({...d,railingType:'None'}),normal=stairs(data),deep=stairs({...data,stairTreadDepthIn:24}),more=stairs({...data,stairRiserCount:6});
check(deep.sections.find(s=>s.title==='Stairs')!.total>normal.sections.find(s=>s.title==='Stairs')!.total&&deep.manHours>normal.manHours,'Deeper boards increase supply and installation allowance');
check(more.total>normal.total&&more.manHours>normal.manHours,'Adding a step increases actual material and installation');
for(const e of [normal,deep,more]){close(e.subtotal+e.hst,e.total);check(Number.isFinite(e.total),'Accounting stays finite');}
const stale=buildDeckTakeoff({...data,width:14});check(!stale.flights.length&&stale.issues.some(s=>s.includes('no longer follows')),'Outline edit preserves stale path without moving stairs to another edge');
const missing=calculateDeckReleaseEstimate({...data,width:14});check(missing.quoteRequired.some(s=>s.includes('Stair path supply and installation'))&&missing.sections.some(s=>s.title==='Unresolved stair path'&&s.items.some(i=>i.cost===null)),'An unbuildable saved path cannot silently omit its supply and installation from the customer quote');
assert.deepEqual(cleanJobDesign(data).stairPath,data.stairPath);checks++;
const wall={...data,deckType:'Attached' as const,stairPath:{points:[{x:48,y:0},{x:120,y:0}]}};check(resolveStairPath(wall,getFootprint(wall),getHouseContact(wall,getFootprint(wall))).issues.length,'A house-contact attachment fails');
check(resolveStairPath(data,getFootprint(data),undefined,[{origin:{x:144,y:144},along:{x:-1,y:0},outward:{x:0,y:1},width:48,edge:'Front',edgeIndex:2}]).issues.length,'Existing level connections cannot be replaced by a sketch run');
check(!buildDeckTakeoff({...data,stairRiserCount:15}).flights.length,'Overlong wrapped flights need a landing rather than silently drawing unsafe stairs');
check(buildDeckTakeoff({...data,stairRiserCount:3}).issues.some(s=>s.includes('10.00-inch')),'Unsafe rise changes are visible');
check(!buildDeckTakeoff({...data,stairFlights:0}).flights.length,'Turning the saved path off removes its geometry');
for(const v of [{points:[{x:0,y:0}]},{points:[{x:NaN,y:0},{x:1,y:0}]},{points:pts,extra:true},{points:[{x:0,y:0,z:1},{x:48,y:0}]}]){assert.throws(()=>validateStairPath(v));checks++;}
assert.throws(()=>parseDeckReleaseDesign(serializeDeckReleaseDesign({...data,stairRiserCount:5.5})));checks++;
let reads=0;const unsafe={};Object.defineProperty(unsafe,'points',{enumerable:true,get(){reads++;return pts;}});assert.throws(()=>validateStairPath(unsafe));check(reads===0,'Unsafe accessor is refused before it can run');
const unsafePoints=[...pts];Object.defineProperty(unsafePoints,'1',{enumerable:true,get(){reads++;return pts[1];}});assert.throws(()=>validateStairPath({points:unsafePoints}));check(reads===0,'Unsafe array accessor is refused before it can run');
const concave={...data,stairPath:{points:[{x:120,y:120},{x:120,y:60},{x:180,y:60}]}};check(resolveStairPath(concave,{bounds:{w:240,h:180},isCurved:false,outline:[{x:0,y:0},{x:240,y:0},{x:240,y:180},{x:180,y:180},{x:180,y:60},{x:120,y:60},{x:120,y:180},{x:0,y:180}]}).issues.length,'A recessed corner is refused rather than drawing intersecting steps');
const initial={...base,materialMarkup:17,customerName:'Private'},state:DeckAgentHostState={data:initial,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true};let commits=0;
const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{state.data=next;state.canUndo=true;commits++;},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:async test=>{assert.ok(test(state));}});
const request={id:'path-apply',commands:[{type:'design.patch' as const,patch:{stairPath:data.stairPath,stairRiserCount:5,stairTreadDepthIn:12}}]},preview=await api.preview(request);check(preview.ok&&commits===0,'Agent preview supports exact path, count and going without applying');
const applied=await api.execute(request);if('error'in applied)throw new Error(JSON.stringify(applied.error));check(applied.ok&&commits===1&&state.data.materialMarkup===17&&state.data.customerName==='Private','Agent application supports the fields and retains private settings');
check(!('customerName'in api.read().design),'Path agent snapshots preserve privacy');
const bad=await api.execute({id:'path-bad',commands:[{type:'design.patch',patch:{stairRiserCount:5.5}}]});check(!bad.ok&&commits===1,'Fractional agent counts cannot mutate live geometry');
console.log(JSON.stringify({checks,status:'passed'}));
