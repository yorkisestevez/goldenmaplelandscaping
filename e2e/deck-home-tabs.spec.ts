import {test,expect,type Page,type BrowserContext} from '@playwright/test';

// The design tabs (Draw · Materials · Extras), as the cost estimator's studio draws them: the homeowner page has the new
// look's rail instead (deckcraft-next-shell.spec.ts) and Designer Mode (`?designer=1`) its own ribbon and menus.
const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
async function open(page:Page,context:BrowserContext,path='/deck-designer/'){
 await context.addInitScript('window.__name=(t,v)=>t');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
 await page.goto(path);await ready(page);
}
const tabs=(page:Page)=>page.getByRole('tablist',{name:'Design',exact:true});
const tab=(page:Page,name:string)=>tabs(page).getByRole('tab',{name,exact:true});
const sheetSelected=(page:Page,name:string)=>expect(page.getByRole('tablist',{name:'Drawing sheets'}).getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');
const panel=(page:Page)=>page.locator('#dd-home-panel');
const box=async(page:Page,selector:string)=>(await page.locator(selector).first().boundingBox())!;
const STUDIO='/cost-estimator/?studio=deck';

test('the arrow keys move between the tabs and Enter or Space opens one',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context,STUDIO);
 await tab(page,'Draw').focus();
 await page.keyboard.press('ArrowRight');
 await expect(tab(page,'Materials')).toBeFocused();
 // Moving the focus opens nothing, so arrowing past Materials does not load the 3D view.
 await expect(tab(page,'Draw')).toHaveAttribute('aria-selected','true');
 await expect(panel(page)).toBeHidden();
 await sheetSelected(page,'Plan');
 await page.keyboard.press('End');await expect(tab(page,'Extras')).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(tab(page,'Draw')).toBeFocused();
 await page.keyboard.press('ArrowLeft');await expect(tab(page,'Extras')).toBeFocused();
 await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect(tab(page,'Materials')).toHaveAttribute('aria-selected','true');
 await expect(panel(page)).toBeVisible();
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');
 await expect(tab(page,'Extras')).toHaveAttribute('aria-selected','true');
 await panel(page).getByRole('button',{name:'Hide panel',exact:true}).click();
 await expect(panel(page)).toBeHidden();
 await expect(tab(page,'Extras')).toBeFocused();
});

test('any tab opens in any order, and Draw puts the drawing back to full width',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context,STUDIO);
 const full=(await box(page,'.dd-canvas')).width;
 await tab(page,'Extras').click();await expect(panel(page)).toBeVisible();
 await tab(page,'Materials').click();await expect(panel(page)).toBeVisible();
 await tab(page,'Draw').click();
 await expect(panel(page)).toBeHidden();
 await sheetSelected(page,'Plan');
 expect((await box(page,'.dd-canvas')).width).toBeCloseTo(full,0);
});

test('Designer Mode keeps its own ribbon and has no homeowner tabs',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});
 await open(page,context,'/deck-designer/?designer=1');
 await expect(page.getByRole('menubar',{name:'Pro workspace menu'})).toBeVisible();
 await expect(tabs(page)).toHaveCount(0);
});

test('the cost estimator studio has the tabs but keeps its own price and hand-off',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});
 await open(page,context,'/cost-estimator/?studio=deck');
 await expect(tabs(page).getByRole('tab')).toHaveText(['Draw','Materials','Extras']);
 await expect(page.locator('.dd-estimator-price')).toBeVisible();
});

test('in the cost estimator studio each section links on to the next under the same tab',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});
 await open(page,context,'/cost-estimator/?studio=deck');
 // The studio has no Price & send tab: Site & foundation and Proposal & files sit under Extras.
 await tab(page,'Extras').click();
 await panel(page).getByRole('button',{name:/^Backyard/}).click();
 await panel(page).getByRole('button',{name:'See the estimate and send it: open Proposal & files',exact:true}).click();
 await expect(tab(page,'Extras')).toHaveAttribute('aria-selected','true');
 await expect(panel(page).locator('#dd-section-proposal-body')).toBeFocused();
});
