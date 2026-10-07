import {readFileSync} from 'node:fs';
import {expect,test,type Locator,type Page} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {pickPlanTool,savedConfiguration} from './nav';

type Point={x:number;y:number};
type PointerSample={type:string;x:number;y:number;scale:number};
declare global {interface Window {__boundaryPointerSamples:PointerSample[]}}
const STORAGE='golden-maple.deck-studio.deck-only.v1';
test.beforeEach(async({context})=>{
  // Browser/CDP input rounds fractional screen coordinates. Record the independently delivered
  // events so exact physical mapping is tested without requiring unattainable input precision.
  await context.addInitScript(()=>{window.__boundaryPointerSamples=[];for(const type of ['pointerdown','pointermove','pointerup'])document.addEventListener(type,event=>{const e=event as PointerEvent;if(!(e.target instanceof Element)||!e.target.closest('.dd-boundary-handle'))return;const box=document.querySelector('.dd-boundary-editor'),svg=box?.querySelector('svg');if(!box||!svg)return;const r=box.getBoundingClientRect(),v=svg.viewBox.baseVal;window.__boundaryPointerSamples.push({type,x:e.clientX,y:e.clientY,scale:Math.min(r.width/v.width,r.height/v.height)});},true);});
  await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return ['127.0.0.1','localhost'].includes(host)?route.fallback():route.abort();});
  await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms)\//,r=>r.fulfill({body:''}));
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.fulfill({body:''}));
});
const handle=(page:Page,name:string)=>page.getByRole('button',{name,exact:true});
const tools=(page:Page)=>page.getByRole('region',{name:'Save and restore design'});
const outlines=(page:Page)=>page.locator('.dd-boundary-outline');
const points=(page:Page,level=0)=>outlines(page).nth(level).evaluate(el=>(el.getAttribute('points')??'').split(' ').map(pair=>{const [x,y]=pair.split(',').map(Number);return {x,y};}));
async function files(page:Page){const menu=tools(page).locator('.dd-workspace-files');if(!await menu.evaluate(el=>(el as HTMLDetailsElement).open))await menu.locator('summary').first().click();}
async function open(page:Page){
  await page.goto('/deck-designer/');
  await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);
  await pickPlanTool(page,'Shape & points');
  await expect(handle(page,'Main deck point 1')).toBeVisible();
  // These regressions exercise exact unsnapped movement; snapping has its own dedicated acceptance.
  await page.getByRole('switch',{name:/^Free movement/}).check();
  await aligned(page);
}
/** Compare each handle with the actual construction SVG transform, not the editor's own transform. */
async function aligned(page:Page){const errors=await page.locator('.dd-boundary-point').evaluateAll(buttons=>{const svg=document.querySelector('.dd-site-plan') as SVGSVGElement,matrix=svg.getScreenCTM()!,polys=Array.from(document.querySelectorAll('.dd-boundary-outline'));return buttons.map(button=>{const level=Number(button.getAttribute('data-level')),poly=polys.find(p=>p.getAttribute('data-level')===String(level))??polys[level-1],index=Number(/point (\d+)$/.exec(button.getAttribute('aria-label')!)![1])-1,[x,y]=poly.getAttribute('points')!.split(' ')[index].split(',').map(Number),p=new DOMPoint(x,y).matrixTransform(matrix),b=button.getBoundingClientRect();return {name:button.getAttribute('aria-label'),dx:Math.abs(p.x-b.x-b.width/2),dy:Math.abs(p.y-b.y-b.height/2)};});});for(const e of errors){expect(e.dx,e.name??'point x alignment').toBeLessThan(.6);expect(e.dy,e.name??'point y alignment').toBeLessThan(.6);}}
async function centre(control:Locator){await control.evaluate(el=>{el.scrollIntoView({block:'center',inline:'nearest'});return new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});const b=await control.boundingBox();expect(b).not.toBeNull();return {x:b!.x+b!.width/2,y:b!.y+b!.height/2};}
async function scale(page:Page){return page.locator('.dd-boundary-editor').evaluate(el=>{const svg=el.querySelector('svg')!;const b=el.getBoundingClientRect(),v=svg.viewBox.baseVal;return Math.min(b.width/v.width,b.height/v.height);});}
async function drag(page:Page,control:Locator,dx:number,dy:number){const start=await centre(control),s=await scale(page);await page.evaluate(()=>window.__boundaryPointerSamples=[]);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dx*s,start.y+dy*s,{steps:8});return {start,s};}
async function deliveredMovement(page:Page,nominalX:number,nominalY:number){const result=await page.evaluate(()=>{const samples=window.__boundaryPointerSamples,down=samples.find(e=>e.type==='pointerdown'),up=samples.slice().reverse().find(e=>e.type==='pointerup');if(!down||!up)throw Error('Expected actual pointerdown and pointerup delivery.');return {dx:(up.x-down.x)/down.scale,dy:(up.y-down.y)/down.scale,scale:down.scale};});expect(Math.abs(result.dx-nominalX)*result.scale,'Delivered X remains within one thousandth of a requested screen pixel').toBeLessThan(.001);expect(Math.abs(result.dy-nominalY)*result.scale,'Delivered Y remains within one thousandth of a requested screen pixel').toBeLessThan(.001);return result;}
async function exported(page:Page){await files(page);const [download]=await Promise.all([page.waitForEvent('download'),tools(page).getByRole('button',{name:'Save JSON',exact:true}).click()]);return JSON.parse(readFileSync((await download.path())!,'utf8')).configuration;}
function expectDelta(before:Point[],after:Point[],indexes:number[],dx:number,dy:number){expect(after).toHaveLength(before.length);before.forEach((p,i)=>{expect(after[i].x).toBeCloseTo(p.x+(indexes.includes(i)?dx:0),6);expect(after[i].y).toBeCloseTo(p.y+(indexes.includes(i)?dy:0),6);});}

