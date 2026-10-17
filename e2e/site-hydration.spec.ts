import {test,expect} from '@playwright/test';

/**
 * Prerendered pages hydrate as they were drawn. The build rewrites quoted internal paths to their slashed form
 * (buildTools/trailingSlashLinks.ts) while each page is prerendered at its unslashed path and opened at the slashed one,
 * so a page that compares its own path with a quoted one drew one thing in the prerender and another in the browser:
 * React threw the page away (#418) and redrew it. Before October 16 that happened on every visit to the cost estimator
 * (the global call dock, hidden there, was in its prerendered HTML) and to any page with a highlighted nav link.
 */
const PAGES:{path:string;active?:string}[]=[
 {path:'/cost-estimator/?studio=deck'},
 {path:'/cost-estimator/',active:'/cost-estimator/'},
 {path:'/contact/',active:'/contact/'},
 {path:'/portfolio/',active:'/portfolio/'},
 {path:'/services/'},
 {path:'/'},
];
for(const {path,active} of PAGES)test(`${path} hydrates without being redrawn`,async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 const html=await (await page.request.get(path)).text();
 await page.goto(path);
 await page.waitForLoadState('load');
 // Hydration is done once the router's effects have run; a recoverable mismatch is reported right after it.
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__reactRouterRouteModules&&document.readyState==='complete')).toBe(true);
 await page.waitForTimeout(1500);
 expect(errors).toEqual([]);
 if(path.startsWith('/cost-estimator')){
  // The estimator has its own sticky bar; the global call dock is neither drawn nor prerendered there.
  expect(html).not.toContain('xl:hidden fixed bottom-0');
  await expect(page.locator('footer a[href^="tel:"].flex-1')).toHaveCount(0);
 }
 if(active){
  const link=page.locator(`header a[href="${active}"]:not(.btn-primary)`).first();
  await expect(link).toHaveClass(/text-brand-gold/);
 }
});
