import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {pickPlanTool,savedConfiguration} from './nav';
import {readFileSync} from 'node:fs';
import type {DeckAgentApi,AgentCommand} from '../src/features/deckcraft/designer/deckAgentController';
type Point={x:number;y:number};
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
let requestId=0;
async function command(page:Page,commands:AgentCommand[]){
 const response=await page.evaluate(async({id,commands})=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({id,commands,expectedRevision:api.read().revision});},{id:`board-layout-e2e-${++requestId}`,commands});
 if('error' in response)throw new Error(`${response.error.code}: ${response.error.message}`);return response;
}
async function start(page:Page){
 await page.goto('/deck-designer/');await page.waitForFunction(()=>typeof (window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read==='function');
 const radio=await pickPlanTool(page,'Board layout');await expect(page.getByRole('button',{name:'Select board',exact:true})).toBeVisible();
}
async function draw(page:Page,context:BrowserContext,points:Point[],touch=false){
 const canvas=page.getByRole('group',{name:'Board layout selection canvas',exact:true});await canvas.scrollIntoViewIfNeeded();
 const screen=await canvas.evaluate((el,points)=>{const matrix=(el as SVGSVGElement).getScreenCTM()!;return points.map(p=>{const v=new DOMPoint(p.x,p.y).matrixTransform(matrix);return {x:v.x,y:v.y};});},points);
 if(touch){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...screen[0],id:1}]});for(const p of screen.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
 else {await page.mouse.move(screen[0].x,screen[0].y);await page.mouse.down();for(const p of screen.slice(1))await page.mouse.move(p.x,p.y,{steps:5});await page.mouse.up();}
}
async function applyRegion(page:Page,context:BrowserContext,angle:number,free=false,touch=false){
 await page.getByRole('button',{name:'Select area',exact:true}).click();await page.getByRole('checkbox',{name:'Free select',exact:true}).setChecked(free);
 await draw(page,context,free?[{x:100,y:70},{x:158,y:70},{x:155,y:118},{x:100,y:105}]:[{x:20,y:30},{x:110,y:95}],touch);
 await expect(page.locator('.dd-board-layout-selection')).toBeVisible();await page.getByRole('spinbutton',{name:'Board direction',exact:true}).fill(String(angle));await page.getByRole('combobox',{name:'Layout board colour',exact:true}).selectOption(free?'tt_prime_plus:Sea Salt Gray':'tt_prime_plus:Dark Cocoa');await page.getByRole('button',{name:'Apply layout',exact:true}).click();
 await expect.poll(async()=>(await state(page)).boards.filter(b=>b.layoutKind==='region'&&b.angleDeg===angle).length).toBeGreaterThan(0);
}
// Zoom, fit and pan stay reachable and uncovered: brought into view as scrolling, focus or a tap brings them, they sit above
// the live-price bar and every button takes the pointer at its centre. Whether they also fit the first screen depends on
// the device height, not on the product.
async function navigationClear(page:Page){
 const navigation=page.getByRole('group',{name:'Drawing navigation',exact:true});await navigation.scrollIntoViewIfNeeded();
 const box=await navigation.boundingBox(),price=await page.getByRole('region',{name:'Live price',exact:true}).boundingBox();expect(box&&price).toBeTruthy();expect(box!.y+box!.height).toBeLessThanOrEqual(price!.y);
 expect(await navigation.evaluate(el=>[...el.querySelectorAll('button')].every(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&button.contains(hit);}))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
 for(const name of ['Select board','Select area','Add breaker']){const b=await page.getByRole('button',{name,exact:true}).boundingBox();expect(b!.height).toBeGreaterThanOrEqual(44);expect(b!.width).toBeGreaterThanOrEqual(44);}
}
test.beforeEach(async({context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
});

test('actual rectangle/free-select directions and finite breaker use discrete Apply history',async({page,context})=>{
 await start(page);await navigationClear(page);const initial=await state(page);
 await page.getByRole('button',{name:'Add breaker',exact:true}).click();await draw(page,context,[{x:61,y:16},{x:79,y:120}]);await expect(page.locator('.dd-board-layout-breaker')).toBeVisible();expect((await state(page)).design).toEqual(initial.design);expect((await state(page)).pricing.total).toBe(initial.pricing.total);
 await page.getByRole('button',{name:'Apply layout',exact:true}).click();await expect.poll(async()=>(await state(page)).design.boardLayout?.breakers.length).toBe(1);const breakerState=await state(page),breaker=breakerState.design.boardLayout!.breakers[0],angle=Math.atan2(breaker.end.y-breaker.start.y,breaker.end.x-breaker.start.x)*180/Math.PI;
 expect(breakerState.boards.some(b=>b.layoutKind==='breaker'&&Math.abs(b.angleDeg-angle)<.02)).toBeTruthy();
 await applyRegion(page,context,33);const afterRectangle=await state(page);await applyRegion(page,context,90,true);expect((await state(page)).design.boardLayout?.regions).toHaveLength(2);
 const history=page.getByRole('region',{name:'Save and restore design'});await history.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>JSON.stringify((await state(page)).design)).toBe(JSON.stringify(afterRectangle.design));expect((await state(page)).pricing.total).toBe(afterRectangle.pricing.total);
 await history.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>JSON.stringify((await state(page)).design)).toBe(JSON.stringify(breakerState.design));await history.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(async()=>(await state(page)).design.boardLayout?.regions.length).toBe(1);
 expect((await state(page)).quotes.some(q=>/board-layout.*support/i.test(q))).toBeTruthy();
});

