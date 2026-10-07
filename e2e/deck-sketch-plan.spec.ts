import {expect,test,type Locator,type Page} from '@playwright/test';
import {savedConfiguration} from './nav';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData} from '../src/features/deckcraft/types';
import type {DeckAgentApi,AgentSnapshot} from '../src/features/deckcraft/designer/deckAgentController';
import type {SketchDocument,SketchShape} from '../src/features/deckcraft/sketch/sketchTypes';

const proof=resolve(process.cwd(),'../../outputs/deckcraft-sketch-plan-review');mkdirSync(proof,{recursive:true});
const draftKey='golden-maple.deck-studio.sketch-draft.v1';
const outline=[{x:0,y:0},{x:108,y:0},{x:216,y:0},{x:216,y:168},{x:132,y:168},{x:132,y:144},{x:0,y:144}];
const fixture:DeckData={...DEFAULT_DECK,width:18,length:14,height:30,levels:1,deckType:'Freestanding',houseVisible:false,
 deckOutlines:{main:outline.map(p=>({x:p.x/12,y:p.y/12}))},
 stairFlights:1,stairPath:{points:[{x:156,y:168},{x:204,y:168}]},stairRiserCount:5,stairTreadDepthIn:12,
 pattern:'Picture Frame',pictureFrameRows:1,deckFinishes:{railingColor:'Black'},hasDrainage:true,benchLf:10,
 privacyScreens:[{id:'retained-screen',side:'Left',lengthFt:8,heightFt:6,offsetPct:50,lights:false,enabled:true}],
 boardLayout:{regions:[{id:'retained-direction',level:1,polygon:[{x:12,y:12},{x:96,y:12},{x:96,y:84},{x:12,y:84}],angleDeg:30}],breakers:[{id:'retained-divider',level:1,start:{x:108,y:0},end:{x:108,y:144},widthIn:5.5}],pieces:[]},
 customerName:'Sketch plan QA',projectAddress:'Private local fixture'};
