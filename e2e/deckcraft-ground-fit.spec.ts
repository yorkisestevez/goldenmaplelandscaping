import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {DeckData} from '../src/features/deckcraft/types';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';

/**
 * Ground fit (G3) on Craighurst: a real U-Level survey (no customer details) under a 12 × 5 ft deck at +30 in with four
 * risers down to a stone landing at +5 in. The panel has to offer priced ways to fit the landing to the measured ground,
 * apply one as a single change and give it back with one Undo.
 */
const KEY='golden-maple.deck-studio.deck-only.v1',DESIGN=readFileSync('e2e/fixtures/craighurst-ground-fit.json','utf8');
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
const design=async(page:Page)=>(await read(page)).design as unknown as DeckData;
const ready=async(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
/** What a ground-fit option can change: the deck top, the stair's place, the landing level and edge, the risers. */
const fit=(d:DeckData)=>{const landing=d.yardFeatures?.find(f=>f.id==='landing');return {height:d.height,stairOffset:d.stairOffset,landing:landing?.finishedElevationIn??null,groundFit:landing?.groundFit??null,risers:d.stairTargets?.find(t=>t.patioId==='landing')?.riserCount??null};};

test.beforeEach(async({page,context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[KEY,DESIGN] as const);
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await ready(page);
 expect(fit(await design(page))).toMatchObject({landing:5,risers:4});
});

async function showProjectControls(page:Page){const show=page.getByRole('button',{name:'Show project controls',exact:true});if(await show.isVisible())await show.click();}
/** Elevations & build → Deck levels & stairs → the Ground fit panel. */
async function openGroundFit(page:Page){
 await showProjectControls(page);
 const tasks=page.getByRole('group',{name:'Elevation tasks',exact:true});
 if(!await tasks.isVisible())await page.getByRole('button',{name:'Elevations & build',exact:true}).click();
 await tasks.getByRole('button',{name:'Deck levels & stairs',exact:true}).click();
 const panel=page.getByRole('region',{name:'Ground fit',exact:true});
 await expect(panel).toBeVisible();await panel.scrollIntoViewIfNeeded();
 return panel;
}
async function findOptions(panel:Locator){
 await panel.getByRole('button',{name:'Find options',exact:true}).click();
 await expect(panel).toHaveAttribute('data-state','done',{timeout:120_000});
}
const nowLine=(panel:Locator)=>panel.getByText(/^Now: /);

test('Ground fit offers priced options, applies one as a single change and Undo restores it',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const panel=await openGroundFit(page),before=fit(await design(page));
 await expect(nowLine(panel)).toHaveText('Now: 4 steps down to Stone landing at +5.00 in; main deck top +30.00 in.');
 const nowBefore=await nowLine(panel).textContent();
 await findOptions(panel);
 // The design as it stands comes first, then at least two alternatives, each with its price effect beside it.
 await expect(panel.locator('.dd-ground-fit-card').first()).toHaveAttribute('data-kind','current');
 const alternatives=panel.locator('.dd-ground-fit-card:not([data-kind="current"])');
 await expect.poll(()=>alternatives.count()).toBeGreaterThanOrEqual(2);
 for(const card of (await alternatives.all()).slice(0,2)){
  await expect(card).toContainText('Price effect before HST:');
  const effect=(await card.locator('.dd-ground-fit-price').textContent())!.trim();
  expect(effect).toMatch(/^(?:[+−]\$[\d,]+|no change|[a-z].* by quote)/);
  expect(effect).not.toMatch(/^\$0\b|[+−]\$0\b/);
 }
 // Prefer moving the landing: it changes the riser count and the patio level the summary reports.
 const level=panel.locator('.dd-ground-fit-card[data-kind="level"]'),card=await level.count()?level.first():alternatives.first();
 const preview=card.getByRole('button',{name:/^Preview in 3D: /});
 if(await preview.count()){
  await preview.click();await expect(preview).toHaveAttribute('aria-pressed','true');
  await expect(panel.getByText(/^Showing “.+” in the 3D view\./)).toBeVisible();
  expect(fit(await design(page)),'A preview writes nothing').toEqual(before);
 }
 await card.getByRole('button',{name:/^Apply: /}).click();
 await expect.poll(async()=>fit(await design(page))).not.toEqual(before);
 const applied=fit(await design(page));
 expect(applied.risers!==before.risers||applied.landing!==before.landing||applied.height!==before.height||applied.stairOffset!==before.stairOffset||JSON.stringify(applied.groundFit)!==JSON.stringify(before.groundFit)).toBe(true);
 // The panel resets for the new design and says what happened.
 await expect(panel).toHaveAttribute('data-state','idle');
 await expect(panel.getByRole('status').filter({hasText:/^Applied: /})).toBeVisible();
 if(applied.risers!==before.risers||applied.landing!==before.landing||applied.height!==before.height)await expect(nowLine(panel)).not.toHaveText(nowBefore!);
 // One Undo restores the whole option.
 const undone=await page.evaluate(async()=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({id:`undo-${Date.now()}`,expectedRevision:api.read().revision,commands:[{type:'history.undo'}]});});
 expect(undone.ok).toBe(true);
 await expect.poll(async()=>fit(await design(page))).toEqual(before);
 await expect(nowLine(panel)).toHaveText(nowBefore!);
 expect(errors).toEqual([]);
});

test('the Backyard patio editor opens the same Ground fit panel for the selected patio',async({page})=>{
 await showProjectControls(page);
 const nav=page.getByRole('navigation',{name:'Design tasks'}),open=nav.getByRole('button',{name:'Backyard',exact:true});
 if(!await open.isVisible())await nav.locator('details').filter({has:page.locator('button[aria-label="Backyard"]')}).locator('summary').click();
 await open.click();
 const entry=page.getByRole('button',{name:'Fit to the ground…',exact:true});
 await entry.scrollIntoViewIfNeeded();await entry.click();await expect(entry).toHaveAttribute('aria-expanded','true');
 const panel=page.getByRole('region',{name:'Ground fit',exact:true});
 await expect(nowLine(panel)).toHaveText('Now: 4 steps down to Stone landing at +5.00 in; main deck top +30.00 in.');
 await expect(panel.getByRole('button',{name:'Find options',exact:true})).toBeEnabled();
});

test('@phone Ground fit keeps every control at least 44 px and fits a 375 px screen',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const panel=await openGroundFit(page);
 await findOptions(panel);
 for(const control of await panel.locator('button,select,summary').all()){
  if(!await control.isVisible())continue;await control.scrollIntoViewIfNeeded();const box=(await control.boundingBox())!;
  expect(box.height,await control.evaluate(e=>e.outerHTML.slice(0,100))).toBeGreaterThanOrEqual(44);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
});
