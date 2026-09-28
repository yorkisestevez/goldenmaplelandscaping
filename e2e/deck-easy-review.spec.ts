import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';
const out=resolve(process.cwd(),'../../outputs/deckcraft-easy-edit-review/review');mkdirSync(out,{recursive:true});
const storageKey='golden-maple.deck-studio.deck-only.v1',house=getHouseConfig(DEFAULT_DECK),place=getHousePlacement(DEFAULT_DECK);
const fixture={...structuredClone(DEFAULT_DECK),customerName:'Local QA Customer',houseConfig:{...house,openings:[{id:'site-window',type:'Window',facade:'Front',offsetPct:(0-place.x0)/place.widthIn*100,bottomIn:48,widthIn:48,heightIn:54}]}};
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
test.beforeEach(async({context,page})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(({storageKey,fixture})=>localStorage.setItem(storageKey,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:fixture})),{storageKey,fixture});
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready)).toBe(true);
});
for(const phone of [false,true])test.describe(phone?'phone actionable review':'desktop actionable review',()=>{
 test.use({viewport:phone?{width:390,height:844}:{width:1440,height:1000},hasTouch:phone,isMobile:phone});
 test(`${phone?'@phone ':''}warning highlights its real measured opening without an edit; related lighting settings remain reachable`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const original=await read(page);
  await page.getByRole('button',{name:/^Review \d+ issues?$/}).click();
  const dialog=page.getByRole('dialog',{name:'Find and resolve issues'});await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-issue-id="opening-clash:site-window"]')).toContainText('railing crosses window');
  await dialog.getByRole('button',{name:'Locate measured opening',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Select plan part',exact:true})).toHaveValue('opening:site-window');
  await expect(page.getByRole('spinbutton',{name:'Opening bottom above grade (in)',exact:true})).toHaveValue('48');
  expect((await read(page)).design).toEqual(original.design);expect((await read(page)).pricing).toEqual(original.pricing);
  await page.screenshot({path:resolve(out,`${phone?'phone':'desktop'}-located-warning.png`)});
  await page.getByRole('button',{name:/^Review \d+ issues?$/}).click();await dialog.getByRole('button',{name:'Review railing connection',exact:true}).click();
  await expect.poll(async()=>(await read(page)).openSections).toContain('stairs');
  expect((await read(page)).design).toEqual(original.design);expect(errors).toEqual([]);
 });
 test(`${phone?'@phone ':''}save status follows actual stored design and reports quota failure honestly`,async({page})=>{
  await expect(page.locator('[data-autosave-state="saved"]')).toBeVisible();
  await page.evaluate(()=>{const original=Storage.prototype.setItem;(window as unknown as {qaSetItem:typeof original}).qaSetItem=original;Storage.prototype.setItem=function(key,value){if(key==='golden-maple.deck-studio.deck-only.v1')throw new DOMException('Quota exceeded','QuotaExceededError');original.call(this,key,value);};});
  const result=await page.evaluate(async()=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({id:'qa-save-failure',expectedRevision:api.read().revision,commands:[{type:'design.patch',patch:{width:18}}]});});expect(result.ok).toBe(true);
  await expect(page.locator('[data-autosave-state="error"]')).toContainText('Not saved');
  await page.evaluate(()=>{Storage.prototype.setItem=(window as unknown as {qaSetItem:typeof Storage.prototype.setItem}).qaSetItem;});
  await page.evaluate(async()=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({id:'qa-save-recovery',expectedRevision:api.read().revision,commands:[{type:'design.patch',patch:{width:19}}]});});
  await expect(page.locator('[data-autosave-state="saved"]')).toBeVisible();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).configuration.width,storageKey)).toBe(19);
 });
});
