import {readFileSync} from 'node:fs';
import {expect,test,type Locator,type Page} from '@playwright/test';

/**
 * DeckCraft smoke tests on the production build: the paths a customer takes, end to end. Each test starts
 * with empty storage. Form posts never leave the browser: the send test answers them itself.
 */
const KNOWN_CONSOLE=[/`selected` on <option>/,/THREE\./,/WebGL|GPU stall|swiftshader|GroupMarkerNotSet/i,/React DevTools/,/Failed to load resource/];

/**
 * The suite never reaches the live trackers. CI builds carry no tracker IDs, but a local build picks up .env.local,
 * and then every run is recorded as real traffic (a sent design can even fire the Lead conversion). Clarity's own
 * script also fails tests: it stops itself on every SPA URL change, and an upload it has in flight at that moment
 * rejects with "Cannot read properties of null (reading 'sequence')", which the page cannot catch because the script
 * is cross-origin. Each tracker script is answered with an empty one, so nothing loads after it.
 */
const TRACKERS=/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms)\//;
test.beforeEach(async({context})=>{
  await context.route(TRACKERS,route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
});

/*
 * Page helpers. Every locator that depends on how the page is laid out goes through these, so the redesign (phases
 * R1–R4 of the "Drawing Set" plan) changes the helpers, not every test. The tests find feature controls by their
 * accessible names, which the redesign keeps. No test body uses a class selector or the wizard's step buttons.
 */
const TITLE='A deck that takes shape';
/** The sections of the designer, in page order. */
const SECTION_NAMES=['House','Deck shape & size','Boards & finish','Stairs & railings','Lighting','Privacy, skirting & extras','Site & foundation','Backyard','Proposal & files'] as const;
type Section=typeof SECTION_NAMES[number];
/** The drawing's sheets: the site plan, the 3D view and the framing. */
type ViewTab='Plan'|'3D'|'Framing';

/** The priced amount, live. */
const price=(page:Page)=>page.locator('.dd-live-price strong');
/** The drawing's heading, which names the deck's size ("16 × 12 ft"). */
const size=(page:Page)=>page.locator('.dd-preview-head h2');
/** The priced sections, their subtotals and the total. */
const schedule=(page:Page)=>page.locator('.dd-breakdown');
/** The selections still to be quoted, listed with the live price. */
const quotes=(page:Page)=>page.locator('#deck-live-preview .dd-quote-notice');
/** The design summary in the estimate. */
const summary=(page:Page)=>page.locator('.dd-summary');
/** The drawing panel; the drawing area in it (the plan, then the 3D view once it loads); the plan; the 3D canvas. */
const preview=(page:Page)=>page.locator('#deck-live-preview');
const drawing=(page:Page)=>page.locator('.dd-canvas');
const plan=(page:Page)=>drawing(page).locator('svg[aria-label="Deck construction plan from the shared model"]');
const viewer3d=(page:Page)=>drawing(page).locator('canvas');
/** The accent-board paint tool's chip over the drawing. */
const paintChip=(page:Page)=>page.locator('.dd-paint-chip');
/** The save, import, share, undo, redo and start-over tools. */
const fileTools=(page:Page)=>page.getByRole('region',{name:'Save and restore design'});
/** The doors and windows bar under the drawing, and how many openings it lists. */
const openingsBar=(page:Page)=>page.getByRole('region',{name:'House doors and windows'});
const openingCount=async(page:Page)=>Number(/(\d+) of/.exec((await openingsBar(page).locator('.dd-openings-head span').textContent())??'')?.[1]);
/** The header's "Send my design" button, and the send dialog (named by a heading that changes once sent). */
const sendButton=(page:Page)=>page.locator('.dd-send-top');
const sendDialog=(page:Page)=>page.locator('[role=dialog].dd-send-panel');
/** Phones: the bar that keeps the price on screen. */
const phoneBar=(page:Page)=>page.getByRole('region',{name:'Live price'});
/** Parts of sections that tests read. */
const backyardSubtotal=(page:Page)=>page.locator('.dd-backyard-subtotal');
const allowances=(page:Page)=>page.locator('.dd-allowances');
const corners=(page:Page)=>page.locator('.dd-corners');
/** The deck-part finishes panel (F6) and its chosen-colour swatches, and the railing colour's note. */
const deckParts=(page:Page)=>page.getByRole('region',{name:'Deck-part finishes'});
const partSwatches=(page:Page)=>deckParts(page).locator('.dd-part-swatch');
const railingColourNote=(page:Page)=>page.locator('.dd-railing-colour');

/** Opens a closed <details> by its summary text; an open one stays open. */
async function expand(scope:Page|Locator,summaryText:string){
  const summaryEl=scope.locator('summary',{hasText:summaryText});
  if(!await summaryEl.evaluate(el=>(el.parentElement as HTMLDetailsElement).open))await summaryEl.click();
}
/** The section rows; a section's row button (named by the section alone); its body, once open. */
const sectionList=(page:Page)=>page.getByRole('region',{name:'Deck configuration'});
const sectionButton=(page:Page,name:Section)=>sectionList(page).getByRole('button',{name,exact:true});
const sectionBody=(page:Page,name:Section)=>page.getByRole('region',{name,exact:true});
/** Opens a section of the designer and waits for its body to load. An open section stays open. */
async function openSection(page:Page,name:Section){
  const button=sectionButton(page,name);
  await expect(button,`"${name}" is a section of the designer`).toBeVisible();
  if(await button.getAttribute('aria-expanded')==='false')await button.click();
  await expect(button).toHaveAttribute('aria-expanded','true');
  // Every body ends with a link to a related section, shown once the body has loaded.
  await expect(sectionBody(page,name).getByRole('button',{name:/: open /})).toBeVisible();
}
/** Waits for the panels a section loads on its own (accent boards, inlays, deck-part finishes, skirting). */
async function sectionReady(page:Page,name:Section){
  if(name==='Boards & finish')for(const panel of ['Accent boards','Inlays','Deck-part finishes'])await expect(page.getByRole('region',{name:panel,exact:true})).toBeVisible();
  if(name==='Privacy, skirting & extras')await expect(page.getByRole('region',{name:'Skirting under the deck'})).toBeVisible();
}
/** The advanced contractor view (framing, hardware and below-ground views, and the modelled quantities), opened. */
async function contractorView(page:Page){
  await expand(preview(page),'Advanced contractor view');
  return preview(page).locator('details',{has:page.locator('summary',{hasText:'Advanced contractor view'})});
}
/** Shows the drawing as the plan, the 3D view or the framing. */
async function viewTab(page:Page,name:ViewTab){
  if(name==='Framing'){await (await contractorView(page)).getByRole('group',{name:'Contractor preview modes'}).getByRole('button',{name:'Framing',exact:true}).click();return;}
  await page.locator('.dd-preview-head').getByRole('button',{name,exact:true}).click();
}
/** The proposal's contractor files (the DXF and OBJ exports), opened. */
async function contractorFiles(page:Page){
  await expand(page,'CAD & 3D model exports');
  return page.locator('details',{has:page.locator('summary',{hasText:'CAD & 3D model exports'})});
}
/** The exterior studio, opened from the doors and windows bar. */
async function openExterior(page:Page){
  const button=openingsBar(page).getByRole('button',{name:'Exterior finishes',exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
  return page.getByRole('region',{name:'Exterior finishes'});
}

async function openDesigner(page:Page){
  const problems:string[]=[];
  page.on('console',m=>{if(m.type()==='error'&&!KNOWN_CONSOLE.some(r=>r.test(m.text())))problems.push(m.text());});
  page.on('pageerror',e=>problems.push(String(e)));
  await page.goto('/deck-designer/');
  await expect(page.getByRole('heading',{level:1})).toContainText(TITLE);
  await expect(price(page)).toContainText('$');
  return problems;
}
async function setNumber(page:Page,label:string,value:number){
  const input=page.getByLabel(label,{exact:true});
  await input.fill(String(value));await input.press('Enter');
}

/**
 * Every feature stays reachable (the plan's reachability matrix). Each step opens the feature's section the way a
 * visitor would and finds its control, so a redesign that loses one fails here, by name.
 */
test('reaches every feature of the designer',async({page})=>{
  const problems=await openDesigner(page);
  const reach=(feature:string,control:Locator)=>expect(control,`${feature} can be reached`).toBeVisible();
  await test.step('House editor',async()=>{
    await openSection(page,'House');
    await reach('House size',page.getByLabel('House width',{exact:true}));
    await reach('House shape',page.getByRole('button',{name:'Add bump-out',exact:true}));
  });
  await test.step('Doors & windows bar',async()=>{
    await reach('Doors & windows bar',openingsBar(page).getByLabel('Style of the new door or window'));
    await reach('Adding a door or window',openingsBar(page).getByRole('button',{name:'Add',exact:true}));
  });
  await test.step('Exterior finishes (F4, F5)',async()=>{
    await reach('Exterior finishes from the House section',page.getByRole('button',{name:'exterior finishes',exact:true}));
    const studio=await openExterior(page);
    await reach('Exterior finishes',studio.getByRole('group',{name:'House cladding',exact:true}));
    await reach('Per-wall finishes (F5)',studio.getByLabel('Walls to finish',{exact:true}));
    await reach('Exterior looks (F5)',studio.getByRole('button',{name:'Looks',exact:true}));
    await openingsBar(page).getByRole('button',{name:'Exterior finishes',exact:true}).click();
    await expect(studio).toHaveCount(0);
  });
  await test.step('Deck shape, levels, split level and wrap',async()=>{
    await openSection(page,'Deck shape & size');
    await reach('Deck size',page.getByLabel('Deck width',{exact:true}));
    await reach('Deck shape',page.getByLabel('Deck shape',{exact:true}));
    await reach('Angled corners',page.getByRole('checkbox',{name:'Angle the front left corner'}));
    await reach('Levels',page.getByLabel('Number of levels',{exact:true}));
    await reach('Split level',page.getByRole('button',{name:'Make it a split level'}));
    await reach('Wrap-around, left',page.getByRole('checkbox',{name:'Around the left corner'}));
    await reach('Wrap-around, right',page.getByRole('checkbox',{name:'Around the right corner'}));
  });
  await test.step('Boards, accent paint tool and inlays',async()=>{
    await openSection(page,'Boards & finish');
    await reach('Decking colours',page.getByRole('button',{name:'Sea Salt Gray',exact:true}));
    const accents=page.getByRole('region',{name:'Accent boards'});
    await accents.getByRole('button',{name:'Paint with Dark Cocoa (TimberTech EDGE Prime+)'}).click();
    await reach('Accent paint tool',paintChip(page));
    await paintChip(page).getByRole('button',{name:'Done'}).click();
    await expect(paintChip(page)).toHaveCount(0);
    const inlays=page.getByRole('region',{name:'Inlays'});
    for(const kind of ['Add a framed rectangle','Add a diamond','Add a band','Add a medallion'])await reach(`Inlays: ${kind}`,inlays.getByRole('button',{name:kind,exact:true}));
    await reach('Deck-part finishes: fascia (F6)',deckParts(page).getByLabel('Fascia colour',{exact:true}));
    await reach('Deck-part finishes: stair treads (F6)',deckParts(page).getByLabel('Stair tread colour',{exact:true}));
  });
  await test.step('Stairs and railings',async()=>{
    await openSection(page,'Stairs & railings');
    await reach('Stair flights',page.getByLabel('Number of stair flights',{exact:true}));
    await reach('Stair layout',page.getByLabel('Stair layout',{exact:true}));
    await reach('Railing style',page.getByLabel('Railing style',{exact:true}));
    await reach('Manufacturer railing',page.getByLabel('Manufacturer railing system',{exact:true}));
    await page.getByLabel('Manufacturer railing system',{exact:true}).selectOption('tt_classic_composite');
    await reach('Railing colour (F6)',page.getByLabel('Railing colour',{exact:true}));
  });
  await test.step('Lighting',async()=>{
    await openSection(page,'Lighting');
    await reach('Deck lighting',page.getByRole('group',{name:'Deck lighting',exact:true}));
    await reach('Lighting catalogue',page.getByLabel('Find lighting',{exact:true}));
    await viewTab(page,'3D');
    await reach('Day and night preview',page.getByRole('group',{name:'Day or night preview'}));
  });
  await test.step('Privacy screens, skirting and extras',async()=>{
    await openSection(page,'Privacy, skirting & extras');
    await reach('Privacy screens',page.getByRole('button',{name:'+ Add privacy screen'}));
    await reach('Skirting (F7)',page.getByRole('region',{name:'Skirting under the deck'}).getByRole('checkbox',{name:'Add skirting under the deck'}));
    await reach('Built-in bench',page.getByLabel('Built-in bench',{exact:true}));
    await reach('Pergola',page.getByLabel('Pergola area',{exact:true}));
  });
  await test.step('Site and foundation',async()=>{
    await openSection(page,'Site & foundation');
    await reach('Project area',page.getByLabel('Project area',{exact:true}));
    await reach('Foundation',page.getByLabel('Foundation preference',{exact:true}));
  });
  await test.step('Backyard',async()=>{
    await openSection(page,'Backyard');
    await reach('Patios',page.getByRole('button',{name:'Add patio'}));
    await reach('Backyard allowances',page.getByLabel('Fire pit',{exact:true}));
  });
  await test.step('Proposal, PDF, summary and DXF/OBJ',async()=>{
    await openSection(page,'Proposal & files');
    await reach('Design summary',summary(page));
    await reach('Proposal',page.getByRole('button',{name:'Print proposal'}));
    await reach('PDF',page.getByRole('button',{name:'Download PDF'}));
    await reach('Summary download',page.getByRole('button',{name:'Download summary'}));
    const files=await contractorFiles(page);
    await reach('DXF export',files.getByRole('button',{name:'Download DXF'}));
    await reach('OBJ export',files.getByRole('button',{name:'Download OBJ'}));
  });
  await test.step('Send my design',async()=>{
    await reach('Send from the header',sendButton(page));
    await reach('Send from the proposal',page.getByRole('region',{name:'Send your design to Golden Maple'}).getByRole('button',{name:'Send my design'}));
    // The phone bar is hidden on a desktop screen; it is there for phones.
    await expect(page.getByRole('region',{name:'Live price',includeHidden:true}).getByRole('button',{name:'Send',exact:true,includeHidden:true}),'Send from the phone bar is on the page').toBeAttached();
  });
  await test.step('Save, import, share, undo, redo and start over',async()=>{
    const tools=fileTools(page);
    for(const name of ['Undo','Redo','Save JSON','Import design','Share link'])await reach(name,tools.getByRole('button',{name,exact:true}));
    await expect(tools.getByLabel('Import Golden Maple design JSON'),'The design file picker is on the page').toBeAttached();
    await expand(tools,'Start over');
    await reach('Start over',tools.getByRole('button',{name:'Start a new design'}));
  });
  await test.step('Advanced contractor view',async()=>{
    const view=await contractorView(page);
    for(const name of ['Framing','Hardware','Below ground'])await reach(`Contractor view: ${name}`,view.getByRole('group',{name:'Contractor preview modes'}).getByRole('button',{name,exact:true}));
    await viewTab(page,'Framing');
    await viewTab(page,'Plan');
    await reach('The plan drawing',plan(page));
  });
  await test.step('Share link, and going back to your own design',async()=>{
    const tools=fileTools(page);
    await tools.getByRole('button',{name:'Share link',exact:true}).click();
    const link=await tools.getByLabel('Link to this design').inputValue();
    // The visitor's own design is kept only when it differs from the shared one.
    await openSection(page,'Deck shape & size');
    await setNumber(page,'Deck width',24);
    await expect(size(page)).toContainText('24 × 12 ft');
    await page.waitForTimeout(800);// autosave runs 450 ms after the last change
    await page.goto(link);
    await reach('Go back to my own design',tools.getByRole('button',{name:'Go back to my own design'}));
  });
  expect(problems).toEqual([]);
});

test('opens sections in any order, keeps several open on a wide screen, and has no numbered steps',async({page})=>{
  const problems=await openDesigner(page);
  // Every section starts closed; there is no "1 of 6", Back or Continue.
  for(const name of SECTION_NAMES)await expect(sectionButton(page,name)).toHaveAttribute('aria-expanded','false');
  await expect(page.getByText(/^\d of \d$/)).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^(← )?Back$|^Continue|^Review my estimate/})).toHaveCount(0);
  // Stairs before the deck.
  const before=await price(page).textContent();
  await openSection(page,'Stairs & railings');
  await page.getByLabel('Number of stair flights',{exact:true}).selectOption('2');
  await expect(price(page)).not.toHaveText(before??'');
  await expect(sectionButton(page,'Stairs & railings')).toHaveAccessibleDescription(/^2 flights, 48 in, straight · Aluminum railing \$[\d,]+ Changed from the default design$/);
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',20);
  await expect(size(page)).toContainText('20 × 12 ft');
  await expect(sectionButton(page,'Stairs & railings')).toHaveAttribute('aria-expanded','true');
  await expect(page.getByLabel('Number of stair flights',{exact:true})).toHaveValue('2');
  // The link at the end of a section opens its related section.
  await sectionBody(page,'Stairs & railings').getByRole('button',{name:'Light the steps and posts: open Lighting'}).click();
  await expect(sectionButton(page,'Lighting')).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('group',{name:'Deck lighting',exact:true})).toBeVisible();
  // A closed section's body goes; the design keeps its choices.
  await sectionButton(page,'Stairs & railings').click();
  await expect(page.getByLabel('Number of stair flights',{exact:true})).toHaveCount(0);
  await openSection(page,'Stairs & railings');
  await expect(page.getByLabel('Number of stair flights',{exact:true})).toHaveValue('2');
  // A section opened from the keyboard takes focus to its first field.
  await sectionButton(page,'Site & foundation').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Project area',{exact:true})).toBeFocused();
  expect(problems).toEqual([]);
});

