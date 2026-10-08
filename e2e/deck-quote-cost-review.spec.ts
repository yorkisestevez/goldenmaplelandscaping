import {test,expect,type Page} from '@playwright/test';
import {showProjectControls} from './nav';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {DeckAgentApi,AgentCommand} from '../src/features/deckcraft/designer/deckAgentController';
const out=resolve(process.cwd(),'../../outputs/deckcraft-contractor-ready-review/quote-browser');mkdirSync(out,{recursive:true});
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
let counter=0;
async function command(page:Page,commands:AgentCommand[]){const result=await page.evaluate(async({commands,id})=>{const a=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return a.execute({id,expectedRevision:a.read().revision,commands});},{commands,id:`quote-browser-${++counter}`});if("error" in result)throw Error(result.error.message);return result;}
for(const phone of [false,true])test.describe(phone?'phone confirmed quote costs':'desktop confirmed quote costs',()=>{
 test.use({viewport:phone?{width:390,height:844}:{width:1440,height:1000},hasTouch:phone,isMobile:phone});
 test(`${phone?'@phone ':''}confirmed missing scope previews exact price, remains private, restores with job, and invalidates on resize`,async({context,page})=>{
  await context.addInitScript('window.__name=(target,value)=>target;localStorage.clear();');
  await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:503,body:'No external writes in local QA'}));
  await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
  await showProjectControls(page);
  const before=await read(page);const tap=async(locator:ReturnType<Page['getByRole']>)=>phone?locator.tap():locator.click();
  await tap(page.getByRole('button',{name:'Review quote costs',exact:true}));const d=page.getByRole('dialog',{name:'Complete the missing costs',exact:true});await expect(d).toBeVisible();
  // Default 2026-10 designs price cladding/frame finish; decking delivery remains the standing supplier quote.
  await d.getByRole('button',{name:/Decking delivery/}).click();
  await expect(d.getByRole('main',{name:'Quote scope review'})).toContainText('delivery');
  await d.getByLabel('Additional supply cost',{exact:true}).fill('100');await d.getByLabel('Additional installation cost',{exact:true}).fill('250');await d.getByLabel('Confirmation date',{exact:true}).fill('2026-09-26');await d.getByLabel('Supplier or builder reference',{exact:true}).fill('Synthetic supplier reference Q-47');await d.getByLabel('What this confirmed amount covers',{exact:true}).fill('Synthetic decking delivery and handling for this order only.');await d.getByRole('checkbox').check();
  await tap(d.getByRole('button',{name:'Review confirmed cost',exact:true}));await expect(d.getByRole('status',{name:'Quote cost price comparison'})).toBeVisible();expect((await read(page)).pricing.total).toBe(before.pricing.total);await page.screenshot({path:resolve(out,`${phone?'phone':'desktop'}-confirmed-price-preview.png`)});
  await tap(d.getByRole('button',{name:'Apply confirmed costs',exact:true}));await expect(d).toBeHidden();const confirmed=await read(page);expect(confirmed.pricing.subtotal-before.pricing.subtotal).toBeCloseTo(385,8);expect(confirmed.pricing.hst-before.pricing.hst).toBeCloseTo(50.05,8);expect(confirmed.pricing.total-before.pricing.total).toBeCloseTo(435.05,8);expect(confirmed.quotes.length).toBe(before.quotes.length-1);expect(JSON.stringify(confirmed)).not.toContain('Synthetic supplier reference Q-47');expect(confirmed.design).not.toHaveProperty('quoteResolutions');
  await tap(page.getByRole('button',{name:'Jobs & versions',exact:true}));const j=page.getByRole('dialog',{name:'Jobs & options',exact:true});await j.getByLabel('Job name',{exact:true}).fill('Synthetic confirmed-cost job');await j.getByLabel('Revision name',{exact:true}).fill('Confirmed missing scope');await tap(j.getByRole('button',{name:'Save revision',exact:true}));await expect(j.getByRole('heading',{name:'Confirmed missing scope',exact:true})).toBeVisible();await tap(j.getByRole('button',{name:'Close',exact:true}));
  await command(page,[{type:'history.undo'}]);expect((await read(page)).pricing).toEqual(before.pricing);await command(page,[{type:'history.redo'}]);expect((await read(page)).pricing).toEqual(confirmed.pricing);
  await command(page,[{type:'design.patch',patch:{width:18}}]);const resized=await read(page);expect(resized.quotes).toEqual(expect.arrayContaining(before.quotes));await tap(page.getByRole('button',{name:'Review quote costs',exact:true}));await d.getByText('Saved quote records (1)',{exact:true}).click();await expect(d).toContainText('1 inactive');await tap(d.getByRole('button',{name:'Close quote cost review',exact:true}));
  await tap(page.getByRole('button',{name:'Jobs & versions',exact:true}));await tap(j.getByRole('button',{name:/^Confirmed missing scope/}));await tap(j.getByRole('button',{name:'Compare designs and prices',exact:true}));expect(Number(await j.locator('[data-exact-total]').nth(1).getAttribute('data-exact-total'))).toBe(confirmed.pricing.total);await tap(j.getByRole('button',{name:'Restore revision',exact:true}));await expect(j).toBeHidden();const restored=await read(page);expect(restored.pricing).toEqual(confirmed.pricing);await command(page,[{type:'history.undo'}]);expect((await read(page)).pricing).toEqual(resized.pricing);
  writeFileSync(resolve(out,`${phone?'phone':'desktop'}-quote-price-proof.json`),JSON.stringify({before:before.pricing.total,confirmed:confirmed.pricing.total,missingCostsAddedOnce:true,markupSupplyOnly:true,hstOnce:true,privateNotesExcluded:true,undoRedoExact:true,resizeInvalidates:true,jobRestoreExact:true},null,2)+'\n');
 });
});

