import {expect,test,type Page} from '@playwright/test';

/**
 * The Pro workspace (Designer Mode, `?designer=1`): a menu bar, ribbon, left tool strip and status bar around the same
 * designer. The public designer must not change, so the last test opens it without the flag.
 */
const KNOWN_CONSOLE=[/`selected` on <option>/,/THREE\./,/WebGL|GPU stall|swiftshader|GroupMarkerNotSet/i,/React DevTools/,/Failed to load resource/];

test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/^https?:$/.test(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();
    return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:''});
  });
});

const menubar=(page:Page)=>page.getByRole('menubar',{name:'Pro workspace menu'});
const menuButton=(page:Page,name:string)=>menubar(page).getByRole('menuitem',{name,exact:true});
const menu=(page:Page,name:string)=>page.getByRole('menu',{name,exact:true});
const ribbon=(page:Page)=>page.getByRole('region',{name:'Ribbon',exact:true});
const ribbonTab=(page:Page,name:string)=>ribbon(page).getByRole('tab',{name,exact:true});
const ribbonButton=(page:Page,name:string)=>page.locator('#dd-pro-ribbon-panel').getByRole('button',{name,exact:true});
const statusBar=(page:Page)=>page.getByRole('region',{name:'Status bar',exact:true});
const strip=(page:Page)=>page.locator('.dd-pro-strip');
/** The docked properties panel, one of its design-area bars (named by the area, its summary following), and an open area. */
const properties=(page:Page)=>page.locator('#dd-pro-properties');
const group=(page:Page,name:string)=>properties(page).getByRole('button',{name:new RegExp(`^${name.replace(/[&()]/g,'\\$&')}\\b`)});
const area=(page:Page,name:string)=>properties(page).getByRole('region',{name:new RegExp(`^${name.replace(/[&()]/g,'\\$&')}\\b`)});

async function openPro(page:Page){
  const problems:string[]=[];
  page.on('console',m=>{if(m.type()==='error'&&!KNOWN_CONSOLE.some(r=>r.test(m.text())))problems.push(m.text());});
  page.on('pageerror',e=>problems.push(String(e)));
  await page.goto('/deck-designer/?designer=1');
  await expect(menubar(page)).toBeVisible();
  await expect(ribbon(page)).toBeVisible();
  // The design is ready once the header's Presets button is (the menus that need a ready design wait for it too).
  await expect(page.getByRole('button',{name:'Presets',exact:true})).toBeEnabled();
  return problems;
}
async function choose(page:Page,menuName:string,item:string){
  await menuButton(page,menuName).click();
  await menu(page,menuName).getByRole('menuitem',{name:item}).click();
}

test('opens the Pro workspace: menu bar, ribbon, tool strip, status bar and the price in view',async({page},info)=>{
  const problems=await openPro(page);
  for(const name of ['File','Edit','Add','Settings','View','Tools','Help'])await expect(menuButton(page,name)).toBeVisible();
  for(const name of ['Main','Building','Terrain','Landscape','Materials','Plan Detail'])await expect(ribbonTab(page,name)).toBeVisible();
  await expect(strip(page).getByRole('group',{name:'Quick tools'})).toBeVisible();
  await expect(statusBar(page)).toContainText('F1');
  // The Pro shell replaces the task menus and the simple tool picker, and never hides the price.
  await expect(page.getByRole('navigation',{name:'Design tasks'})).toBeHidden();
  await expect(page.getByRole('region',{name:'Drawing tools'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Live price'}).getByRole('status',{name:'Priced subtotal'})).toContainText('$');
  // Reference pictures of the shell for design review (the assertions above are the test).
  await page.setViewportSize({width:1440,height:900});
  // On a 1440 × 900 screen the whole workspace fits: the price bar and the status bar are on screen without scrolling.
  await expect(page.getByRole('region',{name:'Live price'})).toBeInViewport({ratio:1});
  await expect(statusBar(page)).toBeInViewport({ratio:1});
  await page.screenshot({path:info.outputPath('pro-workspace.png')});
  await menuButton(page,'File').click();
  await page.screenshot({path:info.outputPath('pro-workspace-file-menu.png')});
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('pro-workspace-narrow.png'),fullPage:true});
  expect(problems).toEqual([]);
});

test('works its menus from the keyboard and runs the designer actions they name',async({page})=>{
  const problems=await openPro(page);
  const file=menuButton(page,'File');
  await file.focus();await page.keyboard.press('ArrowDown');
  await expect(menu(page,'File')).toBeVisible();
  await expect(menu(page,'File').getByRole('menuitem',{name:'New design…'})).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu(page,'File').getByRole('menuitem',{name:'Open design file…'})).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(menu(page,'Edit')).toBeVisible();await expect(menu(page,'File')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(menu(page,'Edit')).toHaveCount(0);await expect(menuButton(page,'Edit')).toBeFocused();
  // Nothing to undo yet.
  await menuButton(page,'Edit').click();
  await expect(menu(page,'Edit').getByRole('menuitem',{name:'Undo'})).toBeDisabled();
  await page.keyboard.press('Escape');
  // View switches the drawing's sheet; Add opens the matching design inspector; Help opens the shortcuts.
  await choose(page,'View','3D');
  await expect(page.getByRole('tab',{name:'3D',exact:true})).toHaveAttribute('aria-selected','true');
  await choose(page,'View','Plan');
  await expect(page.getByRole('tab',{name:'Plan',exact:true})).toHaveAttribute('aria-selected','true');
  // Add opens the design area in the docked properties panel, never in a pop-over over the drawing.
  await choose(page,'Add','Stairs & railings');
  await expect(properties(page).getByRole('heading',{level:2})).toHaveText('Edit Stairs & Railings');
  await expect(group(page,'Stairs & railings')).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('dialog',{name:'Design inspector'})).toHaveCount(0);
  await choose(page,'Help','Keyboard shortcuts');
  await expect(page.getByRole('dialog',{name:'Keyboard shortcuts'})).toBeVisible();
  expect(problems).toEqual([]);
});

