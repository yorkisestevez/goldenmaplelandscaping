import {test,expect,type Page,type BrowserContext} from '@playwright/test';

// The design tabs (Draw · Materials · Extras) were drawn only by the cost estimator's embedded studio, which the light
// deck estimator replaced (2026-11-11, deck-quick-estimator.spec.ts). The homeowner page has the new look's rail
// (deckcraft-next-shell.spec.ts); Designer Mode (`?designer=1`) keeps its own ribbon and menus, with no homeowner tabs.
const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
async function open(page:Page,context:BrowserContext,path:string){
 await context.addInitScript('window.__name=(t,v)=>t');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
 await page.goto(path);await ready(page);
}
const tabs=(page:Page)=>page.getByRole('tablist',{name:'Design',exact:true});

test('Designer Mode keeps its own ribbon and has no homeowner tabs',async({page,context})=>{
 await page.setViewportSize({width:1366,height:900});
 await open(page,context,'/deck-designer/?designer=1');
 await expect(page.getByRole('menubar',{name:'Pro workspace menu'})).toBeVisible();
 await expect(tabs(page)).toHaveCount(0);
});
