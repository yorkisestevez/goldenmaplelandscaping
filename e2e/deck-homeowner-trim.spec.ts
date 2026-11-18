import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {openDesignerMode,proofDir,startOnPlan} from './nav';

// The homeowner page (Designer Mode off, the new look) leaves contractor and Pro tools to Designer Mode (`?designer=1`),
// where every one of them stays; a design with something to review says so beside the price.
const shots=proofDir('deck-homeowner-trim');
const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
async function route(context:BrowserContext){
 await context.addInitScript('window.__name=(t,v)=>t');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
}
async function open(page:Page,context:BrowserContext){await route(context);await page.goto('/deck-designer/');await startOnPlan(page);await ready(page);}
const sheet=(page:Page,name:string)=>page.getByRole('tablist',{name:'Drawing sheets'}).getByRole('tab',{name,exact:true}).click();
// A window the railing crosses gives the design one warning to review.
const storageKey='golden-maple.deck-studio.deck-only.v1',house=getHouseConfig(DEFAULT_DECK),place=getHousePlacement(DEFAULT_DECK);
const clash={...structuredClone(DEFAULT_DECK),houseConfig:{...house,openings:[{id:'site-window',type:'Window',facade:'Front',offsetPct:(0-place.x0)/place.widthIn*100,bottomIn:48,widthIn:48,heightIn:54}]}};
const seedClash=(context:BrowserContext)=>context.addInitScript(({storageKey,clash})=>localStorage.setItem(storageKey,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:clash})),{storageKey,clash});

test('the Framing sheet and the 3D view keep contractor views and presentation tools for Designer Mode',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await open(page,context);
 await sheet(page,'Framing');await expect(page.getByRole('group',{name:'Contractor preview modes'}).getByRole('button')).toHaveText(['Plan','Framing']);
 await sheet(page,'3D');await expect(page.getByRole('group',{name:'Camera'})).toBeVisible({timeout:60_000});
 await expect(page.getByRole('button',{name:'Select objects in 3D',exact:true})).toHaveCount(0);
 await expect(page.locator('details.dd-3d-more')).toHaveCount(0);await expect(page.getByText('Fly-through',{exact:true})).toHaveCount(0);
 await page.screenshot({path:`${shots}/3d.png`});
});

test('Designer Mode keeps every control the homeowner page leaves out',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});await route(context);await openDesignerMode(page,'/deck-designer/?designer=1');
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

for(const phone of [false,true])test.describe(phone?'phone issues link':'desktop issues link',()=>{
 test.use(phone?{viewport:{width:390,height:844},hasTouch:true,isMobile:true}:{viewport:{width:1366,height:900}});
 test(`${phone?'@phone ':''}the default design shows no issues to review`,async({page,context})=>{
  await open(page,context);await expect(page.locator('[data-autosave-state="saved"]')).toBeAttached();
  await expect(page.getByRole('region',{name:'Live price',exact:true}).getByRole('button',{name:/issues? to review$/})).toHaveCount(0);
 });
 test(`${phone?'@phone ':''}the price pill shows how many issues there are to review, and opens them`,async({page,context})=>{
  await seedClash(context);await open(page,context);
  const price=page.getByRole('region',{name:'Live price',exact:true}),link=price.getByRole('button',{name:/^\d+ issues? to review$/});
  await expect(link).toBeVisible();
  await page.screenshot({path:`${shots}/issues-${phone?'phone':'desktop'}.png`});
  await link.click();await expect(page.getByRole('dialog',{name:'Construction readiness',exact:true})).toBeVisible();
 });
});
