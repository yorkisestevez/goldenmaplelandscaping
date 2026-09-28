import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {jsPDF} from 'jspdf';
import {BUSINESS,publicContact} from '../src/data/business';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {deckAttachesToHouse,getHouseContact} from '../src/features/deckcraft/houseContact';
import type {DeckData} from '../src/features/deckcraft/types';
import {DETAIL_SCALES,NTS,SCALES,SHEET,SITE_SCALES,feetInches,type DrawItem,type DrawingSet,type LayerId,type Pt} from '../src/features/deckcraft/drawings/drawingTypes';
import {sitePlan} from '../src/features/deckcraft/drawings/sitePlan';
import {houseOutline} from '../src/features/deckcraft/houseFootprint';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {estimateKeyOf} from '../src/features/deckcraft/designer/useDeckEstimate';
import {ledgerFlashing} from '../src/features/deckcraft/drawings/pricedParts';
import {elevationSolids} from '../src/features/deckcraft/drawings/elevations';
import {hiddenPoint,viewLines,viewSolids,type ElevationView,type Solid} from '../src/features/deckcraft/drawings/hiddenLines';
import {typicalSection} from '../src/features/deckcraft/drawings/typicalSection';
import {beamLines,scheduleTables} from '../src/features/deckcraft/drawings/schedules';
import {partStatus} from '../src/features/deckcraft/drawings/pricedParts';
import {connectorSchedule,constructionStock} from '../src/features/deckcraft/schedule';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {PERMIT_FOOTER,buildPermitSet} from '../src/features/deckcraft/drawings/permitSheets';
import {paperLayout} from '../src/features/deckcraft/drawings/paperLayout';
import {buildPermitDxf} from '../src/features/deckcraft/drawings/renderDxf';
import {buildPermitPdf} from '../src/features/deckcraft/drawings/renderPdf';
import {legacyScenarios} from './deck-legacy-scenarios';

