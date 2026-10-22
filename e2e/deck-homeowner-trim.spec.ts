import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {openDesignerMode,openHomeTab,proofDir} from './nav';

// The homeowner page (Designer Mode off) keeps draw, materials, price and Send in view and leaves contractor and Pro
// tools to Designer Mode (`?designer=1`), where every one of them stays.
const shots=proofDir('deck-homeowner-trim');
const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
async function route(context:BrowserContext){
 await context.addInitScript('window.__name=(t,v)=>t');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
}
async function open(page:Page,context:BrowserContext){await route(context);await page.goto('/deck-designer/');await ready(page);}
const box=async(page:Page,selector:string)=>(await page.locator(selector).first().boundingBox())!;
const apart=(a:{x:number;y:number;width:number;height:number},b:typeof a)=>a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y;
const sheet=(page:Page,name:string)=>page.getByRole('tablist',{name:'Drawing sheets'}).getByRole('tab',{name,exact:true}).click();
/** The price shares the sheet-tab row with the sheet tabs, and never covers the four tabs or the tools below them. */
async function priceClearOfControls(page:Page){
 const bar=await box(page,'.dd-workspace-price');
 for(const control of ['.dd-sheet-tabs','.dd-ribbon-tabs','.dd-simple-tools-grid'])expect(apart(bar,await box(page,control)),`price clear of ${control}`).toBe(true);
}
// A window the railing crosses gives the design one warning to review.
const storageKey='golden-maple.deck-studio.deck-only.v1',house=getHouseConfig(DEFAULT_DECK),place=getHousePlacement(DEFAULT_DECK);
const clash={...structuredClone(DEFAULT_DECK),houseConfig:{...house,openings:[{id:'site-window',type:'Window',facade:'Front',offsetPct:(0-place.x0)/place.widthIn*100,bottomIn:48,widthIn:48,heightIn:54}]}};
const seedClash=(context:BrowserContext)=>context.addInitScript(({storageKey,clash})=>localStorage.setItem(storageKey,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:clash})),{storageKey,clash});

for(const [width,height] of [[1366,900],[1280,720],[801,700]] as const)test(`the price shows on first load at ${width} px without taking room from the drawing`,async({page,context})=>{
 await page.setViewportSize({width,height});await open(page,context);
 await expect(page.locator('.deck-designer')).toHaveAttribute('data-drawing-focus','true');
 const price=page.getByRole('region',{name:'Live price',exact:true});
 await expect(price).toBeVisible();await expect(price.getByLabel('Priced subtotal',{exact:true})).toHaveText(/^\$[\d,]+$/);await expect(price).toContainText('before HST');
 await priceClearOfControls(page);
 // The drawing keeps the drawing-focus height rule, max(280px, 100dvh - 300px), and ends inside the window.
 const canvas=await box(page,'.dd-plan-viewport');expect(canvas.y+canvas.height).toBeLessThanOrEqual(height+1);expect(canvas.height).toBeGreaterThanOrEqual(Math.max(280,height-300)-1);
 await page.screenshot({path:`${shots}/price-${width}.png`});
});

test('scrolling down to the tool options carries the price along with the sheet tabs',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 const tabsBefore=await box(page,'.dd-sheet-tabs'),barBefore=await box(page,'.dd-workspace-price');
 await page.locator('.dd-selection-inspector>summary').scrollIntoViewIfNeeded();
 const tabsAfter=await box(page,'.dd-sheet-tabs'),barAfter=await box(page,'.dd-workspace-price');
 expect(tabsAfter.y).toBeLessThan(tabsBefore.y);
 expect(barAfter.y-barBefore.y).toBeCloseTo(tabsAfter.y-tabsBefore.y,0);
 await priceClearOfControls(page);
});

