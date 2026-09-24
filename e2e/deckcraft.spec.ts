import {readFileSync} from 'node:fs';
import {expect,test,type Page} from '@playwright/test';

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

async function openDesigner(page:Page){
  const problems:string[]=[];
  page.on('console',m=>{if(m.type()==='error'&&!KNOWN_CONSOLE.some(r=>r.test(m.text())))problems.push(m.text());});
  page.on('pageerror',e=>problems.push(String(e)));
  await page.goto('/deck-designer/');
  await expect(page.getByRole('heading',{level:1})).toContainText('A deck that takes shape');
  await expect(price(page)).toContainText('$');
  return problems;
}
const price=(page:Page)=>page.locator('.dd-live-price strong');
const size=(page:Page)=>page.locator('.dd-preview-head h2');
async function setNumber(page:Page,label:string,value:number){
  const input=page.getByLabel(label,{exact:true});
  await input.fill(String(value));await input.press('Enter');
}
const step=(page:Page,name:string|RegExp)=>page.getByRole('navigation',{name:'Design steps'}).getByRole('button',{name});

test('prices the default deck and reprices when the size changes',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await setNumber(page,'Deck width',20);
  await expect(size(page)).toContainText('20 × 12 ft');
  await expect(price(page)).not.toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('undoes and redoes a design change',async({page})=>{
  const problems=await openDesigner(page);
  const tools=page.getByRole('region',{name:'Save and restore design'});
  await expect(tools.getByRole('button',{name:'Undo'})).toBeDisabled();
  const before=await price(page).textContent();
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
  await step(page,/Backyard/).click();
  await page.getByRole('button',{name:'Add patio'}).click();
  await expect(page.locator('.dd-backyard-subtotal')).toContainText('Backyard subtotal: $');
  await expect(price(page)).not.toHaveText(before??'');
  await step(page,/Your estimate/).click();
  await expect(page.locator('.dd-breakdown')).toContainText('Deck subtotal');
  await expect(page.locator('.dd-breakdown')).toContainText('Backyard subtotal');
  await expect(page.locator('.dd-summary')).toContainText('Backyard: a ');
  expect(problems).toEqual([]);
});

test('adds a fire pit and turf as labelled estimator allowances, and takes them off again',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await step(page,/Backyard/).click();
  await page.getByLabel('Fire pit',{exact:true}).selectOption('wood');
  await expect(page.locator('.dd-allowances')).toContainText(/Allowance: \$[\d,]+/);
  await page.getByRole('checkbox',{name:/Artificial turf/}).check();
  await expect(page.getByLabel('Turf area',{exact:true})).toHaveValue('500');
  await expect(page.getByLabel('Finish level',{exact:true})).toHaveValue('mid');
  await expect(page.locator('.dd-backyard-subtotal')).toContainText('Backyard subtotal: $');
  await expect(price(page)).not.toHaveText(before??'');
  await step(page,/Your estimate/).click();
  await expect(page.locator('.dd-breakdown')).toContainText('Fire pit, wood-burning (estimator allowance)');
  await expect(page.locator('.dd-summary')).toContainText('Backyard: allowances for a wood-burning fire pit and 500 sq ft of artificial turf (Elevated finish)');
  await step(page,/Backyard/).click();
  await page.getByLabel('Fire pit',{exact:true}).selectOption('none');
  await page.getByRole('checkbox',{name:/Artificial turf/}).uncheck();
  await expect(page.locator('.dd-backyard-subtotal')).toHaveCount(0);
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
  await page.getByRole('checkbox',{name:'Around the left corner'}).check();
  await step(page,/Your estimate/).click();
  await expect(page.locator('.dd-summary')).toContainText('Wraps the left house corner');
});

test('angles a front corner, reprices it and names it in the estimate',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await page.getByRole('checkbox',{name:'Angle the front left corner'}).check();
  await setNumber(page,'Front left corner cut',5);
  await expect(page.locator('.dd-corners [role=status]')).toContainText('45° angled front corner: 5 ft front left. Angled face: 7.1 ft front left.');
  await expect(price(page)).not.toHaveText(before??'');
  await step(page,/Your estimate/).click();
  await expect(page.locator('.dd-summary')).toContainText('Rectangle with an angled front corner');
  await expect(page.locator('.dd-summary')).toContainText('45° angled front corner: 5 ft front left');
  expect(problems).toEqual([]);
});

