import {test,expect} from '@playwright/test';
for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test('3D toolbars remain compact at '+viewport.width,async({page,context})=>{
 await page.setViewportSize(viewport);
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');
 await page.getByRole('tab',{name:'3D',exact:true}).click();
 const controls=page.locator('[aria-label="Landscape presentation controls"]'),model=page.getByRole('region',{name:'Interactive deck construction model'});
 await expect(model.locator('canvas')).toBeVisible();
 await expect(page.locator('[data-autosave-state]')).toBeVisible();
 await expect.poll(async()=>(await controls.boundingBox())?.height??999).toBeLessThan(180);
 const toolbar=(await controls.boundingBox())!,canvas=(await model.boundingBox())!;
 expect(canvas.height).toBeGreaterThanOrEqual(280);
 expect(Math.abs(canvas.y-toolbar.y-toolbar.height)).toBeLessThan(16);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();
 await expect.poll(async()=>(await controls.boundingBox())?.height??999).toBeLessThan(180);
});
