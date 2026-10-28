import {test,expect} from '@playwright/test';
import {proofDir} from './nav';
const shots=proofDir('drawing-room');
for(const phone of [false,true])test(`larger drawing room and the tab panel ${phone?'@phone':''}`,async({page,context})=>{
 await context.addInitScript('window.__name=(t,v)=>t');await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect(page.getByRole('tablist',{name:'Design',exact:true})).toBeVisible();await expect(page.locator('.deck-designer')).toHaveAttribute('data-drawing-focus','true');
 // Drawing focus now applies from the first paint, so it no longer implies the designer has loaded: wait for that.
 await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
 const before=await page.evaluate(()=>(window as any).deckcraft.read().design),canvas=page.locator('.dd-plan-viewport');
 const initial=(await canvas.boundingBox())!;expect(initial.width).toBeGreaterThan(page.viewportSize()!.width-50);await expect(page.locator('#dd-home-panel')).toBeHidden();
 if(!phone){const visible=Math.min(initial.y+initial.height,page.viewportSize()!.height)-initial.y;expect(visible).toBeGreaterThan(400);expect(initial.y+initial.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);}
 const tabs=page.getByRole('tablist',{name:'Design',exact:true});await tabs.getByRole('tab',{name:'Price & send',exact:true}).click();await expect(page.locator('#dd-home-panel')).toBeVisible();await tabs.getByRole('tab',{name:'Draw',exact:true}).click();await expect(page.locator('#dd-home-panel')).toBeHidden();
 for(let i=0;i<6;i++)await page.getByRole('button',{name:'Zoom out',exact:true}).click();expect(parseInt(await page.getByLabel('Drawing zoom',{exact:true}).innerText())).toBeLessThan(50);await page.getByRole('button',{name:'Fit drawing',exact:true}).click();await expect(page.getByLabel('Drawing zoom',{exact:true})).toHaveText('100%');expect(await page.evaluate(()=>(window as any).deckcraft.read().design)).toEqual(before);
 await page.evaluate(()=>{document.querySelector('.dd-preview')?.scrollTo(0,0);window.scrollTo(0,0);});await page.screenshot({path:`${shots}/${phone?'phone':'desktop'}.png`});
 await page.getByRole('button',{name:'Sketch a design',exact:true}).click();const sketch=page.getByRole('dialog',{name:'Sketch a design',exact:true});await expect(sketch).toBeVisible();expect((await sketch.locator('.dd-sketch-canvas-wrap').boundingBox())!.height).toBeGreaterThan(page.viewportSize()!.height*.6);
});