test('draws a custom outline, moves an edge from the keyboard and reprices it',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await page.getByLabel('Deck shape',{exact:true}).selectOption('Custom');
  const outline=page.getByRole('group',{name:'Custom outline'});
  await outline.getByRole('button',{name:'T, centre bump-out'}).click();
  await expect(outline.getByRole('status')).toContainText('Custom outline: 8 corners');
  await expect(price(page)).not.toHaveText(before??'');
  const drawn=await price(page).textContent();
  const edge=outline.getByRole('button',{name:/^Front edge/}).first();
  await edge.focus();await edge.press('ArrowDown');
  await expect(price(page)).not.toHaveText(drawn??'');
  await step(page,/Your estimate/).click();
  await expect(page.locator('.dd-summary')).toContainText('Custom outline: 8 corners');
  expect(problems).toEqual([]);
});

test('paints a row of accent boards, lists and keeps it, and prices the fitting as a builder quote',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await step(page,/Materials/).click();
  const panel=page.getByRole('region',{name:'Accent boards'});
  await panel.getByRole('button',{name:'Paint with Dark Cocoa (TimberTech EDGE Prime+)'}).click();
  await expect(page.locator('.dd-paint-chip')).toContainText('Painting: Dark Cocoa');
  await setNumber(page,'Row from the house',6);
  await panel.getByRole('button',{name:'Paint this row'}).click();
  await expect(panel.getByRole('listitem')).toHaveText(/Row 6 from the house · Dark Cocoa \(TimberTech EDGE Prime\+\)/);
  await expect(price(page)).not.toHaveText(before??'');
  await expect(page.locator('#deck-live-preview .dd-quote-notice')).toContainText('Accent-colour board labour (builder quote)');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  await step(page,/Materials/).click();
  await expect(panel.getByRole('listitem')).toHaveText(/Row 6 from the house/);
  await panel.getByRole('button',{name:'Remove: Row 6 from the house'}).click();
  await expect(panel.getByRole('listitem')).toHaveCount(0);
  await expect(price(page)).toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('paints a single board by clicking it in the 3D view',async({page})=>{
  const problems=await openDesigner(page);
  await step(page,/Materials/).click();
  const panel=page.getByRole('region',{name:'Accent boards'});
  await panel.getByRole('button',{name:'Paint with Sea Salt Gray (TimberTech EDGE Prime+)'}).click();
  const canvas=page.locator('.dd-canvas canvas');
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({timeout:20000});
  await page.waitForTimeout(2500);// the camera settles on the deck
  const box=(await canvas.boundingBox())!;
  // Open deck surface in the default view (the railing takes no clicks, so a click through it still lands on the boards).
  await canvas.click({position:{x:box.width*.5,y:box.height*.4}});
  await expect(panel.getByRole('heading',{name:/Your accent boards · 1 board$/})).toBeVisible();
  await expect(panel.getByRole('listitem')).toHaveText(/One board in row \d+ from the house · Sea Salt Gray/);
  await page.locator('.dd-paint-chip').getByRole('button',{name:'Done'}).click();
  await expect(page.locator('.dd-paint-chip')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('adds a framed inlay, fits it to the deck, and shows it and its framing on the plan',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await step(page,/Materials/).click();
  const inlays=page.getByRole('region',{name:'Inlays'});
  await inlays.getByRole('button',{name:'Add a framed rectangle'}).click();
  await expect(inlays.getByRole('status')).toContainText('Built:');
  await expect(price(page)).not.toHaveText(before??'');
  await setNumber(page,'Inlay 1 width',30);
  await expect(page.getByLabel('Inlay 1 width',{exact:true})).toHaveValue('20');
  await expect(inlays.getByRole('status')).toContainText('Not built: It reaches past the deck’s field');
  await inlays.getByRole('button',{name:'Fit to deck'}).click();
  await expect(inlays.getByRole('status')).toContainText('Built:');
  await page.locator('.dd-preview-head').getByRole('button',{name:'Plan'}).click();
  await expect(page.locator('.dd-canvas svg')).toContainText('Inlay 1');
  await expect(page.locator('.dd-canvas svg')).toContainText('Amber: inlay blocking');
  await step(page,/Your estimate/).click();
  await expect(page.locator('.dd-summary')).toContainText(/Inlays: a [\d.]+ × [\d.]+ ft framed rectangle with a herringbone inside/);
  expect(problems).toEqual([]);
});

test('adds a band and a compass medallion, and lists the medallion labour for a builder quote',async({page})=>{
  const problems=await openDesigner(page);
  const before=await price(page).textContent();
  await step(page,/Materials/).click();
  const inlays=page.getByRole('region',{name:'Inlays'});
  await inlays.getByRole('button',{name:'Add a band'}).click();
  await expect(inlays.getByRole('status').first()).toContainText('cut in like a breaker board');
  await expect(price(page)).not.toHaveText(before??'');
  // Across a straight deck, a band is its rows in another colour: nothing is cut.
  await page.getByLabel('Inlay 1 runs',{exact:true}).selectOption('across');
  await expect(inlays.getByRole('status').first()).toContainText('with no cutting');
  await inlays.getByRole('button',{name:'Add a medallion'}).click();
  await expect(inlays.getByRole('status').nth(1)).toContainText('on solid blocking');
  await page.locator('.dd-preview-head').getByRole('button',{name:'Plan'}).click();
  await expect(page.locator('.dd-canvas svg')).toContainText('Inlay 2');
  await step(page,/Your estimate/).click();
  await expect(page.locator('.dd-summary')).toContainText(/Inlays: a band one board wide across the deck; a [\d.]+ ft compass medallion in eight wedges/);
  // The breakdown shows the labour as needing a quote; the list of quotes names the medallion's.
  await expect(page.locator('.dd-breakdown')).toContainText(/Labour \(Construction & Build\)\$[\d,]+Priced portion · supplier quote required/);
  await expect(page.locator('.dd-quote-notice').filter({hasText:'Supplier quotes needed'})).toContainText('Medallion inlay labour (builder quote)');
  expect(problems).toEqual([]);
});

test('adds a bump-out to the house',async({page})=>{
  await openDesigner(page);
  await page.getByText('House dimensions, finishes, doors & windows').click();
  await page.getByRole('button',{name:'Add bump-out'}).click();
  await step(page,/Your estimate/).click();
  await expect(page.locator('.dd-summary')).toContainText('bump-out');
});

test('adds, restyles and removes a window from the doors and windows bar',async({page})=>{
  await openDesigner(page);
  const bar=page.getByRole('region',{name:'House doors and windows'});
  const count=async()=>Number(/(\d+) of/.exec((await bar.locator('.dd-openings-head span').textContent())??'')?.[1]);
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
  const open=async()=>{await page.getByRole('region',{name:'House doors and windows'}).getByRole('button',{name:'Exterior finishes'}).click();return page.getByRole('region',{name:'Exterior finishes'});};
  const studio=await open();
  await studio.getByRole('group',{name:'House cladding'}).getByRole('button',{name:'Cedar shakes'}).click();
  await studio.getByRole('button',{name:'Cladding colour: Sage'}).click();
  await studio.getByRole('button',{name:'Roof',exact:true}).click();
  await studio.getByRole('group',{name:'Roof finish'}).getByRole('button',{name:'Slate'}).click();
  await studio.getByRole('button',{name:'Trim, doors & windows'}).click();
  await studio.getByRole('button',{name:'Doors: Red',exact:true}).click();
  await expect(studio.getByRole('button',{name:'Doors: Red',exact:true})).toHaveAttribute('aria-pressed','true');
  // The 3D house redraws in the new finishes; the price does not move.
  await expect(page.locator('.dd-canvas canvas')).toBeVisible();
  await expect(price(page)).toHaveText(before??'');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  const again=await open();
  await expect(again.getByRole('group',{name:'House cladding'}).getByRole('button',{name:'Cedar shakes'})).toHaveAttribute('aria-pressed','true');
  await again.getByRole('button',{name:'Roof',exact:true}).click();
  await expect(again.getByRole('group',{name:'Roof finish'}).getByRole('button',{name:'Slate'})).toHaveAttribute('aria-pressed','true');
  await expect(price(page)).toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('keeps the design after a reload',async({page})=>{
  await openDesigner(page);
  await setNumber(page,'Deck width',22);
  await expect(size(page)).toContainText('22 × 12 ft');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  await expect(size(page)).toContainText('22 × 12 ft');
});

test('saves a design file and imports it again',async({page},info)=>{
  await openDesigner(page);
  await setNumber(page,'Deck width',18);
  await expect(size(page)).toContainText('18 × 12 ft');
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save JSON'}).click()]);
  const file=info.outputPath('design.json');await download.saveAs(file);
  expect(JSON.parse(readFileSync(file,'utf8')).format).toBe('golden-maple-deck-design');
  await setNumber(page,'Deck width',30);
  await expect(size(page)).toContainText('30 × 12 ft');
  await page.getByLabel('Import Golden Maple design JSON').setInputFiles(file);
  await expect(size(page)).toContainText('18 × 12 ft');
});

test('shares a link that reopens the design and keeps the visitor’s own',async({page})=>{
  await openDesigner(page);
  await setNumber(page,'Deck width',24);
  await expect(size(page)).toContainText('24 × 12 ft');
  const tools=page.getByRole('region',{name:'Save and restore design'});
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
  await page.getByRole('button',{name:'Send my design'}).first().click();
  // The dialog is named by its heading, which becomes "Design sent" after sending.
  await expect(page.getByRole('dialog',{name:'Send your design to Golden Maple'})).toBeVisible();
  const dialog=page.locator('[role=dialog].dd-send-panel');
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
  await step(page,/Your estimate/).click();
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:60_000}),page.getByRole('button',{name:'Download PDF'}).click()]);
  expect(download.suggestedFilename()).toBe('golden-maple-deck-proposal.pdf');
  const file=info.outputPath('proposal.pdf');await download.saveAs(file);
  const bytes=readFileSync(file);
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(20_000);
});

test('opens the printable proposal',async({page})=>{
  await openDesigner(page);
  await step(page,/Your estimate/).click();
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
  const farBelow=await page.evaluate(()=>document.querySelector('.dd-canvas')!.getBoundingClientRect().top>window.innerHeight+300);
  expect(farBelow).toBe(true);
  await page.waitForTimeout(4000);
  expect(viewer).toHaveLength(0);
  await expect(page.locator('.dd-canvas svg[aria-label="Deck construction plan from the shared model"]')).toHaveCount(1);// the plan shows meanwhile
  await page.locator('.dd-canvas').scrollIntoViewIfNeeded();
  await expect.poll(()=>viewer.length,{timeout:20_000}).toBeGreaterThan(0);
});

test('@phone keeps the price in view and pins the deck while editing',async({page})=>{
  const viewer:string[]=[];page.on('request',r=>{if(/Deck3DViewer-/.test(r.url()))viewer.push(r.url());});
  const problems=await openDesigner(page);
  const bar=page.getByRole('region',{name:'Live price'});
  await expect(bar).toBeVisible();
  const before=await bar.locator('strong').textContent();
  // Work in the steps, well below the preview: the price stays on screen.
  await page.getByLabel('Deck width',{exact:true}).scrollIntoViewIfNeeded();
  await setNumber(page,'Deck width',20);
  await expect(bar.locator('strong')).not.toHaveText(before??'');
  expect(await page.evaluate(()=>{const r=document.querySelector('.dd-phone-bar')!.getBoundingClientRect();return r.bottom<=window.innerHeight+1&&r.top>=window.innerHeight-120;})).toBe(true);
  // Pin the deck: a compact preview stays at the top while the fields scroll, and the 3D view loads.
  await bar.getByRole('button',{name:'Show deck'}).click();
  await expect(bar.getByRole('button',{name:'Hide deck'})).toHaveAttribute('aria-pressed','true');
  await page.getByLabel('Height above ground',{exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>{const r=document.querySelector('#deck-live-preview')!.getBoundingClientRect();return Math.abs(r.top)<2&&r.height<window.innerHeight*.5;})).toBe(true);
  await expect.poll(()=>viewer.length,{timeout:20_000}).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await bar.getByRole('button',{name:'Hide deck'}).click();
  await expect(page.locator('#deck-live-preview')).not.toHaveClass(/dd-preview-docked/);
  expect(problems).toEqual([]);
});

test('@phone fits the screen, with the send button in reach',async({page})=>{
  await openDesigner(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const send=page.locator('.dd-send-top');
  await expect(send).toBeVisible();
  await send.click();
  const dialog=page.getByRole('dialog',{name:'Send your design to Golden Maple'});
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>{const r=document.querySelector('.dd-send-panel')!.getBoundingClientRect();return r.left>=0&&r.right<=window.innerWidth;})).toBe(true);
});