test('the header keeps Send and leaves Presets and Agents to Designer Mode',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 const header=page.locator('header.dd-header');
 await expect(header.getByRole('button',{name:'Send my design',exact:true})).toBeVisible();
 await expect(header.getByRole('button',{name:'Presets',exact:true})).toHaveCount(0);await expect(header.getByRole('button',{name:'Agents',exact:true})).toHaveCount(0);
});

test('the four tabs show their plan tools without Select parts, each with the sketch button',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 const tabs=page.getByRole('tablist',{name:'Design',exact:true});await expect(tabs.getByRole('tab')).toHaveText(['Draw','Materials','Extras','Price & send']);
 for(const [tab,tools] of [['Draw',['Deck size','Shape & points','Stairs','House','Rails & screens']],['Extras',['Landscape','Patios & walls']],['Materials',['Board layout','Inlays']]] as const){
  await tabs.getByRole('tab',{name:tab,exact:true}).click();await sheet(page,'Plan');
  await expect(page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio')).toHaveText([...tools]);
  await expect(page.getByRole('button',{name:'Sketch a design',exact:true})).toBeVisible();
 }
 expect(errors).toEqual([]);
});

test('the tab panels list every section by name, beside the save status and no contractor tools',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await expect(page.getByRole('region',{name:'Live price',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Contractor job tools'}).getByRole('button')).toHaveCount(0);await expect(page.locator('[data-autosave-state]')).toBeVisible();
 for(const name of ['Describe a change','Jobs & versions','Review quote costs','Elevations & build','Keyboard shortcuts · F1'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
 const rows=page.locator('#dd-home-panel .dd-home-row strong');
 await page.getByRole('button',{name:'Deck settings',exact:true}).click();await expect(rows).toHaveText(['Deck shape & size','Stairs & railings','House']);
 for(const [tab,items] of [['Materials',['Boards & finish']],['Extras',['Lighting','Privacy, skirting & extras','Backyard']],['Price & send',['Site & foundation','Proposal & files']]] as const){
  await openHomeTab(page,tab);await expect(rows).toHaveText([...items]);
 }
 await page.keyboard.press('F1');await expect(page.getByRole('dialog',{name:'Keyboard shortcuts'})).toBeVisible();await page.keyboard.press('Escape');
 await page.screenshot({path:`${shots}/tab-panels.png`});
});

test('the Framing sheet and the 3D view keep contractor views and presentation tools for Designer Mode',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await sheet(page,'Framing');await expect(page.getByRole('group',{name:'Contractor preview modes'}).getByRole('button')).toHaveText(['Plan','Framing']);
 await sheet(page,'3D');await expect(page.getByRole('group',{name:'Camera'})).toBeVisible({timeout:60_000});
 await expect(page.getByRole('button',{name:'Select objects in 3D',exact:true})).toHaveCount(0);
 await expect(page.locator('details.dd-3d-more')).toHaveCount(0);await expect(page.getByText('Fly-through',{exact:true})).toHaveCount(0);
 await page.screenshot({path:`${shots}/3d.png`});
});

test('Designer Mode keeps every control the homeowner page leaves out',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await route(context);await openDesignerMode(page);
 const slot=page.locator('#dd-workspace-agent-slot');await expect(slot.getByRole('button',{name:'Presets',exact:true})).toBeVisible();await expect(slot.getByRole('button',{name:'Agents',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Live price',exact:true}).getByRole('button',{name:'Review quote costs',exact:true})).toBeVisible();
 await expect(page.getByRole('group',{name:'Quick tools'}).getByRole('button',{name:'Select parts',exact:true})).toBeVisible();
 await expect(page.getByRole('tablist',{name:'Ribbon tabs'}).getByRole('tab',{name:'Terrain',exact:true})).toBeVisible();
 const menus=page.getByRole('menubar',{name:'Pro workspace menu'});
 for(const [menu,item] of [['File','Saved jobs & versions…'],['Edit','Describe a change…'],['Settings','Quote costs…'],['Tools','Agents…'],['Help','Keyboard shortcuts']] as const){
  await menus.getByRole('menuitem',{name:menu,exact:true}).click();await expect(page.getByRole('menu',{name:menu}).getByRole('menuitem',{name:new RegExp(`^${item}`)})).toBeVisible();await page.keyboard.press('Escape');
 }
 await sheet(page,'Framing');await expect(page.getByRole('group',{name:'Contractor preview modes'}).getByRole('button')).toHaveText(['Plan','Framing','Hardware','Below ground']);
 await sheet(page,'3D');await expect(page.getByRole('group',{name:'Camera'})).toBeVisible({timeout:60_000});
 await expect(page.getByRole('button',{name:'Select objects in 3D',exact:true})).toBeVisible();
 await expect(page.locator('details.dd-3d-more>summary')).toHaveText('More');await expect(page.getByText('Fly-through',{exact:true})).toBeVisible();
});

test('the plan tools still show when Select parts was chosen elsewhere',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await sheet(page,'Framing');
 // The agent interface and a located warning pick a part, which switches the plan to Select parts.
 const id=await page.evaluate(()=>(window as any).deckcraftWorkspace.read().objects.find((o:any)=>o.id.startsWith('deck:')).id);
 await page.evaluate(id=>(window as any).deckcraftWorkspace.select(id),id);
 await sheet(page,'Plan');
 await expect(page.getByRole('tablist',{name:'Design',exact:true})).toBeVisible();await expect(page.locator('.dd-ribbon-hint')).toContainText('Select parts');
 await expect(page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio',{checked:true})).toHaveCount(0);
 expect(errors).toEqual([]);
});

for(const phone of [false,true])test.describe(phone?'phone issues link':'desktop issues link',()=>{
 test.use(phone?{viewport:{width:390,height:844},hasTouch:true,isMobile:true}:{viewport:{width:1366,height:900}});
 test(`${phone?'@phone ':''}the default design has no Review issues link`,async({page,context})=>{
  await open(page,context);await expect(page.locator('[data-autosave-state="saved"]')).toBeAttached();
  await expect(page.getByRole('region',{name:'Live price',exact:true}).getByRole('button',{name:/^Review \d+ issues?$/})).toHaveCount(0);
 });
 test(`${phone?'@phone ':''}Review issues sits last in the price bar when there is something to review`,async({page,context})=>{
  await seedClash(context);await open(page,context);
  const price=page.getByRole('region',{name:'Live price',exact:true}),link=price.getByRole('button',{name:/^Review \d+ issues?$/});await expect(link).toBeVisible();
  await expect(price.getByRole('button').last()).toHaveText(/^Review \d+ issues?$/);
  if(phone)expect((await box(page,'.dd-workspace-price')).height).toBeLessThanOrEqual(120);
  await page.screenshot({path:`${shots}/issues-${phone?'phone':'desktop'}.png`});
  await link.click();await expect(page.getByRole('dialog',{name:'Construction readiness',exact:true})).toBeVisible();
 });
});

for(const width of [801,900])test(`with a warning to review, the price still clears the sheet tabs at ${width} px`,async({page,context})=>{
 await page.setViewportSize({width,height:700});await seedClash(context);await open(page,context);
 await expect(page.getByRole('region',{name:'Live price',exact:true}).getByRole('button',{name:/^Review \d+ issues?$/})).toBeVisible();
 await priceClearOfControls(page);
});

test('the cost estimator studio keeps its own price, not a second one',async({page,context})=>{
 await page.setViewportSize({width:1440,height:900});await context.addInitScript('window.__name=(t,v)=>t');
 await page.goto('/cost-estimator/?studio=deck');await expect(page.locator('section.dd-simple-tools')).toBeVisible({timeout:30_000});
 await expect(page.locator('.dd-estimator-price')).toBeVisible();await expect(page.locator('.deck-designer[data-embedded] .dd-workspace-price')).toBeHidden();
});
