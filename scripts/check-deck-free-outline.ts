import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {serializeDesign,parseDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {encodeDesignLink,decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {boundaryProblem,boundaryBounds,savedBoundary,resizeBoundaryPatch} from '../src/features/deckcraft/lib/freeOutline';
import {editableBoundaries,moveBoundary,insertBoundaryPoint,removeBoundaryPoint,boundaryPatch} from '../src/features/deckcraft/designer/boundaryEditMath';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {getHouseContact,exposedHouseLine} from '../src/features/deckcraft/houseContact';
import {getFootprint} from '../src/features/deckcraft/lib/deckGeometry';
import type {DeckData} from '../src/features/deckcraft/types';
import type {BoardRun,PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';

let checks=0;const failures:string[]=[];
const ok=(value:unknown,message:string)=>{checks++;if(!value)failures.push(message);};
const near=(a:number,b:number,e=1e-5)=>Math.abs(a-b)<e;
const equal=(a:unknown,b:unknown,message:string)=>ok(JSON.stringify(a)===JSON.stringify(b),message);
const area=(p:PlanPoint[])=>Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0))/2;
const points=(xy:number[][])=>xy.map(([x,y])=>({x:x*12,y:y*12}));
const inside=(p:PlanPoint,poly:PlanPoint[],tol=.02)=>{
 let odd=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[j],b=poly[i],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=Math.min(1,Math.max(0,((p.x-a.x)*dx+(p.y-a.y)*dy)/(len||1)));
  if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=tol)return true;
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)odd=!odd;
 }
 return odd;
};
const boardPolygon=(b:BoardRun,width:number):PlanPoint[]=>{
 if(b.polygon)return b.polygon;
 const a=b.angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),w=b.width??width;
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:b.cx+u*b.length/2*c-v*w/2*s,y:b.cy+u*b.length/2*s+v*w/2*c}));
};
const plain:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',houseVisible:false,stairFlights:0,railingType:'None',levels:1,pictureFrameRows:0};
const shapes:Record<string,PlanPoint[]>={
 rectangle:points([[0,0],[16,0],[16,12],[0,12]]),
 skew:points([[0,0],[16,0],[20,10],[2,14]]),
 negative:points([[-12,-8],[4,-8],[4,4],[-12,4]]),
 triangle:points([[0,0],[17,3],[3,14]]),
 concaveC:points([[0,0],[18,0],[18,4],[6,4],[6,10],[18,10],[18,14],[0,14]]),
 inwardBay:points([[0,0],[20,0],[20,12],[13,12],[11,5],[9,12],[0,12]]),
};
ok(near(area(shapes.rectangle)/144,192)&&near(area(shapes.skew)/144,210)&&near(area(shapes.concaveC)/144,180),'Independent paper areas match rectangle, arbitrary quadrilateral and C-shaped cutout');

