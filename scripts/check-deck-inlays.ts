import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff,type DeckLevel,type Member} from '../src/features/deckcraft/deckTakeoff';
import {serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import {boardOutline,polygonCut,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import {fieldAngles,fillAngles,fitInlay,inlayCrewDays,INLAY_LIMITS,levelInlayContext,planInlays,type InlayPlan} from '../src/features/deckcraft/lib/inlayGeometry';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';
import type {DeckData,DeckInlay} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * Decorative inlays (a framed rectangle or a diamond): the boards are cut around each inlay with no overlap and
 * nothing longer than stock; every joint where boards end at an inlay, every frame board that runs with the
 * joists and every inside that needs it has framing under it; the placement rules hold; labour is the breaker
 * rate on fitted edges plus the inside's pattern factor, exactly; the inlay boards are their own stock; and a
 * design without inlays is unchanged.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const base=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),width:20,length:14,...patch});
const price=(d:DeckData)=>calculateDeckReleaseEstimate(d,DECK_SETTINGS);
const rug=(patch:Partial<DeckInlay>={}):DeckInlay=>({id:'a',kind:'rug',widthFt:6,depthFt:4,...patch});
const diamond=(patch:Partial<DeckInlay>={}):DeckInlay=>({id:'d',kind:'diamond',widthFt:4,depthFt:4,...patch});
const polyArea=(ps:PlanPoint[][])=>ps.reduce((n,p)=>n+Math.abs(signedArea(p)),0);
const box=(p:PlanPoint[])=>({x0:Math.min(...p.map(v=>v.x)),x1:Math.max(...p.map(v=>v.x)),y0:Math.min(...p.map(v=>v.y)),y1:Math.max(...p.map(v=>v.y))});
const segDist=(x:number,z:number,m:Member)=>{const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,l2=dx*dx+dz*dz;const t=l2?Math.max(0,Math.min(1,((x-m.a.x)*dx+(z-m.a.z)*dz)/l2)):0;return Math.hypot(x-(m.a.x+dx*t),z-(m.a.z+dz*t));};
// A point within a quarter inch of a joist's face (1.5 in wide) rests on it; this also covers the narrow crack between
// a breaker's doubled build-up joists, which no blocking fits.
const onJoist=(x:number,z:number,level:DeckLevel)=>level.joists.some(j=>Math.abs(j.a.x-x)<1&&z>=Math.min(j.a.z,j.b.z)-.5&&z<=Math.max(j.a.z,j.b.z)+.5);
const parallel=(deg:number,angles:number[])=>angles.some(a=>Math.abs(Math.sin((deg-a)*Math.PI/180))<.05);
const edgesOf=(poly:PlanPoint[])=>poly.map((a,i)=>{const b=poly[(i+1)%poly.length],len=Math.hypot(b.x-a.x,b.y-a.y);return {a,b,len,deg:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,n:{x:-(b.y-a.y)/len,y:(b.x-a.x)/len}};}).filter(e=>e.len>1);

// 1. No inlays: nothing changes.
{
  const d=base(),empty={...d,inlays:[]};
  ok(JSON.stringify({...price(d),model:undefined,yardModel:undefined})===JSON.stringify({...price(empty),model:undefined,yardModel:undefined}),'An empty inlay list prices exactly like none');
  ok(validateDesign(empty).inlays===undefined&&serializeDesign(d)===serializeDesign(empty),'An empty inlay list is not saved');
  ok(buildDeckTakeoff(d).levels.every(l=>l.inlays===undefined&&l.blocking.every(b=>!b.role?.startsWith('inlay-'))&&l.boards.every(b=>!b.inlay)),'A deck without inlays has no inlay boards, plans or framing');
}