test('@phone keeps one section open at a time',async({page})=>{
  const problems=await openDesigner(page);
  await openSection(page,'Deck shape & size');
  await openSection(page,'Boards & finish');
  await expect(sectionButton(page,'Deck shape & size')).toHaveAttribute('aria-expanded','false');
  await expect(page.getByLabel('Deck width',{exact:true})).toHaveCount(0);
  await openSection(page,'House');
  await openSection(page,'Proposal & files');
  const expanded:string[]=[];
  for(const name of SECTION_NAMES)if(await sectionButton(page,name).getAttribute('aria-expanded')==='true')expanded.push(name);
  expect(expanded).toEqual(['Proposal & files']);
  // The section just opened is on screen, although the long House section above it closed.
  expect(await sectionButton(page,'Proposal & files').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.top<window.innerHeight;})).toBe(true);
  expect(problems).toEqual([]);
});

test('@phone fits a 375 px screen with each section open',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  const problems=await openDesigner(page);
  for(const name of SECTION_NAMES){
    await openSection(page,name);
    await sectionReady(page,name);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`No sideways scroll with ${name} open`).toBe(true);
  }
  expect(problems).toEqual([]);
});

test('prices the default deck and reprices when the size changes',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',20);
  await expect(size(page)).toContainText('20 × 12 ft');
  await expect(price(page)).not.toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('undoes and redoes a design change',async({page})=>{
  const problems=await openDesigner(page);
  const tools=fileTools(page);
  await expect(tools.getByRole('button',{name:'Undo'})).toBeDisabled();
  const before=await price(page).textContent();
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',22);
  await expect(size(page)).toContainText('22 × 12 ft');
  await tools.getByRole('button',{name:'Undo'}).click();
  await expect(size(page)).toContainText('16 × 12 ft');
  await expect(price(page)).toHaveText(before??'');
  await expect(page.getByLabel('Deck width',{exact:true})).toHaveValue('16');
  await page.keyboard.press('Control+Shift+Z');
  await expect(size(page)).toContainText('22 × 12 ft');
  await page.keyboard.press('Control+Z');
  await expect(size(page)).toContainText('16 × 12 ft');
  expect(problems).toEqual([]);
});

test('adds a patio in the backyard step, priced as its own subtotal',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await openSection(page,'Backyard');
  await page.getByRole('button',{name:'Add patio'}).click();
  await expect(backyardSubtotal(page)).toContainText('Backyard subtotal: $');
  await expect(price(page)).not.toHaveText(before??'');
  await openSection(page,'Proposal & files');
  await expect(schedule(page)).toContainText('Deck subtotal');
  await expect(schedule(page)).toContainText('Backyard subtotal');
  await expect(summary(page)).toContainText('Backyard: a ');
  expect(problems).toEqual([]);
});

