import {expect,test,type Page} from '@playwright/test';
import {open,price,sheet} from './next-ui';

/**
 * The Pro workspace in the new look (slice S4, docs/deckcraft/ui-redesign-2026-10/PLAN.md §5d): Designer Mode fills the
 * window like a CAD program. Its menus, ribbon tools, wizards and layers are covered by deckcraft-pro.spec.ts.
 */
const PATH='/deck-designer/?designer=1';
const cad=(page:Page)=>page.locator('.deck-designer[data-ui="cad"]');
const titleBar=(page:Page)=>page.locator('.dd-cad-title');
const ribbon=(page:Page)=>page.getByRole('region',{name:'Ribbon',exact:true});
const ribbonTab=(page:Page,name:string)=>ribbon(page).getByRole('tab',{name,exact:true});
const ribbonButton=(page:Page,name:string)=>page.locator('#dd-pro-ribbon-panel').getByRole('button',{name,exact:true});
const inspector=(page:Page)=>page.locator('#dd-pro-properties');
// The side column: the inspector, the drawing tool's options under it, and the price foot.
const side=(page:Page)=>page.locator('.dd-pro-side');
const foot=(page:Page)=>side(page).locator('.dd-cad-price');
const statusBar=(page:Page)=>page.getByRole('region',{name:'Status bar',exact:true});
const view=(page:Page)=>page.evaluate(()=>(window as any).deckcraft.read().view);
const box=async(l:ReturnType<Page['locator']>)=>{const b=await l.boundingBox();if(!b)throw new Error('not visible');return b;};

test.beforeEach(async({page})=>{await page.setViewportSize({width:1440,height:900});});

test('fills the window like a CAD program: title bar, ribbon, tool strip, drawing, inspector, sheets and status bar',async({page,context},info)=>{
  await open(page,context,PATH);
  await expect(cad(page)).toBeVisible();
  // The title bar (the classic header, restyled) carries the brand, the menus and the page's own file and send actions.
  await expect(titleBar(page)).toContainText('DeckCraft');
  await expect(titleBar(page)).toContainText('Pro');
  await expect(titleBar(page).getByRole('menubar',{name:'Pro workspace menu'})).toBeVisible();
  for(const name of ['Presets','Agents','Send my design'])await expect(titleBar(page).getByRole('button',{name,exact:true})).toBeVisible();
  await expect(titleBar(page).locator('summary',{hasText:'Files'})).toBeVisible();
  await expect(titleBar(page)).toContainText('Auto-save on this device');
  await expect(page.locator('.dd-header')).toHaveCount(1);
  expect((await box(titleBar(page))).height).toBeLessThanOrEqual(56);
  // Every part of the window is on screen at once, and the page itself does not scroll.
  for(const part of [titleBar(page),ribbon(page),page.locator('.dd-pro-strip'),side(page),page.getByRole('tablist',{name:'Drawing sheets'}),page.getByRole('button',{name:/^Layers/}),statusBar(page)])await expect(part).toBeInViewport({ratio:1});
  expect(await page.evaluate(()=>document.scrollingElement!.scrollHeight-window.innerHeight)).toBeLessThanOrEqual(1);
  // The drawing fills the space between the tool strip and the inspector.
  const strip=await box(page.locator('.dd-pro-strip')),canvas=await box(page.locator('.dd-canvas')),column=await box(side(page));
  expect(canvas.x).toBeGreaterThanOrEqual(strip.x+strip.width-1);
  expect(canvas.x+canvas.width).toBeLessThanOrEqual(column.x+1);
  expect(canvas.height).toBeGreaterThan(450);
  // The price lives at the inspector's foot, not in a bar under the page.
  await expect(foot(page).getByRole('region',{name:'Live price'}).getByRole('status',{name:'Priced subtotal'})).toContainText('$');
  await expect(price(page)).toHaveCount(1);
  await page.screenshot({path:info.outputPath('pro-cad.png')});
});

test('groups the ribbon by what DeckCraft builds and keeps every Pro tool, with undo and redo always at hand',async({page,context})=>{
  await open(page,context,PATH);
  const tabs=['Home','Deck','Stairs & rails','House','Yard','Terrain','Documents'];
  await expect(ribbon(page).getByRole('tab')).toHaveText(tabs);
  const seen=new Set<string>();
  for(const name of tabs){
    await ribbonTab(page,name).click();
    await expect(ribbonTab(page,name)).toHaveAttribute('aria-selected','true');
    // Undo and redo stay at the ribbon's start whichever tab is showing.
    for(const command of ['Undo','Redo'])await expect(ribbon(page).getByRole('group',{name:'History'}).getByRole('button',{name:command,exact:true})).toBeVisible();
    for(const label of await page.locator('#dd-pro-ribbon-panel').getByRole('button').allTextContents())seen.add(label.trim());
  }
  const todays=['Select parts','Shape & points','Sketch','Presets','Deck size','Stairs','Rails & screens','House','Doors & windows','Lighting','Privacy & extras','Ground & survey','Site & foundation','Deck levels','Patio & wall levels','Sections & earthwork','Patios & walls','Landscape','Pools & backyard','Board layout','Inlays','Boards & finish','Permit set','Proposal & files'];
  for(const label of [...todays,'Deck wizard','House wizard','Patio wizard','Pool wizard'])expect([...seen],label).toContain(label);
  // A tool button draws on the plan and shows as pressed; a wizard opens its dialog.
  await ribbonTab(page,'Deck').click();
  await ribbonButton(page,'Board layout').click();
  await expect(ribbonButton(page,'Board layout')).toHaveAttribute('aria-pressed','true');
  // Its options dock into the side column's tool band, which opens for it.
  await expect(side(page).locator('.dd-plan-tool-extras > *').first()).toBeVisible();
  await expect(side(page).locator('> .dd-selection-inspector')).toHaveAttribute('open','');
  await ribbonTab(page,'Home').click();
  await ribbonButton(page,'Deck wizard').click();
  await expect(page.getByRole('dialog',{name:'Deck wizard'})).toBeVisible();
});