// 2. Geometry and framing over inlay kinds × main patterns × deck shapes.
const kinds:[string,DeckInlay][]=[['rug, straight inside',rug()],['rug, herringbone inside, 2 frame rows',rug({pattern:'Herringbone',frameRows:2,widthFt:6,depthFt:5,dxFt:-1})],['rug, diagonal inside',rug({pattern:'Diagonal'})],['diamond, straight inside',diamond()],['diamond, herringbone inside',diamond({pattern:'Herringbone',widthFt:5,depthFt:5})]];
const patterns:Partial<DeckData>[]=[{pattern:'Straight'},{pattern:'Diagonal'},{pattern:'Herringbone'},{pattern:'Picture Frame'}];
const shapes:[string,Partial<DeckData>][]=[['rectangle',{}],['L-shape',{shape:'L-Shape',width:24,length:16,cutoutWidth:8,cutoutLength:6}],['angled corner',{cornerChamfers:{frontLeftFt:4}}],['custom T',{shape:'Custom',customFront:[{x:20,y:8},{x:15,y:8},{x:15,y:14},{x:5,y:14},{x:5,y:8},{x:0,y:8}]}]];
let designs=0;
for(const [kindName,inlay] of kinds)for(const pattern of patterns)for(const [shapeName,shape] of shapes){
  const d=base({...shape,...pattern,inlays:[inlay]}),model=buildDeckTakeoff(d),level=model.levels[0],label=`${kindName} on a ${d.pattern} ${shapeName}`;designs++;
  const plan=level.inlays?.[0] as InlayPlan;
  ok(plan?.status==='ok',`${label}: built (${plan?.message??'no plan'})`);
  const gap=model.gap,bw=d.boardWidth,spacing=d.pattern==='Diagonal'||d.pattern==='Herringbone'?12:d.joistSpacing;
  // Boards: no overlap, nothing past stock, inlay boards inside the outline and nothing else inside it.
  const polys=level.boards.map(b=>boardOutline(b,bw)),boxes=polys.map(box);let overlaps=0;
  for(let i=0;i<polys.length;i++)for(let j=i+1;j<polys.length;j++){const a=boxes[i],b=boxes[j];if(a.x0>=b.x1||b.x0>=a.x1||a.y0>=b.y1||b.y0>=a.y1)continue;if(polyArea(polygonCut([polys[i]],[polys[j]]))>.5)overlaps++;}
  ok(overlaps===0,`${label}: no two boards overlap (${overlaps})`);
  ok(level.boards.every(b=>b.length<=model.stockLength+.01),`${label}: no piece is longer than stock`);
  const inlayBoards=level.boards.filter(b=>b.inlay),others=level.boards.filter(b=>!b.inlay);
  ok(inlayBoards.length>0&&inlayBoards.some(b=>b.role==='inlay-frame')&&inlayBoards.some(b=>b.role==='inlay-fill'),`${label}: frame and inside boards are built`);
  ok(inlayBoards.every(b=>polyArea(polygonCut([boardOutline(b,bw)],[plan.outline],true))<1),`${label}: inlay boards stay inside the inlay`);
  ok(others.every(b=>polyArea(polygonCut([boardOutline(b,bw)],[plan.outline]))<1),`${label}: field, border and breaker boards stop at the inlay`);
  const inlaySupport=level.blocking.filter(m=>m.role?.startsWith('inlay-'));
  const at=(p:PlanPoint)=>({x:p.x+level.offset.x,z:p.y+level.offset.z});
  const supported=(p:PlanPoint,roles:string[])=>{const w=at(p);return onJoist(w.x,w.z,level)||inlaySupport.some(m=>roles.includes(m.role!)&&segDist(w.x,w.z,m)<1.0);};
  const sampleLine=(a:PlanPoint,b:PlanPoint,roles:string[],what:string)=>{
    const len=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(2,Math.floor(len/3));let missed=0;
    for(let i=1;i<n;i++){const t=i/n;if(t*len<2||(1-t)*len<2)continue;if(!supported({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},roles))missed++;}
    ok(missed===0,`${label}: ${what} has framing under it all along (${missed} gaps)`);
  };
  // Joints where boards end at the inlay: field boards at the outer edge, fill boards at the inner edge.
  for(const e of edgesOf(plan.outline))if(!parallel(e.deg,fieldAngles(d.pattern)))sampleLine({x:e.a.x-e.n.x*gap/2,y:e.a.y-e.n.y*gap/2},{x:e.b.x-e.n.x*gap/2,y:e.b.y-e.n.y*gap/2},['inlay-edge'],'the outer joint');
  for(const e of edgesOf(plan.inner))if(!parallel(e.deg,fillAngles(plan.pattern)))sampleLine({x:e.a.x-e.n.x*gap/2,y:e.a.y-e.n.y*gap/2},{x:e.b.x-e.n.x*gap/2,y:e.b.y-e.n.y*gap/2},['inlay-edge'],'the inner joint');
  // Frame boards running with the joists (or at 45° over 16 in joists) rest on nailers.
  for(const e of edgesOf(plan.outline)){
    const along=Math.abs(Math.cos(e.deg*Math.PI/180))<.05,angled=Math.abs(Math.abs(Math.sin(e.deg*Math.PI/180))-Math.SQRT1_2)<.05&&spacing>12;
    if(along||angled)for(let k=0;k<plan.frameRows;k++){const d0=k*(bw+gap)+bw/2;sampleLine({x:e.a.x+e.n.x*d0,y:e.a.y+e.n.y*d0},{x:e.b.x+e.n.x*d0,y:e.b.y+e.n.y*d0},['inlay-nailer','inlay-edge'],`frame row ${k+1} along a ${Math.round(e.deg)}° edge`);}
  }
  // An inside the joists alone do not carry has rungs at 12 in centres or closer.
  const rungs=inlaySupport.filter(m=>m.role==='inlay-ladder').map(m=>m.a.z);
  const needs=fillAngles(plan.pattern).some(a=>Math.abs(Math.cos(a*Math.PI/180))<.05||(Math.abs(Math.abs(Math.sin(a*Math.PI/180))-Math.SQRT1_2)<.05&&spacing>12))||plan.pattern==='Herringbone';
  if(needs){const zs=[...new Set(rungs.map(z=>Math.round(z*10)/10))].sort((a,b)=>a-b);ok(zs.length>0&&zs.every((z,i)=>i===0||z-zs[i-1]<=12.01),`${label}: rungs under the inside at 12 in centres or closer`);}
  else ok(rungs.length===0,`${label}: no rungs where the joists carry the inside`);
  // Every inlay board end, and every board end at the inlay, rests on framing: behind each end face (square or
  // mitred), a band 1½ in deep measured square to the face overlaps a joist, block, rim or beam.
  const members=[...level.joists,...level.blocking,...(level.rim??[]),...level.beams].map(m=>{const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len*m.width/2,nz=dx/len*m.width/2;
    const rect=[{x:m.a.x+nx,y:m.a.z+nz},{x:m.b.x+nx,y:m.b.z+nz},{x:m.b.x-nx,y:m.b.z-nz},{x:m.a.x-nx,y:m.a.z-nz}];return {rect,bb:box(rect)};});
  const ob=box(plan.outline);let loose=0;
  for(const b of level.boards){
    const poly=boardOutline(b,bw).map(p=>({x:p.x+level.offset.x,y:p.y+level.offset.z}));if(polyArea([poly])<1)continue;
    const a=b.angleDeg*Math.PI/180,u={x:Math.cos(a),y:Math.sin(a)},us=poly.map(p=>p.x*u.x+p.y*u.y),lo=Math.min(...us),hi=Math.max(...us);
    for(const end of [-1,1]){
      // The end's faces: edges across the board, nearer this end.
      const faces=poly.map((p,i)=>[p,poly[(i+1)%poly.length]]).filter(([p,q])=>{const len=Math.hypot(q.x-p.x,q.y-p.y);if(len<.3)return false;const sin=Math.abs(((q.x-p.x)*u.y-(q.y-p.y)*u.x)/len);const mid=((p.x+q.x)*u.x+(p.y+q.y)*u.y)/2;return sin>.2&&(end<0?mid-lo<hi-mid:hi-mid<=mid-lo);});
      if(!faces.length)continue;
      const bands=faces.map(([p,q])=>{const len=Math.hypot(q.x-p.x,q.y-p.y),sin=Math.abs(((q.x-p.x)*u.y-(q.y-p.y)*u.x)/len),L=1.5/sin,d={x:-end*u.x*L,y:-end*u.y*L};return [p,q,{x:q.x+d.x,y:q.y+d.y},{x:p.x+d.x,y:p.y+d.y}];});
      const zone=polygonCut([poly],bands);if(!zone.length)continue;
      const sb=box(zone.flat()),c={x:(sb.x0+sb.x1)/2-level.offset.x,y:(sb.y0+sb.y1)/2-level.offset.z};
      // Inlay board ends, and other board ends within 3 in of the inlay.
      const touches=b.inlay||(c.x>ob.x0-3&&c.x<ob.x1+3&&c.y>ob.y0-3&&c.y<ob.y1+3&&polyArea(polygonCut([plan.outline],[[{x:c.x-3,y:c.y-3},{x:c.x+3,y:c.y-3},{x:c.x+3,y:c.y+3},{x:c.x-3,y:c.y+3}]]))>0);
      if(!touches)continue;
      const need=Math.min(.5,polyArea(zone)*.25);
      // The house rule too (constructionDetails blockBoardEnd): an end face whose middle is within 0.76 in of a
      // joist's centre is on that joist.
      const face=faces.reduce((best,f)=>Math.hypot(f[1].x-f[0].x,f[1].y-f[0].y)>Math.hypot(best[1].x-best[0].x,best[1].y-best[0].y)?f:best),fm={x:(face[0].x+face[1].x)/2,y:(face[0].y+face[1].y)/2};
      const onJoistRule=level.joists.some(j=>Math.abs(j.a.x-fm.x)<.76&&fm.y>=Math.min(j.a.z,j.b.z)-.1&&fm.y<=Math.max(j.a.z,j.b.z)+.1);
      if(!onJoistRule&&!members.some(m=>m.bb.x0<sb.x1&&m.bb.x1>sb.x0&&m.bb.y0<sb.y1&&m.bb.y1>sb.y0&&polyArea(polygonCut(zone,[m.rect]))>=need))loose++;
    }
  }
  ok(loose===0,`${label}: every board end at the inlay rests on framing (${loose} loose)`);
}
{
  const plain=price(base()),inl=price(base({inlays:[rug({pattern:'Herringbone'})]}));
  const conn=(e:typeof plain)=>e.connectorSchedule.find(r=>r.name==='Blocking connections')?.qty??0;
  ok(inl.model.quantities.blocking>plain.model.quantities.blocking&&conn(inl)>conn(plain),'Inlay framing adds blocking and blocking connections');
  const frame=(e:typeof plain)=>e.sections.find(s=>s.title.startsWith('Structural'))!.total;
  ok(frame(inl)>frame(plain),'Inlay framing is priced in the framing lumber');
}

