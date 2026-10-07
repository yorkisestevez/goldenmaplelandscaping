import {test,expect} from '@playwright/test';
import {pickPlanTool} from './nav';
for(const tool of ['patio','designer','sketch'])test(`Shift keeps the current diagonal in ${tool}`,async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);
 let label='Yard shape drawing surface',dots='.dd-yard-shape-draft-point',line='.dd-yard-shape-draft';
 if(tool==='sketch'){
  await page.getByRole('button',{name:'Sketch a design',exact:true}).click();const modal=page.getByRole('dialog',{name:'Sketch a design',exact:true});await modal.getByRole('button',{name:'Draw patio',exact:true}).click();await modal.getByRole('button',{name:'Straight lines',exact:true}).click();await modal.getByRole('button',{name:'Snap to 90°',exact:true}).click();label='Sketch canvas';dots='.dd-sketch-line-draft>circle:not(.dd-sketch-line-cursor,.dd-sketch-join)';line='.dd-sketch-line-draft>polyline';
 }else{
  await pickPlanTool(page,'Patios & walls');
  if(tool==='designer'){await page.getByLabel('Designer tools',{exact:true}).check();await page.getByRole('button',{name:'Patio outline',exact:true}).click();await page.getByText('Exact length, angle & snapping',{exact:true}).click();await page.getByLabel('Snap to 15° directions',{exact:true}).uncheck();await page.getByLabel('Snap grid',{exact:true}).selectOption('0');label='Patio outline drawing surface';dots='.dd-shape-draw-point';line='.dd-shape-draw-preview';}
  else await page.getByRole('button',{name:'Draw patio',exact:true}).click();
 }
 const surface=page.getByLabel(label,{exact:true});await surface.scrollIntoViewIfNeeded();const box=(await surface.boundingBox())!;await page.mouse.click(box.x+box.width*.45,box.y+box.height*.4);
 const first=surface.locator(dots).first(),b=(await first.boundingBox())!,o={x:b.x+b.width/2,y:b.y+b.height/2};
 await page.mouse.move(o.x+80,o.y+40);await page.keyboard.down('Shift');await page.mouse.move(o.x+100,o.y+95,{steps:6});
 const slope=()=>surface.locator(line).last().evaluate(el=>{const p=(el as SVGPolylineElement).points,a=p.getItem(0),b=p.getItem(p.numberOfItems-1);return (b.y-a.y)/(b.x-a.x);});
 await expect.poll(slope).toBeCloseTo(.5,5);
 await page.mouse.click(o.x+100,o.y+95);const committed=await surface.locator(dots).evaluateAll(els=>els.slice(0,2).map(e=>({x:Number(e.getAttribute('cx')),y:Number(e.getAttribute('cy'))})));expect((committed[1].y-committed[0].y)/(committed[1].x-committed[0].x)).toBeCloseTo(.5,5);
 await page.keyboard.up('Shift');expect(errors).toEqual([]);
});
