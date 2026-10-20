import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {proofDir,showProjectControls} from './nav';

// The homeowner page (Designer Mode off) keeps draw, materials, price and Send in view and leaves contractor and Pro
// tools to Designer Mode (`?designer=1`), where every one of them stays.
const shots=proofDir('deck-homeowner-trim');
const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
async function open(page:Page,context:BrowserContext,url='/deck-designer/'){
 await context.addInitScript('window.__name=(t,v)=>t');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
 await page.goto(url);await ready(page);
}
const box=async(page:Page,selector:string)=>(await page.locator(selector).first().boundingBox())!;
const apart=(a:{x:number;y:number;width:number;height:number},b:typeof a)=>a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y;
const sheet=(page:Page,name:string)=>page.getByRole('tablist',{name:'Drawing sheets'}).getByRole('tab',{name,exact:true}).click();

for(const [width,height] of [[1366,900],[1280,720],[801,700]] as const)test(`the price shows on first load at ${width} px without taking room from the drawing`,async({page,context})=>{
 await page.setViewportSize({width,height});await open(page,context);
 await expect(page.locator('.deck-designer')).toHaveAttribute('data-drawing-focus','true');
 const price=page.getByRole('region',{name:'Live price',exact:true});
 await expect(price).toBeVisible();await expect(price.getByLabel('Priced subtotal',{exact:true})).toHaveText(/^\$[\d,]+$/);await expect(price).toContainText('before HST');
 const bar=await box(page,'.dd-workspace-price');
 expect(apart(bar,await box(page,'.dd-sheet-tabs'))).toBe(true);expect(apart(bar,await box(page,'.dd-drawing-focus-toggle'))).toBe(true);expect(apart(bar,await box(page,'.dd-simple-tools'))).toBe(true);
 const canvas=await box(page,'.dd-plan-viewport');expect(canvas.y+canvas.height).toBeLessThanOrEqual(height+1);expect(canvas.height).toBeGreaterThanOrEqual(Math.max(280,height-300)-1);
 await page.screenshot({path:`${shots}/price-${width}.png`});
});