// 3. Placement rules: an inlay that breaks one is not built, is kept, and the design says why.
for(const [label,patch,status] of [
  ['one past the field',{inlays:[rug({widthFt:20})]},'outside'],
  ['one over another',{inlays:[rug(),rug({id:'b',dxFt:2})]},'overlap'],
  ['one too small for its frame',{inlays:[rug({widthFt:2,depthFt:2,frameRows:2})]},'small'],
  ['one with the centre stripe on',{hasInlay:true,inlayLf:8,inlays:[rug()]},'blocked'],
] as [string,Partial<DeckData>,string][]){
  const d=base(patch),m=buildDeckTakeoff(d),plans=m.levels[0].inlays!,last=plans.at(-1)!;
  ok(last.status===status&&m.levels[0].boards.filter(b=>b.inlay===last.id).length===0,`${label}: not built (${status})`);
  ok(m.issues.some(s=>s.includes('is not built:')),`${label}: the design says why`);
  ok(validateDesign(d).inlays?.length===d.inlays!.length,`${label}: kept in the design`);
}
{
  const d=base({wrap:{left:{widthFt:8,runFt:12}},inlays:[rug()]}),m=buildDeckTakeoff(d);
  ok(!m.levels[0].inlays&&m.levels[0].boards.every(b=>!b.inlay)&&m.issues.some(s=>s.includes('not built on a wrap-around deck')),'Inlays are not built on a wrap-around deck, and it says so');
}

