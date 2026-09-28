import {expect,test,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckAgentApi,AgentCommand} from '../src/features/deckcraft/designer/deckAgentController';
import type {SketchDocument,SketchPoint} from '../src/features/deckcraft/sketch/sketchTypes';

const proof=resolve(process.cwd(),'../../outputs/deckcraft-stair-path-review');mkdirSync(proof,{recursive:true});
const key='golden-maple.deck-studio.sketch-draft.v1';
const modal=(page:Page)=>page.getByRole('dialog',{name:'Sketch a design',exact:true});
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
const draft=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{"version":1,"shapes":[]}') as SketchDocument,key);
const caught=new WeakMap<Page,string[]>();
let requestId=0;
const rectangle:SketchDocument={version:1,shapes:[{id:'main',kind:'deck',label:'Measured freestanding deck',widthFt:16,depthFt:12,heightIn:30,points:[{x:200,y:200},{x:520,y:200},{x:520,y:440},{x:200,y:440}]}]};

async function execute(page:Page,commands:AgentCommand[]){
 const response=await page.evaluate(async({commands,id})=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({commands,id,expectedRevision:api.read().revision});},{commands,id:`stair-path-browser-${++requestId}`});
 if('error' in response)throw Error(`${response.error.code}: ${response.error.message}`);
 return response.snapshot;
}
async function open(page:Page,resume=false){await page.getByRole('button',{name:'Sketch a design',exact:true}).click();await expect(modal(page)).toBeVisible();if(resume){await modal(page).locator('summary').filter({hasText:'Sketch files & reset'}).click();await modal(page).getByRole('button',{name:'Resume saved sketch',exact:true}).click();}else await modal(page).getByRole('button',{name:'New sketch',exact:true}).click();}
async function screen(page:Page,p:SketchPoint){
 const canvas=modal(page).getByRole('group',{name:'Sketch canvas',exact:true});await canvas.scrollIntoViewIfNeeded();
 return canvas.evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);return {x:q.x,y:q.y};},p);
}
async function tap(page:Page,p:SketchPoint,touch=false){const q=await screen(page,p);if(touch)await page.touchscreen.tap(q.x,q.y);else await page.mouse.click(q.x,q.y);}
async function rightFinish(page:Page){const canvas=modal(page).getByRole('group',{name:'Sketch canvas',exact:true});await canvas.scrollIntoViewIfNeeded();const bounds=(await canvas.boundingBox())!;await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2,{button:'right'});}
async function seedDeck(page:Page){await page.evaluate(({key,document})=>localStorage.setItem(key,JSON.stringify(document)),{key,document:rectangle});await open(page,true);}
async function path(page:Page,points:SketchPoint[],touch=false){
 await modal(page).getByRole('button',{name:'Draw stairs',exact:true}).click();
 await expect(modal(page).getByRole('button',{name:'Straight lines',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const p of points)await tap(page,p,touch);
 if(touch){const finish=modal(page).getByRole('button',{name:'Finish path',exact:true});await finish.scrollIntoViewIfNeeded();const b=await finish.boundingBox();expect(b!.width).toBeGreaterThanOrEqual(44);expect(b!.height).toBeGreaterThanOrEqual(44);await page.touchscreen.tap(b!.x+b!.width/2,b!.y+b!.height/2);}
 else await rightFinish(page);
 const drawn=(await draft(page)).shapes.at(-1)!;expect(drawn.kind).toBe('stairs');expect(drawn.drawing).toBe('edge-path');expect(drawn.points).toHaveLength(points.length);
 for(let i=0;i<points.length;i++){expect(drawn.points[i].x).toBeCloseTo(points[i].x,0);expect(drawn.points[i].y).toBeCloseTo(points[i].y,0);}
 return drawn;
}
async function apply(page:Page){await modal(page).getByRole('button',{name:'Generate design',exact:true}).click();await expect(modal(page).getByRole('tabpanel',{name:'Plan sketch preview'})).toBeVisible();const name=(await draft(page)).shapes.at(-1)!.points.length===2?'line':'wrap';await page.screenshot({path:resolve(proof,`${test.info().project.name}-${name}-plan-preview.png`)});await modal(page).getByRole('button',{name:'Apply design',exact:true}).click();await expect(modal(page)).toBeHidden();await expect.poll(async()=>(await state(page)).ready).toBe(true);return state(page);}
async function stairControls(page:Page){const button=page.getByRole('region',{name:'Deck configuration'}).getByRole('button',{name:'Stairs & railings',exact:true});if(await button.getAttribute('aria-expanded')==='false')await button.click();const controls=page.getByRole('region',{name:'Stairs & railings',exact:true});await expect(controls.getByRole('spinbutton',{name:'Number of risers',exact:true})).toBeVisible();return controls;}
const lengths=(points:SketchPoint[])=>points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));

