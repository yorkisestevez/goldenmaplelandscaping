import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {proofDir} from './nav';

// The homeowner page has one navigation: four tabs, Draw · Materials · Extras · Price & send, in any order. They replace the
// ribbon's categories and the "All options" task rail; Designer Mode (`?designer=1`) keeps its own ribbon and menus.
const shots=proofDir('deck-home-tabs');
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

test('four tabs are the only design navigation',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await expect(tabs(page).getByRole('tab')).toHaveText(['Draw','Materials','Extras','Price & send']);
 await expect(tab(page,'Draw')).toHaveAttribute('aria-selected','true');
 await expect(page.getByRole('tablist',{name:'Tool categories'})).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Design tasks'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Show all options',exact:true})).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'Design inspector',exact:true})).toHaveCount(0);
 // No wizard: no counter, no Next or Back.
 await expect(page.getByRole('button',{name:/^(Next|Back)$/})).toHaveCount(0);
 await expect(page.locator('.dd-simple-tools').getByText(/\b\d+ of \d+\b/)).toHaveCount(0);
 for(const name of ['Deck size','Shape & points','Stairs','House','Rails & screens'])await expect(page.getByRole('radio',{name,exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sketch a design',exact:true})).toBeVisible();
 await sheetSelected(page,'Plan');
 await expect(panel(page)).toBeHidden();
 await page.screenshot({path:`${shots}/desktop-draw.png`});
});

test('a new board colour takes two taps, with the deck in 3D beside the panel',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await tab(page,'Materials').click();
 await expect(tab(page,'Materials')).toHaveAttribute('aria-selected','true');
 await sheetSelected(page,'3D');
 const colours=panel(page).locator('.dd-colours button');
 await expect(colours.first()).toBeVisible();
 const next=colours.nth(1),name=(await next.getAttribute('aria-label'))!;
 await expect(next).toContainText(name);
 await next.click();
 await expect(next).toHaveAttribute('aria-pressed','true');
 // Docked: the panel sits beside the drawing, not over it.
 const drawing=await box(page,'.dd-canvas'),side=await box(page,'#dd-home-panel');
 expect(side.x).toBeGreaterThanOrEqual(drawing.x+drawing.width-1);
 expect(side.y).toBeLessThan(drawing.y+drawing.height);
 await expect(panel(page).getByRole('button',{name:'Edit boards directly on the plan'})).toBeVisible();
 await page.screenshot({path:`${shots}/desktop-materials.png`});
});

test('Extras shows the yard tools on the plan and its sections in the panel',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await tab(page,'Extras').click();
 for(const name of ['Lighting','Privacy, skirting & extras','Backyard'])await expect(panel(page).getByRole('button',{name:new RegExp(`^${name.replace(/[&,]/g,m=>m)}`)}).first()).toBeVisible();
 await page.getByRole('tablist',{name:'Drawing sheets'}).getByRole('tab',{name:'Plan',exact:true}).click();
 for(const name of ['Landscape','Patios & walls'])await expect(page.getByRole('radio',{name,exact:true})).toBeVisible();
 await expect(page.getByRole('radio',{name:'Deck size',exact:true})).toHaveCount(0);
});

test('Price & send reads like a quote: each choice with its price and an Edit link, then Send',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await tab(page,'Price & send').click();
 const summary=panel(page).getByRole('list',{name:'Your design',exact:true});
 await expect(summary.getByRole('listitem')).not.toHaveCount(0);
 await expect(summary).toContainText('Boards & finish');
 await panel(page).getByRole('button',{name:'Edit Boards & finish',exact:true}).click();
 await expect(tab(page,'Materials')).toHaveAttribute('aria-selected','true');
 await expect(panel(page).locator('.dd-colours button').first()).toBeVisible();
 // The Edit link is gone with the summary, so the section it opened takes the focus.
 await expect(panel(page).locator('#dd-section-boards-body')).toBeFocused();
 await tab(page,'Price & send').click();
 await expect(panel(page).getByRole('button',{name:'Copy design link'})).toBeVisible();
 await expect(panel(page).getByRole('button',{name:'Download PDF'})).toBeVisible();
 await panel(page).getByRole('button',{name:'Send my design',exact:true}).click();
 await expect(page.getByRole('dialog',{name:/Send your design/})).toBeVisible();
 await page.screenshot({path:`${shots}/desktop-send.png`});
});

test('the arrow keys move between the tabs and Enter or Space opens one',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await tab(page,'Draw').focus();
 await page.keyboard.press('ArrowRight');
 await expect(tab(page,'Materials')).toBeFocused();
 // Moving the focus opens nothing, so arrowing past Materials does not load the 3D view.
 await expect(tab(page,'Draw')).toHaveAttribute('aria-selected','true');
 await expect(panel(page)).toBeHidden();
 await sheetSelected(page,'Plan');
 await page.keyboard.press('End');await expect(tab(page,'Price & send')).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(tab(page,'Draw')).toBeFocused();
 await page.keyboard.press('ArrowLeft');await expect(tab(page,'Price & send')).toBeFocused();
 await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect(tab(page,'Materials')).toHaveAttribute('aria-selected','true');
 await expect(panel(page)).toBeVisible();
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');
 await expect(tab(page,'Extras')).toHaveAttribute('aria-selected','true');
 await panel(page).getByRole('button',{name:'Hide panel',exact:true}).click();
 await expect(panel(page)).toBeHidden();
 await expect(tab(page,'Extras')).toBeFocused();
});

