import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as THREE from 'three';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {sceneBounds} from '../src/features/deckcraft/components/viewer3d/sceneBounds';
import type {AgentSnapshot} from '../src/features/deckcraft/designer/deckAgentController';
const proof=resolve('../../outputs/deckcraft-delete-pull-review/boards');mkdirSync(proof,{recursive:true});
const fixture={...DEFAULT_DECK,deckType:'Freestanding' as const,houseVisible:false,width:20,length:12,height:48,pictureFrameRows:2 as const,stairFlights:0,railingType:'None' as const,deckingMaterial:'tt_prime_plus'};
const read=(page:Page)=>page.evaluate(()=>window.deckcraft!.read());
async function expectNoAdditions(page:Page){await expect.poll(async()=>{const layout=(await read(page)).design.boardLayout;return (layout?.regions.length??0)+(layout?.breakers.length??0)+(layout?.pieces.length??0);}).toBe(0);}
async function undo(page:Page){await page.getByRole('region',{name:'Save and restore design',exact:true}).getByRole('button',{name:'Undo',exact:true}).click();}
async function redo(page:Page){await page.getByRole('region',{name:'Save and restore design',exact:true}).getByRole('button',{name:'Redo',exact:true}).click();}
async function screen(page:Page,p:{x:number;y:number}){return page.locator('.dd-board-layout-svg').evaluate((svg,p)=>{const v=new DOMPoint(p.x,p.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);return {x:v.x,y:v.y};},p);}
async function showBoards(page:Page){await page.locator('.dd-board-layout-svg').evaluate(svg=>svg.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));}
async function pick(page:Page,board:AgentSnapshot['boards'][number],touch=false,selected=true){
 await showBoards(page);
 const center={x:board.polygon.reduce((n,p)=>n+p.x,0)/board.polygon.length,y:board.polygon.reduce((n,p)=>n+p.y,0)/board.polygon.length};
 const candidates=[center,...board.polygon.map(v=>({x:(v.x+center.x)/2,y:(v.y+center.y)/2}))].map(v=>({x:v.x+board.offset.x,y:v.y+board.offset.y}));
 const p=await page.locator('.dd-board-layout-svg').evaluate((svg,{candidates,index})=>{const m=(svg as SVGSVGElement).getScreenCTM()!;return candidates.map(p=>{const v=new DOMPoint(p.x,p.y).matrixTransform(m);return {x:v.x,y:v.y};}).find(p=>document.elementFromPoint(p.x,p.y)?.closest('[data-board-index]')?.getAttribute('data-board-index')===String(index));},{candidates,index:board.index});
 expect(p,'The actual selected stock must have an exposed tap target').toBeTruthy();if(!p)throw Error('Board stock is obscured');
 if(touch){await page.evaluate(()=>{document.documentElement.dataset.boardTapEvents='[]';for(const type of ['pointerdown','pointerup'])document.addEventListener(type,event=>{const e=event as PointerEvent;const values=JSON.parse(document.documentElement.dataset.boardTapEvents??'[]');values.push({type,x:e.clientX,y:e.clientY,pointerType:e.pointerType,target:(e.target as Element).closest('[data-board-index]')?.getAttribute('data-board-index'),hit:document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-board-index]')?.getAttribute('data-board-index')});document.documentElement.dataset.boardTapEvents=JSON.stringify(values);},{once:true,capture:true});});await page.touchscreen.tap(p.x,p.y);writeFileSync(resolve(proof,`native-board-hit-${page.viewportSize()!.width}-${board.index}-${selected}.json`),JSON.stringify({expected:board.index,point:p,events:await page.evaluate(()=>JSON.parse(document.documentElement.dataset.boardTapEvents??'[]'))},null,2));}else await page.mouse.click(p.x,p.y);
 const hit=page.locator(`.dd-board-hit[data-board-index="${board.index}"]`);if(selected)await expect(hit).toHaveAttribute('data-selected','true');else await expect(hit).not.toHaveAttribute('data-selected','true');
}
async function addBreaker(page:Page,context:BrowserContext,touch=false){
 const add=page.getByRole('button',{name:'Add breaker',exact:true});if(touch)await add.tap();else await add.click();await expect(add).toHaveAttribute('aria-pressed','true');await showBoards(page);const a=await screen(page,{x:70,y:20}),b=await screen(page,{x:70,y:125});
 for(const point of [a,b])expect(await page.evaluate(p=>!!document.elementFromPoint(p.x,p.y)?.closest('.dd-board-layout-svg'),point)).toBe(true);
 if(touch){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
 else {await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});await page.mouse.up();}
 const apply=page.getByRole('button',{name:'Apply layout',exact:true});if(touch)await apply.tap();else await apply.click();await expect.poll(async()=>(await read(page)).design.boardLayout?.breakers.length).toBe(1);
 await expect(page.getByRole('button',{name:'Select board',exact:true})).toHaveAttribute('aria-pressed','true');return read(page);
}
test.beforeEach(async({context,page})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(configuration=>{if(!localStorage.getItem('golden-maple.deck-studio.deck-only.v1'))localStorage.setItem('golden-maple.deck-studio.deck-only.v1',JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}));},fixture);
 await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready)).toBe(true);
 await page.getByRole('radio',{name:'Board layout',exact:true}).click();await expect(page.locator('.dd-board-layout-svg')).toBeVisible();
});