// 4. Fit to deck: moved toward the middle, then made smaller, until it fits; never moved onto another inlay.
{
  const d=base(),m=buildDeckTakeoff(d),ctx=levelInlayContext(d,m.levels[0]);
  const big=fitInlay(rug({widthFt:20,depthFt:13}),[],ctx)!;ok(big&&big.widthFt<20&&planInlays([big],ctx)[0].status==='ok','A too-big inlay is made smaller until it fits');
  const off=fitInlay(rug({dxFt:9}),[],ctx)!;ok(off&&Math.abs(off.dxFt??0)<9&&off.widthFt===6&&planInlays([off],ctx)[0].status==='ok','An inlay past the edge is moved toward the middle before it is made smaller');
  const other=rug(),second=fitInlay(rug({id:'b',dxFt:2}),[other],ctx)!;ok(second&&second.widthFt===6&&planInlays([other,second],ctx)[1].status==='ok','A second inlay goes to the nearest free spot beside the first, at its own size');
  const full=fitInlay(rug({id:'c',widthFt:18,depthFt:11}),[rug({widthFt:18,depthFt:11})],ctx);ok(full===null,'An inlay with no room anywhere is not placed');
}

// 5. Saving: validated and bounded.
{
  const good=base({inlays:[rug({dxFt:1.5,dyFt:-1,frameRows:2,pattern:'Diagonal',frame:'tt_prime_plus:Dark Cocoa'}),diamond({level:1})]});
  const back=validateDesign(JSON.parse(serializeDesign(good)).configuration);
  assert.deepStrictEqual(back.inlays,[rug({dxFt:1.5,dyFt:-1,frameRows:2,pattern:'Diagonal',frame:'tt_prime_plus:Dark Cocoa'}),diamond()],'Inlays survive a round trip, with defaults left out');checks++;
  for(const [label,bad] of [['an unknown kind',{...rug(),kind:'star'}],['a bad id',{...rug(),id:'Bad Id'}],['a rug past 20 ft',rug({widthFt:21})],['a diamond past 14 ft',diamond({widthFt:15,depthFt:15})],['a far position',rug({dxFt:31})],['three frame rows',{...rug(),frameRows:3}],['an unknown colour',rug({fill:'nope:Red'})],['an unknown pattern',{...rug(),pattern:'Chevron'}]] as [string,unknown][])
    assert.throws(()=>validateDesign({...base(),inlays:[bad]}),undefined,`Rejects ${label}`),checks++;
  assert.throws(()=>validateDesign({...base(),inlays:[rug(),rug()]}),undefined,'Rejects a repeated id');checks++;
  assert.throws(()=>validateDesign({...base(),inlays:Array.from({length:INLAY_LIMITS.max+1},(_,i)=>rug({id:`i${i}`}))}),undefined,'Rejects too many inlays');checks++;
}