test('cancel and invalid draft never write; real board rotation persists through save/import/reload and agent commands',async({page,context})=>{
 await start(page);const initial=await state(page);await page.getByRole('button',{name:'Select area',exact:true}).click();await draw(page,context,[{x:25,y:25},{x:90,y:70}]);await page.getByRole('spinbutton',{name:'Board direction',exact:true}).fill('');await page.getByRole('button',{name:'Apply layout',exact:true}).click();await expect(page.locator('.dd-board-layout-notice')).toContainText('Enter a board direction');expect((await state(page)).design).toEqual(initial.design);expect((await state(page)).history).toEqual(initial.history);
 await page.getByRole('group',{name:'Board layout selection canvas',exact:true}).press('Escape');await expect(page.getByRole('button',{name:'Apply layout',exact:true})).toBeDisabled();expect((await state(page)).design).toEqual(initial.design);
 await page.getByRole('button',{name:'Select board',exact:true}).click();const target=initial.boards.find(b=>b.level===1&&b.cy>35&&b.cy<65&&b.lengthIn>150)!;expect(target).toBeTruthy();await page.getByRole('combobox',{name:'Select deck board',exact:true}).selectOption(String(target.index));await expect(page.locator('.dd-board-layout-highlight')).toHaveCount(1);await page.getByRole('spinbutton',{name:'Board direction',exact:true}).fill('90');await page.getByRole('combobox',{name:'Layout board colour',exact:true}).selectOption('tt_prime_plus:Sea Salt Gray');await page.getByRole('button',{name:'Apply layout',exact:true}).click();await expect.poll(async()=>(await state(page)).design.boardLayout?.pieces.length).toBe(1);
 const saved=await state(page),piece=saved.design.boardLayout!.pieces[0],runs=saved.boards.filter(b=>b.layoutId===piece.id);expect(runs.length).toBeGreaterThan(0);expect(runs.every(b=>b.angleDeg===90&&b.colour==='tt_prime_plus:Sea Salt Gray')).toBeTruthy();const xs=runs.flatMap(b=>b.polygon.map(p=>p.x)),ys=runs.flatMap(b=>b.polygon.map(p=>p.y));expect(Math.max(...ys)-Math.min(...ys)).toBeGreaterThan((Math.max(...xs)-Math.min(...xs))*2);
 await page.locator('summary').filter({hasText:/^Files/}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save JSON',exact:true}).click();const downloaded=await pending,file=readFileSync((await downloaded.path())!,'utf8');expect(JSON.parse(file).configuration.boardLayout).toEqual(saved.design.boardLayout);
 await expect.poll(async()=>(await savedConfiguration(page))?.boardLayout).toEqual(saved.design.boardLayout);
 await page.reload();await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);expect((await state(page)).design.boardLayout).toEqual(saved.design.boardLayout);
 await command(page,[{type:'design.patch',patch:{boardLayout:{regions:[],breakers:[],pieces:[]}}}]);expect((await state(page)).design.boardLayout).toBeUndefined();await page.locator('summary').filter({hasText:/^Files/}).click();await page.locator('input[type="file"][accept*="json"]').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from(file)});await expect.poll(async()=>JSON.stringify((await state(page)).design.boardLayout)).toBe(JSON.stringify(saved.design.boardLayout));
 const beforeApi=await state(page),region={id:'e2e-agent-region',level:1 as const,polygon:[{x:20,y:20},{x:80,y:20},{x:80,y:65},{x:20,y:65}],angleDeg:33,colour:'tt_prime_plus:Dark Cocoa'};
 const dry=await page.evaluate(async(request)=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.preview(request),{id:`preview-${++requestId}`,expectedRevision:beforeApi.revision,commands:[{type:'layout.region',region}]});expect(dry.ok).toBeTruthy();expect((await state(page)).design).toEqual(beforeApi.design);expect((await state(page)).history).toEqual(beforeApi.history);
 const applied=await command(page,[{type:'layout.region',region}]);expect(applied.snapshot.boards.some(b=>b.layoutId===region.id&&b.angleDeg===33&&b.colour===region.colour)).toBeTruthy();await command(page,[{type:'history.undo'}]);expect((await state(page)).design).toEqual(beforeApi.design);
 const invalid=await page.evaluate(async(request)=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.execute(request),{id:`invalid-${++requestId}`,commands:[{type:'layout.region',region:{...region,angleDeg:999}}]});expect(invalid.ok).toBeFalsy();expect((await state(page)).design).toEqual(beforeApi.design);
 const absent=await page.evaluate(async(request)=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.preview(request),{id:`absent-${++requestId}`,commands:[{type:'layout.region',region:{...region,level:2}}]});expect(absent.ok).toBeFalsy();expect((await state(page)).design).toEqual(beforeApi.design);
 const link=await command(page,[{type:'action',action:'share.create'}]);const shared=await context.newPage();await shared.goto(link.result!.url!);await shared.waitForFunction(()=>!!(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().design.boardLayout);expect((await state(shared)).design.boardLayout).toEqual(saved.design.boardLayout);await shared.close();
});