const independentDraft:SketchDocument={version:1,shapes:[{id:'independent-draft',kind:'deck',label:'Saved independent sketch',widthFt:5,depthFt:5,heightIn:12,points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]}]};
const errors=new WeakMap<Page,string[]>();
const modal=(page:Page)=>page.getByRole('dialog',{name:'Sketch a design',exact:true});
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
async function settled(page:Page){await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);return state(page);}
async function activate(page:Page,control:Locator,touch=false){await control.scrollIntoViewIfNeeded();if(touch){const b=(await control.boundingBox())!;expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}else await control.click();}
async function open(page:Page,touch=false){await activate(page,page.getByRole('button',{name:'Sketch a design',exact:true}),touch);await expect(modal(page)).toBeVisible();await expect(modal(page).getByRole('group',{name:'Sketch source'}).getByRole('button',{name:'Current plan',exact:true})).toHaveAttribute('aria-pressed','true');}
async function dragSketchPoint(page:Page,touch:boolean){
 const point=modal(page).getByRole('button',{name:'Main deck sketch point 6',exact:true});await point.scrollIntoViewIfNeeded();const movement=await point.evaluate(el=>{const circle=el.querySelector('circle')!,svg=circle.ownerSVGElement!,matrix=svg.getScreenCTM()!,origin=new DOMPoint(Number(circle.getAttribute('cx')),Number(circle.getAttribute('cy'))).matrixTransform(matrix),target=new DOMPoint(origin.x+12,origin.y+6).matrixTransform(matrix.inverse()),start=origin.matrixTransform(matrix.inverse());return {x:origin.x,y:origin.y,dx:target.x-start.x,dy:target.y-start.y,hit:document.elementFromPoint(origin.x,origin.y)?.closest("[aria-label]")?.getAttribute("aria-label")};});
 writeFileSync(resolve(proof,`${touch?'phone':'desktop'}-drag-hit.json`),JSON.stringify(movement,null,2)); if(touch){const cdp=await page.context().newCDPSession(page);try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:movement.x,y:movement.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:movement.x+6,y:movement.y+3,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:movement.x+12,y:movement.y+6,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await cdp.detach();}}
 else{await page.mouse.move(movement.x,movement.y);await page.mouse.down();await page.mouse.move(movement.x+12,movement.y+6,{steps:4});await page.mouse.up();}
 return movement;
}
async function exported(page:Page){const files=modal(page).locator('details').filter({has:page.locator('summary').filter({hasText:'Sketch files & reset'})});if(!await files.evaluate(el=>(el as HTMLDetailsElement).open))await files.locator('summary').click();const downloadPromise=page.waitForEvent('download');await modal(page).getByRole('button',{name:'Export sketch JSON',exact:true}).click();const download=await downloadPromise;return JSON.parse(readFileSync((await download.path())!,'utf8')) as SketchDocument;}
function mainOf(doc:SketchDocument){const main=doc.shapes.find(s=>s.id==='plan-deck-1');expect(main,'Current plan contains the main deck rather than an independent stale draft').toBeTruthy();return main!;}
function parity(main:SketchShape,snapshot:AgentSnapshot){
 const points=snapshot.boundaries.find(b=>b.level===1)!.points;expect(main.points).toHaveLength(points.length);
 const left=Math.min(...main.points.map(p=>p.x)),top=Math.min(...main.points.map(p=>p.y)),px=Math.min(...points.map(p=>p.x)),py=Math.min(...points.map(p=>p.y));
 for(let i=0;i<points.length;i++){expect(main.points[i].x-left).toBeCloseTo(points[i].x-px,6);expect(main.points[i].y-top).toBeCloseTo(points[i].y-py,6);}
 expect(main.widthFt).toBeCloseTo((Math.max(...points.map(p=>p.x))-px)/12,6);expect(main.depthFt).toBeCloseTo((Math.max(...points.map(p=>p.y))-py)/12,6);expect(main.heightIn).toBe(snapshot.design.height);
}
function retained(after:AgentSnapshot,before:AgentSnapshot){
 for(const field of ['deckingMaterial','deckingColor','pictureFrameRows','pattern','deckFinishes','hasDrainage','benchLf','stairRiserCount','stairTreadDepthIn'] as const)expect(after.design[field],`${field} survives an edit of the current plan`).toEqual(before.design[field]);
 expect(after.design.stairPath?.points).toHaveLength(2);expect(after.quantities.stairTreads).toBe(4);
 expect(after.design.privacyScreens?.map(s=>({id:s.id,heightFt:s.heightFt,enabled:s.enabled}))).toEqual(before.design.privacyScreens?.map(s=>({id:s.id,heightFt:s.heightFt,enabled:s.enabled})));
 expect(after.design.boardLayout?.regions.map(s=>({id:s.id,angleDeg:s.angleDeg}))).toEqual(before.design.boardLayout?.regions.map(s=>({id:s.id,angleDeg:s.angleDeg})));
 expect(after.design.boardLayout?.breakers.map(s=>({id:s.id,widthIn:s.widthIn}))).toEqual(before.design.boardLayout?.breakers.map(s=>({id:s.id,widthIn:s.widthIn})));
}
async function editOnPlan(page:Page,touch=false){await activate(page,modal(page).getByRole('button',{name:'Edit on plan',exact:true}),touch);await expect(modal(page)).toBeHidden();await expect(page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio',{name:'Shape & points',exact:true})).toBeChecked();return settled(page);}

test.beforeEach(async({page,context})=>{
 const caught:string[]=[];errors.set(page,caught);page.on('pageerror',error=>caught.push(error.message));
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(({configuration,draft,key})=>{const storage='golden-maple.deck-studio.deck-only.v1';if(!localStorage.getItem(storage))localStorage.setItem(storage,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}));if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(draft));},{configuration:fixture,draft:independentDraft,key:draftKey});
 await context.route('**/*',route=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(route.request().url())&&route.request().method()==='GET'?route.continue():route.fulfill({status:200,body:''}));
 await page.goto('/deck-designer/');await settled(page);
});
test.afterEach(async({page},info)=>{writeFileSync(resolve(proof,`${info.project.name}-${info.title.includes('Current plan')?'roundtrip':'draft'}-errors.json`),JSON.stringify({status:info.status,errors:errors.get(page)??[]},null,2));expect(errors.get(page)??[]).toEqual([]);});

