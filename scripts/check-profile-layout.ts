import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {readFileSync} from 'node:fs';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {buildPermitSet} from '../src/features/deckcraft/drawings/permitSheets';
import {siteProfileDrawingItems} from '../src/features/deckcraft/drawings/siteProfiles';
import {poolSectionDrawingItems} from '../src/features/deckcraft/poolDrawings';
import {drawnExtents,SHEET,sheetTransform,type DrawItem} from '../src/features/deckcraft/drawings/drawingTypes';
import {profileSheets,profilePlanReferences} from '../src/features/deckcraft/drawings/profileLayout';
import type {DeckData} from '../src/features/deckcraft/types';
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const data={...structuredClone(DEFAULT_DECK),...JSON.parse(readFileSync(new URL('./pool-profile-layout-fixture.json',import.meta.url),'utf8'))} as DeckData;
await ensureLiveDesignExtensions(data);const estimate=calculateEstimate(data),set=buildPermitSet({data,model:estimate.model,reviewItems:estimate.flags,materialName:'QA',railingName:'QA',date:'QA',priceBook:'QA'}),sheet=set.sheets.find(s=>s.id==='A-2')!;
const original=[...siteProfileDrawingItems(data,estimate.model,{x:0,y:0}),...poolSectionDrawingItems(data,estimate.model,{x:0,y:0})],to=sheetTransform(sheet);
for(const item of sheet.items){const e=drawnExtents([item],sheet.ratio,0),a=to({x:e.minX,y:e.minY}),b=to({x:e.maxX,y:e.maxY});ok(a.x>=SHEET.area.x-1e-7&&a.y>=SHEET.area.y-1e-7&&b.x<=SHEET.area.x+SHEET.area.w+1e-7&&b.y<=SHEET.area.y+SHEET.area.h+1e-7,'Every profile line and complete label fits drawing bounds');}
const lines=(items:DrawItem[])=>items.filter((i):i is Extract<DrawItem,{kind:'line'}>=>i.kind==='line');
const before=lines(original),after=lines(sheet.items);ok(before.length===after.length,'All physical section lines retained');
for(let i=0;i<before.length;i++){const a=before[i],b=after[i];ok(a.layer===b.layer&&Math.abs((a.b.x-a.a.x)-(b.b.x-b.a.x))<1e-7&&Math.abs((a.b.y-a.a.y)-(b.b.y-b.a.y))<1e-7,'Every physical section retains exact chainage/elevation deltas');}
const titles=original.filter(i=>i.kind==='text'&&(/\/A-2 .*true-scale/.test(i.text)||/ Â· (longitudinal|across) Â· /.test(i.text)));
for(const title of titles){if(title.kind!=='text')continue;const key=title.text.split(' Â· ')[0];ok(sheet.items.some(i=>i.kind==='text'&&i.text.startsWith(key)),'Every site and pool section keeps its title/reference');}
ok(sheet.ratio<=128,'Terraced sections remain readable at 3/32 inch per foot or larger');
ok(sheet.items.every(i=>i.kind!=='text'||i.height>=.1),'Drawing labels remain at least 7.2pt');
const poolLines=after.filter(i=>i.layer==='C-FNSH');ok(poolLines.length>0,'Pool physical sections retained');
// More profiles than any legible single sheet can hold must continue, never disappear.
const many:Array<DrawItem>=Array.from({length:80},(_,i)=>[
 {kind:'text' as const,at:{x:0,y:0},text:`${i+1}/A-2 stress section · true-scale height / chainage`,height:.09,anchor:'start' as const,layer:'A-ANNO-TEXT' as const},
 {kind:'line' as const,a:{x:0,y:20},b:{x:400,y:120},layer:'C-FNSH' as const},
 {kind:'text' as const,at:{x:0,y:150},text:'Start 0 ft · EG +0.00 / PG +9.00 / finish +20.00',height:.09,anchor:'start' as const,layer:'A-ANNO-TEXT' as const}
]).flat(),continued=profileSheets(many,[],['QA datum']);
ok(continued.length>1&&continued[0].id==='A-2','Large section sets paginate with the original first-sheet ID');
ok(continued.flatMap(s=>s.items).filter(i=>i.kind==='line').length===80,'Every physical stress panel retained across continuation sheets');
const starts:Array<DrawItem>=Array.from({length:80},(_,i)=>({kind:'text',at:{x:0,y:0},text:`${i+1}/A-2 section start`,height:.06,anchor:'start',layer:'A-ANNO-TEXT'})),references=profilePlanReferences(starts,continued);
for(const item of references){if(item.kind!=='text')continue;const match=item.text.match(/^(\d+)\/(A-2(?:\.\d+)?) section start$/)!;ok(continued.find(p=>p.id===match[2])?.items.some(i=>i.kind==='text'&&i.text.startsWith(`${match[1]}/${match[2]} `)),'Every A-0 start names the actual continuation containing its section');}

for(const [index,page] of continued.entries()){
 ok(page.id===(index?`A-2.${index+1}`:'A-2'),'Continuation sheet identifiers are distinct');
 ok(page.ratio===128,'Continuation sheets retain a legible shared true scale');
 const transform=sheetTransform(page);
 for(const item of page.items){const e=drawnExtents([item],page.ratio,0),a=transform({x:e.minX,y:e.minY}),b=transform({x:e.maxX,y:e.maxY});ok(a.x>=SHEET.area.x-1e-7&&a.y>=SHEET.area.y-1e-7&&b.x<=SHEET.area.x+SHEET.area.w+1e-7&&b.y<=SHEET.area.y+SHEET.area.h+1e-7,'Every continuation label and line fits content bounds');}
}
ok(profileSheets([],[],[]).length===0,'No section data produces no invalid infinite-extent sheet');
const huge=profileSheets([{kind:'text',at:{x:0,y:0},text:'1/A-2 long curved wall · true-scale height / chainage',height:.09,anchor:'start',layer:'A-ANNO-TEXT'},{kind:'line',a:{x:0,y:0},b:{x:100000,y:1000},layer:'C-FNSH'}],[],[]);
ok(huge.length===1&&huge[0].ratio>2400&&(huge[0].extents.maxX-huge[0].extents.minX)/huge[0].ratio<=SHEET.area.w,'An unusually long section receives an explicit larger true scale instead of an export dead end');
console.log(`${checks} profile panel bounds, full-label, scale and exact geometry checks passed; A-2 ratio ${sheet.ratio}, paper height ${((sheet.extents.maxY-sheet.extents.minY)/sheet.ratio).toFixed(2)} in.`);

if(process.argv.includes('--capture')){const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{default:Svg}=await import('../src/features/deckcraft/drawings/PermitSheetSvg'),{default:sharp}=await import('sharp');const svg=renderToStaticMarkup(React.createElement(Svg,{set,sheet,index:set.sheets.indexOf(sheet)})).replace(/style="[^"]*"/,'').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="1700" height="1100" ');await sharp(Buffer.from(svg)).flatten({background:'#fff'}).png().toFile('../../outputs/pool-phase/a2-profile-layout-fixed.png');}