test.describe('phone board tools',()=>{
 test.use({viewport:{width:390,height:844}});
 test('@phone touch rectangle/free select and board-number editing keep navigation and prices reachable',async({page,context})=>{
  await start(page);await navigationClear(page);await applyRegion(page,context,33,false,true);await applyRegion(page,context,90,true,true);expect((await state(page)).design.boardLayout?.regions).toHaveLength(2);
  await page.getByRole('button',{name:'Select board',exact:true}).click();const snapshot=await state(page),target=snapshot.boards.find(b=>b.level===1&&!b.layoutId&&b.lengthIn>40&&b.cy>100&&b.cy<135&&b.cx<90)!;expect(target).toBeTruthy();await page.getByRole('combobox',{name:'Select deck board',exact:true}).selectOption(String(target.index));await expect(page.locator('.dd-board-layout-highlight')).toHaveCount(1);await page.getByRole('spinbutton',{name:'Board direction',exact:true}).fill('90');await page.getByRole('combobox',{name:'Layout board colour',exact:true}).selectOption('tt_prime_plus:Sea Salt Gray');await page.getByRole('button',{name:'Apply layout',exact:true}).click();await expect.poll(async()=>(await state(page)).design.boardLayout?.pieces.length).toBe(1);
  const price=page.getByRole('region',{name:'Live price'});await expect(price).toBeVisible();await price.getByRole('button').filter({hasText:/Price schedule/}).click();await expect(page.getByRole('dialog',{name:'Price schedule'})).toContainText('Custom board-layout');await expect(page.getByRole('dialog',{name:'Price schedule'})).toContainText('Builder quote');expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
 });
});

test.describe('tablet board tools',()=>{
 test.use({viewport:{width:768,height:1024},isMobile:false,hasTouch:true});
 test('@phone tablet breaker touch gesture remains a draft until one Apply',async({page,context})=>{
  await start(page);await navigationClear(page);const initial=await state(page);await page.getByRole('button',{name:'Add breaker',exact:true}).click();await draw(page,context,[{x:61,y:16},{x:79,y:120}],true);await expect(page.locator('.dd-board-layout-breaker')).toBeVisible();expect((await state(page)).design).toEqual(initial.design);await page.getByRole('button',{name:'Apply layout',exact:true}).click();await expect.poll(async()=>(await state(page)).design.boardLayout?.breakers.length).toBe(1);await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>JSON.stringify((await state(page)).design)).toBe(JSON.stringify(initial.design));expect((await state(page)).pricing.total).toBe(initial.pricing.total);
 });
});