for(const touch of [false,true])test(`${touch?'@phone ':''}Current plan sketch and plan edit the same geometry while retaining features and no-op history`,async({page})=>{
 const original=await state(page);expect(original.boundaries[0].points).toHaveLength(7);expect(original.design.boardLayout?.breakers).toHaveLength(1);const independent=await page.evaluate(key=>localStorage.getItem(key),draftKey);
 await open(page,touch);const initial=await exported(page);parity(mainOf(initial),original);expect(initial.shapes.find(s=>s.id==='plan-stairs')?.drawing).toBe('edge-path');const noOp=await editOnPlan(page,touch);expect(noOp.design).toEqual(original.design);expect(noOp.pricing).toEqual(original.pricing);expect(noOp.history).toEqual(original.history);expect(await page.evaluate(key=>localStorage.getItem(key),draftKey)).toBe(independent);
 await open(page,touch);await modal(page).getByRole('button').filter({hasText:'Main deck'}).filter({has:page.locator('.dd-sketch-shape-number')}).click();await modal(page).getByRole('spinbutton',{name:/^Measured width/}).fill('20');
 const widthDraft=await exported(page);expect(mainOf(widthDraft).widthFt).toBe(20);expect(Math.max(...mainOf(widthDraft).points.map(p=>p.x))-Math.min(...mainOf(widthDraft).points.map(p=>p.x))).toBeCloseTo(240,6);const sketchPoint=modal(page).getByRole('button',{name:'Main deck sketch point 6',exact:true});await sketchPoint.focus();await sketchPoint.press('ArrowRight');const pointDraft=await exported(page);expect(mainOf(pointDraft).points[5].x).toBeCloseTo(mainOf(widthDraft).points[5].x+1,6);const edge=modal(page).getByRole('button',{name:'Main deck sketch edge 1',exact:true});await edge.focus();await edge.press('ArrowDown');const edgeDraft=await exported(page);for(const i of [0,1])expect(mainOf(edgeDraft).points[i].y).toBeCloseTo(mainOf(pointDraft).points[i].y+1,6);writeFileSync(resolve(proof,`${touch?'phone':'desktop'}-keyboard-edited-draft.json`),JSON.stringify({sourceFixture:fixture,source:original.design,baseline:initial,document:edgeDraft},null,2));const drag=await dragSketchPoint(page,touch),resizedDraft=await exported(page);expect(drag.hit).toBe('Main deck sketch point 6');expect(mainOf(resizedDraft).points[5].x).toBeCloseTo(mainOf(edgeDraft).points[5].x+drag.dx,3);expect(mainOf(resizedDraft).points[5].y).toBeCloseTo(mainOf(edgeDraft).points[5].y+drag.dy,3);for(const i of [0,1,2,3,4,6])expect(mainOf(resizedDraft).points[i]).toEqual(mainOf(edgeDraft).points[i]);expect((await state(page)).design).toEqual(original.design);expect((await state(page)).pricing).toEqual(original.pricing);
 writeFileSync(resolve(proof,`${touch?'phone':'desktop'}-edited-draft.json`),JSON.stringify({sourceFixture:fixture,source:original.design,baseline:initial,document:resizedDraft},null,2));const resized=await editOnPlan(page,touch);expect(resized.design.width).toBeCloseTo(20,6);expect(resized.boundaries[0].points).toHaveLength(7);parity(mainOf(resizedDraft),resized);retained(resized,original);expect(resized.pricing.areaSqft).not.toBe(original.pricing.areaSqft);
 const point=page.getByRole('button',{name:'Main deck point 6',exact:true});await point.scrollIntoViewIfNeeded();await point.focus();await point.press('ArrowRight');await expect.poll(async()=>(await state(page)).boundaries[0].points[5].x).toBeCloseTo(resized.boundaries[0].points[5].x+1,6);const pulled=await settled(page);
 await open(page,touch);const reopened=await exported(page);parity(mainOf(reopened),pulled);await page.screenshot({path:resolve(proof,`${touch?'phone':'desktop'}-reopened-current-plan.png`)});const secondNoOp=await editOnPlan(page,touch);expect(secondNoOp.design).toEqual(pulled.design);expect(secondNoOp.pricing).toEqual(pulled.pricing);expect(secondNoOp.history).toEqual(pulled.history);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await state(page)).design).toEqual(resized.design);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await state(page)).design).toEqual(original.design);
 await expect.poll(async()=>(await savedConfiguration(page))?.customerName).toBe('Sketch plan QA');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 writeFileSync(resolve(proof,`${touch?'phone':'desktop'}-roundtrip.json`),JSON.stringify({original,initial,noOp,resizedDraft,resized,pulled,reopened,secondNoOp},null,2));
});

test('Invalid current-plan edits and Close preserve the design; New sketch and saved drafts remain separate',async({page})=>{
 const original=await state(page);await open(page);await modal(page).getByRole('button').filter({hasText:'Main deck'}).filter({has:page.locator('.dd-sketch-shape-number')}).click();await modal(page).getByRole('spinbutton',{name:/^Measured width/}).fill('0');await modal(page).getByRole('button',{name:'Edit on plan',exact:true}).click();await expect(modal(page).getByRole('alert')).toBeVisible();expect((await state(page)).design).toEqual(original.design);expect((await state(page)).pricing).toEqual(original.pricing);expect((await state(page)).history).toEqual(original.history);await page.screenshot({path:resolve(proof,'desktop-invalid-current-plan.png')});
 await modal(page).getByRole('button',{name:'Close sketch designer',exact:true}).click();await open(page);parity(mainOf(await exported(page)),original);
 await modal(page).getByRole('group',{name:'Sketch source'}).getByRole('button',{name:'New sketch',exact:true}).click();await expect(modal(page).getByRole('group',{name:'Sketch source'}).getByRole('button',{name:'New sketch',exact:true})).toHaveAttribute('aria-pressed','true');await expect(modal(page).getByRole('button',{name:'Generate design',exact:true})).toBeDisabled();expect((await state(page)).design).toEqual(original.design);
 const files=modal(page).locator('details').filter({has:page.locator('summary').filter({hasText:'Sketch files & reset'})});if(!await files.evaluate(el=>(el as HTMLDetailsElement).open))await files.locator('summary').click();await modal(page).getByRole('button',{name:'Resume saved sketch',exact:true}).click();const resumed=await exported(page);expect(resumed).toEqual(independentDraft);expect((await state(page)).design).toEqual(original.design);await modal(page).getByRole('button',{name:'Close sketch designer',exact:true}).click();const closed=await settled(page);expect(closed.design).toEqual(original.design);expect(closed.pricing).toEqual(original.pricing);expect(closed.history).toEqual(original.history);
 writeFileSync(resolve(proof,'desktop-invalid-new-saved-draft.json'),JSON.stringify({original,resumed,closed},null,2));
});