test('the homeowner page leaves contractor and Pro tools to Designer Mode',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 const header=page.locator('header.dd-header');
 await expect(header.getByRole('button',{name:'Send my design',exact:true})).toBeVisible();
 await expect(header.getByRole('button',{name:'Presets',exact:true})).toHaveCount(0);await expect(header.getByRole('button',{name:'Agents',exact:true})).toHaveCount(0);
 const all=page.getByRole('button',{name:'Show all options',exact:true});await expect(all).toHaveText('All options');
 // Three tool categories, each with its own tools and the sketch button; Select parts is a Designer Mode tool.
 const tabs=page.getByRole('tablist',{name:'Tool categories'});await expect(tabs.getByRole('tab')).toHaveText(['Building','Landscape','Materials']);
 for(const [tab,tools] of [['Building',['Deck size','Shape & points','Stairs','House','Rails & screens']],['Landscape',['Landscape','Patios & walls']],['Materials',['Board layout','Inlays']]] as const){
  await tabs.getByRole('tab',{name:tab,exact:true}).click();
  await expect(page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio')).toHaveText([...tools]);
  await expect(page.getByRole('button',{name:'Sketch a design',exact:true})).toBeVisible();
 }
 await all.click();await expect(page.getByRole('button',{name:'Focus drawing',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Contractor job tools'}).getByRole('button')).toHaveCount(0);
 await expect(page.locator('[data-autosave-state]')).toBeVisible();
 for(const name of ['Describe a change','Jobs & versions','Review quote costs','Elevations & build','Keyboard shortcuts · F1'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
 // The task menus show each section by its own name.
 const nav=page.getByRole('navigation',{name:'Design tasks'});
 for(const summary of await nav.locator('summary').all()){await summary.click();for(const item of await nav.locator('details[open] .dd-nav-menu button').all())await expect(item).toHaveText(await item.getAttribute('aria-label')??'');await summary.click();}
 await page.keyboard.press('F1');await expect(page.getByRole('dialog',{name:'Keyboard shortcuts'})).toBeVisible();await page.keyboard.press('Escape');
 await page.screenshot({path:`${shots}/all-options.png`});
 await sheet(page,'Framing');await expect(page.getByRole('group',{name:'Contractor preview modes'}).getByRole('button')).toHaveText(['Plan','Framing']);
 await sheet(page,'3D');await expect(page.getByRole('group',{name:'Camera'})).toBeVisible({timeout:60_000});
 await expect(page.getByRole('button',{name:'Select objects in 3D',exact:true})).toHaveCount(0);
 await expect(page.locator('details.dd-3d-more')).toHaveCount(0);await expect(page.getByText('Fly-through',{exact:true})).toHaveCount(0);
 await page.screenshot({path:`${shots}/3d.png`});
 expect(errors).toEqual([]);
});

test('Designer Mode keeps every control the homeowner page leaves out',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context,'/deck-designer/?designer=1');
 await expect(page.getByRole('menubar',{name:'Pro workspace menu'})).toBeVisible();
 const slot=page.locator('#dd-workspace-agent-slot');await expect(slot.getByRole('button',{name:'Presets',exact:true})).toBeVisible();await expect(slot.getByRole('button',{name:'Agents',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Live price',exact:true}).getByRole('button',{name:'Review quote costs',exact:true})).toBeVisible();
 await sheet(page,'Framing');await expect(page.getByRole('group',{name:'Contractor preview modes'}).getByRole('button')).toHaveText(['Plan','Framing','Hardware','Below ground']);
 await sheet(page,'3D');await expect(page.getByRole('group',{name:'Camera'})).toBeVisible({timeout:60_000});
 await expect(page.getByRole('button',{name:'Select objects in 3D',exact:true})).toBeVisible();
 await expect(page.locator('details.dd-3d-more>summary')).toHaveText('More');await expect(page.getByText('Fly-through',{exact:true})).toBeVisible();
});

test('the plan ribbon still opens when Select parts was chosen elsewhere',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await sheet(page,'Framing');
 // The agent interface and a located warning pick a part, which switches the plan to Select parts.
 const id=await page.evaluate(()=>(window as any).deckcraftWorkspace.read().objects.find((o:any)=>o.id.startsWith('deck:')).id);
 await page.evaluate(id=>(window as any).deckcraftWorkspace.select(id),id);
 await sheet(page,'Plan');
 await expect(page.getByRole('tablist',{name:'Tool categories'})).toBeVisible();await expect(page.locator('.dd-ribbon-hint')).toContainText('Select parts');
 await expect(page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio',{checked:true})).toHaveCount(0);
 expect(errors).toEqual([]);
});

// A window the railing crosses gives the design one warning to review.
const storageKey='golden-maple.deck-studio.deck-only.v1',house=getHouseConfig(DEFAULT_DECK),place=getHousePlacement(DEFAULT_DECK);
const clash={...structuredClone(DEFAULT_DECK),houseConfig:{...house,openings:[{id:'site-window',type:'Window',facade:'Front',offsetPct:(0-place.x0)/place.widthIn*100,bottomIn:48,widthIn:48,heightIn:54}]}};
for(const phone of [false,true])test.describe(phone?'phone issues link':'desktop issues link',()=>{
 test.use(phone?{viewport:{width:390,height:844},hasTouch:true,isMobile:true}:{viewport:{width:1366,height:900}});
 test(`${phone?'@phone ':''}the default design has no Review issues link`,async({page,context})=>{
  await open(page,context);await expect(page.locator('[data-autosave-state="saved"]')).toBeAttached();
  await expect(page.getByRole('region',{name:'Live price',exact:true}).getByRole('button',{name:/^Review \d+ issues?$/})).toHaveCount(0);
 });
 test(`${phone?'@phone ':''}Review issues sits in the price bar when there is something to review`,async({page,context})=>{
  await context.addInitScript(({storageKey,clash})=>localStorage.setItem(storageKey,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:clash})),{storageKey,clash});
  await open(page,context);
  const link=page.getByRole('region',{name:'Live price',exact:true}).getByRole('button',{name:/^Review \d+ issues?$/});await expect(link).toBeVisible();
  if(phone)expect((await box(page,'.dd-workspace-price')).height).toBeLessThanOrEqual(120);
  await page.screenshot({path:`${shots}/issues-${phone?'phone':'desktop'}.png`});
  await link.click();await expect(page.getByRole('dialog',{name:'Construction readiness',exact:true})).toBeVisible();
 });
});

test('the cost estimator studio keeps its own price, not a second one',async({page,context})=>{
 await page.setViewportSize({width:1440,height:900});await context.addInitScript('window.__name=(t,v)=>t');
 await page.goto('/cost-estimator/?studio=deck');await expect(page.locator('section.dd-simple-tools')).toBeVisible({timeout:30_000});
 await expect(page.locator('.deck-designer[data-embedded] .dd-workspace-price')).toBeHidden();
});

test('All options still shows the task menus and the price bar below the drawing',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await showProjectControls(page);
 await expect(page.getByRole('navigation',{name:'Design tasks'})).toBeVisible();await expect(page.getByRole('region',{name:'Live price',exact:true})).toBeVisible();
});
