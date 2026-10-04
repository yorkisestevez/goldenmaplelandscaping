import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';
import type {SketchDocument,SketchPoint} from '../src/features/deckcraft/sketch/sketchTypes';

const proof=resolve(process.cwd(),'../../outputs/deckcraft-sketch-review/straight-lines');mkdirSync(proof,{recursive:true});
const modal=(page:Page)=>page.getByRole('dialog',{name:'Sketch a design',exact:true});
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
const draft=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('golden-maple.deck-studio.sketch-draft.v1')??'{"version":1,"shapes":[]}') as SketchDocument);
const errors=new WeakMap<Page,string[]>();
async function tap(page:Page,context:BrowserContext,p:SketchPoint,touch=false){
 const canvas=modal(page).getByRole('group',{name:'Sketch canvas',exact:true});await canvas.scrollIntoViewIfNeeded();
 const screen=await canvas.evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);return {x:q.x,y:q.y};},p);
 if(touch){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...screen,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
 else await page.mouse.click(screen.x,screen.y);
}
async function draw(page:Page,context:BrowserContext,points:SketchPoint[],touch=false){for(const p of points)await tap(page,context,p,touch);}
test.beforeEach(async({page,context})=>{
 const caught:string[]=[];errors.set(page,caught);page.on('pageerror',error=>caught.push(error.message));
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
 await page.getByRole('button',{name:'Sketch a design',exact:true}).click();await modal(page).getByRole('button',{name:'New sketch',exact:true}).click();await modal(page).getByRole('button',{name:'Straight lines',exact:true}).click();
 await expect(modal(page).getByRole('button',{name:'Snap to 90°',exact:true})).toHaveAttribute('aria-pressed','true');
});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);});

for(const device of [{name:'desktop',width:1440,height:1000,touch:false},{name:'phone',width:390,height:844,touch:true},{name:'tablet',width:768,height:1024,touch:true}])test.describe(`${device.name} straight outline`,()=>{
 test.use({viewport:{width:device.width,height:device.height},hasTouch:device.touch,isMobile:device.name==='phone'});
 test(`${device.touch?'@phone ':''}imprecise corner taps make exact square edges and a priced undoable design`,async({page,context})=>{
  const original=await state(page);
  await draw(page,context,[{x:100,y:180},{x:520,y:185},{x:525,y:420}],device.touch);
  expect((await draft(page)).shapes).toHaveLength(0);expect((await state(page)).design).toEqual(original.design);
  await expect(modal(page).getByRole('button',{name:'Finish outline',exact:true})).toBeEnabled();
  const finish=modal(page).getByRole('button',{name:'Finish outline',exact:true});await finish.scrollIntoViewIfNeeded();const size=await finish.boundingBox();expect(size!.height).toBeGreaterThanOrEqual(44);expect(size!.width).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:resolve(proof,`${device.name}-square-draft.png`)});
  if(!device.touch){await modal(page).getByRole('group',{name:'Sketch canvas',exact:true}).focus();await page.keyboard.press('Enter');await expect(modal(page).getByLabel('Exact drawing length',{exact:true})).toBeFocused();}await finish.click();
  const saved=await draft(page);expect(saved.shapes).toHaveLength(1);const points=saved.shapes[0].points;expect(points).toHaveLength(4);
  for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];expect(Math.min(Math.abs(p.x-q.x),Math.abs(p.y-q.y))).toBeLessThan(1e-7);}
  // Browser input coordinates round at subpixel precision; locked axes above remain exact.
  expect(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))).toBeCloseTo(420,3);
  expect(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))).toBeCloseTo(240,3);
  await modal(page).getByRole('spinbutton',{name:/^Measured width/}).fill('20');await modal(page).getByRole('spinbutton',{name:/^Measured depth/}).fill('12');
  await page.screenshot({path:resolve(proof,`${device.name}-square-outline.png`)});
  await modal(page).getByRole('button',{name:'Generate design',exact:true}).click();await expect(modal(page).getByRole('status',{name:'Sketch preview price'})).toContainText('240 sq ft');
  expect((await state(page)).design).toEqual(original.design);await modal(page).getByRole('button',{name:'Apply design',exact:true}).click();await expect(modal(page)).toHaveCount(0);
  const applied=await state(page);expect(applied.design.width).toBeCloseTo(20,8);expect(applied.design.length).toBeCloseTo(12,8);expect(applied.pricing.areaSqft).toBeCloseTo(240,5);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await state(page)).design).toEqual(original.design);expect((await state(page)).pricing).toEqual(original.pricing);
  await page.getByRole('button',{name:'Sketch a design',exact:true}).click();expect((await draft(page)).shapes[0].points).toEqual(points);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 });
});

test('angled lines, close-on-start, corner undo and invalid/cancelled drafts keep the host unchanged',async({page,context})=>{
 const original=await state(page);await modal(page).getByRole('button',{name:'Snap to 90°',exact:true}).click();
 const angled=[{x:180,y:160},{x:590,y:215},{x:520,y:480},{x:120,y:400}];await draw(page,context,angled);await tap(page,context,angled[0]);
 const saved=await draft(page);expect(saved.shapes).toHaveLength(1);expect(saved.shapes[0].points).toHaveLength(4);
 expect(saved.shapes[0].points[0].x).toBeCloseTo(180,3);expect(saved.shapes[0].points[1].y).toBeCloseTo(215,3);
 expect(Math.abs(saved.shapes[0].points[0].y-saved.shapes[0].points[1].y)).toBeGreaterThan(40);
 await modal(page).getByRole('button',{name:'Draw deck',exact:true}).click();await draw(page,context,[{x:680,y:140},{x:950,y:350},{x:950,y:140},{x:680,y:350}]);
 await modal(page).getByRole('button',{name:'Finish outline',exact:true}).click();await expect(modal(page).getByRole('status').last()).toContainText('cross');expect(await draft(page)).toEqual(saved);
 await modal(page).getByRole('button',{name:'Back a corner',exact:true}).click();await expect(modal(page).locator('.dd-sketch-line-actions')).toContainText('3 corners');
 await page.keyboard.press('Escape');await expect(modal(page)).toBeVisible();await expect(modal(page).getByRole('button',{name:'Finish outline',exact:true})).toHaveCount(0);expect(await draft(page)).toEqual(saved);
 await draw(page,context,[{x:700,y:150},{x:950,y:160}]);
 await modal(page).getByRole('button',{name:'Back a corner',exact:true}).focus();await page.keyboard.press('Enter');await expect(modal(page).locator('.dd-sketch-line-actions')).toContainText('1 corners');
 await tap(page,context,{x:950,y:160});await page.keyboard.press('Control+z');await expect(modal(page).locator('.dd-sketch-line-actions')).toContainText('1 corners');
 await modal(page).getByRole('button',{name:'Freehand',exact:true}).click();await expect(modal(page).getByRole('button',{name:'Finish outline',exact:true})).toHaveCount(0);expect(await draft(page)).toEqual(saved);
 expect((await state(page)).design).toEqual(original.design);expect((await state(page)).pricing).toEqual(original.pricing);expect((await state(page)).history).toEqual(original.history);
 await page.screenshot({path:resolve(proof,'desktop-angled-outline.png')});
});
