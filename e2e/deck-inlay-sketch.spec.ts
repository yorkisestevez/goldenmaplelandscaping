import {expect,test,type Locator,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';
import type {OutlinePoint} from '../src/features/deckcraft/types';

const proof=resolve(process.cwd(),'../../outputs/deckcraft-inlay-review');mkdirSync(proof,{recursive:true});
const fixture={...DEFAULT_DECK,width:16,length:12,height:30,deckType:'Freestanding',houseVisible:false,hasInlay:false,inlays:undefined};
const modal=(page:Page)=>page.getByRole('dialog',{name:'Sketch an inlay',exact:true});
const canvas=(page:Page)=>modal(page).getByRole('application',{name:'Inlay sketch drawing surface'});
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
const identity=(page:Page)=>page.evaluate(()=>({url:location.href,assets:[...new Set(performance.getEntriesByType('resource').map(e=>e.name).filter(s=>/manifest-|InlaySketchEditor-|DeckDesigner-/.test(s)))]}));
const points=(page:Page)=>canvas(page).getAttribute('data-points').then(s=>JSON.parse(s??'[]')as OutlinePoint[]);
async function activate(page:Page,control:Locator,touch=false){await control.scrollIntoViewIfNeeded();if(touch){const b=(await control.boundingBox())!;expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}else await control.click();}
async function world(page:Page,p:OutlinePoint){return canvas(page).evaluate((el,p)=>{const m=(el as SVGSVGElement).getScreenCTM()!,v=new DOMPoint(p.x,p.y).matrixTransform(m);return{x:v.x,y:v.y};},p);}
async function tap(page:Page,p:OutlinePoint,touch=false){await canvas(page).scrollIntoViewIfNeeded();const screen=await world(page,p);if(touch)await page.touchscreen.tap(screen.x,screen.y);else await page.mouse.click(screen.x,screen.y);}
async function open(page:Page,touch=false){
 const entry=page.getByRole('button',{name:'Draw a custom inlay',exact:true});
 if(!await entry.isVisible()){await activate(page,page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio',{name:'Inlays',exact:true}),touch);}
 await activate(page,await entry.isVisible()?entry:page.getByRole('button',{name:'Draw custom inlay',exact:true}),touch);await expect(modal(page)).toBeVisible();
}
async function unchanged(page:Page,before:Awaited<ReturnType<typeof state>>){const after=await state(page);expect(after.design).toEqual(before.design);expect(after.pricing).toEqual(before.pricing);expect(after.history).toEqual(before.history);}
test.beforeEach(async({page,context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(configuration=>localStorage.setItem('golden-maple.deck-studio.deck-only.v1',JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration})),fixture);
 await context.route('**/*',route=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(route.request().url())&&route.request().method()==='GET'?route.continue():route.fulfill({status:200,body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
});
for(const touch of [false,true])test(`${touch?'@phone ':''}Custom inlay sketch supports native straight taps, measured size, point pulls and local undo before placement`,async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const before=await state(page);await open(page,touch);
 for(const p of [{x:-48,y:-36},{x:48,y:-36},{x:48,y:36}])await tap(page,p,touch);
 expect(await points(page)).toHaveLength(3);await unchanged(page,before);
 if(touch)await activate(page,modal(page).getByRole('button',{name:'Finish shape',exact:true}),true);
 else{const screen=await world(page,{x:0,y:0});await page.mouse.click(screen.x,screen.y,{button:'right'});}
 await expect(canvas(page)).toHaveAttribute('data-closed','true');const closed=await points(page);expect(closed).toHaveLength(4);expect(closed[0].x).toBeCloseTo(-48,3);expect(closed[0].y).toBeCloseTo(-36,3);await unchanged(page,before);
 await modal(page).getByRole('textbox',{name:'Inlay sketch name'}).fill('Measured contractor detail');
 await modal(page).getByRole('spinbutton',{name:'Inlay sketch width feet'}).fill('6');await modal(page).getByRole('spinbutton',{name:'Inlay sketch width inches'}).fill('6');await modal(page).getByRole('spinbutton',{name:'Inlay sketch depth feet'}).fill('5');await modal(page).getByRole('spinbutton',{name:'Inlay sketch depth inches'}).fill('0');await activate(page,modal(page).getByRole('button',{name:'Apply inlay measurements'}),touch);
 const measured=await points(page);expect(Math.max(...measured.map(p=>p.x))-Math.min(...measured.map(p=>p.x))).toBeCloseTo(78,6);expect(Math.max(...measured.map(p=>p.y))-Math.min(...measured.map(p=>p.y))).toBeCloseTo(60,6);
 const first=modal(page).getByRole('button',{name:'Inlay sketch point 1',exact:true});await first.focus();await first.press('ArrowRight');const keyed=await points(page);expect(keyed[0].x).toBeCloseTo(measured[0].x+1,6);for(const i of [1,2,3])expect(keyed[i]).toEqual(measured[i]);
 await activate(page,modal(page).getByRole('button',{name:'Add corner after selected point'}),touch);expect(await points(page)).toHaveLength(5);const added=modal(page).getByRole('button',{name:'Inlay sketch point 2',exact:true});await added.focus();await added.press('Delete');expect(await points(page)).toEqual(keyed);await activate(page,modal(page).getByRole('button',{name:'Undo sketch',exact:true}),touch);expect(await points(page)).toHaveLength(5);await activate(page,modal(page).getByRole('button',{name:'Redo sketch',exact:true}),touch);expect(await points(page)).toEqual(keyed);
 const handle=modal(page).getByRole('button',{name:'Inlay sketch point 3',exact:true});await handle.scrollIntoViewIfNeeded();const box=(await handle.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(43.9);expect(box.height).toBeGreaterThanOrEqual(43.9);
 const start=await world(page,keyed[2]),end=await world(page,{x:keyed[2].x+6,y:keyed[2].y-3});
 if(touch){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y}]});for(let i=1;i<=4;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/4,y:start.y+(end.y-start.y)*i/4}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
 else{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:4});await page.mouse.up();}
 const pulled=await points(page);expect(pulled[2].x).toBeCloseTo(keyed[2].x+6,3);expect(pulled[2].y).toBeCloseTo(keyed[2].y-3,3);for(const i of [0,1,3])expect(pulled[i]).toEqual(keyed[i]);await unchanged(page,before);
 await activate(page,modal(page).getByRole('button',{name:'Undo sketch',exact:true}),touch);expect(await points(page)).toEqual(keyed);await activate(page,modal(page).getByRole('button',{name:'Redo sketch',exact:true}),touch);expect(await points(page)).toEqual(pulled);
 await canvas(page).scrollIntoViewIfNeeded();await page.screenshot({path:resolve(proof,`${touch?'phone':'desktop'}-custom-inlay-sketch.png`)});
 await activate(page,modal(page).getByRole('button',{name:'Place on deck',exact:true}),touch);await expect(modal(page)).toBeHidden();await unchanged(page,before);await expect(page.getByText('Choose a position on the deck',{exact:true})).toBeVisible();
 const armed=await state(page),surface=page.locator('svg[aria-label="Inlay placement surface"]');await surface.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));await expect.poll(()=>surface.evaluate(el=>{const m=(el as SVGSVGElement).getScreenCTM()!,p=new DOMPoint(96,72).matrixTransform(m);return document.elementFromPoint(p.x,p.y)?.closest('svg')===el;})).toBe(true);const location=await surface.evaluate(el=>{const m=(el as SVGSVGElement).getScreenCTM()!,p=new DOMPoint(96,72).matrixTransform(m);return{x:p.x,y:p.y,hit:document.elementFromPoint(p.x,p.y)?.closest('svg')?.getAttribute('aria-label'),viewport:{width:innerWidth,height:innerHeight}};});if(touch)await page.touchscreen.tap(location.x,location.y);else await page.mouse.click(location.x,location.y);
 await expect.poll(async()=>(await state(page)).design.inlays?.length).toBe(1);await expect.poll(async()=>(await state(page)).ready).toBe(true);const placed=await state(page),inlay=placed.design.inlays![0];expect(inlay.kind).toBe('custom');if(inlay.kind==='custom'){expect(inlay.name).toBe('Measured contractor detail');expect(inlay.points).toHaveLength(4);expect(Math.min(...inlay.points.map(p=>p.x))+Math.max(...inlay.points.map(p=>p.x))).toBeCloseTo(0,6);expect(Math.min(...inlay.points.map(p=>p.y))+Math.max(...inlay.points.map(p=>p.y))).toBeCloseTo(0,6);}
 expect(placed.history.canUndo).toBe(true);expect(placed.pricing).not.toEqual(before.pricing);await activate(page,page.getByRole('button',{name:'Undo',exact:true}),touch);await expect.poll(async()=>(await state(page)).design).toEqual(before.design);await expect.poll(async()=>(await state(page)).pricing).toEqual(before.pricing);
 expect(errors).toEqual([]);writeFileSync(resolve(proof,`${touch?'phone':'desktop'}-custom-sketch.json`),JSON.stringify({manifestIdentity:await identity(page),before,closed,measured,keyed,pulled,armed,placementTap:location,placed,restored:await state(page),errors},null,2));
});
test('Invalid and cancelled custom inlay sketches preserve deck geometry, pricing and history',async({page})=>{
 const before=await state(page);await open(page);await modal(page).getByRole('checkbox',{name:'Keep lines square'}).uncheck();for(const p of [{x:-36,y:-36},{x:36,y:36},{x:-36,y:36},{x:36,y:-36}])await tap(page,p);const draft=await points(page);await modal(page).getByRole('button',{name:'Finish shape',exact:true}).click();await expect(modal(page).getByRole('alert')).toContainText(/crosses itself/i);expect(await points(page)).toEqual(draft);await unchanged(page,before);
 await modal(page).getByRole('button',{name:'Cancel inlay sketch'}).click();await expect(modal(page)).toBeHidden();await unchanged(page,before);await open(page);expect(await points(page)).toEqual([]);
 await modal(page).getByRole('button',{name:'Finish shape',exact:true}).click();await expect(modal(page).getByRole('alert')).toContainText(/at least three/i);await modal(page).getByRole('button',{name:'Cancel inlay sketch'}).press('Escape');await expect(modal(page)).toBeHidden();await unchanged(page,before);
 writeFileSync(resolve(proof,'invalid-cancelled-custom-sketch.json'),JSON.stringify({manifestIdentity:await identity(page),before,invalidDraft:draft,after:await state(page)},null,2));
});
