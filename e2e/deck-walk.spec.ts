import {test,expect,type Page} from '@playwright/test';
import {showSheet} from './nav';

/**
 * Walk mode (S7): an eye-level walk in the 3D view. The walker stands in the yard in front of the deck at 5.5 ft eye
 * height, follows the ground, climbs the stairs, stops at the house wall and goes back to the orbit view as it was.
 */
const canvas=(page:Page)=>page.locator('[aria-label="Interactive deck construction model"] canvas').first();
const camera=(page:Page)=>page.getByRole('group',{name:'Camera'}).first();
const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as {deckcraft?:{read():{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
async function eye(page:Page){
 const [x,y,z]=((await canvas(page).getAttribute('data-walk-eye'))??'').split(',').map(Number);
 return {x,y,z,floor:Number(await canvas(page).getAttribute('data-walk-floor'))};
}
async function walking(page:Page){
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/deck-designer/');await ready(page);
 await showSheet(page,'3D');
 await expect(canvas(page)).toBeVisible({timeout:60_000});
 await camera(page).getByRole('button',{name:'Walk',exact:true}).click();
 await expect(camera(page).getByRole('button',{name:'Walk',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(canvas(page)).toHaveAttribute('data-walk','1',{timeout:30_000});
}

test('walks up the stairs onto the deck at eye height and stops at the house wall',async({page})=>{
 await walking(page);
 const start=await eye(page);
 expect(start.y-start.floor).toBeCloseTo(5.5,1);
 expect(start.z).toBeGreaterThan(12);
 await page.keyboard.down('ArrowUp');
 // Yard, stairs and deck are about 25 ft; at 4 ft a second the walker reaches the wall and stays there.
 await expect.poll(async()=>(await eye(page)).floor,{timeout:30_000}).toBeGreaterThan(2);
 await page.waitForTimeout(6000);
 await page.keyboard.up('ArrowUp');
 const end=await eye(page);
 expect(end.floor).toBeGreaterThan(2);
 expect(end.z).toBeGreaterThan(0.5);
 expect(end.z).toBeLessThan(start.z-10);
 await expect.poll(async()=>{const e=await eye(page);return e.y-e.floor;}).toBeCloseTo(5.5,1);
});

test('Esc goes back to the orbit view, and another camera button also ends the walk',async({page})=>{
 await walking(page);
 await page.keyboard.press('Escape');
 await expect(canvas(page)).not.toHaveAttribute('data-walk','1');
 await expect(camera(page).getByRole('button',{name:'Walk',exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(camera(page).getByRole('button',{name:'Corner',exact:true})).toHaveAttribute('aria-pressed','true');
 // Another camera button also ends the walk.
 await camera(page).getByRole('button',{name:'Walk',exact:true}).click();
 await expect(canvas(page)).toHaveAttribute('data-walk','1');
 await camera(page).getByRole('button',{name:'Front',exact:true}).click();
 await expect(canvas(page)).not.toHaveAttribute('data-walk','1');
 await expect(camera(page).getByRole('button',{name:'Front',exact:true})).toHaveAttribute('aria-pressed','true');
 // Above draws with an orthographic camera: a walk from it starts from the Corner view's, at eye height.
 await camera(page).getByRole('button',{name:'Above',exact:true}).click();
 await camera(page).getByRole('button',{name:'Walk',exact:true}).click();
 await expect(canvas(page)).toHaveAttribute('data-walk','1');
 await expect.poll(async()=>{const e=await eye(page);return e.y-e.floor;}).toBeCloseTo(5.5,1);
});

test('the walk pad walks forward while held and stops walking',async({page})=>{
 await walking(page);
 const start=await eye(page);
 const forward=page.getByRole('button',{name:'Walk forward'});
 const box=(await forward.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await expect.poll(async()=>(await eye(page)).z,{timeout:20_000}).toBeLessThan(start.z-2);
 await page.mouse.up();
 await page.getByRole('button',{name:'Stop walking'}).click();
 await expect(canvas(page)).not.toHaveAttribute('data-walk','1');
});

test('a phone walks from the View sheet with a pad of full-size buttons @phone',async({page})=>{
 await page.goto('/deck-designer/');await ready(page);
 await showSheet(page,'3D');
 await page.getByRole('button',{name:'View',exact:true}).click();
 await camera(page).getByRole('button',{name:'Walk',exact:true}).click();
 await expect(canvas(page)).toHaveAttribute('data-walk','1',{timeout:30_000});
 const width=page.viewportSize()!.width;
 for(const name of ['Walk forward','Walk back','Turn left','Turn right','Stop walking']){
  const button=page.getByRole('button',{name,exact:true});
  await expect(button).toBeVisible();
  const box=(await button.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(width);
 }
 // The open View sheet stays clear of the pad.
 const sheet=(await page.getByRole('group',{name:'3D view controls'}).boundingBox())!,stop=(await page.getByRole('button',{name:'Stop walking'}).boundingBox())!;
 expect(stop.y+stop.height).toBeLessThanOrEqual(sheet.y);
});
