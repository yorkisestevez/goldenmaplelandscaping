import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {openSketch,proofDir} from './nav';
const shots=proofDir('canvas-first');
const read=(page:Page)=>page.evaluate(()=>(window as any).deckcraft.read().design);
for(const phone of [false,true])test(`canvas first settings and patio joining ${phone?'@phone':''}`,async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(configuration=>localStorage.setItem('golden-maple.deck-studio.deck-only.v1',JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration})),{...DEFAULT_DECK,yardFeatures:[]});
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);
 const original=await read(page),dialog=page.getByRole('dialog',{name:'Design inspector'}),dock=page.locator('.dd-selection-inspector');
 await expect(dialog).not.toBeVisible();await expect(dock).not.toHaveAttribute('open');
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();await page.getByRole('navigation',{name:'Design tasks'}).locator('summary').filter({hasText:/^Design$/}).click();await page.getByRole('navigation',{name:'Design tasks'}).getByRole('button',{name:'Boards & finish',exact:true}).click();
 await expect(dialog).toBeVisible();const box=(await dialog.boundingBox())!,vp=page.viewportSize()!;expect(box.y).toBeGreaterThan(vp.height*.2);expect(box.y+box.height).toBeLessThanOrEqual(vp.height+1);
 await dialog.press('Escape');await expect(dialog).not.toBeVisible();expect(await read(page)).toEqual(original);
 await page.getByRole('radio',{name:'Patios & walls',exact:true}).click();await page.getByRole('button',{name:'Draw patio',exact:true}).click();
 const surface=page.getByLabel('Yard shape drawing surface',{exact:true});await surface.scrollIntoViewIfNeeded();
 const b=(await surface.boundingBox())!,side=Math.min(85,b.width*.26,b.height*.28),start={x:b.x+b.width*.4,y:b.y+b.height*.45};
 const pts=[start,{x:start.x+side,y:start.y},{x:start.x+side,y:start.y+side},{x:start.x,y:start.y+side}];
 const tap=async(p:{x:number;y:number})=>phone?page.touchscreen.tap(p.x,p.y):page.mouse.click(p.x,p.y);
 for(const p of pts)await tap(p);
 await expect(surface.locator('.dd-yard-shape-draft-point')).toHaveCount(4);expect((await read(page)).yardFeatures).toEqual([]);
 if(phone){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pts[3]]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+10,y:start.y+5}]});await expect(surface.locator('.dd-drawing-join')).toHaveAttribute('data-closing','true');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await page.mouse.move(pts[3].x,pts[3].y);await page.mouse.down();await page.mouse.move(start.x+10,start.y+5,{steps:6});await expect(surface.locator('.dd-drawing-join')).toHaveAttribute('data-closing','true');await page.mouse.up();}
 // Closing the outline commits the patio as one undo step. Plan tools no longer hold it as a preview.
 await expect(surface).toHaveCount(0);await expect(page.getByRole('button',{name:'Apply preview',exact:true})).toHaveCount(0);await expect.poll(async()=>(await read(page)).yardFeatures.length).toBe(1);
 const result=await read(page);expect(result.yardFeatures[0].outline).toHaveLength(4);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await read(page)).yardFeatures.length).toBe(0);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(async()=>(await read(page)).yardFeatures.length).toBe(1);
 await expect(page.getByText(/^Saved on this device at/)).toBeVisible();await page.reload();await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);expect((await read(page)).yardFeatures).toEqual(result.yardFeatures);
 await page.screenshot({path:`${shots}/${phone?'phone':'desktop'}.png`});expect(errors).toEqual([]);
});

for(const phone of [false,true])test(`advanced drawing and sketch share clear closing targets ${phone?'@phone':''}`,async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);
 await page.getByRole('radio',{name:'Patios & walls',exact:true}).click();await page.getByLabel('Designer tools',{exact:true}).check();
 await page.getByRole('button',{name:'Patio outline',exact:true}).click();
 const surface=page.getByLabel('Patio outline drawing surface',{exact:true});await surface.scrollIntoViewIfNeeded();
 const b=(await surface.boundingBox())!,side=Math.min(85,b.width*.26,b.height*.28),start={x:b.x+b.width*.4,y:b.y+b.height*.45};
 const tap=async(p:{x:number;y:number})=>phone?page.touchscreen.tap(p.x,p.y):page.mouse.click(p.x,p.y);
 for(const p of [start,{x:start.x+side,y:start.y},{x:start.x+side,y:start.y+side},{x:start.x,y:start.y+side}])await tap(p);
 await expect(surface.locator('.dd-shape-draw-point')).toHaveCount(4);await tap({x:start.x+12,y:start.y+5});await expect(surface).toHaveCount(0);
 await expect.poll(async()=>(await read(page)).yardFeatures?.length??0).toBe(1);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await read(page)).yardFeatures?.length??0).toBe(0);
 const modal=await openSketch(page);
 await modal.getByRole('button',{name:'Draw patio',exact:true}).click();await modal.getByRole('button',{name:'Straight lines',exact:true}).click();
 const canvas=modal.getByRole('group',{name:'Sketch canvas',exact:true});await canvas.scrollIntoViewIfNeeded();const c=(await canvas.boundingBox())!,s=Math.min(85,c.width*.25,c.height*.25),p={x:c.x+c.width*.4,y:c.y+c.height*.4};
 for(const q of [p,{x:p.x+s,y:p.y},{x:p.x+s,y:p.y+s},{x:p.x,y:p.y+s}])await tap(q);
 await expect(canvas.locator('.dd-sketch-join')).toBeVisible();await tap({x:p.x+12,y:p.y+4});await expect(canvas.locator('.dd-sketch-line-draft')).toHaveCount(0);
 await expect(modal.getByRole('button',{name:'Patio sketch point 4',exact:true})).toBeVisible();
 const settings=modal.locator('.dd-sketch-inspector');await settings.locator(':scope > summary').click();await expect(settings).toHaveAttribute('open');
 expect((await settings.boundingBox())!.y).toBeGreaterThan((await canvas.boundingBox())!.y);await page.screenshot({path:`${shots}/${phone?'phone':'desktop'}-sketch.png`});expect(errors).toEqual([]);
});