test.beforeEach(async({page,context})=>{
 const errors:string[]=[];caught.set(page,errors);page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(({configuration})=>{const key='golden-maple.deck-studio.deck-only.v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}));},{configuration:{...DEFAULT_DECK,width:16,length:12,height:30,levels:1,stairFlights:0,customerName:'Stair path QA',projectAddress:'Local browser fixture'}});
 await context.route('**/*',route=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(route.request().url())&&route.request().method()==='GET'?route.continue():route.fulfill({status:200,body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
});
test.afterEach(async({page})=>expect(caught.get(page)??[],'Native stair sketch interaction must not throw').toEqual([]));

test('right-click finishes each closed shape without adding the cursor position and retains invalid drafts',async({page})=>{
 const original=await state(page);await open(page);await modal(page).getByRole('button',{name:'Straight lines',exact:true}).click();
 for(const kind of ['house','deck','landing'] as const){
  await modal(page).getByRole('button',{name:`Draw ${kind}`,exact:true}).click();
  for(const p of [{x:200,y:200},{x:520,y:200},{x:520,y:440}])await tap(page,p);
  await rightFinish(page);const added=(await draft(page)).shapes.at(-1)!;expect(added.kind).toBe(kind);expect(added.points).toHaveLength(4);expect(added.drawing).toBeUndefined();
  expect(added.points.some(p=>p.x>600||p.y>500)).toBe(false);
 }
 const saved=await draft(page);await modal(page).getByRole('button',{name:'Draw deck',exact:true}).click();await tap(page,{x:680,y:160});await tap(page,{x:940,y:160});await rightFinish(page);
 expect(await draft(page)).toEqual(saved);await expect(modal(page).locator('.dd-sketch-line-actions')).toContainText('2 corners');await expect(modal(page).getByRole('status').last()).toContainText('at least three');
 await tap(page,{x:940,y:380});await rightFinish(page);expect((await draft(page)).shapes).toHaveLength(4);
 await modal(page).getByRole('button',{name:'Draw deck',exact:true}).click();await modal(page).getByRole('button',{name:'Snap to 90°',exact:true}).click();
 const beforeCross=await draft(page);for(const p of [{x:680,y:160},{x:940,y:380},{x:940,y:160},{x:680,y:380}])await tap(page,p);await rightFinish(page);
 expect(await draft(page)).toEqual(beforeCross);await expect(modal(page).getByRole('status').last()).toContainText('cross');await expect(modal(page).locator('.dd-sketch-line-actions')).toContainText('4 corners');
 expect((await state(page)).design).toEqual(original.design);expect((await state(page)).pricing).toEqual(original.pricing);expect((await state(page)).history).toEqual(original.history);
 await page.screenshot({path:resolve(proof,'desktop-right-click-invalid-retained.png')});
});

test('an open line creates its exact stair opening, remains editable and persists through reload with one Apply undo',async({page})=>{
 const original=await state(page);await seedDeck(page);await path(page,[{x:260,y:440},{x:460,y:440}]);
 await modal(page).getByRole('spinbutton',{name:'Number of risers',exact:true}).fill('5');await modal(page).getByRole('spinbutton',{name:/^Tread depth/}).fill('13');
 expect((await state(page)).design).toEqual(original.design);const applied=await apply(page);expect(applied.design.stairPath?.points).toHaveLength(2);expect(lengths(applied.design.stairPath!.points)[0]).toBeCloseTo(120,0);expect(applied.design.stairRiserCount).toBe(5);expect(applied.design.stairTreadDepthIn).toBe(13);expect(applied.pricing.areaSqft).toBeCloseTo(192,3);expect(applied.quantities.stairFlights).toBe(1);expect(applied.quantities.stairTreads).toBe(4);
 await execute(page,[{type:'history.undo'}]);expect((await state(page)).design).toEqual(original.design);expect((await state(page)).pricing).toEqual(original.pricing);await execute(page,[{type:'history.redo'}]);expect((await state(page)).design).toEqual(applied.design);
 const controls=await stairControls(page);await controls.getByRole('spinbutton',{name:'Number of risers',exact:true}).fill('6');await controls.getByRole('spinbutton',{name:'Tread depth',exact:true}).fill('12.5');await expect.poll(async()=>(await state(page)).quantities.stairTreads).toBe(5);await expect.poll(async()=>(await state(page)).ready).toBe(true);const tallerCount=await state(page);expect(tallerCount.pricing.total).toBeGreaterThan(applied.pricing.total);await controls.getByRole('spinbutton',{name:'Stair path section 1 width',exact:true}).fill('96');
 await expect.poll(async()=>{const s=await state(page);return {risers:s.design.stairRiserCount,depth:s.design.stairTreadDepthIn,width:lengths(s.design.stairPath!.points)[0]};}).toEqual({risers:6,depth:12.5,width:96});
 await expect.poll(async()=>(await state(page)).ready).toBe(true);const edited=await state(page);expect(edited.quantities.stairTreads).toBe(5);expect(edited.pricing.areaSqft).toBeCloseTo(192,3);expect(edited.pricing.total).toBeLessThan(tallerCount.pricing.total);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('golden-maple.deck-studio.deck-only.v1')??'{}').configuration.stairRiserCount)).toBe(6);
 // The width is edited after the risers: wait for autosave to hold it too, or a slow runner reloads the earlier width.
 await expect.poll(()=>page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('golden-maple.deck-studio.deck-only.v1')??'{}').configuration.stairPath))).toBe(JSON.stringify(edited.design.stairPath));
 await page.reload();await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);expect((await state(page)).design.stairPath).toEqual(edited.design.stairPath);expect((await state(page)).design.stairRiserCount).toBe(6);expect((await state(page)).design.stairTreadDepthIn).toBe(12.5);expect((await state(page)).pricing).toEqual(edited.pricing);
 writeFileSync(resolve(proof,'desktop-line-persistence.json'),JSON.stringify({applied,edited,reloaded:await state(page)},null,2));await stairControls(page);await page.screenshot({path:resolve(proof,'desktop-line-editable-persisted.png')});
});