test('Deck settings on a fresh page opens Deck shape & size with the focus in it, once the panel has loaded',async({page,context})=>{
 // The panel's chunk is held back from the first request (the idle preload's too) until after the click.
 let release=()=>{},held=false;const gate=new Promise<void>(done=>{release=done;});
 await page.route(/\/HomePanel-[\w-]+\.js$/,async r=>{held=true;await gate;await r.continue();});
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await page.getByRole('button',{name:'Deck settings',exact:true}).click();
 await expect(panel(page)).toHaveCount(0);
 release();
 await expect(panel(page).locator('#dd-section-deck-body')).toBeFocused();
 expect(held,'the panel was still loading when the section opened').toBe(true);
});

test('picking the open tab again, its panel showing, leaves the view and the panel as they are',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await tab(page,'Materials').click();await expect(panel(page).locator('.dd-colours button').first()).toBeVisible();
 await page.getByRole('tablist',{name:'Drawing sheets'}).getByRole('tab',{name:'Plan',exact:true}).click();
 await tab(page,'Materials').click();
 await sheetSelected(page,'Plan');
 await expect(panel(page).locator('.dd-colours button').first()).toBeVisible();
});

test('the open tab, picked again after a new design, opens at its first section in 3D',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await tab(page,'Materials').click();await expect(panel(page).locator('.dd-colours button').first()).toBeVisible();
 const files=page.getByRole('region',{name:'Save and restore design'}),menu=files.locator('details.dd-workspace-files');
 await menu.locator('summary').first().click();
 await files.locator('summary',{hasText:'Start over'}).click();
 await files.getByRole('button',{name:'Start a new design'}).click();
 await expect(panel(page)).toBeHidden();
 if(await menu.evaluate(el=>(el as HTMLDetailsElement).open))await menu.locator('summary').first().click();
 await page.getByRole('tablist',{name:'Drawing sheets'}).getByRole('tab',{name:'Plan',exact:true}).click();
 // The new design reopened the Deck section, which is Draw's: Materials opens at Boards & finish again, in 3D.
 await tab(page,'Materials').click();
 await expect(panel(page).locator('.dd-colours button').first()).toBeVisible();
 await sheetSelected(page,'3D');
});

test('any tab opens in any order, and Draw puts the drawing back to full width',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 const full=(await box(page,'.dd-canvas')).width;
 await tab(page,'Price & send').click();await expect(panel(page)).toBeVisible();
 await tab(page,'Extras').click();await expect(panel(page)).toBeVisible();
 await tab(page,'Draw').click();
 await expect(panel(page)).toBeHidden();
 await sheetSelected(page,'Plan');
 expect((await box(page,'.dd-canvas')).width).toBeCloseTo(full,0);
});

test('@phone the tabs fit one row and the deck stays on screen while picking a colour',async({page,context})=>{
 await open(page,context);
 const rows=new Set<number>();for(const t of await tabs(page).getByRole('tab').all()){const b=(await t.boundingBox())!;rows.add(Math.round(b.y));expect(b.x+b.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);}
 expect(rows.size).toBe(1);
 await tab(page,'Materials').click();
 const colour=panel(page).locator('.dd-colours button').nth(1);
 await colour.scrollIntoViewIfNeeded();await colour.click();
 await expect(colour).toHaveAttribute('aria-pressed','true');
 // At least 200 px of the drawing shows between the sticky header (64 px) and the drawer.
 const drawing=await box(page,'.dd-canvas'),drawer=await box(page,'#dd-home-panel');
 expect(Math.min(drawing.y+drawing.height,drawer.y)-Math.max(drawing.y,64),'the deck stays in view above the drawer').toBeGreaterThanOrEqual(200);
 await expect(page.getByRole('region',{name:'Live price',exact:true})).toBeVisible();
 await page.screenshot({path:`${shots}/phone-materials.png`});
});

test('@phone Price & send sends the design from the drawer',async({page,context})=>{
 await open(page,context);
 await tab(page,'Price & send').click();
 const send=panel(page).getByRole('button',{name:'Send my design',exact:true});
 await send.scrollIntoViewIfNeeded();await send.click();
 await expect(page.getByRole('dialog',{name:/Send your design/})).toBeVisible();
 await page.screenshot({path:`${shots}/phone-send.png`});
});

test('@phone a drawer button that goes back to the drawing gives the focus to the tab it brings forward',async({page,context})=>{
 await open(page,context);
 await tab(page,'Extras').click();
 await panel(page).getByRole('button',{name:/^Privacy, skirting & extras/}).click();
 const place=panel(page).getByRole('button',{name:'Place screens on the drawing',exact:true});
 await place.scrollIntoViewIfNeeded();await place.focus();await page.keyboard.press('Enter');
 await expect(panel(page)).toBeHidden();
 // Placing screens is a Draw tool, so Draw comes forward and takes the focus, not the Extras tab the click came from.
 await expect(tab(page,'Draw')).toHaveAttribute('aria-selected','true');
 await expect(tab(page,'Draw')).toBeFocused();
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