// Real editing operations: diagonal motion, final-to-first edge, full-area translation,
// immutable history inputs, inserted midpoints and crossing/touching rejection.
{
 const p=structuredClone(shapes.rectangle),before=JSON.stringify(p);p.forEach(Object.freeze);Object.freeze(p);
 const point=moveBoundary(p,'point',1,17,-13);equal(point[1],{x:209,y:-13},'Point moves freely in both axes');equal(point[0],p[0],'Other point coordinates stay put');
 const edge=moveBoundary(p,'edge',3,-9,11);equal(edge[0],{x:-9,y:11},'Closing edge moves its first endpoint');equal(edge[3],{x:-9,y:155},'Closing edge moves its last endpoint');equal(edge[1],p[1],'Closing edge does not move unrelated points');
 const moved=moveBoundary(p,'area',0,-70,-83);ok(moved.every((q,i)=>near(q.x,p[i].x-70)&&near(q.y,p[i].y-83)),'Whole area translation preserves every relative position');ok(near(area(moved),area(p)),'Whole area translation preserves area');
 equal(JSON.stringify(p),before,'Point, edge and area edits never mutate frozen history');ok([point,edge,moved].every(list=>list.every((q,i)=>q!==p[i])),'Every edited point array is independently owned');
 const inserted=insertBoundaryPoint(p,3);equal(inserted[4],{x:0,y:72},'Closing-edge insertion puts the midpoint before the first point');equal(removeBoundaryPoint(inserted,4),p,'Inserted point can be removed without changing the boundary');
 ok(boundaryProblem(point)==='','Non-square corner is accepted');ok(boundaryProblem(moved)==='','Negative x/y position is accepted');
 const crossed=points([[0,0],[12,12],[12,0],[0,12]]);ok(/cross/.test(boundaryProblem(crossed)),'Bow-tie crossing is rejected');ok(boundaryPatch(plain,1,crossed)===null,'Rejected crossing never returns a committed design patch');
  ok(!!boundaryProblem(points([[0,0],[12,0],[6,0],[12,12],[0,12]])),'An adjacent backtracking edge is rejected');
 for(const turn of [points([[0,0],[0,6],[0,2],[12,2],[12,12],[0,12]]),points([[0,0],[12,0],[12,12],[0,12],[0,-2]])])ok(/double back|cross/.test(boundaryProblem(turn)),'Vertical and closing-edge backtracking are rejected');
 ok(!!boundaryProblem(p.slice().reverse()),'Reversed winding cannot flip construction normals');ok(!!boundaryProblem([{x:0,y:0},{x:NaN,y:80},{x:80,y:80}]),'Non-finite point is rejected');
 ok(!!boundaryProblem([{x:0,y:0},{x:.5,y:0},{x:192,y:144},{x:0,y:144}]),'Sub-inch edge is rejected');
 const house=getHouseConfig(DEFAULT_DECK),place=getHousePlacement(DEFAULT_DECK),patch=boundaryPatch(DEFAULT_DECK,1,point)!;
 equal(patch.houseConfig,house,'Editing the main deck freezes the existing house measurements');equal(getHousePlacement({...DEFAULT_DECK,...patch}).x0,place.x0,'Changing deck bounds keeps the house at its existing world x position');
  const lower=boundaryPatch({...plain,deckOutlines:{main:savedBoundary(p)}},2,shapes.skew,{x:-180,y:240})!;equal(lower.deckOutlineOffsets?.second,{x:-15,y:20},'Lower-level origin saves world inches as feet');equal(lower.deckOutlines?.main,savedBoundary(p),'Editing a lower level preserves the main boundary');
 const overHouse=points([[-6,-4],[6,-4],[6,8],[-6,8]]),housePatch=boundaryPatch(DEFAULT_DECK,1,overHouse)!;
 ok(buildDeckTakeoff({...DEFAULT_DECK,...housePatch,stairFlights:0}).issues.some(x=>/into the house/.test(x)),'Main negative outline entering the house has a visible collision warning');
 const away=moveBoundary(p,'area',0,600,600),awayPatch=boundaryPatch(DEFAULT_DECK,1,away)!;
 ok(buildDeckTakeoff({...DEFAULT_DECK,...awayPatch,stairFlights:0}).issues.some(x=>/no longer meets the house/.test(x)),'Attached main outline moved off its wall preserves position and warns about lost attachment');
}

