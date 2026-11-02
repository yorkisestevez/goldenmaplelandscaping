import {test,expect,type Locator,type Page} from '@playwright/test';
import {proofDir} from './nav';
import {fileMenu,group,open,panel,price,rail,sheet,topBar} from './next-ui';

// The new look on a phone (docs/deckcraft/ui-redesign-2026-10/PLAN.md, slice S3): a slim top bar, the price and Send
// above the five-group dock, groups and the quote in a drawer that opens at about half height and drags taller or
// away, and the 3D view bar folded into one View button. Runs in the phone project (Pixel 7).
const shots=proofDir('deckcraft-next-phone');
const box=async(l:Locator)=>(await l.boundingBox())!;
const overlaps=(a:{x:number;y:number;width:number;height:number},b:typeof a)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
const viewHeight=(page:Page)=>page.evaluate(()=>window.innerHeight);
const send=(page:Page)=>price(page).getByRole('button',{name:'Send my design',exact:true});
const screenWidth=(page:Page)=>page.evaluate(()=>window.innerWidth);
async function topBarFits(page:Page){
 const parts=[page.getByRole('link',{name:'Golden Maple home'}),page.getByRole('tablist',{name:'Drawing sheets'}),topBar(page).getByRole('button',{name:'Undo',exact:true}),topBar(page).getByRole('button',{name:'Redo',exact:true}),fileMenu(page)];
 const boxes=await Promise.all(parts.map(box)),width=await screenWidth(page);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)expect(overlaps(boxes[i],boxes[j]),`top bar parts ${i} and ${j} overlap`).toBe(false);
 for(const b of boxes){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);}
}
// The price row's text stays inside the total, clear of Send.
async function priceRowFits(page:Page){
 const total=price(page).getByRole('button',{name:/Planning estimate/}),outer=await box(total);
 for(const part of await total.locator('strong,small').all()){if(!await part.isVisible())continue;const b=await box(part);if(b.width<=1)continue;expect(b.x+b.width).toBeLessThanOrEqual(outer.x+outer.width+.5);}
 expect(outer.x+outer.width).toBeLessThanOrEqual((await box(send(page))).x);
}

test('@phone the top bar keeps to the logo, 3D and Plan, Undo, Redo and the file menu, with Framing in the menu',async({page,context})=>{
 await open(page,context);
 await expect(page.getByRole('link',{name:'Golden Maple home'})).toBeVisible();
 for(const name of ['3D','Plan'])await expect(sheet(page,name)).toBeVisible();
 await expect(sheet(page,'Framing')).toBeHidden();
 for(const name of ['Undo','Redo'])await expect(topBar(page).getByRole('button',{name,exact:true})).toBeVisible();
 await expect(topBar(page).getByRole('button',{name:'Send my design',exact:true})).toBeHidden();
 // Nothing in the bar overlaps.
 await topBarFits(page);
 await page.screenshot({path:`${shots}/start.png`,animations:'disabled'});
 await fileMenu(page).click();
 await topBar(page).getByRole('button',{name:'Framing view',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft.read().view)).toBe('drawing');
 // The menu closes and hands the focus back to its button; Framing's modes span the screen.
 await expect(fileMenu(page)).toBeFocused();
 const modes=await box(page.locator('.dd-framing-modes'));
 expect(modes.x).toBeGreaterThanOrEqual(0);expect(modes.x+modes.width).toBeLessThanOrEqual(await screenWidth(page));
});

test('@phone the price and Send stay above the dock and uncovered, whatever is open',async({page,context})=>{
 await open(page,context);
 await expect(rail(page).getByRole('button')).toHaveText(['Shape','Boards','Stairs','Yard','Extras']);
 const dock=await box(rail(page));
 for(const opened of [async()=>{},async()=>group(page,'Boards').click(),async()=>price(page).getByRole('button',{name:/Planning estimate/}).click()]){
  await opened();
  const total=await box(price(page).getByRole('button',{name:/Planning estimate/})),sendBox=await box(send(page));
  // One row, above the dock.
  expect(Math.abs(total.y-sendBox.y)).toBeLessThan(8);
  expect(total.y+total.height).toBeLessThanOrEqual(dock.y+1);
  // The drawer slides up from behind the row (which sits above it); measure it once it has landed.
  if(await panel(page).isVisible()){await panel(page).evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));const drawer=await box(panel(page));expect(overlaps(drawer,total)||overlaps(drawer,sendBox)).toBe(false);}
  await priceRowFits(page);
 }
 await expect(panel(page).getByRole('heading',{level:2})).toHaveText('Your quote');
 await page.screenshot({path:`${shots}/quote.png`,animations:'disabled'});
 await send(page).click();
 await expect(page.getByRole('dialog')).toBeVisible();
});

