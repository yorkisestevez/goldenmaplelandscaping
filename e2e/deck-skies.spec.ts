import {test,expect,type Page} from '@playwright/test';
import {savedConfiguration,showSheet} from './nav';

/**
 * Skies (S6, owner 2026-11-03): the 3D view bar offers Day, Golden hour and Night, and the pick is saved with the design
 * like Day and Night always were. The sky never moves the price.
 */
const sky=(page:Page)=>page.getByRole('group',{name:'Time of day'});
const pick=(page:Page,name:string)=>sky(page).getByRole('button',{name,exact:true});
const hour=(page:Page)=>page.locator('[aria-label="Interactive deck construction model"] canvas').first().getAttribute('data-scene-hour');
// The scene marks its hour when it next draws; CI's software renderer can take well over the default 15 s to redraw a sky.
const DRAWN={timeout:60_000};
const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as {deckcraft?:{read():{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);

test('the view bar picks Day, Golden hour or Night, and the design keeps the sky',async({page})=>{
 test.setTimeout(300_000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/deck-designer/');await ready(page);
 await showSheet(page,'3D');
 for(const name of ['Day','Golden hour','Night'])await expect(pick(page,name)).toBeVisible();
 await expect(pick(page,'Day')).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>hour(page),DRAWN).toBe('day');
 const price=await page.locator('.dd-next-price').innerText();

 await pick(page,'Golden hour').click();
 await expect(pick(page,'Golden hour')).toHaveAttribute('aria-pressed','true');
 await expect(pick(page,'Day')).toHaveAttribute('aria-pressed','false');
 await expect.poll(async()=>(await savedConfiguration(page))?.sceneLighting).toBe('Golden');
 await expect.poll(()=>hour(page),DRAWN).toBe('golden');
 await expect.poll(()=>page.locator('.dd-next-price').innerText()).toBe(price);

 await page.reload();await ready(page);
 await showSheet(page,'3D');
 await expect(pick(page,'Golden hour')).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>hour(page),DRAWN).toBe('golden');

 await pick(page,'Night').click();
 await expect.poll(async()=>(await savedConfiguration(page))?.sceneLighting).toBe('Evening');
 await expect.poll(()=>hour(page),DRAWN).toBe('night');
 await pick(page,'Day').click();
 await expect.poll(async()=>(await savedConfiguration(page))?.sceneLighting).toBe('Daylight');
 await expect.poll(()=>hour(page),DRAWN).toBe('day');
});

test('a still’s golden hour lights a Day design with the grade, and a before-still without it stays day',async({page})=>{
 test.setTimeout(300_000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/deck-designer/?deck-quality=showcase&deck-hour=golden');await ready(page);
 await showSheet(page,'3D');
 await expect(pick(page,'Day')).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>hour(page),DRAWN).toBe('golden');
 await page.goto('/deck-designer/?deck-quality=showcase&deck-hour=golden&deck-grade=0');await ready(page);
 await showSheet(page,'3D');
 await expect.poll(()=>hour(page),DRAWN).toBe('day');
});

test('the three skies fit the phone View sheet as full-size targets @phone',async({page})=>{
 await page.goto('/deck-designer/');await ready(page);
 await showSheet(page,'3D');
 // A phone folds the 3D view controls into its View button.
 await page.getByRole('button',{name:'View',exact:true}).click();
 const width=page.viewportSize()!.width;
 for(const name of ['Day','Golden hour','Night']){
  const box=(await pick(page,name).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(width);
 }
});
