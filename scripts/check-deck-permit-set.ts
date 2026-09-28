import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {jsPDF} from 'jspdf';
import {BUSINESS,publicContact} from '../src/data/business';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {deckAttachesToHouse,getHouseContact} from '../src/features/deckcraft/houseContact';
import type {DeckData} from '../src/features/deckcraft/types';
import {DETAIL_SCALES,SCALES,SHEET,feetInches,type DrawItem,type DrawingSet,type LayerId} from '../src/features/deckcraft/drawings/drawingTypes';
import {ledgerFlashing} from '../src/features/deckcraft/drawings/pricedParts';
import {elevationSolids} from '../src/features/deckcraft/drawings/elevations';
import {hiddenPoint,viewLines,viewSolids,type ElevationView,type Solid} from '../src/features/deckcraft/drawings/hiddenLines';
import {typicalSection} from '../src/features/deckcraft/drawings/typicalSection';
import {PERMIT_FOOTER,buildPermitSet} from '../src/features/deckcraft/drawings/permitSheets';
import {paperLayout} from '../src/features/deckcraft/drawings/paperLayout';
import {buildPermitDxf} from '../src/features/deckcraft/drawings/renderDxf';
import {buildPermitPdf} from '../src/features/deckcraft/drawings/renderPdf';
import {legacyScenarios} from './deck-legacy-scenarios';

// The permit drawing set (drawings/): every priced footing, post and member is on its sheet and layer, each sheet fits a
// standard scale, the title block carries business.ts facts, no text claims a review outcome, the DXF reads back
// layer for layer, and the PDF has one page per sheet. The elevations' hidden-line removal is checked on scenes with
// known answers and, on every design, against a brute-force visibility test; the typical section against the framing
// it is drawn from. `--update` rewrites the per-sheet golden after a reviewed drawing change.
let checks=0;const ok=(cond:unknown,msg:string)=>{assert(cond,msg);checks++;};
const GOLDEN=new URL('./deck-permit-set-golden.json',import.meta.url),update=process.argv.includes('--update');
const BANNED=/\b(code[- ]compliant|permit[- ]ready|engineered|stamped|approved|certified|guaranteed)\b/i;

const legacy=legacyScenarios(),pick=(name:string)=>{const p=legacy[name];assert(p,`legacy scenario ${name}`);return p;};
const fixtures:Record<string,Partial<DeckData>>={
  default:{},
  'L-shape freestanding 2 levels':pick('std/L-Shape/Straight/Straight/freestanding-2lvl'),
  'curved attached':pick('big/Curved/Straight/Straight/attached'),
  'multi-corner winder':pick('std/Multi-corner/Diagonal/Winder/attached'),
  'rectangle landing':pick('std/Rectangle/Picture Frame/Landing/attached'),
  'wrap-around':{width:34,length:12,wrap:{left:{widthFt:8,runFt:10}}},
  'low flush deck':{height:14},
  'walkout 8 ft':{height:96,width:20,length:15},
  'deck blocks':{foundation:'Deck Blocks',height:18},
  'helical piles':{foundation:'Helical Piles'},
  'no railing':{railingType:'None'},
  'glass railing':pick('railing/glass'),
  'frameless glass':{railingType:'Frameless Glass'},
  'add-on deck':{deckType:'Add-on'},
};

const count=(items:DrawItem[],layer:LayerId,kind?:DrawItem['kind'])=>items.filter(i=>i.layer===layer&&(!kind||i.kind===kind)).length;
const stable=(v:unknown)=>JSON.stringify(v,(_k,x)=>typeof x==='number'?Math.round(x*1e4)/1e4:x);

