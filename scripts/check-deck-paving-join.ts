import '../src/features/deckcraft/yardModelAdvancedRuntime';
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {HARDSCAPE_PRODUCTS} from '../src/features/deckcraft/hardscapeCatalogue';
import {buildYardModel,yardArea,type YardModel} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {fitNewPatio,newYardFeature} from '../src/features/deckcraft/yardSettings';
import {joinNewPatio} from '../src/features/deckcraft/pavingLook';
import {rowGrid} from '../src/features/deckcraft/pavingJoin';
import {patioTopPlane,planeAt} from '../src/features/deckcraft/patioPlane';
import {visibleYardBoxes,yardPreviewBoxes,MAX_DETAILED_PREVIEW_PAVERS} from '../src/features/deckcraft/components/viewer3d/yardPreview';
import {edgingRuns} from '../src/features/deckcraft/components/viewer3d/bedEdging';

/** Patios drawn at different times that meet are laid as one surface (pavingJoin.ts, pavingLook.ts). */
let checks=0;
const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},eq=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;},near=(a:number,b:number,m:string,t=1e-6)=>ok(Math.abs(a-b)<t,`${m}: ${a} vs ${b}`);
const patio=(id:string,xFt:number,zFt:number,widthFt:number,depthFt:number,extra:Partial<YardFeature>={}):YardFeature=>({id,kind:'patio',name:id,enabled:true,xFt,zFt,widthFt,depthFt,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaa69b',finishedElevationIn:0,patioSlope:{xPct:0,zPct:0},...extra});
const design=(features:YardFeature[]):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,stairFlights:0,railingType:'None',deckType:'Freestanding',yardFeatures:features});
const feature=(m:YardModel,id:string)=>m.features.find(f=>f.config.id===id)!;
const pavers=(m:YardModel,id:string)=>feature(m,id).boxes.filter(b=>b.role==='paver');
const rootOf=(m:YardModel,id:string)=>feature(m,id).pavingRootId;

// 1. Overlapping patios in the same paving: one bond, whole pavers across the line, areas unchanged.
const a=patio('a',6,22,16,12),b=patio('b',17,27,12,10);
const joined=buildYardModel(design([a,b]));
eq(rootOf(joined,'b'),'a','A later overlapping patio in the same paving joins the earlier one');
eq(rootOf(joined,'a'),undefined,'The first patio is its own surface');
ok(pavers(joined,'b').every(p=>p.unitId!.startsWith('a-paver-')),'Every paver of the joining patio is on the first patio\'s grid');
const shared=pavers(joined,'b').filter(p=>pavers(joined,'a').some(q=>q.unitId===p.unitId));
ok(shared.length>=4,`Pavers cross the line between the patios (${shared.length})`);
ok(shared.every(p=>p.renderDuplicate),'The joining patio\'s part of a shared paver is not drawn again');
for(const id of new Set(shared.map(p=>p.unitId))){
 const parts=[...pavers(joined,'a'),...pavers(joined,'b')].filter(q=>q.unitId===id),drawn=parts.filter(q=>!q.renderDuplicate);
 eq(drawn.length,1,`${id}: a shared paver is drawn once`);
 near(yardArea(drawn[0].renderContours!),parts.reduce((n,q)=>n+yardArea([q.polygon!]),0),`${id}: drawn whole across both patios`,1e-6);
}
near(feature(joined,'a').quantities.areaSqft,192,'The first patio keeps its whole area');
near(feature(joined,'b').quantities.areaSqft,120-18,'The joining patio keeps only its own paving');
const alone=buildYardModel(design([a,{...b,color:'#8a7f72'}]));
eq(rootOf(alone,'b'),undefined,'A different colour is a different surface');
ok(pavers(alone,'b').every(p=>p.unitId!.startsWith('b-paver-')),'A separate surface keeps its own bond');
near(feature(alone,'b').quantities.areaSqft,feature(joined,'b').quantities.areaSqft,'Joining never changes a patio\'s area');
const price=(d:DeckData)=>buildYardTakeoff(d).materials.map(m=>[m.productId,m.installedAreaSqft,m.amountCents]);
eq(price(design([a,b])),price(design([a,{...b,color:'#8a7f72'}])),'Joining never changes pricing: the same as the patios laid as separate surfaces');
// A paver the patios share is one stone: counted once, in the patio that laid it first.
const distinct=(m:YardModel,ids:string[])=>new Set(ids.flatMap(id=>pavers(m,id).map(p=>p.unitId))).size;
eq(feature(joined,'a').quantities.paverPieces,distinct(joined,['a']),'The first patio counts every paver it lays');
eq(feature(joined,'a').quantities.paverPieces+feature(joined,'b').quantities.paverPieces,distinct(joined,['a','b']),'A shared paver is counted once across the joined patios');
eq(joined.quantities.paverPieces,distinct(joined,['a','b']),'The design\'s paver count is the stones laid');
// Shown and hidden: a shared paver is drawn from the fragments of the patios on show, never over a hidden one.
const drawnArea=(boxes:ReturnType<typeof visibleYardBoxes>)=>boxes.filter(p=>p.role==='paver'&&!p.renderDuplicate).reduce((n,p)=>n+yardArea(p.renderContours??[p.polygon!]),0);
const ownArea=(id:string)=>pavers(joined,id).reduce((n,p)=>n+yardArea([p.polygon!]),0);
eq(visibleYardBoxes(joined.boxes,()=>true),joined.boxes,'With every patio shown, the boxes are drawn as laid');
for(const [hide,show] of [['a','b'],['b','a']]){
 const shownBoxes=visibleYardBoxes(joined.boxes,id=>id!==hide);
 ok(shownBoxes.every(p=>p.featureId===show),`Hiding ${hide} draws nothing of it`);
 near(drawnArea(shownBoxes),ownArea(show),`Hiding ${hide}: ${show}'s pavers are drawn whole across its own paving, and not beyond it`,1e-6);
 for(const id of new Set(shared.map(p=>p.unitId)))eq(shownBoxes.filter(p=>p.unitId===id&&!p.renderDuplicate).length,1,`Hiding ${hide}: ${id} is drawn once`);
}