test('adds a fire pit and turf as labelled estimator allowances, and takes them off again',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await openSection(page,'Backyard');
  await page.getByLabel('Fire pit',{exact:true}).selectOption('wood');
  await expect(allowances(page)).toContainText(/Allowance: \$[\d,]+/);
  await page.getByRole('checkbox',{name:/Artificial turf/}).check();
  await expect(page.getByLabel('Turf area',{exact:true})).toHaveValue('500');
  await expect(page.getByLabel('Finish level',{exact:true})).toHaveValue('mid');
  await expect(backyardSubtotal(page)).toContainText('Backyard subtotal: $');
  await expect(price(page)).not.toHaveText(before??'');
  await openSection(page,'Proposal & files');
  await expect(schedule(page)).toContainText('Fire pit, wood-burning (estimator allowance)');
  await expect(summary(page)).toContainText('Backyard: allowances for a wood-burning fire pit and 500 sq ft of artificial turf (Elevated finish)');
  await openSection(page,'Backyard');
  await page.getByLabel('Fire pit',{exact:true}).selectOption('none');
  await page.getByRole('checkbox',{name:/Artificial turf/}).uncheck();
  await expect(backyardSubtotal(page)).toHaveCount(0);
  await expect(price(page)).toHaveText(before??'');
  expect(problems).toEqual([]);
});