// 6. Labour: the breaker rate on each frame's fitted edge plus the inside's pattern factor, exactly.
{
  // The default deck has no labour multipliers (rectangle, straight, low, standard site, spring, aluminum).
  const plain=price(base()),labour=(e:typeof plain)=>e.sections.find(s=>s.title.startsWith('Labour'))!.items[0].cost as number;
  const d=base({inlays:[rug({pattern:'Herringbone'})]}),e=price(d),plans=e.model.levels.flatMap(l=>l.inlays??[]),days=inlayCrewDays(plans,'Straight',320);
  ok(Math.abs(days.edge-plans[0].edgeFt/10*1.5/8)<1e-9,'Fitted edge: 1.5 crew-hours per 10 ft of the frame\'s outline');
  ok(Math.abs(days.inside-(1.3-1)*plans[0].fillSqft/320)<1e-9,'Herringbone inside: its ×1.30 factor on the inside\'s share of the decking labour');
  ok(Math.abs(labour(e)-labour(plain)-days.total*3700)<.01,'The inlay adds exactly its crew-days at $3,700 a day');
  const diag=base({pattern:'Diagonal'}),dd=base({pattern:'Diagonal',inlays:[rug({pattern:'Herringbone'})]}),ed=price(dd),dayd=inlayCrewDays(ed.model.levels.flatMap(l=>l.inlays??[]),'Diagonal',320);
  ok(Math.abs(labour(ed)-labour(price(diag))-dayd.total*1.2*3700)<.01&&Math.abs(dayd.inside-(1.3/1.2-1)*ed.model.levels[0].inlays![0].fillSqft/320)<1e-9,'On a diagonal deck the inside pays only the difference, under the deck\'s own multipliers');
  const straightIn=price(base({pattern:'Herringbone',inlays:[rug()]})),daysS=inlayCrewDays(straightIn.model.levels.flatMap(l=>l.inlays??[]),'Herringbone',320);
  ok(daysS.inside===0,'A plainer inside never lowers the labour');
  ok(e.sections.find(s=>s.title.startsWith('Labour'))!.items[0].spec.includes('crew-days for inlays'),'The labour line says how much is for inlays');
}

