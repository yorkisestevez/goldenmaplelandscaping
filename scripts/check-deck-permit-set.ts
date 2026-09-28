import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {jsPDF} from 'jspdf';
import {BUSINESS,publicContact} from '../src/data/business';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import type {DeckData} from '../src/features/deckcraft/types';
import {SCALES,SHEET,type DrawItem,type DrawingSet,type LayerId} from '../src/features/deckcraft/drawings/drawingTypes';
import {PERMIT_FOOTER,buildPermitSet} from '../src/features/deckcraft/drawings/permitSheets';
import {paperLayout} from '../src/features/deckcraft/drawings/paperLayout';
import {buildPermitDxf} from '../src/features/deckcraft/drawings/renderDxf';
import {buildPermitPdf} from '../src/features/deckcraft/drawings/renderPdf';
import {legacyScenarios} from './deck-legacy-scenarios';

// The permit drawing set (drawings/): every priced footing, post and member is on its sheet and layer, each sheet fits a
// standard scale, the title block carries business.ts facts, no text claims a review outcome, the DXF reads back
// layer for layer, and the PDF has one page per sheet. `--update` rewrites the golden after a reviewed drawing change.
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

const golden:Record<string,string>=existsSync(GOLDEN)?JSON.parse(readFileSync(GOLDEN,'utf8')):{},current:Record<string,string>={};
for(const [name,patch] of Object.entries(fixtures)){
  const data:DeckData={...structuredClone(DEFAULT_DECK),...patch},e=calculateEstimate(data),model=e.model;
  const set:DrawingSet=buildPermitSet({data,model,reviewItems:e.flags,materialName:'Test decking',railingName:'Test railing',date:'September 28, 2026',priceBook:'2026-09-28'});
  const [s1,s2,s3]=set.sheets,tag=name;
  ok(set.sheets.map(s=>s.id).join()==='S-1,S-2,S-3',`${tag}: sheets S-1, S-2, S-3`);
  for(const s of set.sheets){
    const w=(s.extents.maxX-s.extents.minX)/s.ratio,h=(s.extents.maxY-s.extents.minY)/s.ratio;
    ok(SCALES.some(x=>x.ratio===s.ratio&&x.label===s.scaleLabel)&&(w<=SHEET.area.w+1e-9&&h<=SHEET.area.h+1e-9||s.ratio===SCALES.at(-1)!.ratio),`${tag} ${s.id}: fits at ${s.scaleLabel}`);
    ok(s.notes.length>0&&s.legend.length>0,`${tag} ${s.id}: notes and legend`);
    const texts=[...s.items.flatMap(i=>i.kind==='text'||i.kind==='dim'?[i.text]:[]),...s.notes,set.footer,...paperLayout(set,s,0).flatMap(p=>p.kind==='text'?[p.text]:[])];
    ok(texts.every(t=>!BANNED.test(t)),`${tag} ${s.id}: no text claims a review outcome (${texts.find(t=>BANNED.test(t))})`);
    const paper=paperLayout(set,s,set.sheets.indexOf(s)).flatMap(p=>p.kind==='text'?[p.text]:[]).join(' ');
    ok(paper.includes(set.reviewItems.length?'DRAFT':'PLANNING DRAWING')&&paper.includes(s.id)&&paper.includes(s.scaleLabel),`${tag} ${s.id}: stamp, sheet number and scale on the sheet`);
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
  // The DXF reads back: R12, balanced sections, every layer declared, entity counts per layer.
  const dxf=readDxf(buildPermitDxf(set)),byLayer=(layer:string,type:string)=>dxf.entities.filter(x=>x.layer===layer&&x.type===type).length;
  ok(dxf.header==='AC1009'&&dxf.balanced&&dxf.sections.join()==='HEADER,TABLES,BLOCKS,ENTITIES',`${tag}: DXF R12 with balanced sections`);
  ok(dxf.entities.every(x=>dxf.layers.has(x.layer)),`${tag}: every DXF entity is on a declared layer`);
  ok(byLayer('S-FTNG','INSERT')===footings&&byLayer('S-POST','INSERT')===footings,`${tag}: DXF footing and post inserts`);
  ok(byLayer('S-JOIS','LINE')===new Set(s2.items.filter(i=>i.layer==='S-JOIS').map(i=>JSON.stringify(i))).size&&byLayer('S-BEAM','LINE')===new Set(s2.items.filter(i=>i.layer==='S-BEAM').map(i=>JSON.stringify(i))).size,`${tag}: DXF joist and beam lines`);
  current[name]=createHash('sha256').update(stable(set)).digest('hex').slice(0,16);
}

// The PDF: one 11 × 17 page per sheet, text included (a design with every sheet type).
{
  const data={...structuredClone(DEFAULT_DECK)},e=calculateEstimate(data);
  const set=buildPermitSet({data,model:e.model,reviewItems:[],materialName:'Test decking',railingName:'Test railing',date:'September 28, 2026',priceBook:'2026-09-28'});
  const pdf=Buffer.from(buildPermitPdf(jsPDF,set)).toString('latin1');
  ok(pdf.startsWith('%PDF-')&&(pdf.match(/\/Type \/Page\b/g)??[]).length===3,'The permit PDF has three pages');
  ok(/\/MediaBox \[0 0 1224\.?\d* 792\.?\d*\]/.test(pdf),'Its pages are 11 × 17 in landscape');
  // The takeoff's own issues always join the review list; the stamp follows the list.
  ok(set.reviewItems.length>=e.model.issues.length&&e.model.issues.every(i=>set.reviewItems.includes(i)),'The takeoff issues are review items');
  const clean={...set,reviewItems:[]};ok(paperLayout(clean,clean.sheets[0],0).some(p=>p.kind==='text'&&p.text==='PLANNING DRAWING'),'With no review items the stamp reads PLANNING DRAWING');
}

if(update){writeFileSync(GOLDEN,JSON.stringify(current,null,1)+'\n');console.log('Permit set golden written.');}
else{
  ok(existsSync(GOLDEN),'deck-permit-set-golden.json exists (run with --update after a reviewed drawing change)');
  for(const [name,digest] of Object.entries(current))ok(golden[name]===digest,`${name}: the drawing set matches its golden (run --update after reviewing a drawing change)`);
}
console.log(`DECK PERMIT SET OK: ${checks} checks. ${Object.keys(fixtures).length} designs drawn as S-1 to S-3 with every priced footing, post and member on its layer; DXF R12 read back; three-page 11 × 17 PDF.`);