test('click an added breaker then Delete restores exact decking/price with one Undo; text editing and Escape stay safe',async({page,context})=>{
 const original=await read(page),added=await addBreaker(page,context),board=added.boards.find(b=>b.layoutKind==='breaker')!;await pick(page,board);
 const direction=page.getByLabel('Board direction',{exact:true});await direction.fill('90');await direction.press('Delete');expect((await read(page)).design).toEqual(added.design);
 await pick(page,board);await page.locator('.dd-board-layout-svg').press('Escape');await page.locator('.dd-board-layout-svg').press('Delete');expect((await read(page)).design).toEqual(added.design);
 await pick(page,board);await page.screenshot({path:resolve(proof,'desktop-selected-breaker.png'),fullPage:true});await page.locator('.dd-board-layout-svg').press('Delete');
 await expectNoAdditions(page);expect((await read(page)).boards).toEqual(original.boards);expect((await read(page)).pricing.total).toBe(original.pricing.total);
 await undo(page);expect((await read(page)).design).toEqual(added.design);expect((await read(page)).pricing.total).toBe(added.pricing.total);
 await redo(page);expect((await read(page)).boards).toEqual(original.boards);
 await expect(page.locator('[data-autosave-state="saved"]')).toContainText(/saved/i);
});

test('Delete replaces one selected picture-frame cut and retains all other edges, option price and exact saved restoration',async({page,context})=>{
 const before=await read(page),board=before.boards.find(b=>b.role==='border'&&b.lengthIn>30&&Math.abs(b.angleDeg-90)<.1)!;expect(board).toBeTruthy();await pick(page,board);
 await expect(page.locator('.dd-board-delete')).toContainText('other frame boards stay');await page.locator('.dd-board-layout-svg').press('Backspace');
 await expect.poll(async()=>(await read(page)).design.boardLayout?.regions[0]?.replaceBorder).toBe(true);const after=await read(page),region=after.design.boardLayout!.regions[0];
 expect(region.polygon).toEqual(board.polygon);expect(after.design.pictureFrameRows).toBe(before.design.pictureFrameRows);expect(after.quantities.area).toBe(before.quantities.area);
 expect(after.boards.some(b=>b.layoutId===region.id&&b.role==='field')).toBe(true);expect(after.boards.filter(b=>b.role==='border').length).toBeGreaterThan(3);
 await page.screenshot({path:resolve(proof,'desktop-frame-replacement.png'),fullPage:true});await undo(page);expect((await read(page)).design).toEqual(before.design);expect((await read(page)).pricing).toEqual(before.pricing);await redo(page);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('golden-maple.deck-studio.deck-only.v1')??'{}').configuration?.boardLayout?.regions[0]?.replaceBorder)).toBe(true);
 await page.reload();await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready)).toBe(true);expect((await read(page)).design.boardLayout).toEqual(after.design.boardLayout);expect((await read(page)).pricing.total).toBe(after.pricing.total);
 const response=await page.evaluate(()=>window.deckcraft!.execute({id:'delete-share',commands:[{type:'action',action:'share.create'}]}));expect(response.ok).toBe(true);if(response.ok){const visitor=await context.newPage();await visitor.goto(response.result!.url!);await expect.poll(()=>visitor.evaluate(()=>window.deckcraft?.read().ready)).toBe(true);expect((await read(visitor)).design.boardLayout).toEqual(after.design.boardLayout);expect((await read(visitor)).pricing.total).toBe(after.pricing.total);await visitor.close();}
 writeFileSync(resolve(proof,'frame-exact-price.json'),JSON.stringify({before:before.pricing.total,after:after.pricing.total,selectedCut:board.polygon,replacement:region},null,2));
});

test('actual 3D breaker click can be deleted without leaving the 3D sheet',async({page,context})=>{
 await page.setViewportSize({width:1440,height:1000});const original=await read(page),added=await addBreaker(page,context);await page.getByRole('tab',{name:'3D',exact:false}).click();await page.getByRole('button',{name:'Above',exact:true}).click();await page.getByRole('button',{name:'Select objects in 3D',exact:true}).click();
 const canvas=page.getByRole('region',{name:'Interactive deck construction model',exact:true}).locator('canvas');await expect(canvas).toBeVisible();await page.waitForTimeout(900);
 const model=buildDeckTakeoff({...fixture,...added.design}),bounds=sceneBounds(model),rect=(await canvas.boundingBox())!,cx=(bounds.maxX+bounds.minX)/24,cz=(bounds.maxZ+bounds.minZ)/24,r=Math.max((bounds.maxX-bounds.minX)/12,(bounds.maxZ-bounds.minZ)/12),camera=new THREE.PerspectiveCamera(38,rect.width/rect.height,.1,1000);camera.position.set(cx,r*2+.1,cz+.01);camera.lookAt(cx,bounds.top/24,cz);camera.updateMatrixWorld();
 const board=added.boards.find(b=>b.layoutKind==='breaker')!,p=new THREE.Vector3((board.cx+board.offset.x)/12,(model.levels[0].top-.5)/12,(board.cy+board.offset.y)/12).project(camera);await page.mouse.click(rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2);
 await expect(page.getByLabel('Select deck board',{exact:true})).toHaveValue(String(board.index));await expect(page.getByRole('button',{name:'Delete selected board',exact:true})).toBeEnabled();await page.keyboard.press('Delete');
 await expectNoAdditions(page);expect((await read(page)).view).toBe('top');expect((await read(page)).boards).toEqual(original.boards);expect((await read(page)).pricing.total).toBe(original.pricing.total);await undo(page);expect((await read(page)).design).toEqual(added.design);
 await page.screenshot({path:resolve(proof,'desktop-3d-delete-undo.png'),fullPage:true});
});