// One deck price on the site: the cost estimator hands every deck to the designer, at its size.
test('a deck link to the cost estimator opens the designer at that size',async({page})=>{
  const problems:string[]=[];
  page.on('pageerror',e=>problems.push(String(e)));
  await page.goto('/cost-estimator?type=deck&sqft=300');
  await expect(page).toHaveURL(/\/deck-designer\/?$/);
  await expect(size(page)).toContainText('20 × 15 ft');
  await expect(page.getByText(/Started from your cost estimate: a deck of about 300 sq ft \(20 × 15 ft\)/)).toBeVisible();
  expect(problems).toEqual([]);
});

test('a full-backyard estimate leaves the deck to the designer and does not price it',async({page})=>{
  const problems:string[]=[];
  page.on('pageerror',e=>problems.push(String(e)));
  await page.goto('/cost-estimator?type=full');
  const live=page.getByRole('complementary',{name:'Live estimate'});
  await expect(live).toContainText('$');
  await page.waitForTimeout(1500);// the live figure counts up to its value
  const before=await live.textContent();
  await page.getByRole('button',{name:'Composite Deck',pressed:false}).click();
  await expect(page.getByRole('button',{name:'Composite Deck',pressed:true})).toBeVisible();
  const handoff=page.getByRole('link',{name:/Design and price your deck/});
  await expect(handoff).toHaveAttribute('href','/deck-designer?sqft=300');
  await expect(handoff).toHaveAttribute('target','_blank');
  await expect(page.getByText('How high off the ground?')).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(live).toHaveText(before??'');
  // A backyard that is only a deck goes straight to the designer.
  for(const name of ['Patio / Interlock','Retaining Wall','Landscape Lighting'])await page.getByRole('button',{name,exact:true,pressed:true}).click();
  await page.getByRole('button',{name:'Continue →'}).first().click();
  await expect(page).toHaveURL(/\/deck-designer\/?$/);
  await expect(size(page)).toContainText('20 × 15 ft');
  expect(problems).toEqual([]);
});

