import {expect,test,type Page} from '@playwright/test';
import {pickPlanTool} from './nav';
const handle=(page:Page)=>page.getByRole('button',{name:'Main deck point 3',exact:true});
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return ['127.0.0.1','localhost'].includes(host)?route.fallback():route.abort();});
  await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms)\//,r=>r.fulfill({body:''}));
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.fulfill({body:''}));
});
const shape=(page:Page)=>page.locator('.dd-boundary-outline').first().getAttribute('points');
const matrix=(page:Page)=>page.locator('.dd-site-plan').evaluate(el=>{const m=(el as SVGSVGElement).getScreenCTM()!;return {a:m.a,d:m.d,e:m.e,f:m.f};});
async function aligned(page:Page){
  const error=await handle(page).evaluate(button=>{const svg=document.querySelector('.dd-site-plan') as SVGSVGElement,m=svg.getScreenCTM()!,[x,y]=document.querySelector('.dd-boundary-outline')!.getAttribute('points')!.split(' ')[2].split(',').map(Number),point=new DOMPoint(x,y).matrixTransform(m),b=button.getBoundingClientRect();return {x:Math.abs(point.x-b.x-b.width/2),y:Math.abs(point.y-b.y-b.height/2),w:b.width,h:b.height};});
  expect(error.x).toBeLessThan(.6);expect(error.y).toBeLessThan(.6);expect(error.w).toBeGreaterThanOrEqual(43.99);expect(error.h).toBeGreaterThanOrEqual(43.99);
}
test('zoom and pan change only the view; editing at zoom preserves exact world distances and one-step undo',async({page})=>{
  await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);await pickPlanTool(page,'Shape & points');await expect(handle(page)).toBeVisible();
  const original=await shape(page),before=await matrix(page);
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.getByLabel('Drawing zoom')).toHaveText('125%');await aligned(page);
  expect(await shape(page)).toBe(original);expect((await matrix(page)).a).toBeCloseTo(before.a*1.25,6);
  const viewport=(await page.getByLabel('Deck drawing canvas').boundingBox())!,tools=(await page.getByRole('region',{name:'Contractor job tools'}).boundingBox())!,anchor={x:viewport.x+35,y:Math.max(viewport.y+35,tools.y+tools.height+35)},wheelBefore=await matrix(page);
  const world={x:(anchor.x-wheelBefore.e)/wheelBefore.a,y:(anchor.y-wheelBefore.f)/wheelBefore.d};
  expect(await page.evaluate(p=>!!document.elementFromPoint(p.x,p.y)?.closest('.dd-plan-viewport'),anchor)).toBe(true);
  await page.mouse.move(anchor.x,anchor.y);await page.keyboard.down('Control');
  try{await page.mouse.wheel(0,-80);await expect.poll(async()=>(await matrix(page)).a).toBeGreaterThan(wheelBefore.a);}finally{await page.keyboard.up('Control');}
  const wheelAfter=await matrix(page);expect(Math.abs(world.x*wheelAfter.a+wheelAfter.e-anchor.x)).toBeLessThan(.2);expect(Math.abs(world.y*wheelAfter.d+wheelAfter.f-anchor.y)).toBeLessThan(.2);expect(await shape(page)).toBe(original);await aligned(page);
  await page.getByRole('button',{name:'Pan drawing',exact:true}).click();
  const beforePan=await matrix(page);
  const canvas=page.getByLabel('Deck drawing canvas'),b=(await canvas.boundingBox())!;
  // Pan the target above the navigation dock before dragging it; clicking the dock should operate navigation.
  await page.mouse.move(b.x+b.width/2,b.y+70);await page.mouse.down();await page.mouse.move(b.x+b.width/2+40,b.y+35,{steps:4});await page.mouse.up();
  expect(await shape(page)).toBe(original);const panned=await matrix(page);expect(panned.e).toBeCloseTo(beforePan.e+40,1);await aligned(page);
  await page.getByRole('button',{name:'Pan drawing',exact:true}).click();
  await handle(page).scrollIntoViewIfNeeded();const hb=(await handle(page).boundingBox())!,scale=(await matrix(page)).a;
  await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2+12*scale,hb.y+hb.height/2+12*scale,{steps:5});await page.mouse.up();
  // Browser transforms round screen coordinates; enforce sub-thousandth-inch world accuracy.
  await expect.poll(async()=>Math.max(...(await shape(page))!.split(' ')[2].split(',').map((v,i)=>Math.abs(Number(v)-[204,156][i])))).toBeLessThan(.001);
  expect((await matrix(page)).a).toBeCloseTo(scale,6);await aligned(page);
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>shape(page)).toBe(original);
  await page.getByRole('button',{name:'Fit drawing',exact:true}).click();await expect(page.getByLabel('Drawing zoom')).toHaveText('100%');await aligned(page);
  const fitMatrix=await matrix(page);
  await page.mouse.dblclick(fitMatrix.a*144+fitMatrix.e,fitMatrix.d*144+fitMatrix.f);
  await expect(page.locator('.dd-boundary-point')).toHaveCount(5);
  const added=(await shape(page))!.split(' ')[3].split(',').map(Number);expect(Math.abs(added[0]-144)*fitMatrix.a).toBeLessThan(1);expect(added[1]).toBe(144);
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>shape(page)).toBe(original);
});
test('@phone view navigation keeps touch handles 44 px; pan does not reshape the deck and ordinary scrolling remains available',async({page,context})=>{
  await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);await pickPlanTool(page,'Shape & points');await expect(handle(page)).toBeVisible();const original=await shape(page);
  await page.getByRole('button',{name:'Zoom out',exact:true}).click();await expect(page.getByLabel('Drawing zoom')).toHaveText('80%');await aligned(page);
  await page.getByRole('button',{name:'Pan drawing',exact:true}).click();const canvas=page.getByLabel('Deck drawing canvas');await canvas.scrollIntoViewIfNeeded();const cdp=await context.newCDPSession(page),before=await matrix(page);
  const spot=await canvas.evaluate(el=>{const box=el.getBoundingClientRect();for(let y=Math.ceil(box.top)+16;y<box.bottom-16;y+=8){const x=box.left+18;const hit=document.elementFromPoint(x,y);if(hit&&el.contains(hit)&&!hit.closest('button,a,input,select,summary,[role=slider],[role=radio]'))return {x,y};}return null;});
  expect(spot,'pan starts on the canvas, clear of the point handles').toBeTruthy();const {x,y}=spot!;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+30,y:y+15,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await shape(page)).toBe(original);expect((await matrix(page)).e).toBeCloseTo(before.e+30,1);await aligned(page);
  await page.getByRole('button',{name:'Pan drawing',exact:true}).click();expect(await canvas.evaluate(el=>getComputedStyle(el).touchAction)).toBe('pan-y');
  await page.getByRole('button',{name:'Fit drawing',exact:true}).click();await expect(page.getByLabel('Drawing zoom')).toHaveText('100%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual((page.viewportSize()!.width)+1);
});