/** A minimal DXF R12 reader: group-code pairs, entity types per layer, and the layer table. */
function readDxf(text:string){
  const lines=text.split('\n'),pairs:[number,string][]=[];
  for(let i=0;i+1<lines.length;i+=2)pairs.push([Number(lines[i]),lines[i+1]]);
  const sections:string[]=[],layers=new Set<string>(),entities:{type:string;layer:string;block?:string}[]=[];let section='',current:{type:string;layer:string;block?:string}|null=null,inLayerTable=false,depth=0;
  for(let i=0;i<pairs.length;i++){const [c,v]=pairs[i];
    if(c===0&&v==='SECTION'){section=pairs[i+1][1];sections.push(section);depth++;}
    if(c===0&&v==='ENDSEC')depth--;
    if(c===0&&v==='TABLE')inLayerTable=pairs[i+1][1]==='LAYER';
    if(c===0&&v==='ENDTAB')inLayerTable=false;
    if(inLayerTable&&c===0&&v==='LAYER')layers.add(pairs[i+1][1]);
    if(section==='ENTITIES'&&c===0){if(current)entities.push(current);current=['SECTION','VERTEX','SEQEND','ENDSEC','EOF'].includes(v)?null:{type:v,layer:''};}
    if(current&&c===8)current.layer=v;if(current&&c===2)current.block=v;
  }
  if(current)entities.push(current);
  return {header:pairs.find(([c,v],i)=>c===9&&v==='$ACADVER'&&pairs[i+1])?pairs[pairs.findIndex(([c,v])=>c===9&&v==='$ACADVER')+1][1]:'',sections,layers,entities,balanced:depth===0&&pairs.at(-1)?.[1]==='EOF'};
}

// Hidden-line removal on scenes with known answers (front view: u = x, v = y, the viewer at +z).
{
  const box=(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,layer:LayerId='S-POST'):Solid=>({layer,
    vertices:[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]].map(([x,y,z])=>({x,y,z})),
    faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]});
  const total=(ls:{a:{x:number;y:number};b:{x:number;y:number}}[])=>ls.reduce((n,l)=>n+Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y),0);
  const front=(solids:Solid[])=>viewLines(solids,'front');
  ok(Math.abs(total(front([box(0,10,0,20,0,5)]))-60)<1e-6&&front([box(0,10,0,20,0,5)]).length===4,'Hidden lines: a lone box shows its outline, 4 lines');
  ok(front([box(0,40,0,40,10,12,'S-BEAM'),box(10,20,10,20,0,5)]).filter(l=>l.layer==='S-POST').length===0,'Hidden lines: a box behind a larger one is hidden entirely');
  // Behind a wall at x <= 15: the back box (x 10-30, y 0-10) keeps its right part: top and bottom 15 each, right side 10.
  const partial=front([box(-10,15,-5,20,10,12,'S-BEAM'),box(10,30,0,10,0,5)]).filter(l=>l.layer==='S-POST');
  ok(Math.abs(total(partial)-40)<1e-6,`Hidden lines: a partly covered box shows only its uncovered edges (${total(partial)})`);
  // Coplanar triangles: a square face split on its diagonal draws no diagonal.
  const split:Solid={layer:'A-HOUS',vertices:[[0,0,0],[10,0,0],[10,10,0],[0,10,0]].map(([x,y,z])=>({x,y,z})),faces:[[0,1,2],[0,2,3]]};
  ok(front([split]).length===4&&Math.abs(total(front([split]))-40)<1e-6,'Hidden lines: coplanar triangles draw no diagonal');
  // A plane behind a box: its edges run behind the box and are cut there.
  const plane:Solid={layer:'A-HOUS',vertices:[[-20,0,-10],[20,0,-10],[20,30,-10],[-20,30,-10]].map(([x,y,z])=>({x,y,z})),faces:[[0,1,2,3]]};
  ok(Math.abs(total(front([plane,box(-5,5,-2,40,0,4)]).filter(l=>l.layer==='A-HOUS'))-120)<1e-6,'Hidden lines: a plane\'s edges are cut where a nearer box crosses them');
  // A 16-sided pier: only its two silhouettes (and edge-on caps) are drawn, never the facets between.
  const n=16,pier:Solid={layer:'S-FTNG',belowGrade:'S-FTNG-HIDN',vertices:[-48,2].flatMap(y=>Array.from({length:n},(_,i)=>({x:Math.cos(i/n*2*Math.PI)*6,y,z:Math.sin(i/n*2*Math.PI)*6}))),
    faces:[Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>i+n),...Array.from({length:n},(_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])]};
  const pierLines=front([pier]),verticals=pierLines.filter(l=>Math.abs(l.a.x-l.b.x)<1e-6);
  ok(verticals.filter(l=>l.layer==='S-FTNG-HIDN').length===2&&verticals.filter(l=>l.layer==='S-FTNG').length===2,`Hidden lines: a pier shows its two silhouettes, split at grade (${verticals.length} verticals)`);
  ok(pierLines.every(l=>l.layer==='S-FTNG'?Math.min(l.a.y,l.b.y)>=-1e-9:Math.max(l.a.y,l.b.y)<=1e-9),'Hidden lines: below grade is dashed, above is solid');
}