test('wraps the deck round a house corner',async({page})=>{
  await openDesigner(page);
  await openSection(page,'Deck shape & size');
  await page.getByRole('checkbox',{name:'Around the left corner'}).check();
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText('Wraps the left house corner');
});

test('angles a front corner, reprices it and names it in the estimate',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await openSection(page,'Deck shape & size');
  await page.getByRole('checkbox',{name:'Angle the front left corner'}).check();
  await setNumber(page,'Front left corner cut',5);
  await expect(corners(page).getByRole('status')).toContainText('45° angled front corner: 5 ft front left. Angled face: 7.1 ft front left.');
  await expect(price(page)).not.toHaveText(before??'');
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText('Rectangle with an angled front corner');
  await expect(summary(page)).toContainText('45° angled front corner: 5 ft front left');
  expect(problems).toEqual([]);
});

test('draws a custom outline, moves an edge from the keyboard and reprices it',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await openSection(page,'Deck shape & size');
  await page.getByLabel('Deck shape',{exact:true}).selectOption('Custom');
  const outline=page.getByRole('group',{name:'Custom outline'});
  await outline.getByRole('button',{name:'T, centre bump-out'}).click();
  await expect(outline.getByRole('status')).toContainText('Custom outline: 8 corners');
  await expect(price(page)).not.toHaveText(before??'');
  const drawn=await price(page).textContent();
  const edge=outline.getByRole('button',{name:/^Front edge/}).first();
  await edge.focus();await edge.press('ArrowDown');
  await expect(price(page)).not.toHaveText(drawn??'');
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText('Custom outline: 8 corners');
  expect(problems).toEqual([]);
});

