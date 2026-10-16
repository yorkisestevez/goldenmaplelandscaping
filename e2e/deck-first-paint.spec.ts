import {test,expect,type BrowserContext} from '@playwright/test';

/**
 * A slow first load of the designer. It is prerendered with its drawing in place (the Project controls button, the tools
 * ribbon, the plan and its zoom bar): after the first paint nothing there may move, and React must hydrate that HTML, never
 * replace it ("Preparing design workspace…", a ribbon that vanishes and comes back 57 px taller: CLS 0.08 before October 16).
 * Scripts are held until after the first paint and the drawing's own chunks longer, so the page's first effects would run
 * before those land. Boxes are compared with the same run's first paint, never fixed pixels (CI's fonts differ); fonts and
 * trackers are stubbed, and nothing here draws WebGL.
 */
const PIECES=/\/assets\/(PreviewPanel|ArchitectShortcuts|PlanToolPicker|PlanEditingWorkspace|DimensionsStep|EasyEditTools)-/;
/** First-painted nodes that must survive hydration, and whether their height must hold too (the drawing's own height
 *  includes what is below the fold). */
const KEPT:[string,boolean][]=[['#deck-live-preview',false],['.dd-drawing-focus-toggle',true],['section.dd-simple-tools',true],['.dd-canvas>.dd-plan-viewport',true],['.dd-plan-navigation',true],['#dd-section-deck-body>:first-child',false]];

async function slowLoad(context:BrowserContext){
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url))return route.fulfill({body:''});
  const hold=PIECES.test(url)?700:/\/assets\/[^?#]*\.js$/.test(url)?400:0;
  if(hold)await new Promise(done=>setTimeout(done,hold));
  await route.continue();
 });
 await context.addInitScript((kept:[string,boolean][])=>{
  const w=window as any;w.__shift={total:0,sources:[]};
  new PerformanceObserver(list=>{for(const e of list.getEntries() as any[])if(!e.hadRecentInput){w.__shift.total+=e.value;for(const s of e.sources??[])w.__shift.sources.push(`${s.node?.nodeName} ${s.node?.id||s.node?.getAttribute?.('class')||''}: y ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}, h ${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)} (${e.value.toFixed(4)})`);}}).observe({type:'layout-shift',buffered:true});
  // React's streamed HTML moves the prerendered pieces into place on the first frame: take them, and their boxes, then, and
  // watch for a loading fallback from then on (the shell's own placeholders are parsed before that).
  document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const first=kept.map(([selector,sized])=>{const el=document.querySelector(selector);return {selector,sized,el,box:el?.getBoundingClientRect()};}),fallbacks:string[]=[];
   new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n instanceof HTMLElement&&/Preparing design workspace|Loading Deck shape/.test(n.textContent??''))fallbacks.push(n.textContent!.trim());}).observe(document.body,{childList:true,subtree:true});
   w.__kept=()=>({fallbacks,changed:first.flatMap(({selector,sized,el,box})=>{
    if(!el||!box)return [`${selector}: not in the first paint`];
    if(!el.isConnected||document.querySelector(selector)!==el)return [`${selector}: replaced`];
    const now=el.getBoundingClientRect(),moved=Math.max(Math.abs(now.x-box.x),Math.abs(now.y-box.y),Math.abs(now.width-box.width),sized?Math.abs(now.height-box.height):0);
    return moved>1?[`${selector}: moved ${moved.toFixed(1)} px`]:[];
   })});
  })));
 },KEPT);
}

for(const phone of [false,true])test(`the prerendered designer hydrates in place and nothing moves after the first paint ${phone?'@phone':''}`,async({page,context})=>{
 await page.setViewportSize(phone?{width:390,height:844}:{width:1440,height:900});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await slowLoad(context);
 await page.goto('/deck-designer/');
 // Settled: the design is ready, and the job bar and the plan's handles (mounted after hydration, the last to land) are in.
 await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false),{timeout:30_000}).toBe(true);
 await expect(page.locator('[data-autosave-state]')).toBeVisible();
 await expect(page.locator('.dd-plan-stage>.dd-plan-editor')).toBeAttached();
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 // The pieces were in before the gate's 4 s cap: a timeout would bring the jump back on a slow line.
 expect(await page.evaluate(()=>(window as any).__deckcraftPieces)).toBe('settled');
 expect(await page.evaluate(()=>(window as any).__kept())).toEqual({fallbacks:[],changed:[]});
 const shift=await page.evaluate(()=>(window as any).__shift);
 expect(shift.total,shift.sources.join('\n')).toBeLessThanOrEqual(0.005);
 expect(errors).toEqual([]);
});

test('the cost estimator opens the whole designer at once, never piece by piece',async({page,context})=>{
 await page.setViewportSize({width:1440,height:900});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await slowLoad(context);
 // The studio is drawn on the client (the estimator prerenders as its wizard). Its loading screen stays until the drawing can
 // show whole: the drawing never appears as its fallback, or without its ribbon, plan and Project controls.
 await context.addInitScript(()=>{const w=window as any,seen={fallback:false,partial:false},has=(s:string)=>!!document.querySelector(s);w.__studio=seen;
  new MutationObserver(()=>{if(has('.dd-preview[role=status]'))seen.fallback=true;if(has('#deck-live-preview')&&!['section.dd-simple-tools','.dd-canvas>.dd-plan-viewport','.dd-drawing-focus-toggle'].every(has))seen.partial=true;}).observe(document,{childList:true,subtree:true});});
 await page.goto('/cost-estimator/?studio=deck');
 await expect(page.locator('section.dd-simple-tools')).toBeVisible({timeout:30_000});
 await expect(page.locator('.dd-plan-stage>.dd-plan-editor')).toBeAttached();
 expect(await page.evaluate(()=>(window as any).__studio)).toEqual({fallback:false,partial:false});
 expect(errors).toEqual([]);
});
