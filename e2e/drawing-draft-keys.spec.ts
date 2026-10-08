import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
// Draft keys act on the drawing in progress, never on the saved design: Ctrl+Z removes the last point, L/T/A pick the
// next edge, C finishes. Shift-held drawing still closes on the first point. The right-click menu deletes patios and
// opens the stair shape tool.
const read=(page:Page)=>page.evaluate(()=>(window as any).deckcraft.read());
const MENU_PATIO={id:'menu-patio',name:'Menu patio',kind:'patio',enabled:true,xFt:25,zFt:8,widthFt:8,depthFt:8,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaa69b'};
test.beforeEach(async({page,context},info)=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(configuration=>localStorage.setItem('golden-maple.deck-studio.deck-only.v1',JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration})),{...DEFAULT_DECK,yardFeatures:info.title.startsWith('right-click')?[MENU_PATIO]:[]});
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);
});
async function patioSurface(page:Page){
 await page.getByRole('radio',{name:'Patios & walls',exact:true}).click();await page.getByRole('button',{name:'Draw patio',exact:true}).click();
 const surface=page.getByLabel('Yard shape drawing surface',{exact:true});await surface.scrollIntoViewIfNeeded();
 const b=(await surface.boundingBox())!,side=Math.min(85,b.width*.26,b.height*.28),start={x:b.x+b.width*.4,y:b.y+b.height*.45};
 return {surface,side,start,square:[start,{x:start.x+side,y:start.y},{x:start.x+side,y:start.y+side},{x:start.x,y:start.y+side}]};
}
// Finishing a patio commits it. The old Apply preview step was removed when plan tools started saving the edit directly.
async function applyDrawn(page:Page){await expect(page.getByRole('button',{name:'Apply preview',exact:true})).toHaveCount(0);await expect.poll(async()=>(await read(page)).design.yardFeatures?.length??0).toBe(1);}
test('Ctrl+Z removes the last patio point without touching the design, and C finishes the patio',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const before=await read(page),{surface,square}=await patioSurface(page),dots=surface.locator('.dd-yard-shape-draft-point');
 for(const p of square)await page.mouse.click(p.x,p.y);await expect(dots).toHaveCount(4);
 await page.keyboard.press('Control+z');await expect(dots).toHaveCount(3);
 const during=await read(page);expect(during.design).toEqual(before.design);expect(during.revision).toBe(before.revision);
 await page.mouse.click(square[3].x,square[3].y);await expect(dots).toHaveCount(4);
 await page.keyboard.press('c');await expect(surface).toHaveCount(0);await applyDrawn(page);
 expect((await read(page)).design.yardFeatures[0].outline).toHaveLength(4);expect(errors).toEqual([]);
});
test('Shift-held drawing still closes the patio on its first point',async({page})=>{
 const {surface,square,start,side}=await patioSurface(page),dots=surface.locator('.dd-yard-shape-draft-point');
 for(const p of square)await page.mouse.click(p.x,p.y);await expect(dots).toHaveCount(4);
 // Aim up the left edge, then hold Shift: the held bearing passes the first corner, so a nearby click closes the outline.
 await page.mouse.move(start.x,start.y+side*.5);await page.keyboard.down('Shift');
 await page.mouse.move(start.x+12,start.y+6,{steps:4});await page.mouse.click(start.x+12,start.y+6);await page.keyboard.up('Shift');
 await expect(surface).toHaveCount(0);await applyDrawn(page);expect((await read(page)).design.yardFeatures[0].outline).toHaveLength(4);
});
test('designer drawing: L, T and A pick the next edge, Ctrl+Z steps back through the draft, C closes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const before=await read(page);
 await page.getByRole('radio',{name:'Patios & walls',exact:true}).click();await page.getByLabel('Designer tools',{exact:true}).check();await page.getByRole('button',{name:'Patio outline',exact:true}).click();
 const surface=page.getByLabel('Patio outline drawing surface',{exact:true}),dots=surface.locator('.dd-shape-draw-point'),edge=page.getByRole('group',{name:'Next edge'});
 await surface.scrollIntoViewIfNeeded();const b=(await surface.boundingBox())!,side=Math.min(85,b.width*.26,b.height*.28),start={x:b.x+b.width*.4,y:b.y+b.height*.45};
 for(const p of [start,{x:start.x+side,y:start.y},{x:start.x+side,y:start.y+side}])await page.mouse.click(p.x,p.y);await expect(dots).toHaveCount(3);
 for(const [key,name] of [['t','Tangent arc'],['a','3-point arc'],['l','Line']] as const){await page.keyboard.press(key);await expect(edge.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');}
 await page.keyboard.press('Control+z');await expect(dots).toHaveCount(2);expect((await read(page)).design).toEqual(before.design);
 await page.mouse.click(start.x+side,start.y+side);await page.mouse.click(start.x,start.y+side);await expect(dots).toHaveCount(4);
 await page.keyboard.press('c');await expect(surface).toHaveCount(0);await applyDrawn(page);expect(errors).toEqual([]);
});
test('right-click deletes a patio in one undo step and opens the stair shape tool',async({page})=>{
 await expect.poll(async()=>(await read(page)).design.yardFeatures?.length??0).toBe(1);
 await page.getByRole('radio',{name:'Patios & walls',exact:true}).click();
 const menu=page.getByRole('menu',{name:'Object edit menu'});
 const patio=await page.locator('.dd-hardscape-plan-picks').evaluate(svg=>{const poly=[...svg.querySelectorAll('polygon')].find(node=>node.getAttribute('data-context-hardscape')?.includes('menu-patio'));if(!poly)return null;const box=(poly as SVGGraphicsElement).getBBox(),point=(svg as SVGSVGElement).createSVGPoint();point.x=box.x+box.width/2;point.y=box.y+box.height/2;const screen=point.matrixTransform((svg as SVGSVGElement).getScreenCTM()!);return {x:screen.x,y:screen.y};});
 expect(patio).toBeTruthy();await page.mouse.click(patio!.x,patio!.y,{button:'right'});await expect(menu).toContainText('Menu patio');
 await menu.getByRole('menuitem',{name:'Delete',exact:true}).click();await expect.poll(async()=>(await read(page)).design.yardFeatures?.length??0).toBe(0);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await read(page)).design.yardFeatures?.length??0).toBe(1);
 await page.getByRole('radio',{name:'Select parts',exact:true}).click();
 await page.locator('.dd-component-handle[data-kind=stairs]').first().click({button:'right'});await expect(menu).toBeVisible();
 await menu.getByRole('menuitem',{name:'Edit stair shape',exact:true}).click();
 await expect(page.getByRole('radio',{name:'Stairs',exact:true})).toHaveAttribute('aria-checked','true');await expect(page.getByRole('region',{name:'Stair shape tools'})).toBeVisible();
});