test('picks tools and sheets from the ribbon, with the plan’s zoom docked in the tool strip',async({page})=>{
  const problems=await openPro(page);
  await ribbonTab(page,'Building').click();
  await ribbonButton(page,'Stairs').click();
  await expect(ribbonButton(page,'Stairs')).toHaveAttribute('aria-pressed','true');
  await expect(statusBar(page).getByRole('status')).toContainText('Stairs');
  // Select parts draws in the zoomable plan: its pan and zoom controls sit in the strip, and work there.
  await strip(page).getByRole('button',{name:'Select parts'}).click();
  await expect(strip(page).getByRole('button',{name:'Select parts'})).toHaveAttribute('aria-pressed','true');
  const zoom=strip(page).getByRole('group',{name:'Drawing navigation'});
  await expect(zoom).toBeVisible();
  await expect(zoom.getByLabel('Drawing zoom')).toHaveText('100%');
  await zoom.getByRole('button',{name:'Zoom in'}).click();
  await expect(zoom.getByLabel('Drawing zoom')).toHaveText('125%');
  await zoom.getByRole('button',{name:'Fit drawing'}).click();
  await expect(zoom.getByLabel('Drawing zoom')).toHaveText('100%');
  await expect(statusBar(page)).toContainText('fit');
  // Plan Detail's sheets switch the drawing; a tool picked on another sheet brings the plan back.
  await ribbonTab(page,'Plan Detail').click();
  await ribbonButton(page,'Framing').click();
  await expect(page.getByRole('tab',{name:'Framing',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(statusBar(page).getByRole('status')).toContainText('Framing');
  await strip(page).getByRole('button',{name:'Shape & points'}).click();
  await expect(page.getByRole('tab',{name:'Plan',exact:true})).toHaveAttribute('aria-selected','true');
  // Ribbon tabs move with the arrow keys.
  await ribbonTab(page,'Plan Detail').focus();await page.keyboard.press('Home');
  await expect(ribbonTab(page,'Main')).toBeFocused();await expect(ribbonTab(page,'Main')).toHaveAttribute('aria-selected','true');
  expect(problems).toEqual([]);
});

test('edits the selected object in the docked properties panel, beside the drawing',async({page})=>{
  const problems=await openPro(page);
  // The deck is the open design area at first: its title, its areas as bars (one open), and its information.
  await expect(properties(page).getByRole('heading',{level:2})).toHaveText('Edit Deck');
  await expect(group(page,'Deck shape & size')).toHaveAttribute('aria-expanded','true');
  await expect(properties(page).getByLabel('Deck information')).toContainText('192 sq ft');
  // Its settings work in place, and the drawing, header and price stay usable around them.
  const price=page.getByRole('region',{name:'Live price'}).getByRole('status',{name:'Priced subtotal'}),before=await price.textContent();
  const width=area(page,'Deck shape & size').getByLabel('Deck width',{exact:true});
  await width.fill('20');await width.press('Enter');
  await expect(page.locator('#deck-live-preview .dd-preview-head h2')).toContainText('20 × 12 ft');
  await expect(price).not.toHaveText(before??'');
  await expect(properties(page).getByLabel('Deck information')).toContainText('240 sq ft');
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo'}).click();
  await expect(page.locator('#deck-live-preview .dd-preview-head h2')).toContainText('16 × 12 ft');
  // One area open at a time; the open one folds away and back.
  await group(page,'Boards & finish').click();
  await expect(group(page,'Boards & finish')).toHaveAttribute('aria-expanded','true');
  await expect(group(page,'Deck shape & size')).toHaveAttribute('aria-expanded','false');
  await expect(area(page,'Boards & finish')).toBeVisible();
  await group(page,'Boards & finish').click();
  await expect(group(page,'Boards & finish')).toHaveAttribute('aria-expanded','false');
  await expect(area(page,'Boards & finish')).toHaveCount(0);
  // Picking the house on the plan brings up the house; the ribbon opens other areas in the same panel.
  await strip(page).getByRole('button',{name:'Select parts'}).click();
  await page.getByRole('button',{name:'Select Main house'}).click();
  await expect(properties(page).getByRole('heading',{level:2})).toHaveText('Edit House');
  await expect(group(page,'House')).toHaveAttribute('aria-expanded','true');
  await ribbonTab(page,'Building').click();
  await ribbonButton(page,'Outdoor lighting').click();
  await expect(properties(page).getByRole('heading',{level:2})).toHaveText('Edit Stairs & Railings');
  await expect(area(page,'Outdoor lighting')).toBeVisible();
  expect(problems).toEqual([]);
});

test('builds a deck, house, patio and pool with the Tools wizards, each as one undo step',async({page})=>{
  const problems=await openPro(page);
  const wizard=(name:string)=>page.getByRole('dialog',{name});
  const next=async(name:string)=>wizard(name).getByRole('button',{name:'Next',exact:true}).click();
  const heading=page.locator('#deck-live-preview .dd-preview-head h2');
  const price=page.getByRole('region',{name:'Live price'}).getByRole('status',{name:'Priced subtotal'}),before=await price.textContent();
  // Escape leaves a wizard without changing anything.
  await choose(page,'Tools','Deck wizard…');
  await expect(wizard('Deck wizard')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(wizard('Deck wizard')).toHaveCount(0);
  await expect(menuButton(page,'Tools')).toBeFocused();
  // The deck wizard: shape and size, connection and footings, boards, stairs and railings, then a review.
  await choose(page,'Tools','Deck wizard…');
  const deck=wizard('Deck wizard');
  await expect(deck).toContainText('Step 1 of 5 · Shape and size');
  await deck.getByLabel(/^Deck width/).fill('20');
  await next('Deck wizard');
  await deck.getByLabel('Foundation').selectOption('Helical Piles');
  await next('Deck wizard');
  await deck.getByLabel('Board layout').selectOption('Diagonal');
  await next('Deck wizard');
  await deck.getByLabel('Railing style').selectOption('Glass Panels');
  await next('Deck wizard');
  await expect(deck.getByLabel('What will change')).toContainText('20 × 12 ft, 36 in high');
  await expect(deck.getByLabel('What will change')).toContainText('Helical Piles');
  await deck.getByRole('button',{name:'Apply to design'}).click();
  await expect(deck).toHaveCount(0);
  await expect(heading).toContainText('20 × 12 ft');
  await expect(price).not.toHaveText(before??'');
  await expect(properties(page).getByRole('heading',{level:2})).toHaveText('Edit Deck');
  // One undo step takes the whole wizard back.
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo'}).click();
  await expect(heading).toContainText('16 × 12 ft');
  await expect(price).toHaveText(before??'');
  // The house wizard resizes the house (appearance only: the price stays).
  await choose(page,'Tools','House wizard…');
  await wizard('House wizard').getByLabel(/^House width/).fill('34');
  await next('House wizard');await next('House wizard');
  await expect(wizard('House wizard').getByLabel('What will change')).toContainText('34 ×');
  await wizard('House wizard').getByRole('button',{name:'Apply to design'}).click();
  await expect(properties(page).getByRole('heading',{level:2})).toHaveText('Edit House');
  await expect(area(page,'House').getByLabel('House width',{exact:true})).toHaveValue('34');
  await expect(price).toHaveText(before??'');
  // The patio and pool wizards add to the backyard, which opens to refine them.
  await choose(page,'Tools','Patio wizard…');
  await next('Patio wizard');
  await wizard('Patio wizard').getByRole('button',{name:'Add patio'}).click();
  await expect(wizard('Patio wizard')).toHaveCount(0);
  await expect(properties(page).getByRole('heading',{level:2})).toHaveText('Edit Backyard');
  await expect(price).not.toHaveText(before??'');
  await choose(page,'Tools','Pool wizard…');
  await wizard('Pool wizard').getByLabel('Where it goes').selectOption({label:'In Patio'});
  await next('Pool wizard');
  await wizard('Pool wizard').getByRole('button',{name:'Add pool'}).click();
  await expect(wizard('Pool wizard')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('opens the site survey, levels and earthwork tools from the Terrain tab and the Tools menu',async({page})=>{
  const problems=await openPro(page);
  const workspace=page.getByRole('region',{name:'Elevations and build workspace'});
  const task=(name:string)=>workspace.getByRole('group',{name:'Elevation tasks'}).getByRole('button',{name,exact:true});
  await ribbonTab(page,'Terrain').click();
  // Ground & survey: the measured site (photo or PDF underlay, points, elevation import and grading).
  await ribbonButton(page,'Ground & survey').click();
  await expect(ribbonButton(page,'Ground & survey')).toHaveAttribute('aria-pressed','true');
  await expect(task('Ground & grading')).toHaveAttribute('aria-pressed','true');
  await expect(workspace.getByRole('region',{name:'Measured site workspace'})).toBeVisible();
  // Each Terrain button shows its own area; pressing the one showing closes the workspace.
  await ribbonButton(page,'Deck levels').click();
  await expect(task('Deck levels & stairs')).toHaveAttribute('aria-pressed','true');
  await expect(ribbonButton(page,'Ground & survey')).toHaveAttribute('aria-pressed','false');
  await ribbonButton(page,'Sections & earthwork').click();
  await expect(task('Sections & earthworks')).toHaveAttribute('aria-pressed','true');
  await ribbonButton(page,'Sections & earthwork').click();
  await expect(workspace).toHaveCount(0);
  // The Tools menu goes straight to the site survey.
  await choose(page,'Tools','Site survey & photo import…');
  await expect(workspace.getByRole('region',{name:'Measured site workspace'})).toBeVisible();
  expect(problems).toEqual([]);
});

test('shows, hides and locks layers beside the sheet tabs, and opens the full layer editor',async({page})=>{
  const problems=await openPro(page);
  const toggle=page.locator('.dd-pro-layers-toggle'),list=page.getByRole('group',{name:'Layers',exact:true});
  await expect(toggle).toHaveText(/Layers \(1\)/);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  const design=list.getByRole('listitem').filter({hasText:'Design'});
  await expect(design.getByRole('checkbox',{name:'Show'})).toBeChecked();
  // Hiding a layer is a design change: the control says so, and Undo brings it back.
  await design.getByRole('checkbox',{name:'Show'}).uncheck();
  await expect(toggle).toContainText('1 hidden');
  await design.getByRole('checkbox',{name:'Lock'}).check();
  await expect(toggle).toContainText('1 locked');
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo'}).click();
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo'}).click();
  await expect(toggle).toHaveText(/^Layers \(1\)$/);
  // The full editor (groups, assigning objects to layers, precise edits) opens in Pools & backyard.
  await toggle.click();
  await list.getByRole('button',{name:'Manage layers & groups…'}).click();
  await expect(properties(page).getByRole('heading',{level:2})).toHaveText('Edit Backyard');
  await expect(properties(page).locator('details.dd-advanced[open] summary',{hasText:'Layers, groups'})).toBeVisible();
  expect(problems).toEqual([]);
});

test('leaves the Pro workspace for the public designer, which never shows the Pro shell',async({page})=>{
  const problems=await openPro(page);
  await choose(page,'View','Leave the Pro workspace');
  await expect(menubar(page)).toHaveCount(0);
  await expect(page.locator('.deck-designer')).not.toHaveAttribute('data-pro',/.*/);
  // Remembered on the device: a fresh visit without the flag stays public.
  await page.goto('/deck-designer/');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await expect(page.getByRole('radiogroup',{name:'Plan tools'})).toBeVisible();
  await expect(menubar(page)).toHaveCount(0);
  await expect(ribbon(page)).toHaveCount(0);
  expect(problems).toEqual([]);
});