test('default shape exposes every point and edge; diagonal drag commits once, keyboard and numeric moves keep both axes free',async({page})=>{
  await open(page);await expect(page.locator('.dd-boundary-point')).toHaveCount(4);await expect(page.locator('.dd-boundary-edge')).toHaveCount(4);await expect(handle(page,'Main deck move whole level')).toBeVisible();
  const before=await points(page);await drag(page,handle(page,'Main deck point 3'),12,18);
  expect(await points(page)).toEqual(before);await expect(page.locator('.dd-boundary-ghost')).toBeVisible();
  await page.mouse.up();await expect.poll(()=>points(page)).not.toEqual(before);const actual=await deliveredMovement(page,12,18);expectDelta(before,await points(page),[2],actual.dx,actual.dy);
  await tools(page).getByRole('button',{name:'Undo',exact:true}).click();expect(await points(page)).toEqual(before);
  await tools(page).getByRole('button',{name:'Redo',exact:true}).click();const after=await points(page);
  await handle(page,'Main deck point 3').press('ArrowRight');await handle(page,'Main deck point 3').press('Shift+ArrowDown');expectDelta(after,await points(page),[2],1,12);
  await page.locator('.dd-boundary-fine summary').click();await page.getByLabel('Selected boundary point').selectOption('0');await page.getByLabel('Selected point X in feet').fill('-1');await page.getByLabel('Selected point Y in feet').fill('-0.5');await page.locator('.dd-boundary-fine').getByRole('button',{name:'Apply',exact:true}).click();expect((await points(page))[0]).toEqual({x:-12,y:-6});
});

test('every edge can gain a point, the selected point can be removed, and an edge moves both endpoints diagonally',async({page})=>{
  await open(page);await handle(page,'Main deck edge 4').click();await handle(page,'Add point').click();await expect(page.locator('.dd-boundary-point')).toHaveCount(5);
  let p=await points(page);expect(p[4]).toEqual({x:0,y:72});await handle(page,'Remove point').click();await expect(page.locator('.dd-boundary-point')).toHaveCount(4);
  const before=await points(page);await drag(page,handle(page,'Main deck edge 3'),8,16);await page.mouse.up();const actual=await deliveredMovement(page,8,16);expectDelta(before,await points(page),[2,3],actual.dx,actual.dy);
  const edge=await points(page);await handle(page,'Main deck edge 3').press('ArrowLeft');await handle(page,'Main deck edge 3').press('Shift+ArrowDown');expectDelta(edge,await points(page),[2,3],-1,12);
  p=await points(page);await handle(page,'Main deck move whole level').press('Shift+ArrowRight');await handle(page,'Main deck move whole level').press('Shift+ArrowUp');expectDelta(p,await points(page),[0,1,2,3],12,-12);
});