test('paints a row of accent boards, lists and keeps it, and prices the fitting as a builder quote',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await openSection(page,'Boards & finish');
  const panel=page.getByRole('region',{name:'Accent boards'});
  await panel.getByRole('button',{name:'Paint with Dark Cocoa (TimberTech EDGE Prime+)'}).click();
  await expect(paintChip(page)).toContainText('Painting: Dark Cocoa');
  await setNumber(page,'Row from the house',6);
  await panel.getByRole('button',{name:'Paint this row'}).click();
  await expect(panel.getByRole('listitem')).toHaveText(/Row 6 from the house · Dark Cocoa \(TimberTech EDGE Prime\+\)/);
  await expect(price(page)).not.toHaveText(before??'');
  await expect(quotes(page)).toContainText('Accent-colour board labour (builder quote)');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  await openSection(page,'Boards & finish');
  await expect(panel.getByRole('listitem')).toHaveText(/Row 6 from the house/);
  await panel.getByRole('button',{name:'Remove: Row 6 from the house'}).click();
  await expect(panel.getByRole('listitem')).toHaveCount(0);
  await expect(price(page)).toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('paints a single board by clicking it in the 3D view',async({page})=>{
  const problems=await openDesigner(page);
  await openSection(page,'Boards & finish');
  const panel=page.getByRole('region',{name:'Accent boards'});
  await panel.getByRole('button',{name:'Paint with Sea Salt Gray (TimberTech EDGE Prime+)'}).click();
  const canvas=viewer3d(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({timeout:20000});
  await page.waitForTimeout(2500);// the camera settles on the deck
  const box=(await canvas.boundingBox())!;
  // Open deck surface in the default view (the railing takes no clicks, so a click through it still lands on the boards).
  await canvas.click({position:{x:box.width*.5,y:box.height*.4}});
  await expect(panel.getByRole('heading',{name:/Your accent boards · 1 board$/})).toBeVisible();
  await expect(panel.getByRole('listitem')).toHaveText(/One board in row \d+ from the house · Sea Salt Gray/);
  await paintChip(page).getByRole('button',{name:'Done'}).click();
  await expect(paintChip(page)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('adds a framed inlay, fits it to the deck, and shows it and its framing on the plan',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await openSection(page,'Boards & finish');
  const inlays=page.getByRole('region',{name:'Inlays'});
  await inlays.getByRole('button',{name:'Add a framed rectangle'}).click();
  await expect(inlays.getByRole('status')).toContainText('Built:');
  await expect(price(page)).not.toHaveText(before??'');
  await setNumber(page,'Inlay 1 width',30);
  await expect(page.getByLabel('Inlay 1 width',{exact:true})).toHaveValue('20');
  await expect(inlays.getByRole('status')).toContainText('Not built: It reaches past the deck’s field');
  await inlays.getByRole('button',{name:'Fit to deck'}).click();
  await expect(inlays.getByRole('status')).toContainText('Built:');
  await viewTab(page,'Plan');
  await expect(plan(page)).toContainText('Inlay 1');
  await expect(plan(page)).toContainText('Amber: inlay blocking');
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText(/Inlays: a [\d.]+ × [\d.]+ ft framed rectangle with a herringbone inside/);
  expect(problems).toEqual([]);
});

test('adds a band and a compass medallion, and lists the medallion labour for a builder quote',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await openSection(page,'Boards & finish');
  const inlays=page.getByRole('region',{name:'Inlays'});
  await inlays.getByRole('button',{name:'Add a band'}).click();
  await expect(inlays.getByRole('status').first()).toContainText('cut in like a breaker board');
  await expect(price(page)).not.toHaveText(before??'');
  // Across a straight deck, a band is its rows in another colour: nothing is cut.
  await page.getByLabel('Inlay 1 runs',{exact:true}).selectOption('across');
  await expect(inlays.getByRole('status').first()).toContainText('with no cutting');
  await inlays.getByRole('button',{name:'Add a medallion'}).click();
  await expect(inlays.getByRole('status').nth(1)).toContainText('on solid blocking');
  await viewTab(page,'Plan');
  await expect(plan(page)).toContainText('Inlay 2');
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText(/Inlays: a band one board wide across the deck; a [\d.]+ ft compass medallion in eight wedges/);
  // The breakdown shows the labour as needing a quote; the list of quotes names the medallion's.
  await expect(schedule(page)).toContainText(/Labour \(Construction & Build\)\$[\d,]+Priced portion · supplier quote required/);
  await expect(quotes(page)).toContainText('Medallion inlay labour (builder quote)');
  expect(problems).toEqual([]);
});

test('adds skirting under the deck, lists it for a builder quote, and keeps it after a reload',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await openSection(page,'Privacy, skirting & extras');
  const skirting=page.getByRole('region',{name:'Skirting under the deck'});
  await skirting.getByRole('checkbox',{name:'Add skirting under the deck'}).check();
  await expect(skirting.getByRole('status')).toContainText('Listed for a builder quote');
  // The three open sides are offered; the side against the house never is.
  await expect(skirting.getByRole('group',{name:'Sides to skirt'}).getByRole('checkbox')).toHaveCount(3);
  await expect(quotes(page)).toContainText('Deck skirting (builder quote)');
  // A quote, never a price: the priced amount does not move.
  await expect(price(page)).toHaveText(before??'');
  await page.getByLabel('Skirting style',{exact:true}).selectOption('Lattice');
  await expect(skirting.getByRole('status')).toContainText('Listed for a builder quote');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  await openSection(page,'Privacy, skirting & extras');
  await expect(page.getByLabel('Skirting style',{exact:true})).toHaveValue('Lattice');
  await openSection(page,'Proposal & files');
  await expect(schedule(page)).toContainText('Deck skirtingSupplier quote required');
  await expect(summary(page)).toContainText(/Skirting: lattice in /);
  expect(problems).toEqual([]);
});

test('gives the border and stair treads their own colours, quotes a tread line without a price, picks a railing colour, and keeps them after a reload',async({page})=>{
  const problems=await openDesigner(page);
  await openSection(page,'Boards & finish');
  await page.getByLabel('Border rows',{exact:true}).selectOption('1');
  const parts=deckParts(page);
  await parts.getByLabel('Border boards colour',{exact:true}).selectOption('tt_legacy:Espresso');
  await expect(partSwatches(page)).toHaveText(['Espresso · TimberTech PRO Legacy']);
  // Treads from a line without a price make the stairs a supplier quote.
  await parts.getByLabel('Stair tread colour',{exact:true}).selectOption('tt_terrain_plus:Dark Oak');
  await expect(partSwatches(page)).toHaveText(['Espresso · TimberTech PRO Legacy','Dark Oak · TimberTech Composite Terrain+ · supplier quote']);
  await expect(quotes(page)).toContainText('Stair treads and risers in TimberTech Composite Terrain+');
  await openSection(page,'Stairs & railings');
  await page.getByLabel('Manufacturer railing system',{exact:true}).selectOption('tt_classic_composite');
  await page.getByLabel('Railing colour',{exact:true}).selectOption('Matte Black');
  await expect(railingColourNote(page)).toHaveText('Matte Black: the colour on screen is illustrative; confirm with a sample.');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  await openSection(page,'Boards & finish');
  await expect(page.getByLabel('Border boards colour',{exact:true})).toHaveValue('tt_legacy:Espresso');
  await expect(page.getByLabel('Stair tread colour',{exact:true})).toHaveValue('tt_terrain_plus:Dark Oak');
  await openSection(page,'Stairs & railings');
  await expect(page.getByLabel('Railing colour',{exact:true})).toHaveValue('Matte Black');
  await openSection(page,'Proposal & files');
  await expect(schedule(page)).toContainText('StairsSupplier quote required');
  await expect(schedule(page)).toContainText('Deck-part finishes');
  await expect(summary(page)).toContainText('Deck parts: border boards in Espresso (TimberTech PRO Legacy); stair treads in Dark Oak (TimberTech Composite Terrain+)');
  await expect(summary(page)).toContainText('Railing colour: Matte Black (TimberTech Classic Composite · balusters); screen colour illustrative');
  expect(problems).toEqual([]);
});

test('adds a bump-out to the house',async({page})=>{
  await openDesigner(page);
  await openSection(page,'House');
  await page.getByRole('button',{name:'Add bump-out'}).click();
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText('bump-out');
});

test('adds, restyles and removes a window from the doors and windows bar',async({page})=>{
  await openDesigner(page);
  const bar=openingsBar(page);
  const count=()=>openingCount(page);
  const start=await count();
  await bar.getByLabel('Style of the new door or window').selectOption('Window:Casement');
  await bar.getByRole('button',{name:'Add',exact:true}).click();
  await expect.poll(count).toBe(start+1);
  const style=bar.getByLabel('Style of the selected door or window');
  await style.selectOption({index:0});
  const restyled=await style.inputValue();
  await style.selectOption({index:1});
  await expect(style).not.toHaveValue(restyled);
  await bar.getByRole('button',{name:'Remove'}).click();
  await expect.poll(count).toBe(start);
});

test('dresses the house in the exterior studio without changing the price, and keeps it after a reload',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  const studio=await openExterior(page);
  await studio.getByRole('group',{name:'House cladding'}).getByRole('button',{name:'Cedar shakes'}).click();
  await studio.getByRole('button',{name:'Cladding colour: Sage'}).click();
  await studio.getByRole('button',{name:'Roof',exact:true}).click();
  await studio.getByRole('group',{name:'Roof finish'}).getByRole('button',{name:'Slate'}).click();
  await studio.getByRole('button',{name:'Trim, doors & windows'}).click();
  await studio.getByRole('button',{name:'Doors: Red',exact:true}).click();
  await expect(studio.getByRole('button',{name:'Doors: Red',exact:true})).toHaveAttribute('aria-pressed','true');
  // The 3D house redraws in the new finishes; the price does not move.
  await expect(viewer3d(page)).toBeVisible();
  await expect(price(page)).toHaveText(before??'');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  const again=await openExterior(page);
  await expect(again.getByRole('group',{name:'House cladding'}).getByRole('button',{name:'Cedar shakes'})).toHaveAttribute('aria-pressed','true');
  await again.getByRole('button',{name:'Roof',exact:true}).click();
  await expect(again.getByRole('group',{name:'Roof finish'}).getByRole('button',{name:'Slate'})).toHaveAttribute('aria-pressed','true');
  await expect(price(page)).toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('finishes one wall with its own cladding and a wainscot, dresses the house in a look, and keeps both after a reload',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  const wallTiles=(studio:Locator)=>studio.getByRole('group',{name:'Cladding: House, deck-facing wall',exact:true});
  const studio=await openExterior(page);
  // One wall, the deck-facing wall of the house, in its own cladding with a stone wainscot.
  await studio.getByLabel('Walls to finish',{exact:true}).selectOption({label:'House, deck-facing wall'});
  await wallTiles(studio).getByRole('button',{name:'Ledgestone',exact:true}).click();
  await expect(wallTiles(studio).getByRole('button',{name:'Ledgestone',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(studio.getByText('This wall has its own finish.',{exact:true})).toBeVisible();
  await studio.getByRole('checkbox',{name:'A band of another cladding along the bottom, under a trim cap',exact:true}).check();
  await studio.getByLabel('Wainscot cladding',{exact:true}).selectOption('Fieldstone');
  await studio.getByLabel('Wainscot height',{exact:true}).selectOption('42');
  await expect(studio.getByLabel('Wainscot height',{exact:true})).toHaveValue('42');
  // A look dresses the whole house; the wall keeps its own finish.
  await studio.getByRole('button',{name:'Looks',exact:true}).click();
  await studio.getByRole('button',{name:'Coastal look',exact:true}).click();
  await expect(studio.getByRole('button',{name:'Coastal look',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(studio.getByText(/^1 wall, block, door or window keeps its own finish over the look\./)).toBeVisible();
  await expect(viewer3d(page)).toBeVisible();
  await expect(price(page)).toHaveText(before??'');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  const again=await openExterior(page);
  await again.getByRole('button',{name:'Looks',exact:true}).click();
  await expect(again.getByRole('button',{name:'Coastal look',exact:true})).toHaveAttribute('aria-pressed','true');
  await again.getByRole('button',{name:'Walls',exact:true}).click();
  await expect(again.getByRole('group',{name:'House cladding',exact:true}).getByRole('button',{name:'Cedar shakes',exact:true})).toHaveAttribute('aria-pressed','true');
  await again.getByLabel('Walls to finish',{exact:true}).selectOption({label:'House, deck-facing wall'});
  await expect(wallTiles(again).getByRole('button',{name:'Ledgestone',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(again.getByLabel('Wainscot cladding',{exact:true})).toHaveValue('Fieldstone');
  await expect(again.getByLabel('Wainscot height',{exact:true})).toHaveValue('42');
  await expect(price(page)).toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('keeps the design after a reload',async({page})=>{
  await openDesigner(page);
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',22);
  await expect(size(page)).toContainText('22 × 12 ft');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  await expect(size(page)).toContainText('22 × 12 ft');
});

test('saves a design file and imports it again',async({page},info)=>{
  await openDesigner(page);
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',18);
  await expect(size(page)).toContainText('18 × 12 ft');
  const tools=fileTools(page);
  const [download]=await Promise.all([page.waitForEvent('download'),tools.getByRole('button',{name:'Save JSON'}).click()]);
  const file=info.outputPath('design.json');await download.saveAs(file);
  expect(JSON.parse(readFileSync(file,'utf8')).format).toBe('golden-maple-deck-design');
  await setNumber(page,'Deck width',30);
  await expect(size(page)).toContainText('30 × 12 ft');
  await tools.getByLabel('Import Golden Maple design JSON').setInputFiles(file);
  await expect(size(page)).toContainText('18 × 12 ft');
});

test('shares a link that reopens the design and keeps the visitor’s own',async({page})=>{
  await openDesigner(page);
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',24);
  await expect(size(page)).toContainText('24 × 12 ft');
  const tools=fileTools(page);
  await tools.getByRole('button',{name:'Share link'}).click();
  const link=await tools.getByLabel('Link to this design').inputValue();
  expect(link).toMatch(/\/deck-designer#d=1[zj]/);
  await expect(tools).toContainText('Your name and project address are not included');
  await setNumber(page,'Deck width',30);
  await expect(size(page)).toContainText('30 × 12 ft');
  await page.waitForTimeout(800);
  await page.goto(link);
  await expect(size(page)).toContainText('24 × 12 ft');
  await expect(tools).toContainText('shared with you');
  await expect(page).not.toHaveURL(/#d=/);
  await tools.getByRole('button',{name:'Go back to my own design'}).click();
  await expect(size(page)).toContainText('30 × 12 ft');
});

test('sends a design to Golden Maple and hands the link to booking',async({page})=>{
  await openDesigner(page);
  let posted='';
  await page.route(url=>new URL(url).pathname==='/',async route=>{
    if(route.request().method()!=='POST')return route.continue();
    posted=route.request().postData()??'';
    await route.fulfill({status:200,contentType:'text/html',body:'ok'});
  });
  await sendButton(page).click();
  // The dialog is named by its heading, which becomes "Design sent" after sending.
  await expect(page.getByRole('dialog',{name:'Send your design to Golden Maple'})).toBeVisible();
  const dialog=sendDialog(page);
  await expect(dialog).toContainText('By sending, you ask Golden Maple Landscaping to contact you about this deck design.');
  await expect(dialog.getByRole('checkbox',{name:/offers/})).toHaveCount(0);// no offers box until a mailing address is set
  await dialog.getByRole('checkbox',{name:/Please bring a sample of my decking colour/}).check();
  await dialog.getByRole('button',{name:'Send my design'}).click();
  await expect(dialog.getByRole('alert')).toHaveText('Please enter your name.');
  await dialog.getByLabel('Your name').fill('DeckCraft Test');
  await dialog.getByLabel('Email').fill('deckcraft.test@example.com');
  await dialog.getByLabel('When would you like to build? (optional)').selectOption('within-6-months');
  await dialog.getByLabel('Anything we should know? (optional)').fill('Automated smoke test.');
  await dialog.getByRole('button',{name:'Send my design'}).click();
  await expect(dialog.getByRole('heading',{name:'Design sent'})).toBeVisible();
  const fields=new URLSearchParams(posted);
  expect(fields.get('form-name')).toBe('deck-design');
  expect(fields.get('name')).toBe('DeckCraft Test');
  expect(fields.get('marketing_consent')).toBe('no');
  expect(fields.get('source')).toBe('website-deck-designer');
  expect(fields.get('details')).toContain('Open the exact design: ');
  expect(fields.get('design_link')).toMatch(/#d=1[zj]/);
  expect(Number(fields.get('value'))).toBeGreaterThan(0);
  expect(fields.get('timeline')).toBe('within-6-months');
  expect(fields.get('samples_requested')).toBe('yes');
  expect(fields.get('budget')).toBe('');
  expect(fields.get('lead_tier')).toMatch(/^[ABCD]$/);
  expect(fields.get('details')).toContain('Timeline: Within 6 months');
  await dialog.getByRole('link',{name:'Book a call'}).click();
  await expect(page).toHaveURL(/\/book/);
  expect(await page.evaluate(()=>(history.state?.usr?.bookingNotes as string|undefined)??'')).toContain('#d=1');
});

test('downloads the proposal as a PDF',async({page},info)=>{
  await openDesigner(page);
  await openSection(page,'Proposal & files');
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:60_000}),page.getByRole('button',{name:'Download PDF'}).click()]);
  expect(download.suggestedFilename()).toBe('golden-maple-deck-proposal.pdf');
  const file=info.outputPath('proposal.pdf');await download.saveAs(file);
  const bytes=readFileSync(file);
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(20_000);
});

test('opens the printable proposal',async({page})=>{
  await openDesigner(page);
  await openSection(page,'Proposal & files');
  await page.getByRole('button',{name:'Print proposal'}).click();
  const sheet=page.getByRole('dialog',{name:'Deck proposal preview'});
  await expect(sheet).toContainText('PLANNING ESTIMATE');
  await sheet.getByRole('button',{name:'Close'}).click();
  await expect(sheet).toHaveCount(0);
});

test('loads the 3D view once the page settles when the preview is on screen',async({page})=>{
  const viewer:string[]=[];page.on('request',r=>{if(/Deck3DViewer-/.test(r.url()))viewer.push(r.url());});
  await openDesigner(page);
  await expect.poll(()=>viewer.length,{timeout:20_000}).toBeGreaterThan(0);
});

test('@phone waits to load the 3D view until the preview is scrolled near',async({page})=>{
  const viewer:string[]=[];page.on('request',r=>{if(/Deck3DViewer-/.test(r.url()))viewer.push(r.url());});
  // A short phone screen puts the preview well below the fold (on a Pixel 7 it sits just under it).
  await page.setViewportSize({width:412,height:480});
  await openDesigner(page);
  const farBelow=await drawing(page).evaluate(el=>el.getBoundingClientRect().top>window.innerHeight+300);
  expect(farBelow).toBe(true);
  await page.waitForTimeout(4000);
  expect(viewer).toHaveLength(0);
  await expect(plan(page)).toHaveCount(1);// the plan shows meanwhile
  await drawing(page).scrollIntoViewIfNeeded();
  await expect.poll(()=>viewer.length,{timeout:20_000}).toBeGreaterThan(0);
});

test('@phone keeps the price in view and pins the deck while editing',async({page})=>{
  const viewer:string[]=[];page.on('request',r=>{if(/Deck3DViewer-/.test(r.url()))viewer.push(r.url());});
  const problems=await openDesigner(page);
  const bar=phoneBar(page);
  await expect(bar).toBeVisible();
  const before=await bar.locator('strong').textContent();
  // Work in the sections, well below the preview: the price stays on screen.
  await openSection(page,'Deck shape & size');
  await page.getByLabel('Deck width',{exact:true}).scrollIntoViewIfNeeded();
  await setNumber(page,'Deck width',20);
  await expect(bar.locator('strong')).not.toHaveText(before??'');
  expect(await bar.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=window.innerHeight+1&&r.top>=window.innerHeight-120;})).toBe(true);
  // Pin the deck: a compact preview stays at the top while the fields scroll, and the 3D view loads.
  await bar.getByRole('button',{name:'Show deck'}).click();
  await expect(bar.getByRole('button',{name:'Hide deck'})).toHaveAttribute('aria-pressed','true');
  await page.getByLabel('Height above ground',{exact:true}).scrollIntoViewIfNeeded();
  expect(await preview(page).evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.top)<2&&r.height<window.innerHeight*.5;})).toBe(true);
  await expect.poll(()=>viewer.length,{timeout:20_000}).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await bar.getByRole('button',{name:'Hide deck'}).click();
  await expect(preview(page)).not.toHaveClass(/dd-preview-docked/);
  expect(problems).toEqual([]);
});

test('@phone fits the screen, with the send button in reach',async({page})=>{
  await openDesigner(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const send=sendButton(page);
  await expect(send).toBeVisible();
  await send.click();
  const dialog=page.getByRole('dialog',{name:'Send your design to Golden Maple'});
  await expect(dialog).toBeVisible();
  expect(await sendDialog(page).evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=window.innerWidth;})).toBe(true);
});
