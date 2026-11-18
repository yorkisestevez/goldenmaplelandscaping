import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import type {BoundaryEdgeLock,DeckData} from '../src/features/deckcraft/types';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';
import {parseContractorLength,reconcileBoundaryLocks,setBoundaryDimension,validateBoundaryLocks} from '../src/features/deckcraft/designer/boundaryDimensions';
import {boundaryPatch,boundaryProblem,editableBoundaries,insertBoundaryPoint,moveBoundary,removeBoundaryPoint} from '../src/features/deckcraft/designer/boundaryEditMath';
import {savedBoundary} from '../src/features/deckcraft/lib/freeOutline';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {encodeDesignLink,decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';

let checks=0;
const ok=(value:unknown,label:string)=>{checks++;assert.ok(value,label);};
const eq=(a:unknown,b:unknown,label:string)=>{checks++;assert.deepEqual(a,b,label);};
const rejects=(run:()=>unknown,label:string)=>{checks++;assert.throws(run,undefined,label);};
const near=(a:number,b:number)=>Math.abs(a-b)<1e-6;
const p:PlanPoint[]=[{x:-24,y:0},{x:168,y:0},{x:168,y:144},{x:-24,y:144}];
const base:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',houseVisible:false,stairFlights:0,levels:1,width:16,length:12,deckOutlines:{main:savedBoundary(p)}};
const lock:BoundaryEdgeLock={level:1,edge:0,dxIn:192,dyIn:0};
const locked:DeckData={...base,boundaryLocks:[lock]};

for(const [text,inches] of [['16.5',198],['16 ft',192],['16 feet',192],['16′ 5 1/2″',197.5],[`16' 5-1/2"`,197.5],[`16'-5-1/2"`,197.5],['5.5in',5.5],['1/2 inch',.5],['16 1/2 ft',198],['.125',1.5],['0 ft 6 in',6]] as const)ok(near(parseContractorLength(text),inches),`Contractor length ${text} has independently known inches`);
for(const text of ['', '0','-1','NaN','Infinity','1e2','16m',`16' 12"`,`16' 1/0"`,`16' 3/2"`,`16' 5`, `16'-`])rejects(()=>parseContractorLength(text),`Malformed or ambiguous length ${text} rejects`);
{
 const before=JSON.stringify(p);p.forEach(Object.freeze);Object.freeze(p);
 const changed=setBoundaryDimension(p,0,198);
 eq(changed[0],p[0],'Dimension holds start fixed');eq(changed[1],{x:174,y:0},'Decimal feet physically move the endpoint by six inches');eq(changed.slice(2),p.slice(2),'Unrelated corners stay fixed');
 const diagonal=setBoundaryDimension(p,0,120,30);ok(near(diagonal[1].x,-24+Math.sqrt(3)*60)&&near(diagonal[1].y,60),'Thirty degree edge has actual independently computed geometry');
 const closing=setBoundaryDimension(p,3,120,-90);eq(closing[3],p[3],'Closing edge start stays fixed');eq(closing[0],{x:-24,y:24},'Closing edge modifies the first endpoint');
 const crossed=setBoundaryDimension(p,0,240,135);ok(!!boundaryProblem(crossed),'Dimension causing invalid outline is caught by geometry validation');
 eq(JSON.stringify(p),before,'Dimension edits preserve immutable history');ok(changed.every((q,i)=>q!==p[i]),'All resulting points have independent ownership');
 for(const [index,length,angle] of [[-1,120,0],[4,120,0],[0,0,0],[0,NaN,0],[0,2401,0],[0,120,Infinity],[0,120,361]])rejects(()=>setBoundaryDimension(p,index,length,angle),'Invalid dimension command rejects');
}
eq(validateBoundaryLocks([lock],base),[lock],'Exact signed-inch vector validates against feet outline');
ok(validateBoundaryLocks([lock],base)[0]!==lock,'Normalized locks never alias imported data');
for(const candidate of [[{...lock,dxIn:191}],[{...lock,dyIn:1}],[{...lock,edge:4}],[{...lock,edge:-1}],[{...lock,level:2}],[{...lock,dxIn:NaN}],[lock,lock],[{...lock,extra:true}],[{}],Array(1),Array(193).fill(lock)])rejects(()=>validateBoundaryLocks(candidate,base),'Invalid, duplicate or sparse locks reject');
rejects(()=>validateBoundaryLocks([lock],{...base,deckOutlines:undefined}),'A lock cannot attach to inferred geometry');
rejects(()=>validateBoundaryLocks([{...lock,level:3}],{...base,levels:3,deckOutlines:{third:savedBoundary(p)}}),'Third section config must exist');
rejects(()=>validateBoundaryLocks([{...lock,level:2}],{...base,deckOutlines:{second:savedBoundary(p)}}),'Inactive saved second outline cannot host a lock');
let getterCalls=0;
const accessor={...lock};Object.defineProperty(accessor,'dxIn',{get(){getterCalls++;return 192;},enumerable:true});
const hidden={...lock};Object.defineProperty(hidden,'extra',{value:1});
const symbol={...lock,[Symbol('private')]:true};
const inherited=Object.assign(Object.create({secret:true}),lock);
const arrayAccessor=[lock];Object.defineProperty(arrayAccessor,0,{get(){getterCalls++;return lock;},enumerable:true});
for(const candidate of [[accessor],[hidden],[symbol],[inherited],arrayAccessor])rejects(()=>validateBoundaryLocks(candidate,base),'Unsafe object or array descriptors reject');
eq(getterCalls,0,'Imported getters never execute');

eq(reconcileBoundaryLocks(locked,1,p,moveBoundary(p,'area',0,-72,33)),[lock],'Whole outline translates freely with exact vectors');
eq(reconcileBoundaryLocks(locked,1,p,moveBoundary(p,'edge',0,12,13)),[lock],'Locked edge endpoints can translate together');
eq(reconcileBoundaryLocks(locked,1,p,moveBoundary(p,'point',1,1,0)),null,'Single endpoint cannot stretch a locked edge');
eq(reconcileBoundaryLocks(locked,1,p,setBoundaryDimension(p,0,192,1)),null,'Same length rotation violates direction lock');
eq(reconcileBoundaryLocks(locked,1,p,insertBoundaryPoint(p,0)),null,'Splitting a locked edge rejects');
eq(reconcileBoundaryLocks(locked,1,p,removeBoundaryPoint(p,1)),null,'Removing locked endpoint rejects');
const lastLocked:DeckData={...base,boundaryLocks:[{level:1,edge:3,dxIn:0,dyIn:-144}]};
const inserted=insertBoundaryPoint(p,1);
eq(reconcileBoundaryLocks(lastLocked,1,p,inserted),[{level:1,edge:4,dxIn:0,dyIn:-144}],'Unchanged closing locked edge reindexes after unrelated insertion');
eq(reconcileBoundaryLocks({...base,deckOutlines:{main:savedBoundary(inserted)},boundaryLocks:[{level:1,edge:4,dxIn:0,dyIn:-144}]},1,inserted,removeBoundaryPoint(inserted,2)),lastLocked.boundaryLocks,'Removing unrelated point restores index');
const all:DeckData={...base,levels:3,width2:16,length2:12,height2:24,level3:{widthFt:16,lengthFt:12,heightIn:12,parent:2,position:'Front',offsetPct:50},deckOutlines:{main:savedBoundary(p),second:savedBoundary(p),third:savedBoundary(p)},boundaryLocks:[lock,{...lock,level:2},{...lock,level:3}]};
const allBefore=JSON.stringify(all);
eq(reconcileBoundaryLocks(all,2,p,moveBoundary(p,'area',0,9,-7)),all.boundaryLocks,'Other level locks remain intact');
eq(JSON.stringify(all),allBefore,'Reconciliation never mutates saved design');
for(const level of [1,2,3] as const){
 const model=buildDeckTakeoff(all),boundary=editableBoundaries(all,model).find(b=>b.level===level)!;
 eq(boundaryPatch(all,level,moveBoundary(boundary.points,'point',1,1,0),boundary.offset,model),null,`Level ${level} host patch blocks locked stretch`);
 const patch=boundaryPatch(all,level,moveBoundary(boundary.points,'area',0,-37,11),boundary.offset,model)!;
 ok(!!patch,`Level ${level} host patch permits translation`);eq(patch.boundaryLocks,all.boundaryLocks,`Level ${level} retains all saved vectors`);
 const next={...all,...patch};eq(validateDesign(next).boundaryLocks,all.boundaryLocks,`Level ${level} moved locks survive central validator`);
 eq(parseDesign(serializeDesign(next)).boundaryLocks,all.boundaryLocks,`Level ${level} locks survive JSON`);
}
{
 const model=buildDeckTakeoff(base),boundary=editableBoundaries(base,model)[0],patch=boundaryPatch(base,1,boundary.points,boundary.offset,model)!;
 const next:DeckData={...base,...patch,boundaryLocks:validateBoundaryLocks([lock],{...base,...patch})};
 const lockedModel=buildDeckTakeoff(next);
 eq(lockedModel,model,'Saving an unchanged edge lock changes no physical takeoff');
 eq(calculateEstimate(next,DECK_SETTINGS),calculateEstimate(base,DECK_SETTINGS),'Lock creation changes no price or quote scope');
 const round=await decodeDesignLink(designLinkFromHash(new URL(await encodeDesignLink(next)).hash)!);eq(round.boundaryLocks,[lock],'Share links retain exact locks');
 const unlocked={...next,boundaryLocks:undefined};eq(parseDesign(serializeDesign(unlocked)).boundaryLocks,undefined,'Removing last lock survives save/import');
 const stretched={...next,deckOutlines:{main:savedBoundary(moveBoundary(p,'point',1,1,0))}};rejects(()=>validateDesign(stretched),'Generic imported shape cannot bypass a saved lock');
 eq(parseDesign(serializeDesign(base)).boundaryLocks,undefined,'Old designs remain free of lock metadata');
}
console.log(`Deck boundary dimensions: ${checks} meaningful checks passed.`);