// 2. The joined grid is the first patio's own grid, extended: same rows, columns and ids it lays itself.
const own=new Set(pavers(buildYardModel(design([a])),'a').map(p=>p.unitId));
ok(pavers(joined,'a').every(p=>own.has(p.unitId)),'Joining never changes the first patio\'s own pavers');
const rows=[{depth:12,lengths:[24]}],grid=rowGrid(rows,.125,48,36,{u0:-80,u1:80,v0:-60,v1:60});
ok(grid.some(c=>c.row<0)&&grid.some(c=>c.col<0),'The grid extends past the first patio\'s corner in both directions');
const r0=grid.find(c=>c.row===0&&c.col===0)!;near(r0.u,-24,'Row 0 column 0 starts at the first patio\'s corner');near(r0.v,-18,'Row 0 starts at its edge');
const r1=grid.find(c=>c.row===1&&c.col===0)!;near(r1.u,-24-(24.125)/2,'Odd rows keep the half-paver offset');
const rm=grid.find(c=>c.row===-1&&c.col===0)!;near(rm.v,-18-12.125,'Rows before the corner keep the pitch');near(rm.u,-24-(24.125)/2,'and the running-bond offset');

// 3. Patios edge to edge join; a corner touch, a step in level, or a turned bond does not.
eq(rootOf(buildYardModel(design([patio('a',0,30,10,10),patio('b',10,30,10,10)])),'b'),'a','Patios laid edge to edge join');
eq(rootOf(buildYardModel(design([patio('a',0,30,10,10),patio('b',10,40,10,10)])),'b'),undefined,'Patios meeting only at a corner stay apart');
eq(rootOf(buildYardModel(design([patio('a',0,30,10,10),patio('b',10,30,10,10,{finishedElevationIn:2})])),'b'),undefined,'A patio a step lower or higher stays a separate surface');
eq(rootOf(buildYardModel(design([patio('a',0,30,10,10),patio('b',10,30,10,10,{rotationDeg:90})])),'b'),undefined,'A bond running another way stays a separate surface');
eq(rootOf(buildYardModel(design([patio('a',0,30,10,10),patio('b',10,30,10,10),patio('c',20,30,10,10)])),'c'),'a','A third patio joins the surface through the second');

// 4. Sloped patios on one plane join; pavers sit on that plane.
const fall={xPct:0,zPct:2},sa=patio('sa',0,30,12,10,{patioSlope:fall}),plane=patioTopPlane(sa,0),sb=patio('sb',11,33,10,10,{patioSlope:fall,finishedElevationIn:planeAt(plane,11*12,33*12)});
const sloped=buildYardModel(design([sa,sb]));
eq(rootOf(sloped,'sb'),'sa','Patios on one sloped plane join');
for(const p of pavers(sloped,'sb').slice(0,40))near(p.topPlane!.constant,pavers(sloped,'sa')[0].topPlane!.constant,'Joined pavers share the first patio\'s plane',1e-6);

