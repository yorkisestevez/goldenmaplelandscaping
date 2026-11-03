import {test,expect,type BrowserContext,type Page} from '@playwright/test';

/**
 * Where the designer opens (owner, 2026-11-02): a desktop with WebGL opens in 3D, handed over from the plan the page is
 * prerendered with once the 3D viewer has loaded; a phone, a browser without WebGL and a visitor who has already started
 * on the plan stay on the plan. The hand-over swaps the drawing only: the controls around it never move.
 */
const view=(page:Page)=>page.evaluate(()=>(window as {deckcraft?:{read():{view:string}}}).deckcraft?.read().view);
const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as {deckcraft?:{read():{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
async function stubOffsite(context:BrowserContext){
 await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/,route=>route.fulfill({body:''}));
}

test('a desktop opens in 3D, and the controls around the drawing stay where they were painted',async({page,context})=>{
 await page.setViewportSize({width:1440,height:900});
 await stubOffsite(context);
 await context.addInitScript(()=>{
  const w=window as any;w.__shift=0;
  new PerformanceObserver(list=>{for(const e of list.getEntries() as any[])if(!e.hadRecentInput)w.__shift+=e.value;}).observe({type:'layout-shift',buffered:true});
  document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(()=>{w.__boxes=['.dd-next-top','.dd-next-rail','.dd-next-price','.dd-canvas'].map(s=>JSON.stringify(document.querySelector(s)?.getBoundingClientRect()));}));
 });
 await page.goto('/deck-designer/');await ready(page);
 await expect.poll(()=>view(page),{timeout:30_000}).toBe('3d');
 await expect(page.locator('.dd-canvas>[aria-label="Interactive deck construction model"]')).toBeVisible({timeout:60_000});
 expect(await page.evaluate(()=>['.dd-next-top','.dd-next-rail','.dd-next-price','.dd-canvas'].map(s=>JSON.stringify(document.querySelector(s)?.getBoundingClientRect())))).toEqual(await page.evaluate(()=>(window as any).__boxes));
 expect(await page.evaluate(()=>(window as any).__shift)).toBeLessThanOrEqual(0.005);
});

for(const how of ['click','key'] as const)test(`a visitor who starts on the plan (${how}) before the 3D view is ready stays on it`,async({page,context})=>{
 await page.setViewportSize({width:1440,height:900});
 await stubOffsite(context);
 // The viewer's chunk is held, so the visitor's first press lands while the plan is still up.
 let release=()=>{};const held=new Promise<void>(done=>{release=done;});
 await context.route(/\/assets\/Deck3DViewer-[^/]*\.js$/,async route=>{await held;await route.continue();});
 await page.goto('/deck-designer/');await ready(page);
 if(how==='click')await page.mouse.click(720,480);else await page.keyboard.press('Tab');
 release();
 await page.waitForResponse(/\/assets\/Deck3DViewer-[^/]*\.js$/);
 await page.evaluate(()=>new Promise(done=>setTimeout(done,500)));
 expect(await view(page)).toBe('plan');
});

test('without WebGL a desktop stays on the plan',async({page,context})=>{
 await page.setViewportSize({width:1440,height:900});
 await stubOffsite(context);
 await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:string,...rest:unknown[]){return /webgl/.test(kind)?null:(get as any).call(this,kind,...rest);} as typeof get;});
 await page.goto('/deck-designer/');await ready(page);
 await page.evaluate(()=>new Promise(done=>setTimeout(done,1500)));
 expect(await view(page)).toBe('plan');
 await expect(page.locator('.dd-plan-stage>.dd-plan-editor')).toBeAttached();
});

test('@phone a phone opens on the plan and never downloads the 3D viewer at load',async({page,context})=>{
 await stubOffsite(context);
 const viewer:string[]=[];page.on('request',request=>{if(/\/assets\/Deck3DViewer-/.test(request.url()))viewer.push(request.url());});
 await page.goto('/deck-designer/');await ready(page);
 await page.evaluate(()=>new Promise(done=>setTimeout(done,1500)));
 expect(await view(page)).toBe('plan');
 expect(viewer).toEqual([]);
});