type Digest=Record<string,string>;
const golden:Record<string,Digest>=existsSync(GOLDEN)?JSON.parse(readFileSync(GOLDEN,'utf8')):{},current:Record<string,Digest>={};
const digest=(v:unknown)=>createHash('sha256').update(stable(v)).digest('hex').slice(0,16);
let slowest=0,oracleSamples=0,oracleSkipped=0;
for(const [name,patch] of Object.entries(fixtures)){
  const data:DeckData={...structuredClone(DEFAULT_DECK),...patch},e=calculateEstimate(data),model=e.model;
  const t0=performance.now();
  const set:DrawingSet=buildPermitSet({data,model,reviewItems:e.flags,materialName:'Test decking',railingName:'Test railing',date:'September 28, 2026',priceBook:'2026-09-28'});
  slowest=Math.max(slowest,performance.now()-t0);
  const [a1,s1,s2,s3,s4,s5]=set.sheets,tag=name;
  ok(set.sheets.map(s=>s.id).join()==='A-1,S-1,S-2,S-3,S-4,S-5',`${tag}: sheets A-1, S-1 to S-5`);
  for(const s of set.sheets){
    const w=(s.extents.maxX-s.extents.minX)/s.ratio,h=(s.extents.maxY-s.extents.minY)/s.ratio;
    ok([...DETAIL_SCALES,...SCALES].some(x=>x.ratio===s.ratio&&x.label===s.scaleLabel)&&(w<=SHEET.area.w+1e-9&&h<=SHEET.area.h+1e-9||s.ratio===SCALES.at(-1)!.ratio),`${tag} ${s.id}: fits at ${s.scaleLabel}`);
    ok(s.notes.length>0&&s.legend.length>0,`${tag} ${s.id}: notes and legend`);
    const texts=[...s.items.flatMap(i=>i.kind==='text'||i.kind==='dim'?[i.text]:[]),...s.notes,set.footer,...paperLayout(set,s,0).flatMap(p=>p.kind==='text'?[p.text]:[])];
    ok(texts.every(t=>!BANNED.test(t)),`${tag} ${s.id}: no text claims a review outcome (${texts.find(t=>BANNED.test(t))})`);
    const paper=paperLayout(set,s,set.sheets.indexOf(s)).flatMap(p=>p.kind==='text'?[p.text]:[]).join(' ');
    ok(paper.includes(set.reviewItems.length?'DRAFT':'PLANNING DRAWING')&&paper.includes(s.id)&&paper.includes(s.scaleLabel),`${tag} ${s.id}: stamp, sheet number and scale on the sheet`);
    // Notes (0.072 in text) end above the footer (0.065 in text).
    const prims=paperLayout(set,s,0).flatMap(p=>p.kind==='text'?[p]:[]),notesEnd=Math.max(...prims.filter(p=>p.size===.072).map(p=>p.at.y)),footerTop=Math.min(...prims.filter(p=>p.size===.065).map(p=>p.at.y));
    ok(notesEnd<footerTop-.25,`${tag} ${s.id}: the notes end above the footer (${notesEnd.toFixed(2)} < ${footerTop.toFixed(2)})`);
  }
  ok(set.footer===PERMIT_FOOTER&&set.firm.name===BUSINESS.publicName.value&&set.firm.phone===publicContact.phoneDisplay&&set.firm.email===publicContact.email,`${tag}: title block facts come from business.ts`);
  // Every priced part is drawn, once, on its layer.
  const levels=model.levels,footings=model.quantities.footings;
  ok(count(s1.items,'S-FTNG','symbol')===footings&&count(s1.items,'S-POST','symbol')===footings,`${tag}: S-1 draws ${footings} footings and posts`);
  ok(s1.items.filter(i=>i.kind==='symbol'&&i.layer==='S-FTNG').every(i=>i.kind==='symbol'&&i.name===(data.foundation==='Deck Blocks'?'BLOCK':'FOOTING')),`${tag}: footing symbol matches ${data.foundation}`);
  const joists=levels.reduce((n,l)=>n+l.joists.length+(l.rim?.length??0),0),beams=levels.reduce((n,l)=>n+l.beams.length+(l.hips?.length??0),0),blocking=levels.reduce((n,l)=>n+l.blocking.length,0);
  ok(count(s2.items,'S-JOIS','line')===joists&&count(s2.items,'S-BEAM','line')===beams&&count(s2.items,'S-BLKG','line')===blocking,`${tag}: S-2 draws ${joists} joists and rims, ${beams} beam plies and hips, ${blocking} blocks`);
  const ledgers=data.houseVisible===false?0:getHouseContact(data,levels[0].footprint).contacts.length;
  ok(count(s2.items,'S-LEDG','line')===ledgers,`${tag}: S-2 draws ${ledgers} ledger and flush-wall contacts`);
  ok(count(s3.items,'A-STRS','poly')===model.treads.length&&count(s3.items,'A-RAIL','symbol')===model.railing.posts.length,`${tag}: S-3 draws ${model.treads.length} treads and ${model.railing.posts.length} guard posts`);
  ok(data.railingType!=='None'||s3.notes.some(n=>/OBC 9\.8\.8\.1/.test(n)),`${tag}: a deck with no guard says when the code needs one`);
  // A-1: three views, each on its grade with its title and the main deck's height; guard, footing depth and datums.
  const a1Text=(t:string)=>a1.items.filter(i=>i.kind==='text'&&i.text===t).length,a1Dims=(t:string)=>a1.items.filter(i=>i.kind==='dim'&&i.text===t).length;
  ok(['FRONT ELEVATION','LEFT SIDE ELEVATION','RIGHT SIDE ELEVATION'].every(t=>a1Text(t)===1)&&a1Text('GRADE')===3&&count(a1.items,'C-TOPO','line')===3,`${tag}: A-1 draws the front and both sides, each on its grade`);
  ok(a1Dims(feetInches(levels[0].top))===3,`${tag}: A-1 dimensions the deck surface (${feetInches(levels[0].top)}) on every view`);
  const guarded=data.railingType!=='None'&&model.railing.rails.length+model.railing.glass.length>0;
  ok(a1Dims(`${feetInches(model.railing.height)} guard`)===(guarded?2:0),`${tag}: A-1 dimensions the ${model.railing.height} in guard on the front and left views`);
  const footingDepth=data.foundation==='Deck Blocks'?0:data.foundationDepthIn??48;
  ok(a1Dims(`${feetInches(footingDepth)} below grade`)===(footingDepth?1:0),`${tag}: A-1 dimensions the footing depth below grade`);
  ok([...new Set(levels.map(l=>Math.round(l.top*2)/2))].every(t=>a1.items.some(i=>i.kind==='text'&&i.text.endsWith(`+${feetInches(t)}`))),`${tag}: A-1 marks every walking surface's height`);
  // Each view draws the parts the design has: decking, posts, footings (dashed below grade), guard and stairs.
  const solids=elevationSolids(data,model),posts=levels.some(l=>l.supports.some(p=>p.y>(data.foundation==='Deck Blocks'?7:5)));
  for(const view of ['front','left','right'] as ElevationView[]){
    const lines=viewLines(solids,view),has=(layer:LayerId)=>lines.some(l=>l.layer===layer);
    ok(has('A-DECK-FNSH')&&(!posts||has('S-POST'))&&(footingDepth?has('S-FTNG-HIDN'):has('S-FTNG'))&&(!guarded||has('A-RAIL'))&&(!model.treads.length||view!=='front'||has('A-STRS')),`${tag} ${view}: decking, posts, footings, guard and stairs in view`);
    // The visibility of sampled points on every candidate edge agrees with a brute-force test against every face.
    const {edges,occluders}=viewSolids(solids,view),stride=Math.max(1,Math.floor(edges.length/700));
    for(let k=0;k<edges.length;k+=stride){const e=edges[k],len=Math.hypot(e.b.u-e.a.u,e.b.v-e.a.v);
      // Pieces under 0.05 in are not drawn at all, so an edge too short to sample around is not compared.
      if(len<.5)continue;
      for(const t of [.23,.5,.77]){
        const at=(q:number)=>({u:e.a.u+(e.b.u-e.a.u)*q,v:e.a.v+(e.b.v-e.a.v)*q,d:e.a.d+(e.b.d-e.a.d)*q}),dt=.1/len;
        const votes=[t-dt,t,t+dt].map(q=>hiddenPoint(occluders,at(q)));
        if(votes.some(v=>v!==votes[0])){oracleSkipped++;continue;}
        const shown=e.visible.some(([p,q])=>t>=p&&t<=q);oracleSamples++;
        ok(shown===!votes[0],`${tag} ${view}: edge ${k} at ${t} is ${shown?'drawn':'hidden'} but a brute-force test says ${votes[0]?'hidden':'visible'}`);
      }
    }
  }
  // S-4: the typical section is its framing zone: plies, posts and footings per row, the bays dimensioned, ledger or not.
  const section=typicalSection(data,model,{materialName:'Test decking',railingName:'Test railing'},{x:0,y:0}),ref=section.reference,rows=ref.beamRows.length;
  const blocksOnly=data.foundation==='Deck Blocks',helical=data.foundation==='Helical Piles',hasPosts=ref.beamBottomIn>(blocksOnly?6.5:4.5)+.5;
  ok(count(s4.items,'S-BEAM','poly')===rows*ref.beam.plies,`${tag}: S-4 cuts ${rows} beam row${rows===1?'':'s'} of ${ref.beam.plies} plies`);
  ok(count(s4.items,'S-FTNG','poly')===rows*(helical?2:1)&&count(s4.items,'S-POST','poly')===(hasPosts?2:0)*rows+(blocksOnly?0:rows),`${tag}: S-4 has a footing${hasPosts?' and a post':''} under every row`);
  ok(section.attached===deckAttachesToHouse(data)&&(count(s4.items,'S-LEDG','poly')>0)===section.attached,`${tag}: S-4 shows ${section.attached?'the ledger':'the house-side beam of a freestanding deck'}`);
  const chain=[0,...ref.beamRows.map(r=>r.z),section.depthIn],bays=chain.slice(1).map((z,i)=>z-chain[i]).filter(n=>n>=3);
  const drawnBays=s4.items.flatMap(i=>i.kind==='dim'&&i.offset===0?[Math.abs(i.b.x-i.a.x)]:[]);
  ok(drawnBays.length===bays.length&&drawnBays.every((n,i)=>Math.abs(n-bays[i])<1e-6),`${tag}: S-4 dimensions each bay from the house to the front edge`);
  ok(s4.items.some(i=>i.kind==='dim'&&i.text===feetInches(levels[0].top))&&(!guarded||s4.items.some(i=>i.kind==='dim'&&i.text===`${feetInches(model.railing.height)} guard`))&&(!footingDepth||s4.items.some(i=>i.kind==='dim'&&i.text===feetInches(footingDepth))),`${tag}: S-4 dimensions the deck height, guard and footing depth`);
  const spacing=data.pattern==='Diagonal'||data.pattern==='Herringbone'?12:data.joistSpacing;
  ok(s4.items.some(i=>i.kind==='text'&&i.text===`${data.framingSize} joists @ ${spacing}" o.c.`)&&s2.items.some(i=>i.kind==='text'&&i.text===`${data.framingSize} joists @ ${spacing}" o.c.`),`${tag}: S-2 and S-4 name the joists at their framed spacing (${spacing} in)`);
  // S-5: the details this design needs, in order, each dimensioned from the design.
  const ledgerDesign=data.houseVisible!==false&&getHouseContact(data,levels[0].footprint).contacts.some(x=>x.kind==='ledger');
  const titles=s5.items.flatMap(i=>i.kind==='text'&&/^\d+  /.test(i.text)?[i.text.replace(/^\d+  /,'')]:[]);
  const expected=[ledgerDesign?'LEDGER CONNECTION':'FREESTANDING AT THE HOUSE',hasPosts?'BEAM ON POST':'BEAM ON FOOTING','FOOTING',...(data.railingType==='None'?[]:[model.railing.frameless?'GLASS GUARD':'GUARD POST']),...(model.stringers.some(m=>m.stair)?['STAIR STRINGER']:[]),'DECKING AND FASTENING'];
  ok(titles.join()===expected.join(),`${tag}: S-5 details ${expected.join(', ')} (got ${titles.join(', ')})`);
  ok(DETAIL_SCALES.some(x=>x.ratio===s5.ratio),`${tag}: S-5 is at a detail scale (${s5.scaleLabel})`);
  const s5Dims=s5.items.flatMap(i=>i.kind==='dim'?[i.text]:[]),stair=model.stringers.find(m=>m.stair)?.stair;
  ok((!footingDepth||s5Dims.includes(`${feetInches(footingDepth)} below grade`))&&(!guarded||s5Dims.includes(`${feetInches(model.railing.height)} guard`)),`${tag}: S-5 dimensions the footing depth and guard height`);
  ok(!stair||(s5Dims.includes(`${stair.run.toFixed(2)}" run`)&&(stair.risers<2||s5Dims.includes(`${stair.rise.toFixed(2)}" rise`))),`${tag}: S-5 dimensions the stair's rise and run`);
  // The ledger flashing is labelled as the estimate carries it, on S-4 and S-5; no sheet calls the ledger flashed.
  const flashItem=e.sections.flatMap(sec=>sec.items).find(i=>i.name==='Ledger Flashing'),flashPriced=!!flashItem&&Number(flashItem.qty)>0&&flashItem.cost!==null&&flashItem.cost>0;
  const flashLabel=ledgerFlashing(data).label,flashQuote=!!data.catalogueAccessories?.includes('tt_protac_flashing');
  ok(flashLabel===(flashQuote?'Flashing (supplier quote)':flashPriced?'Flashing (priced)':'Flashing (not in this estimate)'),`${tag}: the flashing label (${flashLabel}) matches the estimate`);
  ok(!ledgerDesign||[s4,s5].every(sh=>sh.items.some(i=>i.kind==='text'&&i.text===flashLabel)),`${tag}: S-4 and S-5 label the ledger flashing`);
  ok(set.sheets.every(sh=>[...sh.notes,...sh.items.flatMap(i=>i.kind==='text'?[i.text]:[])].every(t=>!/\bflashed\b/i.test(t))),`${tag}: no sheet calls the ledger flashed`);
  // S-5's connection note lists each part with the estimate's count, under the estimate's status.
  const note=s5.notes.find(n=>n.startsWith('Connections shown'))??'',headings=['In this estimate:','Supplier quote:','Confirm in the railing kit:'];
  const partRows=e.connectorSchedule.filter(r=>['Joist hangers','Ledger bolts','Post anchors','Joist-to-beam ties','Post-to-beam caps','Stringer connectors','Railing post anchors/bolts','Deck screws','Hidden clips'].includes(r.name));
  for(const r of partRows){
    const at=note.indexOf(`${r.name.toLowerCase()} (${r.qty})`),heading=headings.map(h=>({h,i:note.lastIndexOf(h,at)})).sort((p,q)=>q.i-p.i)[0].h;
    const quotedClips=r.name==='Hidden clips'&&data.catalogueAccessories?.some(id=>id==='tt_concealoc'||id==='dk_stealthlock');
    const want=quotedClips?'Supplier quote:':r.rate!==null||r.basis.startsWith('Priced by')?'In this estimate:':r.basis.startsWith('Confirm inclusion')?'Confirm in the railing kit:':'Supplier quote:';
    ok(at>=0&&heading===want,`${tag}: S-5 lists ${r.name} (${r.qty}) under "${want}"`);
  }
  // Section 1 is marked on S-2 at both ends, between joists.
  ok(s2.items.filter(i=>i.kind==='text'&&i.text==='1/S-4').length===2,`${tag}: S-2 marks section 1 at both ends`);
  ok(levels[0].joists.every(j=>!(Math.abs(j.a.x-j.b.x)<1e-6&&Math.abs(j.a.x-section.mark.x)<1.5)),`${tag}: section 1 is cut between the main deck's joists (x ${section.mark.x.toFixed(1)})`);
  // The DXF reads back: R12, balanced sections, every layer declared, entity counts per layer.
  const dxf=readDxf(buildPermitDxf(set)),byLayer=(layer:string,type:string)=>dxf.entities.filter(x=>x.layer===layer&&x.type===type).length;
  ok(dxf.header==='AC1009'&&dxf.balanced&&dxf.sections.join()==='HEADER,TABLES,BLOCKS,ENTITIES',`${tag}: DXF R12 with balanced sections`);
  ok(dxf.entities.every(x=>dxf.layers.has(x.layer)),`${tag}: every DXF entity is on a declared layer`);
  ok(byLayer('S-FTNG','INSERT')===footings&&byLayer('S-POST','INSERT')===footings,`${tag}: DXF footing and post inserts`);
  const unique=(layer:LayerId,kind:DrawItem['kind'])=>new Set(set.sheets.flatMap(sh=>sh.items.filter(i=>i.layer===layer&&i.kind===kind).map(i=>JSON.stringify(i)))).size;
  for(const layer of ['S-JOIS','S-BEAM','S-FRMG','S-POST','A-RAIL','A-DECK-FNSH','C-TOPO','S-FTNG-HIDN'] as LayerId[])
    ok(byLayer(layer,'LINE')===unique(layer,'line')&&byLayer(layer,'POLYLINE')===unique(layer,'poly'),`${tag}: DXF ${layer} lines and polylines match the sheets`);
  current[name]={set:digest({...set,sheets:[]}),...Object.fromEntries(set.sheets.map(sh=>[sh.id,digest(sh)]))};
}

