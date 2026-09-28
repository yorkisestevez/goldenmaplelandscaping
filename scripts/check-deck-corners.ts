import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff,type DeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
import {catalogueAccessoryLayout} from '../src/features/deckcraft/catalogueAccessories';
import {deckExportMeshes,exportDeckDXF,exportDeckOBJ} from '../src/features/deckcraft/designExports';
import {connectorSchedule} from '../src/features/deckcraft/schedule';
import {deckBoardStock} from '../src/features/deckcraft/stockPlan';
import {availableStairSides,getHouseContact} from '../src/features/deckcraft/houseContact';
import {memberLength,unsupportedJoistEnds} from '../src/features/deckcraft/constructionDetails';
import {parseDesign,pruneEdgeNames,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {decodeDesignLink,designLinkFromHash,encodeDesignLink} from '../src/features/deckcraft/designLink';
import {describeDesign,shapeWords} from '../src/features/deckcraft/designFacts';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import ConstructionPlan from '../src/features/deckcraft/ConstructionPlan';
import {activeCornerChamfers,angledStairAllowed,angledStairFits,chamferFaceFt,chamferLabourFactor,describeChamfers,isChamferEdgeId} from '../src/features/deckcraft/lib/cornerChamfers';
import {getFootprint,SIDE_DOT,type PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';
import {boardOutline,offsetPolygons,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import {activeWrap,distanceToSegment,wrapBlockers} from '../src/features/deckcraft/lib/wrapGeometry';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {setWing,wrapFix,wrapFixNames} from '../src/features/deckcraft/designer/deckShapeActions';
import type {BoardRun} from '../src/features/deckcraft/lib/deckGeometry';
import type {DeckLevel,Member} from '../src/features/deckcraft/deckTakeoff';
import type {CornerChamfers,DeckData} from '../src/features/deckcraft/types';

/**
 * 45° angled front corners (Phase 8): stored-but-inactive values change nothing, the outline and its
 * edge ids, framing that leaves no joist end loose, stairs by name only as one straight flight, decking
 * with no thin strip along an angled edge, honest pricing, and every output that names the shape.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const base=():DeckData=>structuredClone(DEFAULT_DECK);
const design=(patch:Partial<DeckData>):DeckData=>deckReleaseData({...base(),...patch});
const corners=(l:number,r:number):CornerChamfers=>({...(l?{frontLeftFt:l}:{}),...(r?{frontRightFt:r}:{})});
const angledSegments=(fp:{outline:PlanPoint[];edgeIds?:string[]})=>fp.outline.flatMap((a,i)=>isChamferEdgeId(fp.edgeIds?.[i])?[{a,b:fp.outline[(i+1)%fp.outline.length],id:fp.edgeIds![i]}]:[]);
const outlineArea=(p:PlanPoint[])=>Math.abs(signedArea(p));
const near=(a:number,b:number,tol=1e-6)=>Math.abs(a-b)<=tol;
const closePosts=(level:DeckLevel)=>level.supports.filter((p,i)=>level.supports.some((q,j)=>j>i&&Math.hypot(p.x-q.x,p.z-q.z)<12)).length;
// A board end's faces (its outline edges within a board width of that end that are not long sides), and
// whether framing (a joist, block, nailer or rim) passes under three points just inside its longest face.
function endFaces(b:BoardRun,sign:number,width:number){
  const poly=boardOutline(b,width),a=b.angleDeg*Math.PI/180,u={x:Math.cos(a),y:Math.sin(a)},us=poly.map(p=>(p.x*u.x+p.y*u.y)*sign),end=Math.max(...us),half=(end+Math.min(...us))/2;
  return {u,faces:poly.flatMap((p,i)=>{const j=(i+1)%poly.length,q=poly[j],len=Math.hypot(q.x-p.x,q.y-p.y),f={x:(q.x-p.x)/len,y:(q.y-p.y)/len};return len<.3||us[i]<end-(b.width??width)-.01||us[j]<end-(b.width??width)-.01||(us[i]+us[j])/2<=half||Math.abs(f.x*u.x+f.y*u.y)>.99?[]:[{p,q,len,f}];})};
}
function unbackedEndsNearAngled(level:DeckLevel,width:number){
  const members:Member[]=[...level.joists,...level.blocking,...((level as DeckLevel&{rim?:Member[]}).rim??[])];let count=0;
  for(const b of level.boards)for(const sign of [-1,1]){
    const {u,faces}=endFaces(b,sign,width),face=faces.reduce<typeof faces[number]|undefined>((best,f)=>!best||f.len>best.len?f:best,undefined);if(!face)continue;
    const mid:PlanPoint={x:(face.p.x+face.q.x)/2-u.x*sign*.4,y:(face.p.y+face.q.y)/2-u.y*sign*.4};
    if(!(level.angledEdges??[]).some(e=>distanceToSegment(mid,e.a,e.b)<=12))continue;
    const pts=[-1.5,0,1.5].map(s=>{const t=Math.max(-face.len/2+.2,Math.min(face.len/2-.2,s));return {x:mid.x+face.f.x*t,y:mid.y+face.f.y*t};});
    if(!pts.some(m=>members.some(mm=>distanceToSegment(m,{x:mm.a.x,y:mm.a.z},{x:mm.b.x,y:mm.b.z})<=.85)))count++;
  }
  return count;
}

// Rounded, -0-free JSON, as in the legacy parity check, so equal designs fingerprint equally.
const stable=(value:unknown)=>JSON.stringify(value,(_k,v)=>typeof v==='number'?(Object.is(v,-0)||Math.abs(v)<5e-7?0:Math.round(v*1e6)/1e6):v);
const digest=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex').slice(0,20);
function fingerprint(d:DeckData){
  const estimate=calculateEstimate(d),model=estimate.model;
  const {model:_model,...priced}=estimate;
  return digest([model,priced,getHardwareLayout(d,model),extrasLayout(d,model),catalogueAccessoryLayout(d,model),deckExportMeshes(d,model).map(m=>[m.name,m.vertices,m.faces])]);
}

// 1. A stored value that is empty, zero, on another shape or too big for the deck changes nothing at all.
{
  const scenarios:Partial<DeckData>[]=[
    {},{pattern:'Herringbone',pictureFrameRows:1},{deckType:'Freestanding',levels:2,height2:24,level2Position:'Left'},
    {shape:'L-Shape',cutoutWidth:6,cutoutLength:4},{shape:'Multi-corner',width:24,length:20,cutoutWidth:8,cutoutLength:8,cutoutWidth2:4,cutoutLength2:4},{shape:'Curved'},
  ];
  for(const patch of scenarios){
    const plain={...base(),...patch},want=fingerprint(plain);
    const stored:CornerChamfers[]=plain.shape==='Rectangle'?[{},{frontLeftFt:0},{frontLeftFt:0,frontRightFt:0}]:[{},{frontLeftFt:4},{frontLeftFt:4,frontRightFt:6}];
    for(const c of stored)ok(fingerprint({...plain,cornerChamfers:c})===want,`${plain.shape} ${JSON.stringify(patch)} with stored corners ${JSON.stringify(c)} builds, exports and prices exactly as without`);
  }
  ok(activeCornerChamfers({...base(),width:4,length:3.5,cornerChamfers:{frontLeftFt:4,frontRightFt:4}})===null,'A deck too shallow for a 12 in leg keeps square corners');
  ok(fingerprint({...base(),width:4,length:3.5,cornerChamfers:{frontLeftFt:4}})===fingerprint({...base(),width:4,length:3.5}),'A clamped-away corner changes nothing');
  ok(!designFeatures(design({shape:'L-Shape',cornerChamfers:{frontLeftFt:4}})).includes('deck_corner_chamfer'),'An inactive stored corner is not reported as a feature');
}

// 2. The side band: every edge the studio already draws faces a side more squarely than SIDE_DOT, and a
// 45° angled edge (0.707) faces none, so side-based choices never land on one.
{
  const sides=[{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
  const bestDot=(a:PlanPoint,b:PlanPoint)=>{const l=Math.hypot(b.x-a.x,b.y-a.y),o={x:(b.y-a.y)/l,y:-(b.x-a.x)/l};return Math.max(...sides.map(s=>o.x*s.x+o.y*s.y));};
  let edges=0;
  for(const width of [4,8,12,16,24,40,60])for(const length of [4,8,12,20,40])for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const)for(const stair of [{stairFlights:0},{stairFlights:1,stairPosition:'Front' as const,stairOffset:10},{stairFlights:1,stairPosition:'Front' as const,stairOffset:90}]){
    const d={...base(),width,length,shape,cutoutWidth:width/3,cutoutLength:length/3,cutoutWidth2:width/4,cutoutLength2:length/4,...stair},fp=getFootprint(d,1);
    for(let i=0;i<fp.outline.length;i++){const a=fp.outline[i],b=fp.outline[(i+1)%fp.outline.length];if(Math.hypot(b.x-a.x,b.y-a.y)<1e-6)continue;edges++;assert(bestDot(a,b)>SIDE_DOT+.05,`${shape} ${width}x${length}: edge ${i} faces a side at ${bestDot(a,b).toFixed(3)}`);}
  }
  ok(edges>1000,`${edges} existing edges all face a side by more than SIDE_DOT`);
  const fp=getFootprint({...base(),cornerChamfers:{frontLeftFt:4,frontRightFt:4}},1);
  for(const s of angledSegments(fp))ok(bestDot(s.a,s.b)<SIDE_DOT-.03,`${s.id} faces no side (${bestDot(s.a,s.b).toFixed(3)})`);
}

// 3. Clamping: each leg leaves 36 in of side edge, the pair leaves 24 in of front, a leg under 12 in is dropped.
{
  const c=(width:number,length:number,cc:CornerChamfers,shape:DeckData['shape']='Rectangle')=>activeCornerChamfers({...base(),width,length,shape,cornerChamfers:cc});
  const a=c(16,12,{frontLeftFt:4,frontRightFt:3});ok(a&&a.leftIn===48&&a.rightIn===36&&!a.reduced,'Legs are taken as entered when they fit');
  const b=c(16,12,{frontLeftFt:20});ok(b&&b.leftIn===144-36&&b.rightIn===0&&b.reduced,'A leg is cut back to leave 36 in of side edge');
  const s=c(10,30,{frontLeftFt:8,frontRightFt:8});ok(s&&near(s.leftIn+s.rightIn,120-24)&&near(s.leftIn,s.rightIn)&&s.reduced,'Two legs share the front, leaving 24 in, in proportion');
  const d=c(4,20,{frontLeftFt:2,frontRightFt:20});ok(d&&d.leftIn===0&&d.rightIn>12&&d.reduced&&d.dropped==='front left','A leg that clamping shrinks under 12 in is dropped');
  const g=c(10,30,{frontLeftFt:2,frontRightFt:20});ok(g&&g.leftIn===0&&near(g.rightIn,96)&&g.dropped==='front left','A dropped corner gives its share of the front back to the other corner');
  ok(describeChamfers(g!)==='45° angled front corner: 8 ft front right (reduced to fit the deck; the front left corner is too small to cut and stays square)','The words say which corner stays square');
  ok(describeChamfers(c(16,12,{frontLeftFt:4})!)==='45° angled front corner: 4 ft front left'&&describeChamfers(a!).startsWith('45° angled front corners:'),'One corner is singular, two are plural');
  ok(c(16,12,{frontLeftFt:4},'L-Shape')===null&&c(16,12,{frontLeftFt:4},'Curved')===null,'Only rectangles take angled corners');
  ok(c(16,12,{})===null&&c(16,12,{frontLeftFt:0})===null,'Empty and zero legs are square corners');
  ok(chamferLabourFactor(null)===1&&chamferLabourFactor(a)===1.25&&chamferLabourFactor(b)===1.10,'Labour reuses the L-shape (×1.10) and multi-corner (×1.25) factors');
  ok(chamferFaceFt(48)===5.7,'A 4 ft leg makes a 5.7 ft angled face');
}

// 4. Outline: the corner is cut on a true 45° line with a named edge, and the area drops by leg²/2 per corner.
for(const [width,length] of [[16,12],[24,20],[40,16]] as const)for(const [l,r] of [[4,0],[0,4],[4,3],[8,8]] as const)for(const deckType of ['Attached','Freestanding'] as const){
  const d=design({width,length,deckType,cornerChamfers:corners(l,r)}),fp=getFootprint(d,1),a=activeCornerChamfers(d)!,tag=`${width}x${length} ${deckType} legs ${l},${r}`;
  ok(near(outlineArea(fp.outline),width*length*144-(a.leftIn**2+a.rightIn**2)/2,1e-3),`${tag}: area is the rectangle less each corner triangle`);
  const segs=angledSegments(fp);
  ok(segs.length===(a.leftIn?1:0)+(a.rightIn?1:0),`${tag}: one named edge per angled corner`);
  for(const s of segs){
    const leg=s.id==='main-chamfer-left'?a.leftIn:a.rightIn,dx=s.b.x-s.a.x,dy=s.b.y-s.a.y;
    ok(near(Math.abs(dx),leg,1e-6)&&near(Math.abs(dy),leg,1e-6),`${tag}: ${s.id} runs ${leg} in along the front and the side`);
    ok(s.id==='main-chamfer-left'?Math.min(s.a.x,s.b.x)===0:Math.max(s.a.x,s.b.x)===width*12,`${tag}: ${s.id} is on its own side`);
  }
  ok(fp.edgeIds?.length===fp.outline.length,`${tag}: every edge keeps an id`);
}

// 5. Framing: no joist end left loose, no member over 16 ft, skewed hangers exactly on the angled rims.
{
  let designs=0,skewed=0;
  for(const [width,length,height] of [[16,12,36],[24,20,72],[40,16,48],[16,12,12]] as const)for(const [l,r] of [[4,0],[0,4],[4,4],[8,6],[12,12]] as const)for(const deckType of ['Attached','Freestanding'] as const)for(const pattern of ['Straight','Herringbone'] as const){
    const d=design({width,length,height,deckType,pattern,cornerChamfers:corners(l,r)}),tag=`${width}x${length}@${height} ${deckType} ${pattern} legs ${l},${r}`;
    const estimate=calculateDeckReleaseEstimate(d),model=estimate.model,main=model.levels[0],fp=getFootprint(d,1),segs=angledSegments(main.footprint);
    const loose=model.levels.filter(x=>x.kind==='deck').flatMap(x=>unsupportedJoistEnds(x,x.index===0?getHouseContact(d,fp):undefined));
    ok(loose.length===0,`${tag}: every joist end bears on a ledger or beam (loose ${loose.length})`);
    ok(model.levels.flatMap(x=>[...x.joists,...x.beams]).every(m=>memberLength(m)<=192.01),`${tag}: no framing member over 16 ft`);
    ok(model.levels.flatMap(x=>[...x.joists,...x.beams,...x.blocking]).every(m=>memberLength(m)>=.05),`${tag}: no zero-length framing member`);
    const twin=buildDeckTakeoff(design({width,length,height,deckType,pattern})).levels[0];
    ok(closePosts(main)<=closePosts(twin),`${tag}: no second footing a few inches from a post (${closePosts(main)} close posts, square deck ${closePosts(twin)})`);
    ok(main.angledEdges?.length===segs.length,`${tag}: the level records its angled edges`);
    ok(model.issues.some(i=>i.startsWith('Angled corner:')&&i.includes('reviewed before construction')),`${tag}: the corner framing is flagged for review`);
    ok(!model.issues.some(i=>i.includes('ripped narrower than 1.5 in')),`${tag}: no thin decking strip is flagged`);
    const hw=getHardwareLayout(d,model),onAngled=(p:{x:number;z:number})=>segs.some(s=>distanceToSegment({x:p.x,y:p.z},s.a,s.b)<2);
    ok((hw.skewedHangers?.length??0)>0&&hw.skewedHangers!.every(onAngled),`${tag}: skewed hangers sit on the angled rims (${hw.skewedHangers?.length??0})`);
    ok(!hw.hangers.some(onAngled),`${tag}: no square hanger is left on an angled rim`);
    const row=connectorSchedule(d,model,hw).find(r=>r.name==='Skewed joist and hip hangers')!;
    ok(row.rate===null&&row.qty===hw.skewedHangers!.length&&row.basis.includes('angled corners'),`${tag}: skewed hangers are listed for a supplier quote with an angled-corner basis`);
    ok(Number.isFinite(estimate.total)&&estimate.total>0,`${tag}: the estimate is a finite price`);
    designs++;skewed+=hw.skewedHangers!.length;
  }
  ok(designs===80,`${designs} framed designs, ${skewed} skewed hangers`);
  // A beam row's own post right at the angled beam carries it (the review's two cases).
  for(const [patch,tag] of [[{width:30,length:14,height:36,framingSize:'2x10',cornerChamfers:{frontLeftFt:10}},'30x14 10 ft left'],[{width:10,length:14,height:48,framingSize:'2x8',cornerChamfers:{frontRightFt:7}},'10x14 7 ft right']] as [Partial<DeckData>,string][])
    ok(closePosts(buildDeckTakeoff(design(patch)).levels[0])===0,`${tag}: no two posts within a foot`);
  // A bump-out zone that ends inside an angled corner leaves no zero-length beam.
  const house={...getHouseConfig({...base(),width:20}),widthFt:24,depthFt:22};
  for(const offsetFt of [4,6,7.5,9])for(const leftFt of [6,8]){
    const m=buildDeckTakeoff(design({houseConfig:{...house,footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt,widthFt:4,depthFt:3}]}},cornerChamfers:{frontLeftFt:leftFt}}));
    ok(m.levels.flatMap(x=>[...x.joists,...x.beams,...x.blocking]).every(mm=>memberLength(mm)>=.05),`bump-out at ${offsetFt} ft, ${leftFt} ft corner: no zero-length framing member`);
  }
}

// 6. Access: a stair opens on an angled face only by name, as one straight flight of up to 14 risers.
{
  const d=design({cornerChamfers:{frontLeftFt:6,frontRightFt:6},stairEdgeId:'main-chamfer-right',stairFlights:1,stairType:'Straight',height:36}),model=buildDeckTakeoff(d);
  const seg=angledSegments(model.levels[0].footprint).find(s=>s.id==='main-chamfer-right')!,f=model.flights[0];
  const dir={x:f.end.x-f.start.x,y:f.end.z-f.start.z},l=Math.hypot(dir.x,dir.y),normal={x:Math.SQRT1_2,y:Math.SQRT1_2};
  ok(model.flights.length===1&&distanceToSegment({x:f.start.x,y:f.start.z},seg.a,seg.b)<4,'A named angled face takes the stair');
  ok((dir.x*normal.x+dir.y*normal.y)/l>.99,'The flight runs straight out from the angled face');
  ok(!model.issues.some(i=>i.includes('one straight flight')),'An allowed angled stair raises no issue');
  const two=buildDeckTakeoff(design({cornerChamfers:{frontLeftFt:6,frontRightFt:6},stairEdgeId:'main-chamfer-right',stairFlights:2,height:36}));
  ok(two.flights.length===2&&Math.abs(two.flights[1].end.x-two.flights[1].start.x)<1e-6&&two.flights[1].end.z>two.flights[1].start.z,'A second flight still takes the real front edge');
  const plain=buildDeckTakeoff(design({cornerChamfers:{frontLeftFt:6,frontRightFt:6},stairPosition:'Front',stairFlights:1,height:36})).flights[0];
  ok(Math.abs(plain.end.x-plain.start.x)<1e-6&&plain.end.z>plain.start.z,'Following the stair location, the front stair stays on the real front edge');
  ok(availableStairSides(design({cornerChamfers:{frontLeftFt:6,frontRightFt:6}})).includes('Front'),'Front is still a stair side on an angled-corner deck');
  // Disallowed: turned stairs or more than 14 risers keep to the chosen side, with an issue.
  for(const patch of [{stairType:'Landing' as const},{stairType:'Straight' as const,height:120}]){
    const raw={...base(),cornerChamfers:{frontLeftFt:6,frontRightFt:6},stairEdgeId:'main-chamfer-right',stairFlights:1,...patch},m=buildDeckTakeoff(raw),s=angledSegments(m.levels[0].footprint).find(x=>x.id==='main-chamfer-right')!;
    ok(m.issues.some(i=>i.includes('must be one straight flight of up to 14 risers')),`${JSON.stringify(patch)}: the angled stair falls back with an issue`);
    ok(!m.flights.some(x=>distanceToSegment({x:x.start.x,y:x.start.z},s.a,s.b)<4),`${JSON.stringify(patch)}: no flight opens on the angled face`);
    ok(!angledStairAllowed(raw),`${JSON.stringify(patch)}: the angled stair is not allowed`);
  }
  // Loading prunes a name that is not allowed, and a level never joins an angled face.
  const loaded=(patch:Partial<DeckData>)=>parseDesign(serializeDesign({...base(),cornerChamfers:{frontLeftFt:6,frontRightFt:6},...patch}));
  ok(loaded({stairEdgeId:'main-chamfer-left',stairType:'Straight'}).stairEdgeId==='main-chamfer-left','A straight stair keeps its angled face');
  ok(loaded({stairEdgeId:'main-chamfer-left',stairType:'Landing'}).stairEdgeId===undefined,'A landing stair drops an angled face');
  ok(loaded({stairEdgeId:'main-chamfer-left',height:120}).stairEdgeId===undefined,'A stair over 14 risers drops an angled face');
  ok(loaded({levels:2,level2EdgeId:'main-chamfer-left'}).level2EdgeId===undefined,'A second level never joins an angled face');
  const l3=loaded({levels:3,level3:{widthFt:8,lengthFt:8,heightIn:20,parent:1,position:'Front',offsetPct:50,edgeId:'main-chamfer-right'}});
  ok(l3.level3&&l3.level3.edgeId===undefined,'A third level never joins an angled face');
  // A stale wrap edge can't match an angled-corner outline, and an edit drops any name the design can't use.
  const chamferFp=getFootprint(design({cornerChamfers:{frontLeftFt:4,frontRightFt:4}}),1);
  ok(chamferFp.edgeIds!.every(id=>isChamferEdgeId(id)||id.startsWith('rect-')),'Angled-corner edges never reuse a wrap edge id');
  const stale=buildDeckTakeoff({...base(),cornerChamfers:{frontRightFt:4},stairEdgeId:'main-left',stairPosition:'Right',stairFlights:1}).flights[0];
  ok(stale.end.x-stale.start.x>1&&Math.abs(stale.end.z-stale.start.z)<1e-6,'A leftover wrap stair edge is ignored: the stair keeps to the chosen side');
  const wrapHouse={...getHouseConfig({...base(),width:20}),widthFt:26,depthFt:22};
  const withWrap=design({width:22,length:12,houseConfig:wrapHouse,wrap:{right:{widthFt:8,runFt:10}},stairEdgeId:'main-left',levels:2,level2EdgeId:'main-left'});
  ok(pruneEdgeNames(withWrap)===withWrap,'Usable wrap edge names are kept');
  const unwrapped=pruneEdgeNames(deckReleaseData({...withWrap,wrap:undefined}));
  ok(unwrapped.stairEdgeId===undefined&&unwrapped.level2EdgeId===undefined,'Removing the wrap drops its stair and level edge names at once');
  const narrow=design({cornerChamfers:{frontLeftFt:3},stairEdgeId:'main-chamfer-left',stairWidth:60});
  ok(!angledStairFits(chamferFaceFt(36)*12,60)&&pruneEdgeNames(narrow).stairEdgeId===undefined,'A stair wider than the angled face drops the face');
  ok(pruneEdgeNames(design({cornerChamfers:{frontLeftFt:2},stairEdgeId:'main-chamfer-left',stairWidth:36})).stairEdgeId===undefined,'A face under 36 in never takes a stair');
  ok(pruneEdgeNames(design({cornerChamfers:{frontLeftFt:3},stairEdgeId:'main-chamfer-left',stairWidth:48})).stairEdgeId==='main-chamfer-left','A face as wide as the stair keeps it');
  const narrowRaw=buildDeckTakeoff({...base(),cornerChamfers:{frontLeftFt:3},stairEdgeId:'main-chamfer-left',stairWidth:60,stairPosition:'Right',stairFlights:1});
  ok(narrowRaw.issues.some(i=>i.includes('at least as wide as the stair'))&&narrowRaw.flights[0].end.x>narrowRaw.flights[0].start.x+1,'A too-narrow face falls back to the chosen side with an issue');
  const split={...base(),height:40,levels:2,height2:20,level2Position:'Front' as const,cornerChamfers:{frontRightFt:4},stairEdgeId:'main-chamfer-right',stairPosition:'Left' as const,stairFlights:1};
  ok(!angledStairAllowed(split)&&pruneEdgeNames(deckReleaseData(split)).stairEdgeId===undefined,'When a lower level takes the grade stairs, the angled face is dropped');
  const splitRaw=buildDeckTakeoff(split),splitGrade=splitRaw.flights.find(f=>f.kind==='grade')!;
  ok(splitRaw.issues.some(i=>i.includes('from the main deck'))&&splitGrade.end.x<splitGrade.start.x-1,'A lower level keeps its stair on the chosen side');
  ok(angledStairAllowed({...split,height2:48}),'A higher second level leaves the grade stairs on the main deck');
  ok(!buildDeckTakeoff({...base(),stairEdgeId:'main-chamfer-left',stairFlights:1}).issues.some(i=>i.includes('angled corner')),'A leftover angled-corner name on a square deck raises no angled-corner issue');
  // A wrap-around needs square front corners.
  const house={...getHouseConfig({...base(),width:20}),widthFt:26,depthFt:22};
  const wrapped=design({width:22,length:12,houseConfig:house,wrap:{left:{widthFt:8,runFt:10}},cornerChamfers:{frontLeftFt:4}});
  ok(activeWrap(wrapped)===null&&wrapBlockers(wrapped).some(r=>r.includes('front corners must be square')),'Angled corners pause a wrap-around with a reason');
  // Screens and benches keep off the angled faces.
  const screened=design({cornerChamfers:{frontLeftFt:3,frontRightFt:3},stairFlights:0,privacyScreens:[{id:'s1',side:'Front',lengthFt:4,heightFt:6,offsetPct:50,lights:false}]});
  const handles=extrasLayout(screened,buildDeckTakeoff(screened)).screenHandles;
  ok(handles.length===1&&near(Math.abs(handles[0].edge.dx),1)&&near(handles[0].edge.dz,0),'A front screen stands on the real front edge');
  const benched=design({width:16,length:12,cornerChamfers:{frontLeftFt:2,frontRightFt:2},benchLf:60,stairFlights:0});
  const seats=extrasLayout(benched,buildDeckTakeoff(benched)).wood.filter(w=>w.h===1&&w.d===5.5);
  ok(seats.length>0&&seats.every(w=>{const a=Math.abs(((w.angle??0)%(Math.PI/2)+Math.PI/2)%(Math.PI/2));return a<1e-6||Math.abs(a-Math.PI/2)<1e-6;}),'No bench stub sits on a short angled face');
}

// 7. Surface: full coverage, no overlap, and no thin strip (<1.5 in across, >6 in long) on any layout.
{
  const inside=(p:PlanPoint,poly:PlanPoint[])=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)hit=!hit;return hit;};
  const distance=(p:PlanPoint,poly:PlanPoint[])=>inside(p,poly)?0:Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}));
  const extent=(poly:PlanPoint[],deg:number)=>{const a=deg*Math.PI/180,u=poly.map(p=>p.x*Math.cos(a)+p.y*Math.sin(a)),v=poly.map(p=>-p.x*Math.sin(a)+p.y*Math.cos(a));return {length:Math.max(...u)-Math.min(...u),rip:Math.max(...v)-Math.min(...v)};};
  const cases:[number,number,DeckData['pattern'],0|1|2,[number,number],boolean][]=[];
  for(const pattern of ['Straight','Picture Frame','Diagonal','Herringbone'] as const)for(const legs of [[4,0],[0,4],[5,3],[8,8]] as [number,number][])cases.push([18,12,pattern,pattern==='Picture Frame'?1:0,legs,false]);
  for(const pattern of ['Diagonal','Herringbone'] as const)for(const rows of [1,2] as const)for(const legs of [[4,0],[0,4],[8,8]] as [number,number][])cases.push([40,16,pattern,rows,legs,false]);
  // Without the row anchor, these diagonal layouts leave a long rip along the front-left angled edge.
  cases.push([18,12,'Diagonal',1,[4,0],false],[18,12,'Diagonal',1,[8,8],false],[18,12,'Diagonal',2,[5,3],false],[40,16,'Diagonal',0,[5,3],false]);
  // Herringbone ends that stop a few inches inside the angled rim, past its nailer, still get a block.
  cases.push([24,18,'Herringbone',0,[2,7],false],[16,12,'Herringbone',0,[6,6],false],[20,14,'Herringbone',0,[3,3],false],[12,10,'Herringbone',0,[3,3],false]);
  // Short joint pieces and square ends just inside an angled rim, clear of its nailer, still get backing.
  cases.push([18,12,'Diagonal',0,[7,7],false],[16,10,'Diagonal',0,[0,3],false],[14,14,'Diagonal',0,[3,5],false]);
  // A 40 ft deck has breakers; a 14 ft corner on a 30 ft depth puts one across the angled edge.
  for(const rows of [0,1] as const)for(const legs of [[14,0],[0,14],[20,6]] as [number,number][])cases.push([40,30,'Straight',rows,legs,true]);
  for(const [width,length,pattern,rows,legs,inlay] of cases){
    const d=design({width,length,pattern,pictureFrameRows:rows,hasInlay:inlay,inlayLf:inlay?length:0,cornerChamfers:corners(...legs)}),m=buildDeckTakeoff(d),level=m.levels[0],tag=`${width}x${length} ${pattern} rows ${rows} legs ${legs}${inlay?' inlay':''}`;
    const polys=level.boards.map(b=>boardOutline(b,d.boardWidth)),fp=(level.deckingFootprint??level.footprint).outline;
    let missing=0,overlap=0,samples=0;const step=width>20?6.13:3.17;
    for(let y=Math.min(...fp.map(p=>p.y))+.37;y<Math.max(...fp.map(p=>p.y));y+=step)for(let x=Math.min(...fp.map(p=>p.x))+.29;x<Math.max(...fp.map(p=>p.x));x+=step){
      const p={x,y};if(!inside(p,fp))continue;samples++;
      if(Math.min(...polys.map(poly=>distance(p,poly)))>=.38)missing++;
      if(polys.filter(poly=>inside(p,poly)).length>1)overlap++;
    }
    ok(samples>100&&missing===0&&overlap===0,`${tag}: decking covers the deck once (missing ${missing}, overlap ${overlap} of ${samples})`);
    const strips=level.boards.map((b,i)=>extent(polys[i],b.angleDeg)).filter(e=>e.rip<1.5&&e.length>6);
    ok(strips.length===0,`${tag}: no thin strip along an edge (${strips.length})`);
    // Herringbone picks, among the lattice positions that line up with the angled edges, one leaving few tiny tips.
    const tips=level.boards.map((b,i)=>extent(polys[i],b.angleDeg)).filter(e=>e.rip<1.5&&e.length<=6).length;
    if(pattern==='Herringbone')ok(tips<=2,`${tag}: at most two tiny offcut tips (${tips})`);
    ok(deckBoardStock(m,1.1).unresolved.length===0&&polys.every(p=>Math.abs(signedArea(p))>.001),`${tag}: every piece is a real board cut from stock`);
    const borders=d.pictureFrameRows||(pattern==='Picture Frame'?1:0),field=offsetPolygons([fp],borders*(d.boardWidth+m.gap));
    const inField=(b:typeof level.boards[number])=>boardOutline(b,d.boardWidth).every(p=>field.some(poly=>distance(p,poly)<.05));
    ok(level.boards.filter(b=>b.role==='breaker'||b.role==='inlay').every(inField),`${tag}: breakers and the inlay stay inside the field, clear of the border rows`);
    if(width===40&&length===30)ok(level.boards.some(b=>b.role==='breaker'&&(b.polygon?.length??4)>4||b.role==='breaker'&&extent(boardOutline(b,d.boardWidth),90).length<length*12-1),`${tag}: a breaker is cut short by the angled edge`);
    if(inlay)ok(level.boards.some(b=>b.role==='inlay'),`${tag}: the inlay is laid`);
    // Boards run flush to each angled field edge: sample just inside it; only board joints may show.
    for(const e of level.angledEdges??[]){
      const el=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),dir={x:(e.b.x-e.a.x)/el,y:(e.b.y-e.a.y)/el};
      const edge=field.flatMap(poly=>poly.map((p,i)=>[p,poly[(i+1)%poly.length]] as const)).find(([p,q])=>{const l=Math.hypot(q.x-p.x,q.y-p.y);return l>12&&Math.abs((q.x-p.x)/l*dir.y-(q.y-p.y)/l*dir.x)<.02&&distanceToSegment({x:(p.x+q.x)/2,y:(p.y+q.y)/2},e.a,e.b)<14;});
      if(!edge)continue;
      const [p,q]=edge,l=Math.hypot(q.x-p.x,q.y-p.y),n0={x:-(q.y-p.y)/l,y:(q.x-p.x)/l},mid={x:(p.x+q.x)/2,y:(p.y+q.y)/2},n=inside({x:mid.x+n0.x*2,y:mid.y+n0.y*2},fp)&&field.some(poly=>inside({x:mid.x+n0.x*2,y:mid.y+n0.y*2},poly))?n0:{x:-n0.x,y:-n0.y};
      let open=0;const count=128;
      for(let k=0;k<count;k++){const t=(k+.5)/count,s={x:p.x+(q.x-p.x)*t+n.x*.09,y:p.y+(q.y-p.y)*t+n.y*.09};if(!polys.some(poly=>inside(s,poly)))open++;}
      ok(open/count<=.08,`${tag}: boards run flush to the angled edge (${open} of ${count} points open)`);
    }
    ok(unbackedEndsNearAngled(level,d.boardWidth)===0,`${tag}: every board end near an angled corner has framing under it (${unbackedEndsNearAngled(level,d.boardWidth)})`);
  }
}

// 8. Pricing: priced from the model, on existing rates and factors only.
{
  const square=calculateDeckReleaseEstimate(design({})),cut=calculateDeckReleaseEstimate(design({cornerChamfers:{frontLeftFt:4,frontRightFt:4}}));
  ok(near(square.model.quantities.area,192,1e-6)&&near(cut.model.quantities.area,176,1e-6),'Two 4 ft corners take 16 sq ft off a 16 x 12 ft deck');
  ok(cut.total>square.total,'Angled corners cost more to build than square ones on the same rectangle');
  // The fascia basis is the true outline: 2(W + L) less (2 − √2) × the legs.
  const fp=getFootprint(design({deckType:'Freestanding',cornerChamfers:{frontLeftFt:4,frontRightFt:3}}),1),perimeterFt=fp.outline.reduce((n,p,i)=>{const q=fp.outline[(i+1)%fp.outline.length];return n+Math.hypot(q.x-p.x,q.y-p.y)/12;},0);
  ok(near(perimeterFt,2*(16+12)-(2-Math.SQRT2)*(48+36)/12,1e-9),'The fascia formula equals the real outline length');
  const calc=readFileSync(new URL('../src/features/deckcraft/calculations.ts',import.meta.url),'utf8');
  ok(calc.includes('chamfers ? 2 * (width + length) - (2 - Math.SQRT2) * (chamfers.leftIn + chamfers.rightIn) / 12 : 2 * (width + length)'),'The estimate prices fascia on the true outline');
  ok(/complexityMult \*= wrapLabourFactor\(wrap\);\s*complexityMult \*= chamferLabourFactor\(chamfers\);/.test(calc),'The estimate applies the angled-corner labour factor');
  ok(calc.includes("l.angledEdges?.length?l.breakers.reduce((d,x)=>d+outlineSpans(l.footprint.outline,x,'x')"),'Breaker labour uses the real depth beside an angled corner');
  ok(!connectorSchedule(design({}),square.model).some(r=>r.name==='Skewed joist and hip hangers'&&r.qty>0),'A square deck lists no skewed hangers');
  ok(!cut.materialList.some(m=>m.cost===0&&/angled|skew/i.test(m.item)),'Nothing about the angled corners is priced at $0');
}

// 9. Outputs: the words, the plan, the exports, the analytics label, drainage and a saved or shared design.
{
  const d=design({cornerChamfers:{frontLeftFt:4,frontRightFt:3},hasDrainage:true,height:48}),estimate=calculateDeckReleaseEstimate(d),model=estimate.model as DeckTakeoff;
  const words=describeDesign(d,estimate);
  ok(words.facts.includes('Rectangle 16 × 12 ft with 45° angled front corners: 4 ft front left, 3 ft front right'),'The design facts describe the corners');
  ok(String(words.summary).includes('Rectangle with angled front corners, 1 level(s)'),'The summary names the shape');
  ok(words.proposalFacts[0].includes('rectangle deck with angled front corners'),'The proposal names the shape');
  ok(shapeWords(d,false)==='Rectangle with angled front corners'&&shapeWords(design({}),false)==='Rectangle'&&shapeWords(d,true)==='Wrap-around','The estimate step names the shape');
  const one=design({cornerChamfers:{frontLeftFt:4}}),oneWords=describeDesign(one,calculateDeckReleaseEstimate(one));
  ok(shapeWords(one,false)==='Rectangle with an angled front corner'&&oneWords.proposalFacts[0].includes('rectangle deck with an angled front corner,')&&oneWords.facts.includes('Rectangle 16 × 12 ft with 45° angled front corner: 4 ft front left'),'One angled corner is described in the singular');
  const reduced=activeCornerChamfers(design({cornerChamfers:{frontLeftFt:30}}))!;
  ok(describeChamfers(reduced).endsWith('(reduced to fit the deck)'),'A clamped corner says it was reduced');
  const svg=renderToStaticMarkup(createElement(ConstructionPlan,{model,data:d}));
  ok(svg.includes('45° corner · 4.0 ft cut')&&svg.includes('45° corner · 3.0 ft cut'),'The plan labels each angled corner with its cut');
  const dxf=exportDeckDXF(d,model),obj=exportDeckOBJ(d,model);
  ok(dxf.length>1000&&obj.length>1000&&!/NaN|Infinity/.test(dxf+obj),'DXF and OBJ export cleanly');
  ok(designFeatures(d).includes('deck_corner_chamfer'),'Analytics reports the angled corners with a fixed label');
  const drains=extrasLayout(d,model).drainage,collector=drains.find(b=>b.h===3&&b.d===4)!,spout=drains.find(b=>b.w===3&&b.d===3)!;
  ok(near(collector.w,16*12-48-36)&&near(collector.x,48+(16*12-36-48)/2),'The drainage collector spans only the real front edge');
  ok(near(spout.x,48+3),'The downspout drops at the left end of the real front edge');
  // Save, load and share.
  for(const raw of [[],'x',-1,31,.5,Number.NaN,'4'])assert.throws(()=>validateDesign({...base(),cornerChamfers:{frontLeftFt:raw}}),`Leg ${String(raw)} is rejected`),checks++;
  assert.throws(()=>validateDesign({...base(),cornerChamfers:[]}),'A list is not a corner set');checks++;
  ok(serializeDesign(validateDesign({...base(),cornerChamfers:{frontLeftFt:0}}))===serializeDesign(base()),'A zero leg saves exactly like a square deck');
  const text=serializeDesign(d);ok(serializeDesign(parseDesign(text))===text&&parseDesign(text).cornerChamfers?.frontRightFt===3,'Angled corners round-trip through a saved design');
  const link=await encodeDesignLink(d,'https://example.test'),shared=await decodeDesignLink(designLinkFromHash(new URL(link).hash)!);
  ok(shared.cornerChamfers?.frontLeftFt===4&&shared.cornerChamfers.frontRightFt===3,'Angled corners survive a share link');
}

// 10. Wiring: the designer offers the corners, clears them for a wrap, and keeps angled faces out of level pickers.
{
  const read=(p:string)=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8');
  const step=read('features/deckcraft/designer/steps/DimensionsStep.tsx'),page=read('pages/DeckDesigner.tsx'),actions=read('features/deckcraft/designer/deckShapeActions.ts');
  ok(step.includes('Angled front corners (45°)')&&step.includes('data.shape===\'Rectangle\'&&cornersSection'),'The footprint step offers angled corners on rectangles');
  ok(actions.includes('cornerChamfers:undefined')&&actions.includes("'square front corners'"),'Turning on a wrap-around squares the corners and says so');
  ok(step.includes('setWing(data,houseConfig,side,on)')&&step.includes('update(wrapFix(data))'),'The footprint step turns wings on through the shape actions');
  const angled=design({cornerChamfers:corners(4,3)}),{patch,status}=setWing(angled,getHouseConfig(angled),'left',true);
  ok('cornerChamfers' in patch&&patch.cornerChamfers===undefined&&patch.wrap?.left&&status==='Switched to square front corners so the corner can be mitred.','A wing squares angled corners and says so');
  ok(wrapFixNames(design({cornerChamfers:corners(4,0),pattern:'Diagonal'})).join()==='straight boards,square front corners'&&!('cornerChamfers' in wrapFix(base())),'The wrap fix names only what it changes');
  ok(page.includes('stairEdges={levelEdges}')&&/levelEdges=namedEdges\.filter\(e=>wrap&&!isChamferEdgeId\(e\.id\)\)/.test(page),'Level pickers never offer an angled face');
  ok(read('features/deckcraft/designer/useDeckDesign.ts').includes('setData(prev=>pruneEdgeNames(deckReleaseData({...prev,...patch})))'),'Every edit drops a stair or level edge name the design can no longer use');
  ok(read('features/deckcraft/designPersistence.ts').includes('const named=pruneEdgeNames(clean);'),'Loading drops the same names');
  ok(page.includes('angledStairAllowed(data)&&angledStairFits(e.lenIn,data.stairWidth)'),'The stair picker offers an angled face on the same rule');
}

console.log(`DECK CORNERS OK — no-op, side band, clamping, outline, 80 framed designs, access, surface, pricing, outputs and wiring; ${checks} checks.`);