test('@phone a group opens as a half-height drawer that drags taller or away',async({page,context})=>{
 await open(page,context);
 await group(page,'Shape').click();
 const height=await viewHeight(page),drawer=panel(page);
 await expect(drawer).toBeVisible();
 const half=(await box(drawer)).height;
 // The plan's tools stay on screen above an open drawer.
 await sheet(page,'Plan').click();
 const tools=await box(page.getByRole('radio',{name:'Shape & points',exact:true}));
 expect(tools.x).toBeGreaterThanOrEqual(0);expect(tools.x+tools.width).toBeLessThanOrEqual(await page.evaluate(()=>window.innerWidth));
 expect(half/height).toBeGreaterThan(.38);expect(half/height).toBeLessThan(.52);
 await page.screenshot({path:`${shots}/drawer-half.png`,animations:'disabled'});
 // Tapping the handle toggles the two heights.
 const handle=drawer.getByRole('button',{name:'Taller panel',exact:true});
 await handle.click();
 await expect.poll(async()=>(await box(drawer)).height/height).toBeGreaterThan(.7);
 const top=await box(topBar(page));
 await drawer.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
 expect((await box(drawer)).y).toBeGreaterThanOrEqual(top.y+top.height-2);
 await page.screenshot({path:`${shots}/drawer-tall.png`,animations:'disabled'});
 await drawer.getByRole('button',{name:'Shorter panel',exact:true}).click();
 await expect.poll(async()=>(await box(drawer)).height/height).toBeLessThan(.47);
 // Dragging the grip up snaps the drawer tall; its grip stays on top while the drawer scrolls.
 const start=await box(drawer.getByRole('button',{name:'Taller panel',exact:true}));
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2);
 await page.mouse.down();
 await page.mouse.move(start.x+start.width/2,start.y-height*.25,{steps:8});
 await page.mouse.up();
 await expect.poll(async()=>(await box(drawer)).height/height).toBeGreaterThan(.7);
 await drawer.evaluate(el=>{el.scrollTop=el.scrollHeight;});
 const grip=drawer.getByRole('button',{name:'Shorter panel',exact:true});
 await expect.poll(async()=>(await box(grip)).y-(await box(drawer)).y).toBeLessThan(2);
 await grip.click();
 await expect.poll(async()=>(await box(drawer)).height/height).toBeLessThan(.47);
 // Dragging the handle down puts the drawer away.
 const low=await box(drawer.getByRole('button',{name:'Taller panel',exact:true}));
 await page.mouse.move(low.x+low.width/2,low.y+low.height/2);
 await page.mouse.down();
 await page.mouse.move(low.x+low.width/2,low.y+low.height/2+half*.7,{steps:8});
 await page.mouse.up();
 await expect(drawer).toBeHidden();
 await expect(group(page,'Shape')).toHaveAttribute('aria-pressed','false');
});

test('@phone in 3D the view bar folds into one View button',async({page,context})=>{
 await open(page,context);
 await sheet(page,'3D').click();
 const view=page.getByRole('button',{name:'View',exact:true});
 await expect(view).toBeVisible();
 const bar=page.getByRole('group',{name:'3D view controls'});
 await expect(bar).toBeHidden();
 await view.click();
 await expect(view).toHaveAttribute('aria-expanded','true');
 await expect(bar).toBeVisible();
 await expect(bar.getByRole('group',{name:'Camera'})).toBeVisible();
 // The sheet sits above the price row and inside the screen.
 const sheetBox=await box(bar),row=await box(price(page));
 expect(sheetBox.y+sheetBox.height).toBeLessThanOrEqual(row.y+1);
 expect(sheetBox.x).toBeGreaterThanOrEqual(0);
 const width=await page.evaluate(()=>window.innerWidth);
 expect(sheetBox.x+sheetBox.width).toBeLessThanOrEqual(width);
 // Every control in the sheet is on screen: its groups wrap instead of running off the sides.
 for(const control of await bar.locator('button,label').all()){const b=await box(control);expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);}
 await page.screenshot({path:`${shots}/view-sheet.png`,animations:'disabled'});
 await view.click();
 await expect(bar).toBeHidden();
 // A drawer covers the foot of the scene, so the View button gives way to it.
 await group(page,'Boards').click();
 await expect(panel(page)).toBeVisible();
 await expect(view).toBeHidden();
});

test('@phone the plan opens on Deck size with its controls shut and its zoom controls clear of the price',async({page,context})=>{
 await open(page,context);
 await sheet(page,'Plan').click();
 await expect(page.getByRole('radio',{name:'Deck size',exact:true})).toHaveAttribute('aria-checked','true');
 await expect(page.locator('.dd-selection-inspector')).not.toHaveAttribute('open','');
 const zoom=await box(page.getByRole('group',{name:'Drawing navigation',exact:true})),row=await box(price(page));
 expect(overlaps(zoom,row)).toBe(false);
});