// 5. Supplier stock: the joining patio is laid on the first patio's recipe grid.
const product=HARDSCAPE_PRODUCTS.find(p=>p.id==='techo-aberdeen-slab')!,finish=product.finishes[0];
for(const patternId of ['running-bond',finish.patterns[0].id]){
 const recipe=finish.patterns.find(p=>p.id===patternId),hardscape={finishId:finish.id,colorId:finish.colors[0].id,unitId:finish.units[0].id,patternId,angleDeg:0,jointMm:recipe?recipe.layout.jointMm??0:3};
 const ha=patio('ha',0,30,12,10,{productId:product.id,hardscape}),hb=patio('hb',10,34,10,10,{productId:product.id,hardscape:{...hardscape}});
 const m=buildYardModel(design([ha,hb]));
 ok(!feature(m,'ha').excluded&&!feature(m,'hb').excluded,`${patternId}: both supplier patios are laid`);
 eq(rootOf(m,'hb'),'ha',`${patternId}: supplier patios in the same stock join`);
 ok(pavers(m,'hb').every(p=>p.unitId!.startsWith('ha-paver-')),`${patternId}: on the first patio's grid`);
 const both=pavers(m,'hb').filter(p=>pavers(m,'ha').some(q=>q.unitId===p.unitId));
 ok(both.length>0&&both.every(p=>p.renderDuplicate),`${patternId}: a shared stone is drawn once`);
 const stock=(ids:string[])=>[...new Map(ids.flatMap(id=>pavers(m,id)).map(p=>[p.unitId,p])).values()].reduce((n,p)=>n+(p.stockAreaSqft??0),0);
 near(feature(m,'ha').quantities.paverStockAreaSqft!+feature(m,'hb').quantities.paverStockAreaSqft!,stock(['ha','hb']),`${patternId}: a shared stone is ordered once`,1e-6);
 const turned=buildYardModel(design([ha,{...hb,hardscape:{...hardscape,angleDeg:45}}]));
 eq(rootOf(turned,'hb'),undefined,`${patternId}: a bond at another angle stays apart`);
}

// 6. A patio drawn touching another continues its paving and plane; one drawn apart keeps its own.
const first=patio('first',0,30,12,10,{productId:product.id,color:'#777',rotationDeg:30,patioSlope:{xPct:1,zPct:-2},finishedElevationIn:6,groundFit:{slopeRatio:4},hardscape:{finishId:finish.id,colorId:finish.colors[0].id,unitId:finish.units[0].id,patternId:'running-bond',angleDeg:10,jointMm:3}});
const drawn=patio('drawn',8,32,8,8,{finishedElevationIn:-3});
const next=joinNewPatio({yardFeatures:[first]},drawn),firstPlane=patioTopPlane(first,0),nextPlane=patioTopPlane(next,0);
eq([next.productId,next.color,next.hardscape?.patternId,next.groundFit],[first.productId,first.color,'running-bond',{slopeRatio:4}],'A touching new patio takes the neighbour\'s paving and ground fit');
near(next.hardscape!.angleDeg,40,'Its bond keeps the neighbour\'s direction in its own axes');
near(nextPlane.x,firstPlane.x,'Same fall across');near(nextPlane.z,firstPlane.z,'Same fall out');near(nextPlane.constant,firstPlane.constant,'Same level');
eq(joinNewPatio({yardFeatures:[first]},patio('apart',40,30,8,8)),patio('apart',40,30,8,8),'A patio drawn apart is left as drawn');
eq(joinNewPatio({yardFeatures:[{...first,enabled:false}]},drawn),drawn,'A hidden patio is not continued');
const base=design([patio('a',6,22,16,12,{color:'#555'})]);
eq(joinNewPatio(base,fitNewPatio(base,patio('n',17,27,12,10))).color,'#555','Drawing over a patio continues it (the drawing tools fit, then join)');
eq(newYardFeature('patio',{...base,yardFeatures:[patio('a',DEFAULT_DECK.width/2,DEFAULT_DECK.length+10,16,12,{color:'#555'})]}).color,'#aaa69b','The default placement never takes a neighbour\'s paving');
const both=buildYardModel(design([first,next]));
eq(rootOf(both,'drawn'),'first','The continued patio is laid as the same surface');

// 7. The simplified preview draws joints from the surface's bond corner, for every slab and joined patio.
const big=design([patio('ga',0,40,80,80),patio('gb',40,90,40,40)]),bigModel=buildYardModel(big);
ok(bigModel.quantities.paverPieces>MAX_DETAILED_PREVIEW_PAVERS,'Large paving uses the simplified preview');
const slabs=yardPreviewBoxes(bigModel).filter(b=>b.illustrative&&b.role==='paver');
ok(slabs.length>=3&&slabs.every(b=>b.patternFrame),'Every simplified slab carries its bond frame');
eq(new Set(slabs.map(b=>JSON.stringify(b.patternFrame))).size,1,'Slabs and a joined patio share one bond frame');

// 8. Beds of one surface that meet carry no edging between them.
const sq=(x:number):{x:number;z:number}[]=>[{x,z:0},{x:x+48,z:0},{x:x+48,z:48},{x,z:48}];
const runs=edgingRuns(sq(0),[sq(48)]);
eq(runs.length,1,'One run of edging round the open sides');
eq(runs[0],[{x:48,z:48},{x:0,z:48},{x:0,z:0},{x:48,z:0}],'The shared side has no edging');
eq(edgingRuns(sq(0),[]),[[...sq(0),sq(0)[0]]],'A bed alone is edged all round');
eq(edgingRuns(sq(0),[sq(60)]),[[...sq(0),sq(0)[0]]],'A bed apart from its neighbour is edged all round');

console.log(`PAVING JOIN OK — touching patios in the same paving share one bond and whole pavers; areas, pricing and separate surfaces unchanged; new patios continue their neighbour; preview and bed edging follow; ${checks} checks.`);
