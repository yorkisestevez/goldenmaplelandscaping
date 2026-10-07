import {test,expect} from '@playwright/test';
import {proofDir} from './nav';
const shots=proofDir('drawing-room');
for(const phone of [false,true])test(`larger drawing room and project controls ${phone?'@phone':''}`,async({page,context})=>{
 await context.addInitScript('window.__name=(t,v)=>t');await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect(page.getByRole('button',{name:'Show project controls',exact:true})).toBeVisible();await expect(page.locator('.deck-designer')).toHaveAttribute('data-drawing-focus','true');
 const before=await page.evaluate(()=>(window as any).deckcraft.read().design),canvas=page.locator('.dd-plan-viewport');
 const initial=(await canvas.boundingBox())!;expect(initial.width).toBeGreaterThan(page.viewportSize()!.width-50);await expect(page.getByRole('navigation',{name:'Design tasks'})).not.toBeVisible();
 if(!phone){const visible=Math.min(initial.y+initial.height,page.viewportSize()!.height)-initial.y;expect(visible).toBeGreaterThan(400);expect(initial.y+initial.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);}
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();await expect(page.getByRole('navigation',{name:'Design tasks'})).toBeVisible();await page.getByRole('button',{name:'Focus drawing',exact:true}).click();await expect(page.getByRole('navigation',{name:'Design tasks'})).not.toBeVisible();
 for(let i=0;i<6;i++)await page.getByRole('button',{name:'Zoom out',exact:true}).click();expect(parseInt(await page.getByLabel('Drawing zoom',{exact:true}).innerText())).toBeLessThan(50);await page.getByRole('button',{name:'Fit drawing',exact:true}).click();await expect(page.getByLabel('Drawing zoom',{exact:true})).toHaveText('100%');expect(await page.evaluate(()=>(window as any).deckcraft.read().design)).toEqual(before);
 await page.evaluate(()=>{document.querySelector('.dd-preview')?.scrollTo(0,0);window.scrollTo(0,0);});await page.screenshot({path:`${shots}/${phone?'phone':'desktop'}.png`});
 await page.getByRole('button',{name:'Sketch a design',exact:true}).click();const sketch=page.getByRole('dialog',{name:'Sketch a design',exact:true});await expect(sketch).toBeVisible();expect((await sketch.locator('.dd-sketch-canvas-wrap').boundingBox())!.height).toBeGreaterThan(page.viewportSize()!.height*.6);
});