function verify(name:string,d:DeckData,expectedArea:number){
 const model=buildDeckTakeoff(d),estimate=calculateEstimate(d,DECK_SETTINGS),decks=model.levels.filter(l=>l.kind==='deck');
 ok(near(model.quantities.area,expectedArea),`${name}: takeoff uses actual polygon area (${model.quantities.area} vs ${expectedArea})`);ok(near(estimate.area,expectedArea),`${name}: customer estimate uses actual polygon area`);
 equal(estimate.model.quantities,model.quantities,`${name}: pricing and visible takeoff agree`);
 ok(Object.values(model.quantities).every(x=>Number.isFinite(x)&&x>=0),`${name}: all quantities are finite and nonnegative`);
 for(const l of decks){
  const face=l.deckingFootprint?.outline??l.footprint.outline,polys=l.boards.map(b=>boardPolygon(b,d.boardWidth)),coverage=polys.reduce((n,p)=>n+area(p),0)/area(face);
  ok(polys.length>0&&coverage>.88&&coverage<1.005,`${name}/level${l.index}: boards cover the area without double coverage (${coverage.toFixed(4)})`);
  ok(polys.every(p=>p.every((q,i)=>inside(q,face,.1)&&inside({x:(q.x+p[(i+1)%p.length].x)/2,y:(q.y+p[(i+1)%p.length].y)/2},face,.1))),`${name}/level${l.index}: cut boards stay inside the finished polygon, including concave bays`);
  ok(l.joists.length>0&&l.beams.length>0&&l.supports.length>0,`${name}/level${l.index}: actual framing and bearings exist`);
  ok([...l.joists,...l.beams].every(m=>[.2,.5,.8].every(t=>inside({x:m.a.x+(m.b.x-m.a.x)*t-l.offset.x,y:m.a.z+(m.b.z-m.a.z)*t-l.offset.z},l.footprint.outline,3))),`${name}/level${l.index}: framing stays inside the real deck rather than spanning its concave void`);
 }
 const meshes=deckExportMeshes(d,model);ok(meshes.length>0&&meshes.every(m=>m.vertices.every(p=>[p.x,p.y,p.z].every(Number.isFinite))&&m.faces.every(f=>f.length>=3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<m.vertices.length))),`${name}: export/render geometry is finite with valid face indexes`);
 for(const s of estimate.sections)ok(near(s.total,s.items.reduce((n,i)=>n+(i.cost??0),0),.02),`${name}: ${s.title} row costs match section total`);
 const preTax=estimate.sections.filter(s=>s.title!=='HST (13%)').reduce((n,s)=>n+s.total,0);ok(near(estimate.subtotal,preTax,.02),`${name}: priced sections reconcile to subtotal`);ok(near(estimate.hst,estimate.subtotal*.13,.02)&&near(estimate.total,estimate.subtotal+estimate.hst,.02),`${name}: markup-inclusive subtotal, HST and grand total reconcile`);
 ok(estimate.quoteRequired.some(q=>/custom outline|bespoke/i.test(q)),`${name}: bespoke support/connection review remains an explicit quote`);
 const parsed=parseDesign(serializeDesign(d));equal(parsed.deckOutlines,d.deckOutlines,`${name}: arbitrary boundaries persist exactly`);equal(parsed.deckOutlineOffsets,d.deckOutlineOffsets,`${name}: lower-level origins persist exactly`);equal(buildDeckTakeoff(parsed).quantities,model.quantities,`${name}: save/load preserves all quantities`);ok(near(calculateEstimate(parsed,DECK_SETTINGS).total,estimate.total,.01),`${name}: save/load preserves the total`);
 return {model,estimate,parsed};
}

for(const [name,p] of Object.entries(shapes))for(const pattern of ['Straight','Diagonal','Herringbone'] as const)for(const rows of [0,1] as const){
 const b=boundaryBounds(p),d:DeckData={...plain,width:b.w/12,length:b.h/12,pattern,pictureFrameRows:rows,deckOutlines:{main:savedBoundary(p)}};
 ok(boundaryProblem(p)==='',`${name}: a valid independently chosen polygon is accepted`);
 try{verify(`${name}/${pattern}/border${rows}`,d,area(p)/144);}catch(e){failures.push(`${name}/${pattern}/border${rows}: threw ${String(e)}`);}
}
// Adding a handle on an existing straight edge changes neither construction nor price.
// Saved handles survive; only the model discards a redundant collinear vertex.
for(const [name,p] of Object.entries(shapes))for(const pattern of ['Straight','Diagonal','Herringbone'] as const){
 const b=boundaryBounds(p),base:DeckData={...plain,width:b.w/12,length:b.h/12,pattern,pictureFrameRows:1,deckOutlines:{main:savedBoundary(p)}};
 const inserted=insertBoundaryPoint(p,1),next={...base,deckOutlines:{main:savedBoundary(inserted)}},model=buildDeckTakeoff(base),extra=buildDeckTakeoff(next);
 equal(extra,model,`${name}/${pattern}: adding a collinear handle leaves the entire model identical`);equal(calculateEstimate(next),calculateEstimate(base),`${name}/${pattern}: adding a collinear handle leaves every price/quantity/disclosure identical`);
 equal(deckExportMeshes(next,extra),deckExportMeshes(base,model),`${name}/${pattern}: adding a collinear handle leaves exported rendering identical`);
 equal(editableBoundaries(next,extra)[0].points,inserted,`${name}/${pattern}: the added handle stays editable`);equal(parseDesign(serializeDesign(next)).deckOutlines?.main,savedBoundary(inserted),`${name}/${pattern}: added handle stays in the saved design`);
}