// The permit drawing set (drawings/): every priced footing, post and member is on its sheet and layer, each sheet fits a
// standard scale, the title block carries business.ts facts, no text claims a review outcome, the DXF reads back
// layer for layer, and the PDF has one page per sheet. The elevations' hidden-line removal is checked on scenes with
// known answers and, on every design, against a brute-force visibility test; the typical section against the framing
// it is drawn from. The site plan's lot lines and the deck's setbacks are measured again from the entered lot and the
// drawn deck, and a lot not entered, or a deck over a lot line, stamps the set DRAFT. `--update` rewrites the per-sheet
// golden after a reviewed drawing change.
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
  // With a lot for the site plan (A-0).
  'lot 50 x 120, yard south':{permitSite:{lotWidthFt:50,lotDepthFt:120,leftYardFt:10,rearYardFt:40,yardFaces:'S'}},
  'lot corner, wrap-around':{width:34,length:12,wrap:{left:{widthFt:8,runFt:10}},permitSite:{lotWidthFt:66,lotDepthFt:110,leftYardFt:12,rearYardFt:35,yardFaces:'W',corner:'left'}},
  'lot L-shape, yard northeast':{...pick('std/L-Shape/Straight/Straight/freestanding-2lvl'),permitSite:{lotWidthFt:60,lotDepthFt:130,leftYardFt:8,rearYardFt:30,yardFaces:'NE',corner:'right'}},
  'lot too shallow, no north':{permitSite:{lotWidthFt:40,lotDepthFt:100,leftYardFt:4,rearYardFt:14}},
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
  const [a0,a1,s1,s2,s3,s4,s5,s6]=set.sheets,tag=name;
  ok(set.sheets.map(s=>s.id).join()==='A-0,A-1,S-1,S-2,S-3,S-4,S-5,S-6',`${tag}: sheets A-0, A-1, S-1 to S-6`);
  for(const s of set.sheets){
    const w=(s.extents.maxX-s.extents.minX)/s.ratio,h=(s.extents.maxY-s.extents.minY)/s.ratio;
    // The schedules are tables, not to scale; they still have to fit the drawing area.
    ok(s.id==='S-6'?s.scaleLabel===NTS&&w<=SHEET.area.w+1e-9&&h<=SHEET.area.h+1e-9:[...DETAIL_SCALES,...SITE_SCALES].some(x=>x.ratio===s.ratio&&x.label===s.scaleLabel)&&(w<=SHEET.area.w+1e-9&&h<=SHEET.area.h+1e-9||s.ratio===(s.id==='A-0'?SITE_SCALES:SCALES).at(-1)!.ratio),`${tag} ${s.id}: fits at ${s.scaleLabel} (${w.toFixed(2)} x ${h.toFixed(2)} in)`);
    ok(s.id==='A-0'||s.id==='S-6'||[...DETAIL_SCALES,...SCALES].some(x=>x.ratio===s.ratio),`${tag} ${s.id}: only the site plan uses an engineer's scale`);
    ok(s.notes.length>0&&(s.legend.length>0||s.id==='S-6'),`${tag} ${s.id}: notes and legend`);
    const texts=[...s.items.flatMap(i=>i.kind==='text'||i.kind==='dim'?[i.text]:[]),...s.notes,set.footer,...paperLayout(set,s,0).flatMap(p=>p.kind==='text'?[p.text]:[])];
    ok(texts.every(t=>!BANNED.test(t)),`${tag} ${s.id}: no text claims a review outcome (${texts.find(t=>BANNED.test(t))})`);
    const paper=paperLayout(set,s,set.sheets.indexOf(s)).flatMap(p=>p.kind==='text'?[p.text]:[]).join(' ');
    ok(paper.includes(set.reviewItems.length?'DRAFT':'PLANNING DRAWING')&&paper.includes(s.id)&&paper.includes(s.scaleLabel===NTS?'NOT TO SCALE':s.scaleLabel),`${tag} ${s.id}: stamp, sheet number and scale on the sheet`);
    // Notes (0.072 in text) end above the footer (0.065 in text), both in the title block.
    const prims=paperLayout(set,s,0).flatMap(p=>p.kind==='text'&&p.at.x>SHEET.w-SHEET.margin-SHEET.titleW?[p]:[]),notesEnd=Math.max(...prims.filter(p=>p.size===.072).map(p=>p.at.y)),footerTop=Math.min(...prims.filter(p=>p.size===.065).map(p=>p.at.y));
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
  // A-0: the house, every level and tread; the lot lines where the lot is entered, and the deck's setbacks to them.
  const site=sitePlan(data,model),houseRings=houseOutline(data),lot=data.permitSite;
  ok(JSON.stringify(a0.items)===JSON.stringify(site.items)&&SITE_SCALES.some(x=>x.ratio===a0.ratio),`${tag}: A-0 is the site plan at a site scale (${a0.scaleLabel})`);
  ok(count(a0.items,'A-HOUS','poly')===houseRings.length&&count(a0.items,'A-DECK-OTLN','poly')===levels.length&&count(a0.items,'A-STRS','poly')===model.treads.length,`${tag}: A-0 draws the house, ${levels.length} level outlines and ${model.treads.length} treads`);
  const a0Texts=a0.items.flatMap(i=>i.kind==='text'||i.kind==='dim'?[i.text]:[]),siteIssues=set.reviewItems.filter(i=>i.startsWith('Site plan:'));
  ok(a0Texts.includes('PROPOSED DECK')&&a0Texts.includes('EXISTING HOUSE'),`${tag}: A-0 names the proposed deck and the existing house`);
  if(!lot){
    ok(count(a0.items,'C-PROP')===0&&a0Texts.includes('PROPERTY LINES NOT ENTERED')&&!a0.legend.includes('C-PROP'),`${tag}: A-0 without a lot draws no lot lines and says so`);
    ok(siteIssues.length===1&&/enter the lot/.test(siteIssues[0]),`${tag}: a lot not entered is a review item, so the set is stamped DRAFT`);
  }else{
    const hMinX=Math.min(...houseRings.flat().map(q=>q.x)),L=hMinX-lot.leftYardFt*12,R=L+lot.lotWidthFt*12,B=lot.rearYardFt*12,F=B-lot.lotDepthFt*12;
    const prop=a0.items.filter(i=>i.kind==='poly'&&i.layer==='C-PROP') as Extract<DrawItem,{kind:'poly'}>[];
    ok(prop.length===1&&prop[0].closed&&JSON.stringify(prop[0].points)===JSON.stringify([{x:L,y:F},{x:R,y:F},{x:R,y:B},{x:L,y:B}]),`${tag}: A-0 draws the lot ${lot.lotWidthFt} × ${lot.lotDepthFt} ft around the house as entered`);
    // The deck's extent measured again from the level outlines and S-3's treads.
    const deck:Pt[]=[...levels.flatMap(l=>l.footprint.outline.map(q=>({x:q.x+l.offset.x,y:q.y+l.offset.z}))),...s3.items.flatMap(i=>i.kind==='poly'&&i.layer==='A-STRS'?i.points:[])];
    const want={left:Math.min(...deck.map(q=>q.x))-L,right:R-Math.max(...deck.map(q=>q.x)),rear:B-Math.max(...deck.map(q=>q.y))};
    ok(!!site.setbacks&&(['left','right','rear'] as const).every(k=>Math.abs(site.setbacks![k]-want[k])<1e-6),`${tag}: A-0 setbacks ${JSON.stringify(want)} measured to the deck and its stairs`);
    for(const k of ['left','right','rear'] as const)if(want[k]>0)ok(a0Texts.includes(feetInches(want[k]))&&a0Texts.includes(`(${(want[k]*.0254).toFixed(2)} m)`),`${tag}: A-0 gives the ${k} setback in feet and metres`);
    ok(a0Texts.includes(feetInches(R-L))&&a0Texts.includes(feetInches(B-F))&&a0.legend.includes('C-PROP'),`${tag}: A-0 dimensions the lot's width and depth`);
    const circles=a0.items.filter(i=>i.kind==='circle') as Extract<DrawItem,{kind:'circle'}>[];
    if(lot.yardFaces){
      // North on the plan: the yard (+y) faces the given bearing, so north lies (90 - bearing) degrees from +x (y down).
      const bearing={N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315}[lot.yardFaces],n=a0.items.find(i=>i.kind==='text'&&i.text==='N') as Extract<DrawItem,{kind:'text'}>|undefined;
      const angle=n&&circles.length===1?Math.atan2(n.at.y-circles[0].c.y-.035*a0.ratio,n.at.x-circles[0].c.x)*180/Math.PI:NaN,expect=90-bearing;
      ok(Math.abs(((angle-expect)%360+540)%360-180)<.5,`${tag}: the north arrow points ${expect}° on the plan for a yard facing ${lot.yardFaces} (drew ${angle.toFixed(1)}°)`);
    }else ok(circles.length===0&&siteIssues.some(i=>/which way the back yard faces/.test(i)),`${tag}: no north arrow until the yard's direction is entered, and that is a review item`);
    const over=(['left','right','rear'] as const).filter(k=>want[k]<=0);
    ok(over.length===0?!siteIssues.some(i=>/reaches the/.test(i)):siteIssues.some(i=>/reaches the/.test(i))&&a0.notes.some(n=>over.every(k=>n.includes(`over the ${k==='rear'?'rear':`${k} side`} lot line by`))),`${tag}: a deck over a lot line is a review item and the notes say by how much`);
    ok(a0.notes.some(n=>n.includes('zoning by-law'))&&!a0.notes.some(n=>/\d+(\.\d+)? ?m (minimum|required)/i.test(n)),`${tag}: A-0 leaves the required setbacks to the zoning by-law and quotes none`);
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
  // S-6: every schedule adds up to the takeoff and the connector schedule the estimate prices, and is drawn on the sheet.
  {
    const hardware=getHardwareLayout(data,model),tables=scheduleTables(data,model,{railingName:'Test railing'},hardware),table=(title:string)=>tables.find(t=>t.title===title);
    const col=(title:string,head:string)=>{const t=table(title);if(!t)return [];const c=t.head.indexOf(head);return t.rows.map(r=>r[c]);};
    const sum=(xs:string[])=>xs.reduce((n,x)=>n+(Number(x)||0),0);
    const contacts=data.houseVisible===false?[]:getHouseContact(data,levels[0].footprint).contacts,flights=model.flights??[],guarded6=data.railingType!=='None'&&model.quantities.railingLf>0;
    const titles=['FOOTINGS AND POSTS','BEAMS','JOISTS',...(contacts.length?['HOUSE CONNECTION']:[]),...(flights.length?['STAIRS']:[]),...(guarded6?['GUARD']:[]),'CONNECTIONS','FRAMING LUMBER'];
    ok(tables.map(t=>t.title).join()===titles.join(),`${tag}: S-6 schedules ${titles.join(', ')} (got ${tables.map(t=>t.title).join(', ')})`);
    ok(sum(col('FOOTINGS AND POSTS','Qty'))===model.quantities.footings,`${tag}: S-6 footings add up to ${model.quantities.footings}`);
    ok(col('FOOTINGS AND POSTS','Post').filter(p=>p==='6x6').length===0||table('FOOTINGS AND POSTS')!.rows.filter(r=>r[3]==='6x6').reduce((n,r)=>n+Number(r[5]),0)===model.quantities.supportPosts,`${tag}: S-6 posts add up to ${model.quantities.supportPosts}`);
    const lines=beamLines(model),beamMembers=levels.reduce((n,l)=>n+l.beams.length,0);
    ok(lines.reduce((n,b)=>n+b.pieces,0)===beamMembers&&table('BEAMS')!.rows.length===lines.length,`${tag}: S-6 beam lines hold all ${beamMembers} beam pieces`);
    ok(lines.every(b=>b.plies>=1&&b.plies<=4&&b.lengthIn>0),`${tag}: S-6 beam lines have 1 to 4 plies and a length`);
    ok(sum(col('JOISTS','Qty'))===model.quantities.joists&&sum(col('JOISTS','Blocking'))===model.quantities.blocking,`${tag}: S-6 joists and blocking add up to ${model.quantities.joists} and ${model.quantities.blocking}`);
    if(contacts.length)ok(sum(col('HOUSE CONNECTION','Bolts'))===hardware.ledgerBolts.length,`${tag}: S-6 ledger bolts add up to ${hardware.ledgerBolts.length}`);
    if(flights.length)ok(sum(col('STAIRS','Risers'))===model.quantities.totalRisers&&sum(col('STAIRS','Stringers'))===model.stringers.length,`${tag}: S-6 stairs add up to ${model.quantities.totalRisers} risers and ${model.stringers.length} stringers`);
    if(guarded6)ok(col('GUARD','Posts')[0]===String(model.railing.posts.length),`${tag}: S-6 guard posts are the takeoff's ${model.railing.posts.length}`);
    const rows=connectorSchedule(data,model,hardware),words={'priced':'Priced','supplier quote':'Supplier quote','confirm in the railing kit':'Confirm in the railing kit','confirm in the footing allowance':'Confirm in the footing allowance'};
    ok(JSON.stringify(table('CONNECTIONS')!.rows)===JSON.stringify(rows.map(r=>[r.name,String(r.qty),r.unit,words[partStatus(data,r)]])),`${tag}: S-6 lists every connection part with the estimate's count and status`);
    const stock=constructionStock(model);
    ok(sum(col('FRAMING LUMBER','Pieces'))===stock.reduce((n,r)=>n+r.orderedPieces,0)&&table('FRAMING LUMBER')!.rows.length===stock.length,`${tag}: S-6 framing lumber is the stock plan's`);
    const drawn=new Set(s6.items.flatMap(i=>i.kind==='text'?[i.text]:[]));
    ok(tables.every(t=>drawn.has(t.title)&&[t.head,...t.rows].every(r=>r.every(c=>drawn.has(c)))),`${tag}: every S-6 cell is drawn on the sheet`);
  }
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
  for(const layer of ['S-JOIS','S-BEAM','S-FRMG','S-POST','A-RAIL','A-DECK-FNSH','C-TOPO','S-FTNG-HIDN','C-PROP'] as LayerId[])
    ok(byLayer(layer,'LINE')===unique(layer,'line')&&byLayer(layer,'POLYLINE')===unique(layer,'poly'),`${tag}: DXF ${layer} lines and polylines match the sheets`);
  current[name]={set:digest({...set,sheets:[]}),...Object.fromEntries(set.sheets.map(sh=>[sh.id,digest(sh)]))};
}

// The PDF: one 11 × 17 page per sheet, text included (a design with every sheet type).
{
  const data={...structuredClone(DEFAULT_DECK)},e=calculateEstimate(data);
  const set=buildPermitSet({data,model:e.model,reviewItems:[],materialName:'Test decking',railingName:'Test railing',date:'September 28, 2026',priceBook:'2026-09-28'});
  const pdf=Buffer.from(buildPermitPdf(jsPDF,set)).toString('latin1');
  ok(pdf.startsWith('%PDF-')&&(pdf.match(/\/Type \/Page\b/g)??[]).length===8,'The permit PDF has eight pages');
  ok(/\/MediaBox \[0 0 1224\.?\d* 792\.?\d*\]/.test(pdf),'Its pages are 11 × 17 in landscape');
  // The takeoff's own issues always join the review list; the stamp follows the list.
  ok(set.reviewItems.length>=e.model.issues.length&&e.model.issues.every(i=>set.reviewItems.includes(i)),'The takeoff issues are review items');
  const clean={...set,reviewItems:[]};ok(paperLayout(clean,clean.sheets[0],0).some(p=>p.kind==='text'&&p.text==='PLANNING DRAWING'),'With no review items the stamp reads PLANNING DRAWING');
}

// The lot is part of the saved design: it survives a save and reload, bad values are refused, and it never re-prices.
{
  const lot={lotWidthFt:50,lotDepthFt:120,leftYardFt:10,rearYardFt:40.25,yardFaces:'SW' as const,corner:'left' as const},data={...structuredClone(DEFAULT_DECK),permitSite:lot};
  ok(JSON.stringify(parseDesign(serializeDesign(data)).permitSite)===JSON.stringify(lot),'A saved design keeps its lot');
  ok(parseDesign(serializeDesign(DEFAULT_DECK)).permitSite===undefined,'A design without a lot loads without one');
  const refused=(site:unknown)=>{try{parseDesign(JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:{permitSite:site}}));return false;}catch{return true;}};
  ok(refused({...lot,lotWidthFt:5})&&refused({...lot,rearYardFt:-1})&&refused({...lot,yardFaces:'Up'})&&refused({...lot,corner:'back'})&&refused({lotWidthFt:50}),'Out-of-range, unknown or missing lot values are refused');
  ok(estimateKeyOf(data)===estimateKeyOf(DEFAULT_DECK),'Entering the lot never re-prices the design');
}
ok(oracleSkipped<oracleSamples*.02,`Brute-force samples on a visibility boundary stay rare (${oracleSkipped} of ${oracleSamples+oracleSkipped})`);

if(update){writeFileSync(GOLDEN,JSON.stringify(current,null,1)+'\n');console.log('Permit set golden written.');}
else{
  ok(existsSync(GOLDEN),'deck-permit-set-golden.json exists (run with --update after a reviewed drawing change)');
  for(const [name,sheets] of Object.entries(current))for(const [id,d] of Object.entries(sheets))ok(golden[name]?.[id]===d,`${name} ${id}: the drawing matches its golden (run --update after reviewing a drawing change)`);
}
console.log(`DECK PERMIT SET OK: ${checks} checks. ${Object.keys(fixtures).length} designs drawn as A-0, A-1 and S-1 to S-6 with every priced footing, post and member on its layer and the site plan's setbacks measured again; elevations' hidden lines agree with ${oracleSamples} brute-force samples; DXF R12 read back; eight-page 11 × 17 PDF. Slowest set ${slowest.toFixed(0)} ms.`);
