import {expect,test,type Page} from '@playwright/test';
import {openDesignTask,pickPlanTool,showProjectControls} from './nav';
const names=['Deck shape & size','House','Boards & finish','Stairs & railings','Outdoor lighting','Privacy, skirting & extras','Site & foundation','Backyard','Proposal & files'];
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return ['127.0.0.1','localhost'].includes(host)?route.fallback():route.abort();});
  await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms)\//,r=>r.fulfill({body:''}));
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.fulfill({body:''}));
});
async function open(page:Page){await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);}
async function reach(page:Page){
  for(const name of names){
    await openDesignTask(page,name);
    const panel=page.getByRole('region',{name,exact:true});await expect(panel).toBeVisible();
    await expect(panel.getByRole('button',{name:/: open /})).toBeVisible();
    await expect(page.getByRole('dialog',{name:'Design inspector',exact:true})).toHaveCount(1);
    expect(await panel.locator('input,button,select').count(),`${name} retains its controls`).toBeGreaterThan(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width+1);
  }
}
test('every task remains reachable in one inspector; complete pricing and keyboard focus are accessible',async({page})=>{
  await open(page);await reach(page);
  await page.getByRole('dialog',{name:'Design inspector',exact:true}).getByRole('button',{name:'Done · back to drawing',exact:true}).click();
  await showProjectControls(page);
  const price=page.getByRole('region',{name:'Live price'});await expect(price.getByRole('status',{name:'Priced subtotal'})).toContainText('$');
  await price.getByRole('button',{name:'Price schedule'}).click();
  const dialog=page.getByRole('dialog',{name:'Price schedule'});await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Golden Maple price book',{exact:false})).toBeVisible();await expect(dialog.getByRole('list',{name:/Still to be quoted/})).toBeVisible();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(price.getByRole('button',{name:'Price schedule'})).toBeFocused();
  const tasks=page.getByRole('navigation',{name:'Design tasks'});const designMenu=tasks.locator('summary').filter({hasText:/^Design$/});await designMenu.click();await designMenu.focus();await page.keyboard.press('Tab');await page.keyboard.press('Tab');await expect(tasks.getByRole('button',{name:'House',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'House',exact:true})).toBeFocused();
});
test('@phone all tasks fit320px; return to canvas and viewport controls remain above pricing',async({page})=>{
  await page.setViewportSize({width:320,height:740});await open(page);await reach(page);
  await page.getByRole('dialog',{name:'Design inspector',exact:true}).getByRole('button',{name:'Done · back to drawing',exact:true}).click();await pickPlanTool(page,'Shape & points');await expect(page.getByRole('button',{name:'Main deck point 3',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Fit drawing',exact:true}).scrollIntoViewIfNeeded();
  const controls=(await page.getByRole('group',{name:'Drawing navigation'}).boundingBox())!,price=(await page.getByRole('region',{name:'Live price'}).boundingBox())!;
  expect(controls.y+controls.height).toBeLessThanOrEqual(price.y+1);
  expect(await page.locator('nav[aria-label="Design tasks"] button[aria-label="Proposal & files"]').getAttribute('aria-expanded')).toBe('false');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});