// Lower sections have their own local boundary and world origin; moving one does not
// silently reshape another or erase a detached section. Connections remain flagged.
const multi:DeckData={...plain,levels:3,height:48,height2:24,width2:12,length2:8,level3:{widthFt:10,lengthFt:8,heightIn:16,parent:2,position:'Front',offsetPct:50},deckOutlines:{main:savedBoundary(shapes.rectangle),second:savedBoundary(points([[-3,0],[9,1],[8,9],[-3,8]])),third:savedBoundary(points([[0,0],[10,0],[10,8],[6,8],[6,4],[0,4]]))},deckOutlineOffsets:{second:{x:-5,y:15},third:{x:-3,y:28}}};
try{
 const result=verify('three-levels',multi,Object.values(multi.deckOutlines!).reduce((n,p)=>n+area(p!),0)),boundaries=editableBoundaries(multi,result.model);
 equal(boundaries.map(b=>b.level),[1,2,3],'All three deck levels remain editable');
 equal(boundaries[1].offset,{x:-60,y:180},'Second level uses its saved negative world origin');equal(boundaries[2].offset,{x:-36,y:336},'Third level uses its saved negative world origin');
 ok(result.model.issues.some(x=>/no longer meets|reconnect/.test(x)),'Detached edited lower levels retain a visible connection warning');
 const link=await encodeDesignLink(multi,'https://example.test'),decoded=await decodeDesignLink(designLinkFromHash(new URL(link).hash)!);equal(decoded.deckOutlines,multi.deckOutlines,'Share link preserves every boundary');equal(decoded.deckOutlineOffsets,multi.deckOutlineOffsets,'Share link preserves negative/local/world coordinates');equal(buildDeckTakeoff(decoded).quantities,result.model.quantities,'Share link preserves quantities');ok(near(calculateEstimate(decoded).total,result.estimate.total,.01),'Share link preserves current price calculation');
}catch(e){failures.push(`three-level persistence/share: threw ${String(e)}`);}
for(const key of ['second','third'] as const){
 const local=multi.deckOutlines![key]!.map(p=>({x:p.x*12,y:p.y*12})),next={...multi,deckOutlines:{...multi.deckOutlines,[key]:savedBoundary(insertBoundaryPoint(local,0))}};
 equal(buildDeckTakeoff(next),buildDeckTakeoff(multi),`${key}: a collinear handle leaves all level and connection geometry unchanged`);equal(calculateEstimate(next),calculateEstimate(multi),`${key}: a collinear handle leaves every quantity, price and quote unchanged`);
}
for(const pattern of ['Straight','Diagonal','Herringbone'] as const){
 const p=shapes.skew,b=boundaryBounds(p),a:DeckData={...plain,width:b.w/12,length:b.h/12,pattern,deckOutlines:{main:savedBoundary(p)}},shifted={...a,deckOutlines:{main:savedBoundary(moveBoundary(p,'area',0,-70,-83))}},before=calculateEstimate(a),after=calculateEstimate(shifted);
 const moved=Object.keys(before.model.quantities).filter(k=>before.model.quantities[k as keyof typeof before.model.quantities]!==after.model.quantities[k as keyof typeof after.model.quantities]).map(k=>`${k}: ${before.model.quantities[k as keyof typeof before.model.quantities]} -> ${after.model.quantities[k as keyof typeof after.model.quantities]}`);
 const floating=new Set(['riserBoardLf','riserBoardArea','inlayLf','landingArea','stairRailingLf','railingLf','area','framingLf']);
 ok(Object.keys(before.model.quantities).every(k=>{const a=before.model.quantities[k as keyof typeof before.model.quantities],b=after.model.quantities[k as keyof typeof after.model.quantities];return floating.has(k)?near(a,b,1e-7):a===b;}),`${pattern}: rigid translation preserves exact counts and lengths/areas within 1e-7 (${moved.join(', ')})`);ok(near(after.total,before.total,.01),`${pattern}: rigid whole-area translation preserves the price (${before.total.toFixed(2)} -> ${after.total.toFixed(2)})`);
}
{
 const baseHouse=getHouseConfig(DEFAULT_DECK),narrow:DeckData={...structuredClone(DEFAULT_DECK),stairFlights:0,railingType:'None',houseConfig:{...baseHouse,widthFt:12,openings:[]},housePlacement:{anchor:'left',offsetIn:24},deckOutlines:{main:savedBoundary(shapes.rectangle)}},fp=getFootprint(narrow),contact=getHouseContact(narrow,fp),exposed=exposedHouseLine(narrow,fp,contact);
 ok(near(contact.ledgerLf,12)&&near(contact.flashingLf,12),'Narrow house only receives its actual 12-foot ledger/flashing, not the full 16-foot deck back');
 ok(near(exposed.reduce((n,[a,b])=>n+b-a,0),48),'The two exposed back stretches total four feet and retain independent framing');
 const outside={...narrow,housePlacement:{anchor:'left' as const,offsetIn:240}},off=getHouseContact(outside,getFootprint(outside));ok(off.ledgerLf===0,'A complete gap to the positioned house has no fictitious ledger');ok(buildDeckTakeoff(outside).issues.some(x=>/no longer meets the house/.test(x)),'A whole ledger gap requires a visible reconnection warning');
 const before=buildDeckTakeoff(multi),changed={...multi,...boundaryPatch(multi,1,moveBoundary(shapes.rectangle,'point',2,22,13))!},after=buildDeckTakeoff(changed);
 const lower=(m:typeof before)=>m.levels.filter(l=>l.kind==='deck'&&l.index!==0).map(l=>({index:l.index,offset:l.offset,outline:l.footprint.outline}));equal(lower(after),lower(before),'Editing the main polygon keeps both lower levels and their world origins/local boundaries');
 const automatic={...multi,deckOutlineOffsets:undefined},autoBefore=buildDeckTakeoff(automatic),patch=boundaryPatch(automatic,1,moveBoundary(shapes.rectangle,'point',2,35,-16),undefined,autoBefore)!;
 const autoAfter=buildDeckTakeoff({...automatic,...patch}),oldLower=lower(autoBefore),newLower=lower(autoAfter);
 equal(newLower.map(l=>l.index),oldLower.map(l=>l.index),'Main editing retains both automatically positioned lower levels');
 ok(oldLower.length===2&&newLower.every((l,i)=>near(l.offset.x,oldLower[i].offset.x,1e-7)&&near(l.offset.z,oldLower[i].offset.z,1e-7)),'Main editing snapshots the existing automatic lower origins instead of sliding them to its new edge');
 equal(newLower.map(l=>l.outline),oldLower.map(l=>l.outline),'Main editing preserves automatically positioned lower polygons');
}