// The PDF: one 11 × 17 page per sheet, text included (a design with every sheet type).
{
  const data={...structuredClone(DEFAULT_DECK)},e=calculateEstimate(data);
  const set=buildPermitSet({data,model:e.model,reviewItems:[],materialName:'Test decking',railingName:'Test railing',date:'September 28, 2026',priceBook:'2026-09-28'});
  const pdf=Buffer.from(buildPermitPdf(jsPDF,set)).toString('latin1');
  ok(pdf.startsWith('%PDF-')&&(pdf.match(/\/Type \/Page\b/g)??[]).length===6,'The permit PDF has six pages');
  ok(/\/MediaBox \[0 0 1224\.?\d* 792\.?\d*\]/.test(pdf),'Its pages are 11 × 17 in landscape');
  // The takeoff's own issues always join the review list; the stamp follows the list.
  ok(set.reviewItems.length>=e.model.issues.length&&e.model.issues.every(i=>set.reviewItems.includes(i)),'The takeoff issues are review items');
  const clean={...set,reviewItems:[]};ok(paperLayout(clean,clean.sheets[0],0).some(p=>p.kind==='text'&&p.text==='PLANNING DRAWING'),'With no review items the stamp reads PLANNING DRAWING');
}
ok(oracleSkipped<oracleSamples*.02,`Brute-force samples on a visibility boundary stay rare (${oracleSkipped} of ${oracleSamples+oracleSkipped})`);

if(update){writeFileSync(GOLDEN,JSON.stringify(current,null,1)+'\n');console.log('Permit set golden written.');}
else{
  ok(existsSync(GOLDEN),'deck-permit-set-golden.json exists (run with --update after a reviewed drawing change)');
  for(const [name,sheets] of Object.entries(current))for(const [id,d] of Object.entries(sheets))ok(golden[name]?.[id]===d,`${name} ${id}: the drawing matches its golden (run --update after reviewing a drawing change)`);
}
console.log(`DECK PERMIT SET OK: ${checks} checks. ${Object.keys(fixtures).length} designs drawn as A-1 and S-1 to S-5 with every priced footing, post and member on its layer; elevations' hidden lines agree with ${oracleSamples} brute-force samples; DXF R12 read back; six-page 11 × 17 PDF. Slowest set ${slowest.toFixed(0)} ms.`);