// 7. Stock: inlay boards are their own order, at the allowance of what they are.
{
  const d=base({inlays:[rug({pattern:'Herringbone',frame:'tt_prime_plus:Dark Cocoa'})]}),e=price(d),s=e.sections.find(x=>x.title==='Accent colours & inlays')!;
  ok(s&&s.items.some(i=>i.name==='Inlay frame · TimberTech EDGE Prime+ · Dark Cocoa')&&s.items.some(i=>i.name==='Inlay inside, herringbone · TimberTech EDGE Prime+ · Coconut Husk'),'The frame and the inside are ordered as their own boards, in their colours');
  const frameRow=e.stockSchedule.find(r=>r.name.startsWith('Inlay frame'))!,cuts=frameRow.cutsIn.flat().reduce((n,c)=>n+c,0)/12;
  ok(frameRow.orderedPieces>=Math.ceil(cuts*1.22/16),'The frame carries the picture-frame waste allowance (×1.22)');
  const inlayPieces=e.model.levels[0].boards.filter(b=>b.inlay).length,main=e.stockSchedule[0].cutsIn.flat().length;
  ok(main+e.stockSchedule.filter(r=>r.name.startsWith('Inlay')).reduce((n,r)=>n+r.cutsIn.flat().length,0)===e.model.levels[0].boards.length&&inlayPieces>0,'Every deck board is ordered once: the main order or an inlay order');
  ok(s.items.every(i=>i.cost!==0),'No inlay line is priced at $0');
}

// 8. Words and wiring.
{
  const d=base({inlays:[rug({pattern:'Herringbone'}),diamond({dxFt:6,widthFt:3,depthFt:3})]}),e=price(d);
  ok(describeDesign(d,e).facts.includes('Inlays: a 6 × 4 ft framed rectangle with a herringbone inside; a 3 ft diamond with boards running front to back inside'),'The design facts name each built inlay');
  ok(designFeatures(d).includes('deck_inlay_rug')&&designFeatures(d).includes('deck_inlay_diamond'),'The funnel counts each inlay kind');
  for(const f of ['src/features/deckcraft/lib/inlayGeometry.ts','src/features/deckcraft/inlayFraming.ts'])ok(!/from ['"]three|@react-three/.test(read(f)),`${f} does not import three.js`);
  const viewer=read('src/features/deckcraft/components/viewer3d/Deck3DViewer.tsx'),plan=read('src/features/deckcraft/ConstructionPlan.tsx'),designer=designerSource();
  ok(viewer.includes('name="inlay-blocking"'),'The 3D framing view draws inlay framing in its own colour');
  ok(plan.includes('Amber: inlay blocking')&&plan.includes('`Inlay ${k+1}`'),'The plan draws and names each inlay and its framing');
  ok(/lazy\(loadInlayEditor\)/.test(designer)&&read('scripts/check-deck-bundle.ts').includes('/^InlayEditor-/'),'The inlay editor loads on demand, off the page\'s first load');
  ok(read('src/features/deckcraft/constructionDetails.ts').includes('if(onInlaySupport((face?'),'Board ends on inlay framing get no second block');
}

console.log(`DECK INLAYS OK — ${designs} framed inlay designs (${kinds.length} kinds × ${patterns.length} patterns × ${shapes.length} shapes), placement, fit, saving, labour, stock, words and wiring; ${checks} checks.`);