test('Escape, pointer cancellation and invalid final crossing leave the original outline and undo history intact',async({page})=>{
  await open(page);const before=await points(page),undo=tools(page).getByRole('button',{name:'Undo',exact:true});await expect(undo).toBeDisabled();
  await drag(page,handle(page,'Main deck point 3'),8,8);await page.keyboard.press('Escape');await page.mouse.up();expect(await points(page)).toEqual(before);await expect(undo).toBeDisabled();
  await drag(page,handle(page,'Main deck point 3'),8,8);await handle(page,'Main deck point 3').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});await page.mouse.up();expect(await points(page)).toEqual(before);await expect(undo).toBeDisabled();
  const start=await centre(handle(page,'Main deck point 1')),s=await scale(page);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x-12*s,start.y-12*s,{steps:4});await expect(page.locator('.dd-boundary-ghost')).not.toHaveAttribute('data-invalid','true');
  await page.mouse.move(start.x+before[2].x*s,start.y+before[2].y*s,{steps:8});await expect(page.locator('.dd-boundary-ghost')).toHaveAttribute('data-invalid','true');expect(await points(page)).toEqual(before);await page.mouse.up();expect(await points(page)).toEqual(before);await expect(undo).toBeDisabled();await expect(page.locator('.dd-boundary-notice')).toBeVisible();
});

test('saved JSON, reload, import and a shared link retain inserted and free coordinates',async({page,context})=>{
  await open(page);await handle(page,'Main deck edge 3').click();await handle(page,'Add point').click();await handle(page,'Main deck point 4').press('Shift+ArrowDown');const before=await points(page),configuration=await exported(page);expect(configuration.deckOutlines.main).toHaveLength(5);
  await expect.poll(async()=>(await savedConfiguration(page))?.deckOutlines?.main?.length).toBe(5);
  await page.reload();await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);await pickPlanTool(page,'Shape & points');await expect(handle(page,'Main deck point 5')).toBeVisible();expect(await points(page)).toEqual(before);
  await files(page);await tools(page).getByRole('button',{name:'Share link',exact:true}).click();const link=await tools(page).getByLabel('Link to this design').inputValue();const visitor=await context.newPage();await visitor.goto(link);await expect.poll(()=>visitor.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);await pickPlanTool(visitor,'Shape & points');await expect(handle(visitor,'Main deck point 5')).toBeVisible();expect(await points(visitor)).toEqual(before);await visitor.close();
  await handle(page,'Main deck point 4').press('Shift+ArrowDown');await files(page);await tools(page).getByLabel('Import Golden Maple design JSON').setInputFiles({name:'boundary.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}))});await expect.poll(()=>points(page)).toEqual(before);
});

test('each lower level moves and reshapes without shifting its unchanged neighbours',async({page})=>{
  await page.addInitScript(({key,configuration})=>localStorage.setItem(key,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration})),{key:STORAGE,configuration:{...DEFAULT_DECK,height:108,levels:3,width2:8,length2:8,height2:84,level3:{widthFt:6,lengthFt:6,heightIn:60,parent:2,position:'Front',offsetPct:50}}});
  await open(page);await expect(page.locator('.dd-boundary-point')).toHaveCount(12);await expect(page.locator('.dd-boundary-edge')).toHaveCount(12);
  const lowerOrigins=await page.locator('.dd-boundary-outline[data-level="2"],.dd-boundary-outline[data-level="3"]').evaluateAll(els=>els.map(el=>({level:el.getAttribute('data-level'),points:el.getAttribute('points')})));await handle(page,'Main deck move whole level').press('Shift+ArrowRight');await handle(page,'Main deck move whole level').press('Shift+ArrowUp');expect(await page.locator('.dd-boundary-outline[data-level="2"],.dd-boundary-outline[data-level="3"]').evaluateAll(els=>els.map(el=>({level:el.getAttribute('data-level'),points:el.getAttribute('points')})))).toEqual(lowerOrigins);await expect(page.locator('.dd-boundary-point')).toHaveCount(12);await aligned(page);
  await page.getByRole('group',{name:'Deck level',exact:true}).getByRole('button',{name:'Level 2',exact:true}).click();let old=await exported(page);await handle(page,'Level 2 point 3').press('Shift+ArrowRight');await handle(page,'Level 2 point 3').press('Shift+ArrowDown');let next=await exported(page);expect(next.deckOutlines.second[2]).toEqual({x:9,y:9});expect(next.deckOutlineOffsets.second).toBeDefined();expect(next.width).toBe(old.width);expect(next.length).toBe(old.length);expect(next.level3).toEqual(old.level3);
  await page.getByRole('group',{name:'Deck level',exact:true}).getByRole('button',{name:'Level 3',exact:true}).click();old=next;await handle(page,'Level 3 edge 3').press('Shift+ArrowRight');await handle(page,'Level 3 edge 3').press('Shift+ArrowDown');next=await exported(page);expect(next.deckOutlines.third[2]).toEqual({x:7,y:7});expect(next.deckOutlines.third[3]).toEqual({x:1,y:7});expect(next.deckOutlines.second).toEqual(old.deckOutlines.second);expect(next.deckOutlineOffsets.third).toBeDefined();
});

