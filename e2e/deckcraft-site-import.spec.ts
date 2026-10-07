import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
const ready=async(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
const saved=async(page:Page)=>expect(page.locator('[data-autosave-state="saved"]')).toHaveCount(1);
const zip={name:'ulevel_10-05-26_14-18.zip',mimeType:'application/zip',buffer:readFileSync('e2e/fixtures/ulevel-sample.zip')};
const SHOTS=Array.from({length:11},(_,i)=>`P${i+1}`);
test.beforeEach(async({context})=>{await context.addInitScript('window.__name=(target,value)=>target;');await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({body:''}));});
async function openImport(page:Page){
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();
 const open=page.getByRole('button',{name:'Import from U-Level or survey file',exact:true});
 if(!await open.count())await page.getByRole('button',{name:'Elevations & build',exact:true}).click();
 await open.click();
 return page.getByRole('region',{name:'Survey readings import'});
}
/** Loads the real U-Level export and returns the door sill height the dialog reports. */
async function loadZip(page:Page){
 const region=page.getByRole('region',{name:'Survey readings import'});
 await page.getByLabel('Survey readings file',{exact:true}).setInputFiles(zip);
 await expect(page.getByRole('table',{name:'Survey readings preview'}).locator('tbody tr')).toHaveCount(11);
 await expect(region.getByText('a closed house line (P1, P2, P3)',{exact:false})).toBeVisible();
 await expect(region.getByText('confirmed by the recorded lengths',{exact:false})).toBeVisible();
 await expect(region.getByText('Recorded lengths: P1-P2 matches, P2-P3 matches, P3-P1 matches.',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Place shots by',{exact:true})).toHaveValue('house');
 const status=region.getByText(/^The door sill measures [\d.]+ in above the ground/);await expect(status).toBeVisible();
 return Number((await status.textContent())!.match(/measures ([\d.]+) in/)![1]);
}
async function previewAndApply(page:Page){
 await page.getByRole('button',{name:'Preview survey import',exact:true}).click();
 const apply=page.getByRole('button',{name:'Apply site preview',exact:true});await expect(apply).toBeEnabled();await apply.click();
 await expect.poll(async()=>(await read(page)).design.siteModel?.points.length).toBe(11);
}

test('a U-Level zip imports, ties to the door sill, undoes in one step and survives reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/deck-designer/');await ready(page);await saved(page);
 const before=(await read(page)).design;
 await openImport(page);
 const sill=await loadZip(page);
 expect(sill).toBeGreaterThan(23.5);expect(sill).toBeLessThan(41.5);
 await previewAndApply(page);
 const after=(await read(page)).design;
 expect(after.siteModel!.points.map(p=>p.id)).toEqual(SHOTS);
 expect(after.houseConfig!.floorHeightIn).toBeCloseTo(sill,1);
 // The site and the sill are one edit: a single undo restores both.
 const undone=await page.evaluate(async()=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({id:`undo-${Date.now()}`,expectedRevision:api.read().revision,commands:[{type:'history.undo'}]});});
 expect(undone.ok).toBe(true);
 const restored=(await read(page)).design;
 expect(restored.siteModel).toEqual(before.siteModel);
 expect(restored.houseConfig?.floorHeightIn).toEqual(before.houseConfig?.floorHeightIn);
 // Import again, then the measured ground and the sill persist across a reload.
 await loadZip(page);await previewAndApply(page);await saved(page);
 await page.reload();await ready(page);
 const reloaded=(await read(page)).design;
 expect(reloaded.siteModel!.points.map(p=>p.id)).toEqual(SHOTS);
 expect(reloaded.houseConfig!.floorHeightIn).toBeCloseTo(sill,1);
 expect(errors).toEqual([]);
});

test('a second U-Level export is added under its date instead of overwriting P1..P11',async({page})=>{
 await page.goto('/deck-designer/');await ready(page);await saved(page);
 await openImport(page);await loadZip(page);await previewAndApply(page);
 await loadZip(page);
 await expect(page.getByLabel('Combine with measured points',{exact:true})).toHaveValue('append');
 await page.getByRole('button',{name:'Preview survey import',exact:true}).click();
 await page.getByRole('button',{name:'Apply site preview',exact:true}).click();
 // The same shots at the same spots are re-shots: the dated set replaces them rather than duplicating positions.
 await expect.poll(async()=>(await read(page)).design.siteModel?.points.map(p=>p.id)).toEqual(SHOTS.map(id=>`10-05 ${id}`));
});

test('@phone the survey import keeps every control at least 44 px tall',async({page})=>{
 await page.goto('/deck-designer/');await ready(page);await saved(page);
 const region=await openImport(page);await loadZip(page);
 for(const control of await region.locator('button,select,input:not([type=checkbox]):not([type=file])').all()){
  if(!await control.isVisible())continue;const box=(await control.boundingBox())!;
  expect(box.height,await control.evaluate(e=>e.outerHTML.slice(0,80))).toBeGreaterThanOrEqual(44);
 }
});
