import {test,expect} from '@playwright/test';
import {openDesignerMode,pickPlanTool} from './nav';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

test.describe('compact contractor controls',()=>{
 test.use({viewport:{width:320,height:740},hasTouch:true,isMobile:true});
 test('@phone 320px header and direct edit controls fit; consecutive applications undo separately',async({page,context})=>{
  await context.addInitScript('window.__name=(target,value)=>target;');
  await context.route('**/*',r=>{const url=new URL(r.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({status:200,body:''});});
  await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  // Presets, Agents, the job bar's buttons and Select parts are Designer Mode tools; the homeowner header keeps Undo and Redo.
  for(const label of ['Presets','Agents'])await expect(page.getByRole('button',{name:label,exact:true})).toHaveCount(0);
  for(const label of ['Undo','Redo']){const box=await page.getByRole('button',{name:label,exact:true}).boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);}
  await openDesignerMode(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  const header=page.locator('header.dd-header'),menubar=page.getByRole('menubar',{name:'Pro workspace menu'});
  for(const label of ['Presets','Agents','Undo','Redo']){const box=await header.getByRole('button',{name:label,exact:true}).boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);}
  for(const [menu,item] of [['Edit','Describe a change…'],['File','Saved jobs & versions…']]){await menubar.getByRole('menuitem',{name:menu,exact:true}).click();const box=await page.getByRole('menu',{name:menu}).getByRole('menuitem',{name:item,exact:true}).boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);await page.keyboard.press('Escape');await expect(page.getByRole('menu',{name:menu})).toBeHidden();}
  await pickPlanTool(page,'Select parts');await page.getByRole('combobox',{name:'Select plan part',exact:true}).selectOption('house:main');
  const input=page.getByRole('spinbutton',{name:'Main house width (ft)',exact:true});const original=Number(await input.inputValue());
  await input.fill(String(original+1));await page.getByRole('button',{name:'Apply part changes',exact:true}).click();await expect(input).toHaveValue(String(original+1));
  await input.fill(String(original+2));await page.getByRole('button',{name:'Apply part changes',exact:true}).click();await expect(input).toHaveValue(String(original+2));
  await header.getByRole('button',{name:'Undo',exact:true}).click();await expect(input).toHaveValue(String(original+1));
  await header.getByRole('button',{name:'Undo',exact:true}).click();await expect(input).toHaveValue(String(original));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  await page.locator('#deck-live-preview').scrollIntoViewIfNeeded();const dir=resolve('../../outputs/deckcraft-contractor-review/compact');mkdirSync(dir,{recursive:true});await page.screenshot({path:resolve(dir,'phone-320-contractor-tools.png')});
 });
});