// Owner decision 2026-11-01: on phones a drawing tool's own controls open as a drawer above the price row, and the plan
// zooms onto the deck in the space left above it.
test('@phone a drawing tool opens its controls as a drawer above the price row, with the whole deck zoomed into the space above',async({page,context})=>{
 await open(page,context);
 await sheet(page,'Plan').click();
 await page.getByRole('radio',{name:'Board layout',exact:true}).click();
 const drawer=page.locator('details.dd-selection-inspector');
 await expect(drawer).toHaveAttribute('open','');
 await expect(drawer.getByRole('button',{name:'Select board',exact:true})).toBeVisible();
 const width=await screenWidth(page),height=await viewHeight(page),row=await box(price(page)),top=await box(topBar(page));
 await expect.poll(async()=>(await box(drawer)).y+(await box(drawer)).height).toBeLessThanOrEqual(row.y+1);
 const sheetBox=await box(drawer);
 expect(sheetBox.x).toBeLessThanOrEqual(1);expect(sheetBox.width).toBeGreaterThanOrEqual(width-2);
 expect(sheetBox.y).toBeGreaterThan(height*.35);
 // The zoom controls stay usable above the drawer, and the deck is centred in the space between the top bar and it.
 const zoom=await box(page.getByRole('group',{name:'Drawing navigation',exact:true}));
 expect(overlaps(zoom,sheetBox)||overlaps(zoom,row)).toBe(false);
 const deck=await page.evaluate(()=>{const r=[...document.querySelectorAll('.dd-board-hit')].map(e=>e.getBoundingClientRect());return {top:Math.min(...r.map(b=>b.top)),bottom:Math.max(...r.map(b=>b.bottom))};});
 // The whole deck fits between the plan tools and the drawer, so every edge and point can be reached.
 const tools=await box(page.locator('.dd-simple-tools'));
 expect(deck.top).toBeGreaterThanOrEqual(Math.max(top.y+top.height,tools.y+tools.height)-1);expect(deck.bottom).toBeLessThanOrEqual(sheetBox.y+1);
 await page.screenshot({path:`${shots}/tool-drawer.png`,animations:'disabled'});
 // Its summary folds it away; Deck size, which works on the plan itself, leaves it shut.
 await drawer.locator(':scope>summary').click();
 await expect(drawer).not.toHaveAttribute('open','');
 await page.getByRole('radio',{name:'Deck size',exact:true}).click();
 await expect(drawer).not.toHaveAttribute('open','');
});

test('@phone the narrowest phones keep the top bar, its menu and the price row inside the screen',async({page,context})=>{
 await page.setViewportSize({width:320,height:640});
 await open(page,context);
 await topBarFits(page);
 await priceRowFits(page);
 await fileMenu(page).click();
 const menu=await box(topBar(page).locator('.dd-files-popover'));
 expect(menu.x).toBeGreaterThanOrEqual(0);expect(menu.x+menu.width).toBeLessThanOrEqual(320);
 await page.screenshot({path:`${shots}/narrow.png`,animations:'disabled'});
});

test('@phone a phone on its side keeps the price row and the dock on screen',async({page,context})=>{
 await page.setViewportSize({width:740,height:360});
 await open(page,context);
 for(const part of [price(page),rail(page)]){const b=await box(part);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(360);}
 await priceRowFits(page);
});

test('@phone the plan opens zoomed onto the deck so its labels read at 14 px or more, and Fit shows it all',async({page,context})=>{
 await open(page,context);
 await sheet(page,'Plan').click();
 const zoom=page.getByRole('group',{name:'Drawing navigation',exact:true}).locator('output');
 // Each label's rendered size: its font size in drawing units times the drawing's scale on screen (the footnote, at
 // 6 units, is not a label).
 const labelPx=()=>page.evaluate(()=>{
  const svg=document.querySelector<SVGSVGElement>('.dd-plan-stage svg.dd-site-plan')!,r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;
  const k=Math.min(r.width/vb.width,r.height/vb.height);
  return [...svg.querySelectorAll('text[font-size]')].map(t=>Number(t.getAttribute('font-size'))).filter(n=>n>=6.5).map(n=>n*k);
 });
 await expect.poll(async()=>Math.min(...await labelPx())).toBeGreaterThanOrEqual(13.9);
 expect(parseInt((await zoom.textContent())!)).toBeGreaterThan(100);
 // The deck sits in view.
 const deck=await box(page.locator('.dd-plan-stage svg.dd-site-plan [aria-label="Deck and stair elevations"]'));
 expect(deck.x+deck.width).toBeGreaterThan(0);expect(deck.x).toBeLessThan(await page.evaluate(()=>window.innerWidth));
 await page.screenshot({path:`${shots}/plan-zoomed.png`,animations:'disabled'});
 await page.getByRole('button',{name:'Fit drawing',exact:true}).click();
 await expect(zoom).toHaveText('100%');
});