test('an L path opens both complete perimeter edges without closing into a diagonal or two unrelated default flights',async({page})=>{
 await seedDeck(page);await path(page,[{x:200,y:440},{x:520,y:440},{x:520,y:200}]);await modal(page).getByRole('spinbutton',{name:'Number of risers',exact:true}).fill('4');const applied=await apply(page);
 expect(applied.design.stairPath?.points).toHaveLength(3);const span=lengths(applied.design.stairPath!.points);expect(span[0]).toBeCloseTo(192,0);expect(span[1]).toBeCloseTo(144,0);expect(applied.design.stairRiserCount).toBe(4);expect(applied.quantities.stairFlights).toBe(2);expect(applied.quantities.stairTreads).toBe(6);expect(applied.pricing.areaSqft).toBeCloseTo(192,3);
 const controls=await stairControls(page);await expect(controls.getByRole('spinbutton',{name:'Stair path section 1 width',exact:true})).toHaveValue('192');await expect(controls.getByRole('spinbutton',{name:'Stair path section 2 width',exact:true})).toHaveValue('144');const corner=applied.design.stairPath!.points[1];
 await controls.getByRole('spinbutton',{name:'Stair path section 1 width',exact:true}).fill('168');await expect.poll(async()=>lengths((await state(page)).design.stairPath!.points)[0]).toBe(168);expect((await state(page)).design.stairPath!.points[1]).toEqual(corner);expect(lengths((await state(page)).design.stairPath!.points)[1]).toBeCloseTo(144,4);
 await expect.poll(async()=>(await state(page)).ready).toBe(true);const beforeRemoval=await state(page);await page.screenshot({path:resolve(proof,'desktop-l-wrap-editable.png')});
 await controls.getByRole('button',{name:'Remove drawn stairs',exact:true}).click();await expect.poll(async()=>(await state(page)).ready).toBe(true);const removed=await state(page);expect(removed.design.stairPath).toBeUndefined();expect(removed.design.stairFlights).toBe(0);expect(removed.quantities.stairFlights).toBe(0);expect(removed.quantities.stairTreads).toBe(0);
 await execute(page,[{type:'history.undo'}]);const restored=await state(page);expect(restored.design).toEqual(beforeRemoval.design);expect(restored.pricing).toEqual(beforeRemoval.pricing);expect(restored.quantities).toEqual(beforeRemoval.quantities);writeFileSync(resolve(proof,'desktop-l-two-edge-state.json'),JSON.stringify({beforeRemoval,removed,restored},null,2));
});

test.describe('phone stair path',()=>{test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});test('@phone native touch draws an L and Finish path leaves risers and tread dimensions editable',async({page})=>{
 const original=await state(page);await seedDeck(page);await path(page,[{x:200,y:440},{x:520,y:440},{x:520,y:200}],true);
 await modal(page).getByRole('spinbutton',{name:'Number of risers',exact:true}).fill('5');await modal(page).getByRole('spinbutton',{name:/^Tread depth/}).fill('12');
 const saved=await draft(page);expect(saved.shapes.at(-1)!.points).toHaveLength(3);await page.screenshot({path:resolve(proof,'phone-native-touch-l-path.png')});const applied=await apply(page);expect(applied.design.stairPath?.points).toHaveLength(3);expect(applied.design.stairRiserCount).toBe(5);expect(applied.design.stairTreadDepthIn).toBe(12);expect(applied.quantities.stairTreads).toBe(8);
 await execute(page,[{type:'history.undo'}]);expect((await state(page)).design).toEqual(original.design);await execute(page,[{type:'history.redo'}]);const controls=await stairControls(page);
 for(const name of ['Number of risers','Tread depth','Stair path section 1 width','Stair path section 2 width']){const input=controls.getByRole('spinbutton',{name,exact:true});await input.scrollIntoViewIfNeeded();const b=await input.boundingBox();expect(b!.height).toBeGreaterThanOrEqual(44);}
 await controls.getByRole('spinbutton',{name:'Number of risers',exact:true}).fill('6');await expect.poll(async()=>(await state(page)).quantities.stairTreads).toBe(10);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:resolve(proof,'phone-l-post-apply-count-edit.png')});
});});