test('@phone touch drags diagonally, cancellation restores the outline, and the editor fits with 44 px controls',async({page,context},info)=>{
  await open(page);const before=await points(page),control=handle(page,'Main deck point 3'),start=await centre(control),s=await scale(page),cdp=await context.newCDPSession(page);
  await page.evaluate(()=>window.__boundaryPointerSamples=[]);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+12*s,y:start.y+18*s,id:1}]});await expect(page.locator('.dd-boundary-ghost')).toBeVisible();expect(await points(page)).toEqual(before);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>points(page)).not.toEqual(before);const actual=await deliveredMovement(page,12,18);expectDelta(before,await points(page),[2],actual.dx,actual.dy);
  const after=await points(page),cancelStart=await centre(control);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cancelStart.x,y:cancelStart.y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cancelStart.x+6*s,y:cancelStart.y+6*s,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('.dd-boundary-ghost')).toHaveCount(0);expect(await points(page)).toEqual(after);
  await aligned(page);await page.locator('.dd-boundary-fine summary').click();const dimensions=await page.locator('.dd-boundary-handle,.dd-boundary-controls button,.dd-boundary-controls input,.dd-boundary-controls select,.dd-boundary-fine summary').evaluateAll(els=>els.filter(el=>el.getClientRects().length).map(el=>{const target=el.matches('input[type="checkbox"]')?el.closest('label')??el:el,r=target.getBoundingClientRect();return {name:el.getAttribute('aria-label')??target.textContent,width:r.width,height:r.height};}));for(const d of dimensions){expect(d.width,d.name??'control').toBeGreaterThanOrEqual(44);expect(d.height,d.name??'control').toBeGreaterThanOrEqual(44);}
  // The 22px checkbox glyph belongs to a full clickable wrapping label. Prove the large target
  // actually toggles the switch outside the glyph, rather than only substituting a larger bbox.
  const free=page.getByRole('switch',{name:/^Free movement/}),label=free.locator('..');await expect(free).toBeChecked();const labelBox=(await label.boundingBox())!;await label.click({position:{x:labelBox.width-8,y:labelBox.height/2}});await expect(free).not.toBeChecked();await label.click({position:{x:labelBox.width-8,y:labelBox.height/2}});await expect(free).toBeChecked();expect(await points(page)).toEqual(after);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#deck-live-preview').screenshot({path:info.outputPath('phone-free-boundary.png')});await cdp.detach();
});

test('successive right-edge pulls grow from the new outline and each undo restores one pull',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await open(page);
  const before=await points(page),left=await centre(handle(page,'Main deck point 1'));
  await drag(page,handle(page,'Main deck edge 2'),24,0);await page.mouse.up();
  await expect.poll(()=>points(page)).not.toEqual(before);const first=await points(page),delta1=await deliveredMovement(page,24,0);
  expectDelta(before,first,[1,2],delta1.dx,delta1.dy);await aligned(page);
  await expect(handle(page,'Apply preview')).toHaveCount(0);
  const stillLeft=await centre(handle(page,'Main deck point 1'));expect(stillLeft.x).toBeCloseTo(left.x,0);expect(stillLeft.y).toBeCloseTo(left.y,0);
  await drag(page,handle(page,'Main deck edge 2'),24,0);await page.mouse.up();
  await expect.poll(()=>points(page)).not.toEqual(first);const second=await points(page),delta2=await deliveredMovement(page,24,0);
  expectDelta(first,second,[1,2],delta2.dx,delta2.dy);await aligned(page);
  await tools(page).getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>points(page)).toEqual(first);
  await tools(page).getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>points(page)).toEqual(before);
});