for(const bad of [points([[0,0],[12,12],[12,0],[0,12]]),[{x:0,y:0},{x:Infinity,y:0},{x:0,y:100}],points([[0,0],[2,0],[2,2],[0,2]])]){
 let refused=false;try{validateDesign({...plain,deckOutlines:{main:savedBoundary(bad)}});}catch{refused=true;}ok(refused,'Persistence refuses invalid free geometry instead of loading a different shape');
}
const circle=Array.from({length:64},(_,i)=>({x:96+96*Math.cos(i*Math.PI/32),y:96+96*Math.sin(i*Math.PI/32)}));
ok(boundaryProblem(circle)==='','Maximum 64-point boundary is valid');equal(parseDesign(serializeDesign({...plain,deckOutlines:{main:savedBoundary(circle)}})).deckOutlines?.main,savedBoundary(circle),'Maximum 64-point boundary persists without losing vertices');ok(!!boundaryProblem(insertBoundaryPoint(circle,0)),'A sixty-fifth point is refused');
for(const level of [1,2,3] as const){
 const wide=points([[0,0],[80,0],[80,8],[0,8]]),data:DeckData={...plain,levels:3,level3:{widthFt:10,lengthFt:8,heightIn:16,parent:2,position:'Front',offsetPct:50}},patch=boundaryPatch(data,level,wide);
 ok(patch!==null,`level${level}: 80-foot width is within the declared 120-foot boundary limit`);
 try{const loaded=parseDesign(serializeDesign({...data,...patch}));equal(loaded.deckOutlines?.[level===1?'main':level===2?'second':'third'],savedBoundary(wide),`level${level}: a valid large boundary persists`);}catch(e){failures.push(`level${level}: accepted 80-foot boundary cannot persist: ${String(e)}`);}
}
{
 const initial:DeckData={...plain,deckOutlines:{main:savedBoundary(shapes.negative)}},before=JSON.stringify(initial),patch=resizeBoundaryPatch(initial,{width:24,length:18}),scaled=patch.deckOutlines!.main!;
 equal(JSON.stringify(initial),before,'Dimension resizing never mutates the current boundary');equal(boundaryBounds(scaled),{x:-12,y:-8,w:24,h:18},'Dimension resizing scales around the negative boundary origin');
 ok(near(area(scaled),192*2.25),'Dimension scaling gives the mathematically expected area');ok(near(buildDeckTakeoff({...initial,...patch}).quantities.area,192*2.25),'Dimension resize changes the real polygon takeoff');
 for(const key of ['second','third'] as const){
  const shape=multi.deckOutlines![key]!,b=boundaryBounds(shape),input=key==='second'?{width2:b.w*1.5,length2:b.h*1.25}:{level3:{...multi.level3!,widthFt:b.w*1.5,lengthFt:b.h*1.25}},changed=resizeBoundaryPatch(multi,input),next=changed.deckOutlines![key]!;
  ok(near(area(next),area(shape)*1.875),`${key}: its own dimensions scale its own polygon area`);equal(changed.deckOutlines?.main,multi.deckOutlines?.main,`${key}: dimension edits preserve the main polygon`);equal({...multi,...changed}.deckOutlineOffsets,multi.deckOutlineOffsets,`${key}: dimension patch leaves world origins untouched`);
 }
}
{
 const rectangle:DeckData={...plain,deckOutlines:{main:savedBoundary(shapes.rectangle)}},e=calculateEstimate(rectangle);
 for(const shape of ['L-Shape','Multi-corner','Curved','Custom'] as const){
  const stale={...rectangle,shape};equal(calculateEstimate(stale).model.quantities,e.model.quantities,`${shape}: stale preset cannot change a free rectangle takeoff`);ok(near(calculateEstimate(stale).total,e.total,.01),`${shape}: stale shape factor cannot alter a free rectangle's price`);
 }
}
// A saved free boundary is authoritative even if a stale legacy wrap remains in
// an imported file. It must not draw/frame a different area or rewrite width on share.
{
 const mixed:DeckData={...structuredClone(DEFAULT_DECK),width:16,length:12,stairFlights:0,railingType:'None',wrap:{left:{widthFt:6,runFt:8}},deckOutlines:{main:savedBoundary(shapes.skew)}};
 const model=buildDeckTakeoff(mixed),face=model.levels[0].deckingFootprint?.outline??model.levels[0].footprint.outline;
 ok(model.levels[0].boards.every(b=>boardPolygon(b,mixed.boardWidth).every(p=>inside(p,face,.1))),'Imported free boundary cannot retain wrap boards outside its real shape');
 ok(model.levels[0].joists.every(m=>inside({x:(m.a.x+m.b.x)/2,y:(m.a.z+m.b.z)/2},model.levels[0].footprint.outline,3)),'Imported free boundary cannot retain wrap framing outside its real shape');
 const linked=await decodeDesignLink(designLinkFromHash(new URL(await encodeDesignLink(mixed,'https://example.test')).hash)!);
 equal(linked.deckOutlines,mixed.deckOutlines,'Stale-wrap imported free boundary survives sharing');equal(buildDeckTakeoff(linked).quantities,model.quantities,'Stale-wrap imported free boundary retains takeoff on sharing');
}
equal(buildDeckTakeoff(DEFAULT_DECK),buildDeckTakeoff({...DEFAULT_DECK,deckOutlines:undefined,deckOutlineOffsets:undefined}),'Absent free boundaries preserve the exact legacy default takeoff');equal(calculateEstimate(DEFAULT_DECK),calculateEstimate({...DEFAULT_DECK,deckOutlines:undefined,deckOutlineOffsets:undefined}),'Absent free boundaries preserve the exact legacy default estimate');
for(const f of failures)console.error(`FREE OUTLINE FAILURE: ${f}`);
console.log(`FREE OUTLINE ${failures.length?'FAILED':'OK'} — ${checks} independent editing, polygon coverage, framing, export, accounting, saved-design, share-link and legacy checks; ${failures.length} failures.`);
assert.equal(failures.length,0,'Free-outline regressions above need review');
