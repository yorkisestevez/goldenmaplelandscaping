import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {savedConfiguration} from './nav';
import type {HardscapeProduct} from '../src/features/deckcraft/hardscapeCatalogue';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';
const workingKey='golden-maple.deck-studio.deck-only.v1',recoveryKey='golden-maple.deck-studio.unrestored.v1';
const catalogue=JSON.parse(readFileSync(resolve(process.cwd(),'public/deckcraft/hardscape-catalogue.json'),'utf8')) as {products:HardscapeProduct[]};
const product=catalogue.products.find(p=>p.id==='techo-aberdeen-slab')!,finish=product.finishes[0],pattern=finish.patterns[0];
const valid={...structuredClone(DEFAULT_DECK),customerName:'Recovered contractor · Équipe',houseVisible:false,width:21,yardFeatures:[{id:'restore-patio',kind:'patio' as const,name:'Original supplier patio',enabled:true,xFt:50,zFt:50,widthFt:10,depthFt:10,heightIn:0,rotationDeg:0,productId:product.id,color:'#777777',hardscape:{finishId:finish.id,colorId:finish.colors[0].id,unitId:pattern.layout.cells[0].unitId,patternId:pattern.id,angleDeg:37,jointMm:pattern.layout.jointMm??0}}]};
function previous(reason:'joint'|'colour'){
 const d=structuredClone(valid);
 if(reason==='joint')d.yardFeatures[0].hardscape.jointMm=(pattern.layout.jointMm??0)+1;
 else d.yardFeatures[0].hardscape.colorId='qa-supplier-colour-no-longer-available';
 // Preserve whitespace and Unicode, so a parsed/re-serialized substitute fails.
 return JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:d},null,2)+'\n';
}
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
async function ready(page:Page){await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);}
async function patch(page:Page,width:number){
 const result=await page.evaluate(async width=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({id:`qa-recovery-width-${width}`,expectedRevision:api.read().revision,commands:[{type:'design.patch',patch:{width}}]});},width);
 expect(result.ok).toBe(true);await expect.poll(async()=>(await read(page)).design.width).toBe(width);
}
async function unchanged(page:Page,raw:string){
 // The write is debounced450ms; checking immediately would miss a destructive delayed save.
 await page.waitForTimeout(650);
 expect(await page.evaluate(key=>localStorage.getItem(key),workingKey)).toBe(raw);
 await expect(page.locator('.dd-save-state')).toContainText('Auto-save paused');
}
async function downloadPrevious(page:Page,raw:string){
 const files=page.locator('.dd-workspace-files');if(!await files.evaluate(el=>el.hasAttribute('open')))await files.locator('summary').first().click();
 const next=page.waitForEvent('download');await files.getByRole('button',{name:'Download previous design',exact:true}).click();
 const download=await next;expect(download.suggestedFilename()).toBe('golden-maple-previous-design.json');
 expect(await readFile((await download.path())!,'utf8')).toBe(raw);
}
test.beforeEach(async({context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({status:200,body:''}));
});
for(const reason of ['joint','colour'] as const)test(`source ${reason} restore failure preserves exact file through edits, sharing and reload; explicit ${reason==='joint'?'import':'new design'} resumes safely`,async({page,context})=>{
 const raw=previous(reason);
 await context.addInitScript(({workingKey,raw})=>{if(!localStorage.getItem(workingKey))localStorage.setItem(workingKey,raw);},{workingKey,raw});
 await page.goto('/deck-designer/');await ready(page);await unchanged(page,raw);
 expect((await read(page)).design.yardFeatures??[]).toEqual([]);
 await downloadPrevious(page,raw);await patch(page,19);await unchanged(page,raw);
 await patch(page,23);const shared=await page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.execute({id:'qa-recovery-share',commands:[{type:'action',action:'share.create'}]}));expect(shared.ok).toBe(true);
 if(!shared.ok)throw new Error('Expected the valid shared-design command to succeed.');
 await patch(page,20);await unchanged(page,raw);
 await page.evaluate(hash=>{location.hash=hash;},new URL(shared.result!.url!).hash);await ready(page);
 await expect.poll(async()=>(await read(page)).design.width).toBe(23);await unchanged(page,raw);
 await page.reload();await ready(page);await unchanged(page,raw);await downloadPrevious(page,raw);
 const files=page.locator('.dd-workspace-files');
 if(reason==='joint'){
  // Keep this focused on restore protection; supplier rendering is exercised
  // by the separate pattern/inlay browser suite against the final source build.
  const replacement={...structuredClone(DEFAULT_DECK),width:21,customerName:'Recovered contractor · Équipe'};
  await files.getByLabel('Import Golden Maple design JSON',{exact:true}).setInputFiles({name:'valid-design.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:replacement}))});
  await expect.poll(async()=>(await read(page)).design.width).toBe(21);
 }else{
  await files.locator('.dd-reset>summary').click();await files.getByRole('button',{name:'Start a new design',exact:true}).click();
  await expect.poll(async()=>(await read(page)).design.width).toBe(DEFAULT_DECK.width);
 }
 await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),recoveryKey)).toBe(raw);
 await expect(page.locator('[data-autosave-state="saved"]')).toBeVisible();
 await expect.poll(async()=>(await savedConfiguration(page))?.yardFeatures?.some(feature=>feature.id==='restore-patio')??false).toBe(false);
 await patch(page,24);await expect.poll(async()=>(await savedConfiguration(page))?.width).toBe(24);
 await page.reload();await ready(page);expect((await read(page)).design.width).toBe(24);
 expect(await page.evaluate(key=>localStorage.getItem(key),recoveryKey)).toBe(raw);
 await downloadPrevious(page,raw);
});
test('failed recovery backup keeps autosave paused even after explicit start-new',async({page,context})=>{
 const raw=previous('joint');await context.addInitScript(({workingKey,raw,recoveryKey})=>{if(!localStorage.getItem(workingKey))localStorage.setItem(workingKey,raw);const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===recoveryKey)throw new DOMException('Quota exceeded','QuotaExceededError');original.call(this,k,v);};},{workingKey,raw,recoveryKey});
 await page.goto('/deck-designer/');await ready(page);await unchanged(page,raw);
 const files=page.locator('.dd-workspace-files');await files.locator('summary').first().click();await files.locator('.dd-reset>summary').click();await files.getByRole('button',{name:'Start a new design',exact:true}).click();
 await unchanged(page,raw);expect(await page.evaluate(key=>localStorage.getItem(key),recoveryKey)).toBeNull();
 await patch(page,25);await unchanged(page,raw);await downloadPrevious(page,raw);
});