test('clearing the board picker or changing deck levels clears the actual Delete targets',async({page})=>{
 const seeded=await page.evaluate(()=>window.deckcraft!.execute({id:'delete-levels',commands:[{type:'design.patch',patch:{levels:2,width2:8,length2:8,height2:24}}]}));expect(seeded.ok).toBe(true);const before=await read(page),board=before.boards.find(b=>b.modelLevel===0&&b.role==='border')!;
 await pick(page,board);await page.getByLabel('Select deck board',{exact:true}).selectOption('');await page.locator('.dd-board-layout-svg').press('Delete');expect((await read(page)).design).toEqual(before.design);await expect(page.locator('.dd-board-delete')).toHaveCount(0);
 await pick(page,board);await page.getByLabel('Board layout level',{exact:true}).selectOption('2');await page.locator('.dd-board-layout-svg').press('Delete');expect((await read(page)).design).toEqual(before.design);await expect(page.locator('.dd-board-delete')).toHaveCount(0);
});

for(const v of [{name:'phone',width:390,height:844},{name:'tablet',width:768,height:1024}])test.describe(`${v.name} board deletion`,()=>{
 test.use({viewport:{width:v.width,height:v.height},hasTouch:true,isMobile:v.name==='phone'});
 test('@phone touch-select added breaker and frame board exposes Delete with one Undo',async({page,context})=>{
  const original=await read(page),added=await addBreaker(page,context,true),breaker=added.boards.find(b=>b.layoutKind==='breaker')!;
  await showBoards(page);const point=await screen(page,{x:breaker.cx+breaker.offset.x,y:breaker.cy+breaker.offset.y}),cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:80}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.locator('.dd-board-hit[data-selected]')).toHaveCount(0);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:81}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+18,y:point.y,id:81}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('.dd-board-hit[data-selected]')).toHaveCount(0);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:82}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:82},{x:point.x+24,y:point.y,id:83}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:84}]});await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,pointerType:'pen'});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,pointerType:'pen'});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  await expect(page.locator('.dd-board-hit[data-selected]')).toHaveCount(0);expect((await read(page)).design).toEqual(added.design);
  await pick(page,breaker,true);const multiple=page.getByLabel('Select multiple boards',{exact:true});await multiple.tap();await expect(multiple).toBeChecked();await pick(page,breaker,true,false);await expect(page.locator('.dd-board-hit[data-selected]')).toHaveCount(0);await pick(page,breaker,true);await expect(page.locator('.dd-board-hit[data-selected]')).toHaveCount(1);await multiple.tap();await expect(multiple).not.toBeChecked();
  const remove=page.getByRole('button',{name:'Delete selected board',exact:true});await remove.scrollIntoViewIfNeeded();const rect=(await remove.boundingBox())!;expect(rect.width).toBeGreaterThanOrEqual(44);expect(rect.height).toBeGreaterThanOrEqual(44);const buttons=await context.newCDPSession(page),buttonPoint={x:rect.x+rect.width/2,y:rect.y+rect.height/2};await buttons.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...buttonPoint,id:86}]});await buttons.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:buttonPoint.x+18,y:buttonPoint.y,id:86}]});await buttons.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await buttons.detach();expect((await read(page)).design).toEqual(added.design);await remove.tap();await expectNoAdditions(page);expect((await read(page)).boards).toEqual(original.boards);expect((await read(page)).pricing.total).toBe(original.pricing.total);await undo(page);expect((await read(page)).design).toEqual(added.design);await redo(page);
  const frameBefore=await read(page);await pick(page,frameBefore.boards.find(b=>b.role==='border'&&b.lengthIn>30&&Math.abs(b.angleDeg-90)<.1)!,true);await remove.scrollIntoViewIfNeeded();await remove.tap();await expect.poll(async()=>(await read(page)).design.boardLayout?.regions[0]?.replaceBorder).toBe(true);await page.screenshot({path:resolve(proof,`${v.name}-frame-delete.png`),fullPage:true});await undo(page);expect((await read(page)).design).toEqual(frameBefore.design);expect((await read(page)).pricing).toEqual(frameBefore.pricing);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
 });
});
