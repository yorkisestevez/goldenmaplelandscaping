import {expect,test,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    if(!['GET','HEAD'].includes(route.request().method()))return route.abort();
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost','[::1]'].includes(url.hostname))return route.fallback();
    const type=route.request().resourceType();
    return route.fulfill({status:200,contentType:type==='stylesheet'?'text/css':type==='script'?'text/javascript':'text/plain',body:''});
  });
});
async function open(page:Page){
  await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);
  const seeded=await page.evaluate(()=>window.deckcraft!.execute({id:'dimension-fixture',commands:[{type:'design.patch',patch:{deckType:'Freestanding',houseVisible:false,stairFlights:0}},{type:'boundary.set',level:1,points:[{x:0,y:0},{x:192,y:0},{x:192,y:144},{x:0,y:144}]}]}));expect(seeded.ok,JSON.stringify(seeded)).toBe(true);
  await outline(page);
}
async function outline(page:Page){await page.locator('#dd-tool-outline').click();await expect(page.getByRole('region',{name:'Contractor edge dimensions'})).toBeVisible();await page.getByRole('switch',{name:/^Free movement/}).check();}
const read=(page:Page)=>page.evaluate(()=>window.deckcraft!.read());
async function persistedLocks(page:Page){const expected=(await read(page)).design.boundaryLocks;await expect.poll(()=>page.evaluate(()=>{const file=localStorage.getItem('golden-maple.deck-studio.deck-only.v1');return file?JSON.parse(file).configuration.boundaryLocks:undefined;})).toEqual(expected);}
async function proof(page:Page,name:string){if(process.env.DECK_DIMENSION_PROOF==='1'){const dir=resolve('../../outputs/deckcraft-contractor-review/dimensions');mkdirSync(dir,{recursive:true});await page.locator('#deck-live-preview').screenshot({path:resolve(dir,name)});}}

test('contractor dimensions rotate actual geometry; saved locks block dragging, permit translation and undo unlock',async({page})=>{
 await open(page);const length=page.getByLabel('Selected edge length'),angle=page.getByLabel('Selected edge angle in degrees');
 await page.getByLabel('Selected boundary edge').selectOption('0');await length.fill(`16' 5 1/2"`);await angle.fill('15');await page.getByRole('button',{name:'Apply edge dimension',exact:true}).click();
 await expect.poll(async()=>((await read(page)).boundaries[0].points[1].y)).toBeCloseTo(197.5*Math.sin(Math.PI/12),6);
 let before=await read(page);expect(before.boundaries[0].points[0]).toEqual({x:0,y:0});expect(before.boundaries[0].points[1].x).toBeCloseTo(197.5*Math.cos(Math.PI/12),6);expect(before.boundaries[0].points[2]).toEqual({x:192,y:144});
 await page.getByRole('button',{name:'Lock edge',exact:true}).click();await expect.poll(async()=>((await read(page)).design.boundaryLocks?.length)).toBe(1);
 const locked=await read(page);expect(locked.pricing).toEqual(before.pricing);expect(locked.quantities).toEqual(before.quantities);
 await persistedLocks(page);await page.reload();await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);await outline(page);await page.getByLabel('Selected boundary edge').selectOption('0');await expect(page.getByRole('button',{name:'Unlock edge',exact:true})).toBeVisible();
 before=await read(page);await length.fill('18');await page.getByRole('button',{name:'Apply edge dimension',exact:true}).click();await expect(page.locator('.dd-boundary-notice')).toContainText('locked');expect((await read(page)).boundaries).toEqual(before.boundaries);
 const endpoint=page.getByRole('button',{name:'Main deck point 2',exact:true});await endpoint.scrollIntoViewIfNeeded();const box=(await endpoint.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+22,box.y+box.height/2+3,{steps:4});await page.mouse.up();
 await expect(page.locator('.dd-boundary-notice')).toContainText('locked');expect((await read(page)).boundaries).toEqual(before.boundaries);
 const area=page.getByRole('button',{name:'Main deck move whole level',exact:true});await area.focus();await area.press('Shift+ArrowDown');
 await expect.poll(async()=>((await read(page)).boundaries[0].points[0].y)).toBe(12);const translated=await read(page);expect(translated.design.boundaryLocks).toEqual(before.design.boundaryLocks);
 expect(translated.boundaries[0].points.every((p,i)=>Math.abs(p.x-before.boundaries[0].points[i].x)<1e-6&&Math.abs(p.y-before.boundaries[0].points[i].y-12)<1e-6)).toBe(true);
 await proof(page,'desktop-locked-angle.png');
 await page.getByRole('button',{name:'Unlock edge',exact:true}).click();await expect.poll(async()=>((await read(page)).design.boundaryLocks)).toBeUndefined();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>((await read(page)).design.boundaryLocks)).toEqual(before.design.boundaryLocks);expect((await read(page)).boundaries).toEqual(translated.boundaries);
});

test('edge dimension and lock controls fit phone and retain one-step undo @phone',async({page})=>{
 await open(page);await page.getByLabel('Selected boundary edge').selectOption('2');await page.getByLabel('Selected edge length').fill('15.5');await page.getByLabel('Selected edge angle in degrees').fill('180');
 const original=(await read(page)).boundaries;await page.getByRole('button',{name:'Apply edge dimension',exact:true}).click();await expect.poll(async()=>((await read(page)).boundaries[0].points[3].x)).toBe(6);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>((await read(page)).boundaries)).toEqual(original);
 await page.getByRole('button',{name:'Lock edge',exact:true}).click();await expect(page.getByRole('button',{name:'Unlock edge',exact:true})).toBeVisible();
 const dimensions=page.getByRole('region',{name:'Contractor edge dimensions'});
 expect(await dimensions.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 for(const control of [dimensions.getByRole('button',{name:'Apply edge dimension',exact:true}),dimensions.getByRole('button',{name:'Unlock edge',exact:true}),page.getByLabel('Selected edge length'),page.getByLabel('Selected edge angle in degrees')]){const box=(await control.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);}
 await proof(page,'phone-edge-dimensions.png');await persistedLocks(page);await page.reload();await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);expect((await read(page)).design.boundaryLocks?.[0].edge).toBe(2);
});