test('shows the picked subject as inspector tabs, one editor at a time, with the live price and documents at its foot',async({page,context})=>{
  await open(page,context,PATH);
  const tabs=inspector(page).getByRole('tablist',{name:'Edit Deck'});
  await expect(tabs.getByRole('tab')).toHaveText(['Deck shape & size','Boards & finish','Privacy, skirting & extras','Site & foundation','Information']);
  await tabs.getByRole('tab',{name:'Boards & finish',exact:true}).click();
  await expect(tabs.getByRole('tab',{name:'Boards & finish',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(inspector(page).getByRole('tabpanel',{name:'Boards & finish'})).toBeVisible();
  await expect(inspector(page).getByRole('tabpanel')).toHaveCount(1);
  await tabs.getByRole('tab',{name:'Information',exact:true}).click();
  await expect(inspector(page).getByRole('tabpanel',{name:'Information'})).toContainText('sq ft');
  // Asking the ribbon for the area behind Information shows it again.
  await ribbonTab(page,'Deck').click();
  await ribbonButton(page,'Boards & finish').click();
  await expect(inspector(page).getByRole('tabpanel',{name:'Boards & finish'})).toBeVisible();
  // A ribbon area opens its own subject and tab.
  await ribbonTab(page,'Stairs & rails').click();
  await ribbonButton(page,'Lighting').click();
  const stairs=inspector(page).getByRole('tablist',{name:'Edit Stairs & Railings'});
  await expect(stairs.getByRole('tab',{name:'Lighting',exact:true})).toHaveAttribute('aria-selected','true');
  // The foot: the price-bar actions, the proposal PDF and the permit set.
  const price=foot(page).getByRole('region',{name:'Live price'});
  for(const name of ['Price schedule','Review quote costs'])await expect(price.getByRole('button',{name:new RegExp('^'+name)})).toBeVisible();
  await expect(foot(page).getByRole('button',{name:'Proposal PDF',exact:true})).toBeVisible();
  await foot(page).getByRole('button',{name:'Permit set',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Permit drawing set'})).toBeVisible();
});

test('puts the four cameras on a compass puck and the day, night and lights switches in the bottom bar',async({page,context})=>{
  await open(page,context,PATH);
  await sheet(page,'3D').click();
  await expect.poll(()=>view(page)).toBe('3d');
  const puck=page.getByRole('group',{name:'Camera'});
  await expect(puck).toHaveClass(/dd-cad-puck/);
  await expect(puck.getByRole('button')).toHaveText(['Above','Overview','Corner','Front']);
  await puck.getByRole('button',{name:'Front',exact:true}).click();
  await expect.poll(()=>view(page)).toBe('front');
  await expect(puck.getByRole('button',{name:'Front',exact:true})).toHaveAttribute('aria-pressed','true');
  const bottom=page.locator('.dd-preview-head');
  await expect(bottom.getByRole('group',{name:'Day or night preview'})).toBeVisible();
  await expect(bottom.getByRole('switch',{name:/Preview lights/})).toBeVisible();
  // Only one set of camera buttons shows.
  await expect(page.getByRole('group',{name:'Camera'})).toHaveCount(1);
});

test('keeps the select, shape and size tools and the plan navigation in the left strip',async({page,context})=>{
  await open(page,context,PATH);
  const strip=page.locator('.dd-pro-strip');
  for(const name of ['Select parts','Shape & points','Deck size'])await expect(strip.getByRole('group',{name:'Quick tools'}).getByRole('button',{name,exact:true})).toBeVisible();
  for(const name of ['Pan drawing','Zoom out','Zoom in','Fit drawing'])await expect(strip.getByRole('group',{name:'Drawing navigation'}).getByRole('button',{name,exact:true})).toBeVisible();
  await strip.getByRole('button',{name:'Zoom in',exact:true}).click();
  await expect(strip.getByRole('group',{name:'Drawing navigation'}).getByLabel('Drawing zoom')).not.toHaveText('100%');
});

test('keeps the price and documents on screen in a short window with a drawing tool open',async({page,context})=>{
  await page.setViewportSize({width:1280,height:700});
  await open(page,context,PATH);
  await ribbonTab(page,'Yard').click();
  await ribbonButton(page,'Patios & walls').click();
  await expect(side(page).locator('> .dd-selection-inspector')).toHaveAttribute('open','');
  for(const part of [foot(page).getByRole('status',{name:'Priced subtotal'}),foot(page).getByRole('button',{name:'Permit set',exact:true}),inspector(page).getByRole('tablist'),statusBar(page)])await expect(part).toBeInViewport({ratio:1});
  expect(await page.evaluate(()=>document.scrollingElement!.scrollHeight-window.innerHeight)).toBeLessThanOrEqual(1);
});

test('is the only Pro workspace: the retired switch does not bring the old shell back',async({page,context})=>{
  await open(page,context,'/deck-designer/?designer=1&ui=classic');
  await expect(cad(page)).toBeVisible();
  await expect(titleBar(page).getByRole('menubar',{name:'Pro workspace menu'})).toBeVisible();
  await expect(page.locator('.dd-workspace > .dd-workspace-price')).toHaveCount(0);
});
