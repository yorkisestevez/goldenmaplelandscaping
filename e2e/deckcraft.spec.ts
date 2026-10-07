import {readFileSync} from 'node:fs';
import {savedConfiguration} from './nav';
import {expect,test,type Locator,type Page} from '@playwright/test';

/**
 * DeckCraft smoke tests on the production build: the paths a customer takes, end to end. Each test starts
 * with empty storage. Form posts never leave the browser: the send test answers them itself.
 */
const KNOWN_CONSOLE=[/`selected` on <option>/,/THREE\./,/WebGL|GPU stall|swiftshader|GroupMarkerNotSet/i,/React DevTools/,/Failed to load resource/];
/** CI runners draw the software (SwiftShader) proposal views about three times slower than a workstation. */
const PROPOSAL_WAIT=process.env.CI?2:1;

/** Keep every test local, including trackers, fonts, remote media and form destinations. The send workflow
 * separately intercepts the local form POST and verifies its fields without sending anything. */
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!/^https?:$/.test(url.protocol)||['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();
    return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:''});
  });
});

/*
 * Page helpers. Every locator that depends on how the page is laid out goes through these, so the redesign (phases
 * R1–R4 of the "Drawing Set" plan) changes the helpers, not every test. The tests find feature controls by their
 * accessible names, which the redesign keeps. No test body uses a class selector or the wizard's step buttons.
 */
const TITLE='Draw your deck on your house';
/** The sections of the designer, in page order. */
const SECTION_NAMES=['House','Deck shape & size','Boards & finish','Stairs & railings','Lighting','Privacy, skirting & extras','Site & foundation','Backyard','Proposal & files'] as const;
type Section=typeof SECTION_NAMES[number];
/** The drawing's sheets: the site plan, the 3D view and the framing. */
type ViewTab='Plan'|'3D'|'Framing';

/** The full price schedule, opened explicitly from the persistent price bar on every screen size. */
const schedule=(page:Page)=>page.getByRole('region',{name:'Price schedule',exact:true});
/** The priced amount stays available while switching between the canvas and focused inspectors, once the project
 * controls show (drawing focus hides the price bar). */
const price=async(page:Page)=>(await phoneBar(page)).getByRole('status',{name:'Priced subtotal'});
/** One line of the schedule, by its engine title ("Railing System"). */
const scheduleLine=(page:Page,title:string)=>schedule(page).getByRole('row').filter({has:page.getByRole('rowheader',{name:title,exact:true})});
/** The selections still to be quoted, each with a supplier or builder tag; one of them by its name. */
const quotes=(page:Page)=>schedule(page).getByRole('list',{name:/^Still to be quoted/});
const quoteLine=(page:Page,name:string)=>quotes(page).getByRole('listitem').filter({hasText:name});
/** Your changes, newest first, and the one announcement each change makes. */
const changes=(page:Page)=>schedule(page).getByRole('list',{name:'Your changes'}).getByRole('listitem');
const announcement=(page:Page)=>page.getByRole('status').filter({hasText:/\. Priced subtotal \$/});
/** The full price list in Proposal & files. */
const fullList=(page:Page)=>page.getByRole('region',{name:'Full price list'});
/** "$0" standing alone: never shown for anything unpriced. */
const ZERO=/\$0(?![\d.,])/;
/** Whole dollars in a figure ("$24,388" → 24388, "−$380" → −380). */
const wholeDollars=(text:string|null)=>(/^\s*[−-]/.test(text??'')?-1:1)*Number((text??'').replace(/[^\d]/g,''));
/** A decking collection's button in Boards & finish, by the collection's name; its price effect is its description. */
const collection=(page:Page,name:string)=>sectionBody(page,'Boards & finish').getByRole('button',{name:`${name} material sample`,includeHidden:true});
/** The text a control is described by (its aria-describedby): an option's or a select's price effect. */
const describedBy=(control:Locator)=>control.evaluate(el=>(el.getAttribute('aria-describedby')??'').split(/\s+/).map(id=>document.getElementById(id)?.textContent??'').join(' ').trim());
/** The drawing's heading, which names the sheet and the deck's size ("Site plan · 16 × 12 ft deck"). Scoped to the
 * drawing's header: the keyboard-shortcuts dialog in the drawing has a heading of its own. */
const size=(page:Page)=>preview(page).locator('.dd-preview-head').getByRole('heading',{level:2,includeHidden:true});
/** The design summary in the estimate. */
const summary=(page:Page)=>page.locator('.dd-summary');
/** The drawing panel; the drawing area in it; the plan on screen (the site plan, or the Framing sheet's plan); the 3D canvas. */
const preview=(page:Page)=>page.locator('#deck-live-preview');
const drawing=(page:Page)=>page.locator('.dd-canvas');
const plan=(page:Page)=>drawing(page).locator('svg[aria-label="Site plan: the deck against the house"],svg[aria-label="Deck construction plan from the shared model"]');
const viewer3d=(page:Page)=>drawing(page).locator('canvas');
/** The site plan's handles (sliders, by name), a drag's ghost outline, its shape shortcuts and its status line. */
const planHandle=(page:Page,name:string)=>page.getByRole('slider',{name,exact:true});
const ghost=(page:Page)=>drawing(page).locator('.dd-plan-ghost');
const shortcuts=(page:Page)=>page.getByRole('group',{name:'Shape shortcuts'});
const planStatus=(page:Page)=>preview(page).locator('.dd-plan-status');
/** The plan's tools (R5): Deck size, Draw outline, Stairs and House, one at a time. Picks one. */
async function planTool(page:Page,name:'Deck size'|'Shape & points'|'Stairs'|'House'){
  const inspector=page.getByRole('dialog',{name:'Design inspector',exact:true});
  if(await inspector.isVisible())await inspector.getByRole('button',{name:'Done · back to drawing',exact:true}).click();
  const tool=page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio',{name,exact:true});
  if(!await tool.isVisible())await page.getByRole('tablist',{name:'Tool categories'}).getByRole('tab',{name:'Building',exact:true}).click();
  await tool.click();
  await expect(tool).toHaveAttribute('aria-checked','true');
}
/** The Stairs tool's mark on an edge the stairs can go on ("left side", "Right wing end"). */
const stairMark=(page:Page,edge:string)=>drawing(page).getByRole('button',{name:`Put the stairs on the ${edge}`,exact:true});
/** Every request for the 3D viewer's chunk (three.js), from now on. */
const viewerRequests=(page:Page)=>{const urls:string[]=[];page.on('request',r=>{if(/Deck3DViewer-/.test(r.url()))urls.push(r.url());});return urls;};
/** Scrolls a control to the middle of the screen, clear of the sticky header and price bar, and lets layout settle.
 * Pointer input by coordinates does not scroll by itself, and the price bar covers the foot of the drawing. */
const scrollToCentre=(control:Locator)=>control.evaluate(el=>{el.scrollIntoView({block:'center'});return new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done())));});
/** The Inlays panel in Boards & finish. The plan's inlay controls repeat the selected inlay's card, so this is scoped. */
const inlayPanel=(page:Page)=>sectionBody(page,'Boards & finish').getByRole('region',{name:'Inlays'});
/** Add only arms an inlay; it is placed where the visitor taps the deck. Taps a plan point, in inches from the default
 * 16 × 12 ft deck's corner at the house (by default its middle, where Add used to put an inlay), waits for the
 * placement to finish, and goes back to Boards & finish (placing shows the drawing in place of the section). */
async function placeInlay(page:Page,point={x:96,y:72}){
  const surface=page.getByLabel('Inlay placement surface',{exact:true});
  await scrollToCentre(surface);
  const at=await surface.evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);return {x:q.x,y:q.y,onSurface:document.elementFromPoint(q.x,q.y)===el};},point);
  expect(at.onSurface,'the tap lands on the plan, clear of the price bar and other controls').toBe(true);
  await page.mouse.click(at.x,at.y);
  await expect(surface).toHaveCount(0);
  await openSection(page,'Boards & finish');
}
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
/** The canvas-first workspace opens in drawing focus, which hides the task menus and the price bar. Its toggle (mounted
 * with the drawing, so waited for) reads "Show project controls" while pressed; one tap shows them, and they stay. */
async function showProjectControls(page:Page){
  const focus=page.locator('.dd-drawing-focus-toggle');
  await expect(focus).toHaveAttribute('aria-pressed',/^(true|false)$/);
  if(await focus.getAttribute('aria-pressed')==='true')await focus.click();
  await expect(focus).toHaveAttribute('aria-pressed','false');
}
/** The workspace bar that keeps the price available on all screen sizes, with the project controls showing. */
const phoneBar=async(page:Page)=>{await showProjectControls(page);return page.getByRole('region',{name:'Live price'});};
/** Parts of sections that tests read. */
const backyardSubtotal=(page:Page)=>page.locator('.dd-backyard-subtotal');
const allowances=(page:Page)=>page.locator('.dd-allowances');
const corners=(page:Page)=>page.locator('.dd-corners');
/** The deck-part finishes panel (F6) and its chosen-colour swatches, and the railing colour's note. */
const deckParts=(page:Page)=>page.getByRole('region',{name:'Deck-part finishes'});
const partSwatches=(page:Page)=>deckParts(page).locator('.dd-part-swatch');
const railingColourNote=(page:Page)=>page.locator('.dd-railing-colour');

/** The proposal (R8): its dialog, one of its sheets by name, and its Letter sheets (for their printed size). */
const proposalDialog=(page:Page)=>page.getByRole('dialog',{name:'Deck proposal preview'});
const proposalSheet=(page:Page,name:string)=>proposalDialog(page).getByRole('region',{name,exact:true});
const proposalPages=(page:Page)=>proposalDialog(page).locator('.dd-proposal-page');
/** Opens the proposal from Proposal & files; its 3D views are taken first (a software-drawn 3D view is slow). */
async function openProposal(page:Page){
  await openSection(page,'Proposal & files');
  await page.getByRole('button',{name:'Print proposal'}).click();
  await expect(proposalDialog(page)).toBeVisible({timeout:120_000*PROPOSAL_WAIT});
  return proposalDialog(page);
}
/** The pages of a PDF file, and the pictures in it. */
const pdfPages=(bytes:Buffer)=>(bytes.toString('latin1').match(/\/Type \/Page\b/g)??[]).length;
const pdfImages=(bytes:Buffer)=>(bytes.toString('latin1').match(/\/Subtype \/Image/g)??[]).length;

/** Opens a closed <details> by its summary text; an open one stays open. */
async function expand(scope:Page|Locator,summaryText:string){
  const summaryEl=scope.locator('summary',{hasText:summaryText});
  if(!await summaryEl.evaluate(el=>(el.parentElement as HTMLDetailsElement).open))await summaryEl.click();
}
async function openFiles(page:Page){await leaveSection(page);await expand(fileTools(page),'Files');}
/** Undo in the header: leaves any open section for it, then goes back to that section, as a visitor would. */
async function undoFromHeader(page:Page){
  const section=await leaveSection(page);
  await fileTools(page).getByRole('button',{name:'Undo'}).click();
  if(section)await openSection(page,section);
}
async function closeFiles(page:Page){const details=fileTools(page).locator('details.dd-workspace-files');if(await details.evaluate(el=>(el as HTMLDetailsElement).open))await details.locator('summary').first().click();}
/** Back to the drawing: a section opens over it as a modal inspector, closed by its own "Done" button. */
async function showCanvas(page:Page){
  const inspector=page.getByRole('dialog',{name:'Design inspector'});
  if(await inspector.isVisible())await inspector.getByRole('button',{name:'Done · back to drawing',exact:true}).click();
  await expect(inspector).toBeHidden();
  await expect(preview(page)).toBeVisible();
}
/** The open section's inspector is modal and covers the header and the price bar. Leaves it for the drawing, as a
 * visitor would, and names the section left so it can be reopened. */
async function leaveSection(page:Page):Promise<Section|undefined>{
  const inspector=page.getByRole('dialog',{name:'Design inspector'});
  if(!await inspector.isVisible())return undefined;
  const name=(await inspector.locator('.dd-inspector-top h2').textContent())?.trim() as Section;
  await showCanvas(page);
  return name;
}
async function showOpenings(page:Page){await showCanvas(page);await expand(preview(page),'Doors & windows');}
/** Reads the price schedule from the price bar, then goes back to the section the visitor was in. */
async function withSchedule<T>(page:Page,read:()=>Promise<T>):Promise<T>{
  const dialog=page.getByRole('dialog',{name:'Price schedule'}),wasOpen=await dialog.isVisible(),section=wasOpen?undefined:await leaveSection(page);
  if(!wasOpen){await (await phoneBar(page)).getByRole('button',{name:'Price schedule',exact:true}).click();await expect(dialog).toBeVisible();}
  try{return await read();}finally{if(!wasOpen&&await dialog.isVisible())await dialog.getByRole('button',{name:'Close',exact:true}).click();if(section)await openSection(page,section);}
}
/** The section rows; a section's row button (named by the section alone); its body, once open. The button sits in a
 * task menu that closes itself once a task is chosen, so it is found shown or not; openSection asserts it is shown
 * before choosing it. */
const sectionList=(page:Page)=>page.getByRole('region',{name:'Deck configuration'});
const sectionButton=(page:Page,name:Section)=>sectionList(page).getByRole('button',{name,exact:true,includeHidden:true});
const sectionBody=(page:Page,name:Section)=>page.getByRole('region',{name,exact:true});
/** The canvas-first workspace hides the section menus: leave any open (modal) section for the drawing, show the
 * project controls, then open the button's menu group. */
async function revealSectionButton(page:Page,button:Locator,name:string){
  if(await button.isVisible())return;
  await showCanvas(page);
  await showProjectControls(page);
  if(!await button.isVisible())await page.locator('nav[aria-label="Design tasks"] details').filter({has:page.locator(`button[aria-label="${name}"]`)}).locator('summary').click();
}
/** Opens a section of the designer and waits for its body to load. An open section stays open. */
async function openSection(page:Page,name:Section){
  const button=sectionButton(page,name),state=page.locator(`nav[aria-label="Design tasks"] button[aria-label="${name}"]`);
  // An open section stays open: its body is already showing, so leave the menus alone.
  if(await state.count()&&await state.getAttribute('aria-expanded')==='true'){await expect(sectionBody(page,name).getByRole('button',{name:/: open /})).toBeVisible();return;}
  await revealSectionButton(page,button,name);
  await expect(button,`"${name}" is a section of the designer`).toBeVisible();
  if(await button.getAttribute('aria-expanded')==='false')await button.click();
  // Choosing a task closes its menu, which hides the button from role queries; read its state directly.
  await expect(page.locator(`nav[aria-label="Design tasks"] button[aria-label="${name}"]`)).toHaveAttribute('aria-expanded','true');
  // Every body ends with a link to a related section, shown once the body has loaded.
  await expect(sectionBody(page,name).getByRole('button',{name:/: open /})).toBeVisible();
}
/** Waits for the panels a section loads on its own (accent boards, inlays, deck-part finishes, skirting). */
async function sectionReady(page:Page,name:Section){
  if(name==='Boards & finish')for(const panel of ['Accent boards','Inlays','Deck-part finishes'])await expect(page.getByRole('region',{name:panel,exact:true})).toBeVisible();
  if(name==='Privacy, skirting & extras')await expect(page.getByRole('region',{name:'Skirting under the deck'})).toBeVisible();
}
/** Shows one of the drawing's sheets: the site plan, the 3D view or the framing. */
async function viewTab(page:Page,name:ViewTab){
  await showCanvas(page);
  await page.getByRole('tab',{name,exact:true}).click();
  await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');
}
/** The Framing sheet (the 2D framing plan, the 3D framing, hardware and below-ground views, and the modelled quantities). */
async function contractorView(page:Page){
  await viewTab(page,'Framing');
  return preview(page).getByRole('tabpanel');
}
/** The Framing sheet's 2D plan, the contractor plan the PDF prints. */
async function framingPlan(page:Page){
  await (await contractorView(page)).getByRole('group',{name:'Contractor preview modes'}).getByRole('button',{name:'Plan',exact:true}).click();
  return plan(page);
}
/** The proposal's contractor files (the DXF and OBJ exports), opened. */
async function contractorFiles(page:Page){
  await expand(page,'CAD & 3D model exports');
  return page.locator('details',{has:page.locator('summary',{hasText:'CAD & 3D model exports'})});
}
/** The exterior studio, opened from the doors and windows bar. */
async function openExterior(page:Page){
  await showOpenings(page);
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
  await expect((await price(page))).toContainText('$');
  // Existing sizing workflows explicitly select their tool; boundary.spec verifies the new default.
  await planTool(page,'Deck size');
  await expand(preview(page),'Start with a shape');
  return problems;
}
async function setNumber(scope:Page|Locator,label:string,value:number){
  const input=scope.getByLabel(label,{exact:true});
  await input.fill(String(value));await input.press('Enter');
}

/**
 * Every feature stays reachable (the plan's reachability matrix). Each step opens the feature's section the way a
 * visitor would and finds its control, so a redesign that loses one fails here, by name.
 */
test('reaches every feature of the designer',async({page})=>{
  const problems=await openDesigner(page);
  const reach=(feature:string,control:Locator)=>expect(control,`${feature} can be reached`).toBeVisible();
  await test.step('Site plan: handles, typed figures and shape shortcuts',async()=>{
    await reach('The site plan',plan(page));
    for(const name of ['Deck depth, front edge','Deck width, right end','Deck width, left end','Deck position along the house'])await reach(`Plan handle: ${name}`,planHandle(page,name));
    await reach('Typing the width on the plan',drawing(page).getByRole('button',{name:'Deck width 16 ft: type a new width'}));
    for(const name of ['Rectangle','L-shape','Multi-corner','Curved','Wrap left','Wrap right','Wrap both','Split level','Draw my own'])await reach(`Shape shortcut: ${name}`,shortcuts(page).getByRole('button',{name,exact:true}));
    for(const name of ['Shape & points','Deck size','Stairs','House'])await reach(`Plan tool: ${name}`,page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio',{name,exact:true}));
    await planTool(page,'Stairs');
    await reach('Stairs on the plan',planHandle(page,'Stairs, position along the edge'));
    await planTool(page,'House');
    await reach('House size on the plan',planHandle(page,'House width, right wall'));
    await planTool(page,'Shape & points');
    await reach('Add a boundary point',page.getByRole('button',{name:'Add point',exact:true}));
    await reach('Move any corner',page.getByRole('button',{name:'Main deck point 3',exact:true}));
    await planTool(page,'Deck size');
  });
  await test.step('House editor',async()=>{
    await openSection(page,'House');
    await reach('House size',page.getByLabel('House width',{exact:true}));
    await reach('House shape',page.getByRole('button',{name:'Add bump-out',exact:true}));
  });
  await test.step('Doors & windows bar',async()=>{
    await showOpenings(page);
    await reach('Doors & windows bar',openingsBar(page).getByLabel('Style of the new door or window'));
    await reach('Adding a door or window',openingsBar(page).getByRole('button',{name:'Add',exact:true}));
  });
  await test.step('Exterior finishes (F4, F5)',async()=>{
    // Doors & windows leaves the drawing, which closes the House inspector. The link lives in that section.
    await openSection(page,'House');
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
    await showCanvas(page);await paintChip(page).getByRole('button',{name:'Done'}).click();
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
    await page.getByLabel('Railing style',{exact:true}).selectOption('Frameless Glass');
    await reach('Frameless glass mount',page.getByLabel('Glass railing mount',{exact:true}));
    await reach('Frameless glass hardware finish',page.getByLabel('Glass hardware finish',{exact:true}));
    await page.getByLabel('Railing style',{exact:true}).selectOption('Aluminum');
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
    await reach('Full price schedule from the persistent price bar',(await phoneBar(page)).getByRole('button',{name:'Price schedule',exact:true}));
  });
  await test.step('Save, import, share, undo, redo and start over',async()=>{
    const tools=fileTools(page);await openFiles(page);
    for(const name of ['Undo','Redo','Save JSON','Import design','Share link'])await reach(name,tools.getByRole('button',{name,exact:true}));
    await expect(tools.getByLabel('Import Golden Maple design JSON'),'The design file picker is on the page').toBeAttached();
    await expand(tools,'Start over');
    await reach('Start over',tools.getByRole('button',{name:'Start a new design'}));
    await closeFiles(page);
  });
  await test.step('Framing sheet: the 2D framing plan, the 3D contractor views and the quantities',async()=>{
    const view=await contractorView(page);
    for(const name of ['Plan','Framing','Hardware','Below ground'])await reach(`Contractor view: ${name}`,view.getByRole('group',{name:'Contractor preview modes'}).getByRole('button',{name,exact:true}));
    await reach('Modelled quantities',view.getByLabel('Modeled quantities'));
    await reach('The framing plan',await framingPlan(page));
    await viewTab(page,'Plan');
    await reach('The plan drawing',plan(page));
  });
  await test.step('Share link, and going back to your own design',async()=>{
    const tools=fileTools(page);await openFiles(page);
    await tools.getByRole('button',{name:'Share link',exact:true}).click();
    const link=await tools.getByLabel('Link to this design').inputValue();
    // The visitor's own design is kept only when it differs from the shared one.
    await openSection(page,'Deck shape & size');
    await setNumber(page,'Deck width',24);
    await expect(size(page)).toContainText('24 × 12 ft');
    await page.waitForTimeout(800);// autosave runs 450 ms after the last change
    await page.goto(link);await openFiles(page);
    await reach('Go back to my own design',tools.getByRole('button',{name:'Go back to my own design'}));
  });
  expect(problems).toEqual([]);
});

test('opens tasks in any order, keeps one focused inspector, preserves choices and supports keyboard navigation',async({page})=>{
  const problems=await openDesigner(page);
  await expect(page.getByRole('button',{name:/^(← )?Back$|^Continue|^Review my estimate/})).toHaveCount(0);
  await expand(preview(page),'Drawing details & construction notes');
  await expect(page.getByLabel('Drawing title block').getByText(/^\d of 3$/)).toHaveCount(1);
  const before=await (await price(page)).textContent();
  await openSection(page,'Stairs & railings');await page.getByLabel('Number of stair flights',{exact:true}).selectOption('2');
  await expect((await price(page))).not.toHaveText(before??'');
  await openSection(page,'Deck shape & size');await setNumber(page,'Deck width',20);await expect(size(page)).toContainText('20 × 12 ft');
  await expect(sectionButton(page,'Stairs & railings')).toHaveAttribute('aria-expanded','false');
  await expect(page.getByLabel('Number of stair flights',{exact:true})).toHaveCount(0);
  await openSection(page,'Stairs & railings');await expect(page.getByLabel('Number of stair flights',{exact:true})).toHaveValue('2');
  await sectionBody(page,'Stairs & railings').getByRole('button',{name:'Light the steps and posts: open Lighting'}).click();
  await expect(sectionButton(page,'Lighting')).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('group',{name:'Deck lighting',exact:true})).toBeVisible();
  await openSection(page,'Stairs & railings');await expect(page.getByLabel('Number of stair flights',{exact:true})).toHaveValue('2');
  // From the keyboard: back to the drawing, Enter on the task's menu, then Enter on the task.
  await showCanvas(page);await showProjectControls(page);
  await page.locator('nav[aria-label="Design tasks"] details').filter({has:page.locator('button[aria-label="Site & foundation"]')}).locator('summary').focus();
  await page.keyboard.press('Enter');
  await sectionButton(page,'Site & foundation').focus();await page.keyboard.press('Enter');
  await expect(sectionBody(page,'Site & foundation')).toBeFocused();
  await expect(page.getByLabel('Project area',{exact:true})).toBeVisible();
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

/**
 * Controls under 44 px tall inside `scope`, by name and height. A checkbox or radio is tapped through its label, so the
 * label is measured; controls that are not shown (the design file picker) are skipped.
 */
const underTouchSize=(scope:Locator)=>scope.evaluate(root=>[...root.querySelectorAll('button,input,select,textarea')].flatMap(el=>{
  const target=el.matches('[type=checkbox],[type=radio]')?el.closest('label')??el:el,box=target.getBoundingClientRect();
  return box.width&&box.height<44?[`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label')??el.textContent??'').trim().slice(0,40)}": ${Math.round(box.height)} px`]:[];
}));

test('@phone keeps every control at least 44 px tall at 375 px',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  const problems=await openDesigner(page);
  expect(await underTouchSize(page.locator('.deck-designer')),'The header, file tools, drawing and price bar').toEqual([]);
  for(const name of SECTION_NAMES){
    await openSection(page,name);
    await sectionReady(page,name);
    expect(await underTouchSize(sectionBody(page,name)),`${name}, open`).toEqual([]);
  }
  // Controls shown only while in use: the paint tool's chip over the drawing, and the exterior studio's colour chips
  // and its link back to the look for a wall with a finish of its own.
  await openSection(page,'Boards & finish');
  await page.getByRole('region',{name:'Accent boards'}).getByRole('button',{name:'Paint with Dark Cocoa (TimberTech EDGE Prime+)'}).click();
  await showCanvas(page);
  expect(await underTouchSize(paintChip(page)),'The paint tool').toEqual([]);
  await showCanvas(page);await paintChip(page).getByRole('button',{name:'Done'}).click();
  const studio=await openExterior(page);
  expect(await underTouchSize(studio),'Exterior finishes: walls').toEqual([]);
  await studio.getByLabel('Walls to finish',{exact:true}).selectOption({label:'House, deck-facing wall'});
  await studio.getByRole('group',{name:'Cladding: House, deck-facing wall',exact:true}).getByRole('button',{name:'Ledgestone',exact:true}).click();
  await studio.getByRole('button',{name:'Looks',exact:true}).click();
  await studio.getByRole('button',{name:'Coastal look',exact:true}).click();
  await expect(studio.getByRole('button',{name:'Reset them to the look'})).toBeVisible();
  expect(await underTouchSize(studio),'Exterior finishes: looks').toEqual([]);
  expect(problems).toEqual([]);
});

/**
 * The plan tools' row as laid out: its height, how many rows the tools take, whether it scrolls sideways, whether the
 * page does, and each tool's size, whether its label fits, and whether it is in view in the row.
 */
const toolRow=(page:Page)=>page.getByRole('radiogroup',{name:'Plan tools'}).evaluate(row=>{
  const box=row.getBoundingClientRect(),tools=[...row.querySelectorAll('[role=radio]')].map(el=>{
    const r=el.getBoundingClientRect();
    return {name:el.textContent??'',top:Math.round(r.top),width:r.width,height:r.height,inView:r.left>=box.left&&r.right<=box.right,labelFits:el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight};
  });
  return {height:box.height,rows:new Set(tools.map(t=>t.top)).size,scrolls:row.scrollWidth>row.clientWidth,pageFits:document.documentElement.scrollWidth<=innerWidth,tools};
});
/** The category ribbon. Select parts is on every category. Sketch is a button beside the radios, not one of them. */
const PLAN_RIBBONS=[
  ['Building',['Deck size','Shape & points','Stairs','Patios & walls','House','Rails & screens','Select parts']],
  ['Landscape',['Landscape','Patios & walls','Select parts']],
  ['Materials',['Board layout','Inlays','Select parts']],
  ['Main',['Select parts','Deck size']],
] as const;
async function showToolCategory(page:Page,name:string){
  const tab=page.getByRole('tablist',{name:'Tool categories'}).getByRole('tab',{name,exact:true});
  if(await tab.getAttribute('aria-selected')!=='true')await tab.click();
  await expect(tab).toHaveAttribute('aria-selected','true');
}
/** Every tool is a 44 px target whose label fits and is in view, without the page scrolling sideways.
 * On a desktop the category is one row. On a phone the same tools sit in the category grid. */
async function expectPlanTools(page:Page,where:string,names:readonly string[],layout:'row'|'grid'){
  const row=await toolRow(page);
  expect(row.tools.map(t=>t.name),where).toEqual([...names]);
  if(layout==='row'){
    expect(row.rows,`${where}: the plan tools take one row`).toBe(1);
    expect(row.height,`${where}: the row is one tool tall`).toBeLessThan(60);
  }else expect(row.rows,`${where}: the category grid stays within two rows`).toBeLessThanOrEqual(2);
  expect(row.scrolls,`${where}: the tools do not scroll out of the row`).toBe(false);
  for(const t of row.tools){
    expect(Math.min(t.width,t.height),`${where}: "${t.name}" is a 44 px target`).toBeGreaterThanOrEqual(44);
    expect(t.labelFits,`${where}: "${t.name}" fits its label`).toBe(true);
    expect(t.inView,`${where}: "${t.name}" is in view`).toBe(true);
  }
  expect(row.pageFits,`${where}: no sideways page scroll`).toBe(true);
  return row;
}

test('keeps the plan tools on one row, all in view, on a desktop and a landscape tablet',async({page})=>{
  const problems=await openDesigner(page);
  for(const viewport of [{width:1280,height:720},{width:1024,height:768}]){
    await page.setViewportSize(viewport);
    const where=`${viewport.width} × ${viewport.height}`;
    for(const [category,names] of PLAN_RIBBONS){
      await showToolCategory(page,category);
      await expectPlanTools(page,`${where} · ${category}`,names,'row');
    }
  }
  expect(problems).toEqual([]);
});

test('@phone keeps every plan tool a 44 px target, and keeps the chosen tool in view',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const problems=await openDesigner(page);
  await expectPlanTools(page,'390 px',PLAN_RIBBONS[0][1],'grid');
  const inView=async(name:string)=>(await toolRow(page)).tools.find(t=>t.name===name)?.inView;
  // Leaving the plan and coming back keeps the chosen tool checked and on screen.
  await planTool(page,'House');
  await viewTab(page,'Framing');
  await viewTab(page,'Plan');
  await expect(page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio',{name:'House',exact:true})).toHaveAttribute('aria-checked','true');
  expect(await inView('House'),'House, chosen before, is in view on the plan again').toBe(true);
  // A section can choose a tool too, and that tool stays on screen.
  await openSection(page,'Stairs & railings');
  await sectionBody(page,'Stairs & railings').getByRole('button',{name:'Edit railings by section',exact:true}).click();
  await expect(page.getByRole('radiogroup',{name:'Plan tools'}).getByRole('radio',{name:'Rails & screens',exact:true})).toHaveAttribute('aria-checked','true');
  expect(await inView('Rails & screens'),'Rails & screens, chosen from the Stairs & railings section, is in view').toBe(true);
  await expectPlanTools(page,'390 px, after choosing tools',PLAN_RIBBONS[0][1],'grid');
  expect(problems).toEqual([]);
});

test('prices the default deck and reprices when the size changes',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',20);
  await expect(size(page)).toContainText('20 × 12 ft');
  await expect((await price(page))).not.toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('undoes and redoes a design change',async({page})=>{
  const problems=await openDesigner(page);
  const tools=fileTools(page);
  await expect(tools.getByRole('button',{name:'Undo'})).toBeDisabled();
  const before=await (await price(page)).textContent();
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',22);
  await expect(size(page)).toContainText('22 × 12 ft');
  await undoFromHeader(page);
  await expect(size(page)).toContainText('16 × 12 ft');
  await expect((await price(page))).toHaveText(before??'');
  await expect(page.getByLabel('Deck width',{exact:true})).toHaveValue('16');
  await page.keyboard.press('Control+Shift+Z');
  await expect(size(page)).toContainText('22 × 12 ft');
  await page.keyboard.press('Control+Z');
  await expect(size(page)).toContainText('16 × 12 ft');
  expect(problems).toEqual([]);
});

test('adds a patio in the backyard step, priced as its own subtotal',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  await openSection(page,'Backyard');
  await page.getByRole('button',{name:'Add patio'}).click();
  await expect(backyardSubtotal(page)).toContainText('Backyard subtotal: $');
  await expect((await price(page))).not.toHaveText(before??'');
  await openSection(page,'Proposal & files');
  await withSchedule(page,async()=>{ await expect(schedule(page)).toContainText('Deck subtotal'); });
  await withSchedule(page,async()=>{ await expect(schedule(page)).toContainText('Backyard subtotal'); });
  await expect(summary(page)).toContainText('Backyard: a ');
  expect(problems).toEqual([]);
});

test('adds a fire pit and turf as labelled estimator allowances, and takes them off again',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  await openSection(page,'Backyard');
  await page.getByLabel('Fire pit',{exact:true}).selectOption('wood');
  await expect(allowances(page)).toContainText(/Allowance: \$[\d,]+/);
  await page.getByRole('checkbox',{name:/Artificial turf/}).check();
  await expect(page.getByLabel('Turf area',{exact:true})).toHaveValue('500');
  await expect(page.getByLabel('Finish level',{exact:true})).toHaveValue('mid');
  await expect(backyardSubtotal(page)).toContainText('Backyard subtotal: $');
  await expect((await price(page))).not.toHaveText(before??'');
  await openSection(page,'Proposal & files');
  await withSchedule(page,async()=>{ await expect(schedule(page)).toContainText('Fire pit, wood-burning (estimator allowance)'); });
  await expect(summary(page)).toContainText('Backyard: allowances for a wood-burning fire pit and 500 sq ft of artificial turf (Elevated finish)');
  await openSection(page,'Backyard');
  await page.getByLabel('Fire pit',{exact:true}).selectOption('none');
  await page.getByRole('checkbox',{name:/Artificial turf/}).uncheck();
  await expect(backyardSubtotal(page)).toHaveCount(0);
  await expect((await price(page))).toHaveText(before??'');
  expect(problems).toEqual([]);
});

// One deck price on the site: the designer's. It opens inside the cost estimator, and prices a full backyard's deck.
test('a deck link to the cost estimator opens the designer there, at that size',async({page})=>{
  const problems:string[]=[];
  page.on('pageerror',e=>problems.push(String(e)));
  await page.goto('/cost-estimator?type=deck&sqft=300');
  await expect(page).toHaveURL(/\/cost-estimator\/?\?studio=deck$/);
  await expect(page.getByRole('region',{name:'Cost estimator'})).toContainText('Cost estimator · deck');
  await expect(size(page)).toContainText('20 × 15 ft');
  await openFiles(page);
  await expect(page.getByText(/Started from your cost estimate: a deck of about 300 sq ft \(20 × 15 ft\)/)).toBeVisible();
  // Back returns to the estimator, with the deck still chosen.
  await page.getByRole('button',{name:'Project types'}).click();
  await expect(page.getByRole('button',{name:'Composite Deck',pressed:true})).toBeVisible();
  expect(problems).toEqual([]);
});

test('a full-backyard estimate prices its deck with the designer and adds it to the total',async({page})=>{
  const problems:string[]=[];
  page.on('pageerror',e=>problems.push(String(e)));
  await page.goto('/cost-estimator?type=full');
  const live=page.getByRole('complementary',{name:'Live estimate'});
  await expect(live).toContainText('$');
  await page.getByRole('button',{name:'Composite Deck',pressed:false}).click();
  await expect(page.getByRole('button',{name:'Composite Deck',pressed:true})).toBeVisible();
  // A starter deck at the chosen 300 sq ft, priced by the designer and on the live receipt.
  const card=page.locator('[data-estimator-deck="starter"]');
  await expect(card).toContainText('20 × 15 ft');
  await expect(card).toContainText('included in this estimate');
  await expect(live).toContainText('Deck (starter)');
  const starterText=(await card.textContent())?.match(/\$([\d,]+\.\d{2})/)?.[1];
  expect(starterText).toBeTruthy();
  // The designer shows whole dollars; the estimate shows the same price to the cent.
  const starter=Math.round(Number(starterText!.replace(/,/g,''))).toLocaleString('en-CA');
  await expect(page.getByText('How high off the ground?')).toHaveCount(0);
  // Designing it opens the designer in the estimator, at that size and that price; using it brings it back.
  await page.getByRole('button',{name:/Design your deck in 3D/}).click();
  await expect(page).toHaveURL(/studio=full/);
  await expect(size(page)).toContainText('20 × 15 ft');
  await expect(page.getByRole('region',{name:'Cost estimator'})).toContainText(`$${starter}`);
  await page.getByRole('button',{name:'Use this deck in my estimate'}).click();
  await expect(page.locator('[data-estimator-deck="design"]')).toContainText('Your 3D deck design',{ignoreCase:true});
  await expect(live).toContainText('Deck (your 3D design)');
  // A backyard that is only a deck is the designer's whole estimate.
  for(const name of ['Patio / Interlock','Retaining Wall','Landscape Lighting'])await page.getByRole('button',{name,exact:true,pressed:true}).click();
  await page.getByRole('button',{name:'Continue →'}).first().click();
  await expect(page).toHaveURL(/studio=deck/);
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
  const before=await (await price(page)).textContent();
  await openSection(page,'Deck shape & size');
  await page.getByRole('checkbox',{name:'Angle the front left corner'}).check();
  await setNumber(page,'Front left corner cut',5);
  await expect(corners(page).getByRole('status')).toContainText('45° angled front corner: 5 ft front left. Angled face: 7.1 ft front left.');
  await expect((await price(page))).not.toHaveText(before??'');
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText('Rectangle with an angled front corner');
  await expect(summary(page)).toContainText('45° angled front corner: 5 ft front left');
  expect(problems).toEqual([]);
});

test('draws a custom outline, moves an edge from the keyboard and reprices it',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  await openSection(page,'Deck shape & size');
  await page.getByLabel('Deck shape',{exact:true}).selectOption('Custom');
  const outline=page.getByRole('group',{name:'Custom outline'});
  await outline.getByRole('button',{name:'T, centre bump-out'}).click();
  await expect(outline.getByRole('status')).toContainText('Custom outline: 8 corners');
  await expect((await price(page))).not.toHaveText(before??'');
  const drawn=await (await price(page)).textContent();
  const edge=outline.getByRole('button',{name:/^Front edge/}).first();
  await edge.focus();await edge.press('ArrowDown');
  await expect((await price(page))).not.toHaveText(drawn??'');
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText('Custom outline: 8 corners');
  expect(problems).toEqual([]);
});

test('paints a row of accent boards, lists and keeps it, and prices the fitting as a builder quote',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  await openSection(page,'Boards & finish');
  const panel=page.getByRole('region',{name:'Accent boards'});
  await panel.getByRole('button',{name:'Paint with Dark Cocoa (TimberTech EDGE Prime+)'}).click();
  await expect(paintChip(page)).toContainText('Painting: Dark Cocoa');
  await setNumber(page,'Row from the house',6);
  await panel.getByRole('button',{name:'Paint this row'}).click();
  await expect(panel.getByRole('listitem')).toHaveText(/Row 6 from the house · Dark Cocoa \(TimberTech EDGE Prime\+\)/);
  await expect((await price(page))).not.toHaveText(before??'');
  await withSchedule(page,async()=>{ await expect(quoteLine(page,'Accent-colour board labour')).toHaveText('Builder quote Accent-colour board labour'); });
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  await openSection(page,'Boards & finish');
  await expect(panel.getByRole('listitem')).toHaveText(/Row 6 from the house/);
  await panel.getByRole('button',{name:'Remove: Row 6 from the house'}).click();
  await expect(panel.getByRole('listitem')).toHaveCount(0);
  await expect((await price(page))).toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('paints a single board by clicking it in the 3D view',async({page})=>{
  const problems=await openDesigner(page);
  await openSection(page,'Boards & finish');
  const panel=page.getByRole('region',{name:'Accent boards'});
  await panel.getByRole('button',{name:'Paint with Sea Salt Gray (TimberTech EDGE Prime+)'}).click();
  // The section covers the drawing: back to it to click the board, then back to the section to see the result.
  await showCanvas(page);
  const canvas=viewer3d(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({timeout:20000});
  await page.waitForTimeout(2500);// the camera settles on the deck
  const box=(await canvas.boundingBox())!;
  // Open deck surface in the default view (the railing takes no clicks, so a click through it still lands on the boards).
  await canvas.click({position:{x:box.width*.5,y:box.height*.4}});
  await openSection(page,'Boards & finish');
  await expect(panel.getByRole('heading',{name:/Your accent boards · 1 board$/})).toBeVisible();
  await expect(panel.getByRole('listitem')).toHaveText(/One board in row \d+ from the house · Sea Salt Gray/);
  await showCanvas(page);await paintChip(page).getByRole('button',{name:'Done'}).click();
  await expect(paintChip(page)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('adds a framed inlay, fits it to the deck, and shows it and its framing on the plan',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  await openSection(page,'Boards & finish');
  const inlays=inlayPanel(page);
  await inlays.getByRole('button',{name:'Add a framed rectangle'}).click();
  // Add changes nothing until the inlay is placed on the deck.
  await expect(page.getByText('Choose a position on the deck',{exact:true})).toBeVisible();
  await expect((await price(page))).toHaveText(before??'');
  await placeInlay(page);
  await expect(inlays.getByRole('status')).toContainText('Built:');
  await expect((await price(page))).not.toHaveText(before??'');
  // The preset's inside runs front to back; the summary names the inside the visitor picks.
  await inlays.getByLabel('Inlay 1 inside boards',{exact:true}).selectOption('Herringbone');
  await setNumber(inlays,'Inlay 1 width',30);
  await expect(inlays.getByLabel('Inlay 1 width',{exact:true})).toHaveValue('20');
  await expect(inlays.getByRole('status')).toContainText('Not built: It reaches past the deck’s field');
  await inlays.getByRole('button',{name:'Fit to deck'}).click();
  await expect(inlays.getByRole('status')).toContainText('Built:');
  await expect(await framingPlan(page)).toContainText('Inlay 1');
  await expect(plan(page)).toContainText('Amber: inlay blocking');
  // The site plan shows the inlay but none of the framing under it.
  await viewTab(page,'Plan');
  await expect(plan(page)).toContainText('Inlay 1');
  await expect(plan(page)).not.toContainText('Amber: inlay blocking');
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText(/Inlays: a [\d.]+ × [\d.]+ ft framed rectangle with a herringbone inside/);
  expect(problems).toEqual([]);
});

test('adds a band and a compass medallion, and lists the medallion labour for a builder quote',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  await openSection(page,'Boards & finish');
  const inlays=inlayPanel(page);
  await inlays.getByRole('button',{name:'Add a band'}).click();
  await placeInlay(page);
  await expect(inlays.getByRole('status').first()).toContainText('cut in like a breaker board');
  await expect((await price(page))).not.toHaveText(before??'');
  // Across a straight deck, a band is its rows in another colour: nothing is cut.
  await inlays.getByLabel('Inlay 1 runs',{exact:true}).selectOption('across');
  await expect(inlays.getByRole('status').first()).toContainText('with no cutting');
  // The band fills the middle of the 12 ft deep deck, so the medallion is made smaller while it waits to be placed,
  // then tapped in 3 ft toward the house, clear of the band.
  await inlays.getByRole('button',{name:'Add a medallion'}).click();
  await setNumber(page.getByLabel('Inlay plan controls',{exact:true}),'Inlay 2 size',4);
  await placeInlay(page,{x:96,y:36});
  await expect(inlays.getByRole('status').nth(1)).toContainText('on solid blocking');
  await expect(await framingPlan(page)).toContainText('Inlay 2');
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText(/Inlays: a band two boards wide across the deck; a 4 ft compass medallion in eight wedges/);
  // The breakdown shows the labour as needing a quote; the list of quotes names the medallion's.
  await withSchedule(page,async()=>{ await expect(scheduleLine(page,'Labour (Construction & Build)')).toHaveText(/^Labour \(Construction & Build\)\$[\d,]+ \+ quote · allowance$/); });
  await withSchedule(page,async()=>{ await expect(quoteLine(page,'Medallion inlay labour')).toHaveText('Builder quote Medallion inlay labour'); });
  expect(problems).toEqual([]);
});

test('adds skirting under the deck, lists it for a builder quote, and keeps it after a reload',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  await openSection(page,'Privacy, skirting & extras');
  const skirting=page.getByRole('region',{name:'Skirting under the deck'});
  await skirting.getByRole('checkbox',{name:'Add skirting under the deck'}).check();
  await expect(skirting.getByRole('status')).toContainText('Listed for a builder quote');
  // The three open sides are offered; the side against the house never is.
  await expect(skirting.getByRole('group',{name:'Sides to skirt'}).getByRole('checkbox')).toHaveCount(3);
  await withSchedule(page,async()=>{ await expect(quoteLine(page,'Deck skirting')).toHaveText('Builder quote Deck skirting'); });
  // A quote, never a price: the priced amount does not move.
  await expect((await price(page))).toHaveText(before??'');
  await page.getByLabel('Skirting style',{exact:true}).selectOption('Lattice');
  await expect(skirting.getByRole('status')).toContainText('Listed for a builder quote');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  await openSection(page,'Privacy, skirting & extras');
  await expect(page.getByLabel('Skirting style',{exact:true})).toHaveValue('Lattice');
  await openSection(page,'Proposal & files');
  // The face is a supplier product; the backing, panels and labour are the builder's.
  await withSchedule(page,async()=>{ await expect(scheduleLine(page,'Deck skirting')).toHaveText('Deck skirtingSupplier & builder quotes'); });
  await expect(fullList(page)).toContainText('Skirting labour');
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
  await withSchedule(page,async()=>{ await expect(quoteLine(page,'Stair treads and risers in TimberTech Composite Terrain+')).toHaveText('Supplier quote Stair treads and risers in TimberTech Composite Terrain+'); });
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
  await withSchedule(page,async()=>{ await expect(scheduleLine(page,'Stairs')).toHaveText('StairsSupplier quote'); });
  await withSchedule(page,async()=>{ await expect(schedule(page)).toContainText('Deck-part finishes'); });
  await expect(summary(page)).toContainText('Deck parts: border boards in Espresso (TimberTech PRO Legacy); stair treads in Dark Oak (TimberTech Composite Terrain+)');
  await expect(summary(page)).toContainText('Railing colour: Matte Black (TimberTech Classic Composite · balusters); screen colour illustrative');
  expect(problems).toEqual([]);
});

test('lists what each change does to the price, tags quotes and never shows $0 for one',async({page})=>{
  const problems=await openDesigner(page);
  await withSchedule(page,async()=>{ await expect(schedule(page)).toContainText('Golden Maple price book'); });
  await withSchedule(page,async()=>{ await expect(changes(page)).toHaveCount(0); });
  await openSection(page,'Stairs & railings');
  // A downgrade and a priced upgrade.
  await page.getByLabel('Number of stair flights',{exact:true}).selectOption('0');
  await withSchedule(page,async()=>{ await expect(changes(page).first()).toHaveText(/^\u2212\$[\d,]+ Stair flights → 0 \(\d+ fewer to quote\)$/); });
  await page.getByLabel('Railing style',{exact:true}).selectOption('Glass Panels');
  await withSchedule(page,async()=>{ await expect(changes(page).first()).toHaveText(/^\+\$[\d,]+ Railing style → Glass Panels$/); });
  await expect(announcement(page)).toHaveText(/^Railing style: Glass Panels\. \+\$[\d,]+\. Priced subtotal \$[\d,]+\.$/);
  await withSchedule(page,async()=>{ await expect(changes(page)).toHaveCount(2); });
  // A choice that turns a priced section into a quote says so, with what left the priced total.
  const before=await (await price(page)).textContent();
  await page.getByLabel('Manufacturer railing system',{exact:true}).selectOption('tt_classic_composite');
  await withSchedule(page,async()=>{ await expect(changes(page).first()).toHaveText(/^Now a supplier quote Manufacturer railing → TimberTech Classic Composite · balusters \(priced total \u2212\$[\d,]+\)$/); });
  await expect((await price(page))).not.toHaveText(before??'');
  await withSchedule(page,async()=>{ await expect(scheduleLine(page,'Railing System')).toHaveText('Railing SystemSupplier quote'); });
  await withSchedule(page,async()=>{ await expect(quoteLine(page,'TimberTech Classic Composite · balusters')).toHaveText('Supplier quote TimberTech Classic Composite · balusters'); });
  // A builder quote beside it; nothing unpriced reads $0, and the total says it is the priced portion.
  await openSection(page,'Privacy, skirting & extras');
  await page.getByRole('region',{name:'Skirting under the deck'}).getByRole('checkbox',{name:'Add skirting under the deck'}).check();
  await withSchedule(page,async()=>{ await expect(quoteLine(page,'Deck skirting')).toHaveText('Builder quote Deck skirting'); });
  await withSchedule(page,async()=>{ await expect(changes(page).first()).toHaveText(/^Now a builder quote Skirting$/); });
  await withSchedule(page,async()=>{ expect(await schedule(page).textContent()).not.toMatch(ZERO); });
  await withSchedule(page,async()=>{ await expect(schedule(page)).toContainText('Priced portion including HST'); });
  // Undo shows what it gave back; a new design clears the list.
  await undoFromHeader(page);
  await withSchedule(page,async()=>{ await expect(changes(page).first()).toHaveText('No price change Undo (1 fewer to quote)'); });
  await openFiles(page);await expand(fileTools(page),'Start over');
  await fileTools(page).getByRole('button',{name:'Start a new design'}).click();
  await withSchedule(page,async()=>{ await expect(changes(page)).toHaveText(['New design loaded']); });
  // The full price list in Proposal & files lists every item, the unpriced ones tagged.
  await withSchedule(page,async()=>{ await schedule(page).getByRole('button',{name:'Full price list'}).click(); });
  await expect(fullList(page)).toContainText('Installation Labour');
  expect(await fullList(page).textContent()).not.toMatch(ZERO);
  expect(problems).toEqual([]);
});

test('joins deck levels as built: the step stands on the lower level and the cladding is a builder quote',async({page})=>{
  test.setTimeout(150_000);
  const shaderProblems:string[]=[];
  page.on('console',m=>{if(/Shader Error|WebGLProgram/.test(m.text()))shaderProblems.push(m.text().slice(0,300));});
  const problems=await openDesigner(page);
  // Every stair's sides are boarded: a builder quote beside the stairs, never $0.
  await withSchedule(page,async()=>{ await expect(quoteLine(page,'Stair and level cladding')).toHaveText('Builder quote Stair and level cladding'); });
  await openSection(page,'Deck shape & size');
  await page.getByLabel('Number of levels',{exact:true}).selectOption('2');
  // A second level adds its price (the levels meet, so no guard runs along the lower edge of the join).
  await withSchedule(page,async()=>{ await expect(changes(page).first()).toHaveText(/^\+\$[\d,]+ Number of levels → 2/); });
  await withSchedule(page,async()=>{ await expect(scheduleLine(page,'Stair and level cladding')).toHaveText(/^Stair and level cladding\$[\d,]+ \+ quote · allowance$/); });
  await withSchedule(page,async()=>{ expect(await schedule(page).textContent()).not.toMatch(ZERO); });
  await viewTab(page,'3D');
  const canvas=viewer3d(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({timeout:20000});
  await page.waitForTimeout(3000);
  expect(shaderProblems).toEqual([]);
  expect(problems).toEqual([]);
});

test('offers a frameless glass railing in three mounts, as a supplier quote with no posts',async({page})=>{
  test.setTimeout(150_000);
  const shaderProblems:string[]=[];
  page.on('console',m=>{if(/Shader Error|WebGLProgram/.test(m.text()))shaderProblems.push(m.text().slice(0,300));});
  const problems=await openDesigner(page);
  await openSection(page,'Stairs & railings');
  await expect(page.getByLabel('Glass railing mount',{exact:true})).toHaveCount(0);
  await page.getByLabel('Railing style',{exact:true}).selectOption('Frameless Glass');
  // The railing materials leave the priced total and become a quote; the change says so. Its labour is the Glass Panels
  // basis (20 ft a crew-day and ×1.40 on the job), so from aluminum the priced total can go up.
  await withSchedule(page,async()=>{ await expect(changes(page).first()).toHaveText(/^Now a supplier quote Railing style → Frameless Glass \(priced total [+−]\$[\d,]+\)$/); });
  await withSchedule(page,async()=>{ await expect(scheduleLine(page,'Railing System')).toHaveText('Railing SystemSupplier quote'); });
  await withSchedule(page,async()=>{ await expect(quoteLine(page,'Frameless glass railing on a top-mount base shoe')).toHaveText('Supplier quote Frameless glass railing on a top-mount base shoe'); });
  await expect(page.getByLabel('Glass railing mount',{exact:true})).toHaveValue('Top-mount base shoe');
  await expect(plan(page).locator('g[aria-label="Frameless glass railing · Top-mount base shoe"]')).toHaveCount(1);
  await page.getByLabel('Glass railing mount',{exact:true}).selectOption('Spigots');
  await page.getByLabel('Glass hardware finish',{exact:true}).selectOption('Silver');
  await withSchedule(page,async()=>{ await expect(quoteLine(page,'Frameless glass railing on spigots')).toHaveCount(1); });
  await expect(plan(page).locator('g[aria-label="Frameless glass railing · Spigots"] circle').first()).toBeAttached();
  await withSchedule(page,async()=>{ expect(await schedule(page).textContent()).not.toMatch(ZERO); });
  // No posts, so no post-cap lights.
  await openSection(page,'Lighting');
  const cap=page.getByRole('checkbox',{name:/^Cap light on each railing post/});
  await expect(cap).toBeDisabled();
  await expect(page.getByText('Cap light on each railing post · a frameless glass railing has no posts')).toBeVisible();
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  await openSection(page,'Stairs & railings');
  await expect(page.getByLabel('Railing style',{exact:true})).toHaveValue('Frameless Glass');
  await expect(page.getByLabel('Glass railing mount',{exact:true})).toHaveValue('Spigots');
  await expect(page.getByLabel('Glass hardware finish',{exact:true})).toHaveValue('Silver');
  await page.getByLabel('Glass railing mount',{exact:true}).selectOption('Fascia-mount base shoe');
  await viewTab(page,'3D');
  await page.getByRole('group',{name:'Day or night preview'}).getByRole('button',{name:'Night'}).click();
  const canvas=viewer3d(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({timeout:20000});
  await page.waitForTimeout(3000);
  expect(shaderProblems).toEqual([]);
  expect(problems).toEqual([]);
});

test('shows the price effect beside each option, and picking one moves the priced subtotal by exactly that much',async({page})=>{
  const problems=await openDesigner(page);
  await openSection(page,'Boards & finish');await expand(sectionBody(page,'Boards & finish'),'Change collection');
  // A desktop prices the options on its own: no "Show price effect" to press.
  await expect(sectionBody(page,'Boards & finish').getByRole('button',{name:'Show price effect'})).toHaveCount(0);
  // A dearer collection reads "+$…" as its description (its name is unchanged); the current one has none.
  const vintage=collection(page,'TimberTech AZEK Vintage'),current=collection(page,'TimberTech EDGE Prime+');
  await expect(vintage).toHaveAccessibleDescription(/^\+\$[\d,]+$/);
  await expect(current).toHaveAttribute('aria-pressed','true');
  await expect(current).not.toHaveAttribute('aria-describedby',/./);
  // A collection with no rate turns the priced decking into a quote: "supplier quote", never $0.
  await expect(collection(page,'TimberTech Composite Prime')).toHaveAccessibleDescription('supplier quote');
  // Picking the dearer one moves the schedule's priced subtotal by exactly its delta.
  const delta=wholeDollars(await describedBy(vintage)),before=await (await price(page)).textContent();
  await vintage.click();await expand(sectionBody(page,'Boards & finish'),'Change collection');
  await expect(vintage).toHaveAttribute('aria-pressed','true');
  await expect((await price(page))).not.toHaveText(before??'');
  expect(wholeDollars(await (await price(page)).textContent())-wholeDollars(before)).toBe(delta);
  // The deltas follow the new design at once: the collection just left shows the way back, never a stale figure.
  await expect(current).toHaveAccessibleDescription(`−$${delta.toLocaleString('en-CA')}`);
  await expect(vintage).not.toHaveAttribute('aria-describedby',/./);
  // Each select is described by its line: every other choice with its price effect.
  await expect(page.getByLabel('Board layout',{exact:true})).toHaveAccessibleDescription(/^Price effect: Diagonal \+\$[\d,]+ · Picture Frame \+\$[\d,]+ · Herringbone \+\$[\d,]+$/);
  await openSection(page,'Stairs & railings');
  await expect(page.getByLabel('Railing style',{exact:true})).toHaveAccessibleDescription(/ · Glass Panels \+\$[\d,]+ · /);
  // Every manufacturer railing is a supplier quote, so they read as one.
  await expect(page.getByLabel('Manufacturer railing system',{exact:true})).toHaveAccessibleDescription(/^Price effect: \d+ choices: supplier quote$/);
  const flights=page.getByLabel('Number of stair flights',{exact:true});
  await expect(flights).toHaveAccessibleDescription(/^Price effect: 0 flights −\$[\d,]+( · \d+ fewer to quote)? · 2 flights \+\$[\d,]+ · 3 flights \+\$[\d,]+$/);
  const two=wholeDollars(/2 flights (\+\$[\d,]+)/.exec(await describedBy(flights))![1]),was=await (await price(page)).textContent();
  await flights.selectOption('2');
  await expect((await price(page))).not.toHaveText(was??'');
  expect(wholeDollars(await (await price(page)).textContent())-wholeDollars(was)).toBe(two);
  for(const name of ['Boards & finish','Stairs & railings'] as const){await openSection(page,name);expect(await sectionBody(page,name).textContent()).not.toMatch(ZERO);}
  expect(problems).toEqual([]);
});

test('@phone shows each option’s price effect only once asked, then keeps it for the visit',async({page})=>{
  const engine:string[]=[];
  page.on('request',r=>{if(/\/optionDeltas[-.][\w.-]+\.js/.test(r.url()))engine.push(r.url());});
  const problems=await openDesigner(page);
  await openSection(page,'Boards & finish');
  await expand(sectionBody(page,'Boards & finish'),'Change collection');
  const show=sectionBody(page,'Boards & finish').getByRole('button',{name:'Show price effect'});
  await expect(show).toHaveAttribute('aria-pressed','false');
  // One engine run can pass 50 ms on a throttled phone, so nothing is priced (or even downloaded) until asked.
  await page.waitForTimeout(1500);
  await expect(collection(page,'TimberTech AZEK Vintage')).not.toHaveAttribute('aria-describedby',/./);
  await expect(page.getByLabel('Board layout',{exact:true})).not.toHaveAttribute('aria-describedby',/./);
  expect(engine).toEqual([]);
  await show.click();
  await expect(show).toHaveAttribute('aria-pressed','true');
  await expect(collection(page,'TimberTech AZEK Vintage')).toHaveAccessibleDescription(/^\+\$[\d,]+$/);
  await expect(collection(page,'TimberTech Composite Prime')).toHaveAccessibleDescription('supplier quote');
  expect(engine.length).toBeGreaterThan(0);
  // The choice holds for the visit: the next section shows its price effects at once.
  await openSection(page,'Stairs & railings');
  await expect(sectionBody(page,'Stairs & railings').getByRole('button',{name:'Show price effect'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('Railing style',{exact:true})).toHaveAccessibleDescription(/ · Glass Panels \+\$[\d,]+ · /);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(problems).toEqual([]);
});

test('@phone opens the price schedule from the price bar and gives focus back when it closes',async({page})=>{
  const problems=await openDesigner(page);
  const opener=(await phoneBar(page)).getByRole('button',{name:'Price schedule',exact:true});
  await expect(await phoneBar(page)).toContainText(/to quote/);
  const amount=await (await price(page)).textContent();
  await opener.click();
  const drawer=page.getByRole('dialog',{name:'Price schedule'});
  await expect(drawer).toBeVisible();
  // Focus goes in, and Tab and Shift+Tab loop inside the drawer (never out to the page behind it).
  const close=drawer.getByRole('button',{name:'Close',exact:true}),more=drawer.getByRole('button',{name:'Full price list'});
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(more).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(more).toBeFocused();
  await withSchedule(page,async()=>{ await expect(schedule(page).getByRole('status',{name:'Priced subtotal'})).toHaveText(amount??''); });
  await withSchedule(page,async()=>{ await expect(quotes(page).getByRole('listitem').first()).toContainText('quote'); });
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await drawer.getByRole('button',{name:'Close',exact:true}).click();
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
  // "Full price list" closes the drawer and opens Proposal & files.
  await opener.click();
  await drawer.getByRole('button',{name:'Full price list'}).click();
  await expect(drawer).toHaveCount(0);
  await expect(sectionButton(page,'Proposal & files')).toHaveAttribute('aria-expanded','true');
  await expect(fullList(page)).toContainText('Priced subtotal');
  expect(problems).toEqual([]);
});

test('drags the deck’s front edge on the plan: a ghost while dragging, then one change to the size and price and one undo step',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  const handle=planHandle(page,'Deck depth, front edge');
  await expect(handle).toHaveAttribute('aria-valuenow','12');
  const box=(await handle.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x,y+25,{steps:4});
  await page.waitForTimeout(700);// longer than undo's grouping, so a change made mid-drag would be a step of its own
  await page.mouse.move(x,y+50,{steps:4});
  // Mid-drag: a ghost with the new figures; the design, its size heading and its price have not changed.
  await expect(ghost(page)).toHaveCount(1);
  await expect(handle).toHaveAttribute('aria-valuetext',/^16 × 1[3-9](\.5)? ft · \d+ sq ft$/);
  await expect(size(page)).toContainText('16 × 12 ft');
  await expect((await price(page))).toHaveText(before??'');
  await expect(fileTools(page).getByRole('button',{name:'Undo'})).toBeDisabled();
  await page.mouse.up();
  await expect(ghost(page)).toHaveCount(0);
  const depth=Number(await handle.getAttribute('aria-valuenow'));
  expect(depth).toBeGreaterThan(12);
  await expect(size(page)).toContainText(`16 × ${depth} ft`);
  await expect((await price(page))).not.toHaveText(before??'');
  await withSchedule(page,async()=>{ await expect(changes(page)).toHaveCount(1); });
  // One undo takes the whole drag back, and there is nothing more to undo.
  const undo=fileTools(page).getByRole('button',{name:'Undo'});
  await undo.click();
  await expect(size(page)).toContainText('16 × 12 ft');
  await expect((await price(page))).toHaveText(before??'');
  await expect(undo).toBeDisabled();
  expect(problems).toEqual([]);
});

test('moves the deck’s depth with the arrow keys on its handle, as the Deck section’s field sees it',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  const handle=planHandle(page,'Deck depth, front edge');
  await handle.focus();
  await page.keyboard.press('ArrowUp');
  await expect(handle).toHaveAttribute('aria-valuenow','12.5');
  await expect(handle).toHaveAttribute('aria-valuetext','12.5 ft deep');
  await expect(size(page)).toContainText('16 × 12.5 ft');
  await expect((await price(page))).not.toHaveText(before??'');
  await page.keyboard.press('Shift+ArrowUp');
  await expect(handle).toHaveAttribute('aria-valuenow','13.5');
  await page.keyboard.press('ArrowDown');
  await expect(handle).toHaveAttribute('aria-valuenow','13');
  await page.keyboard.press('End');
  await expect(handle).toHaveAttribute('aria-valuenow','60');
  await page.keyboard.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow','4');
  await expect(size(page)).toContainText('16 × 4 ft');
  await expect(handle).toBeFocused();
  await openSection(page,'Deck shape & size');
  await expect(page.getByLabel('Deck depth',{exact:true})).toHaveValue('4');
  expect(problems).toEqual([]);
});

test('types the deck’s width and depth on the plan, clamped as the fields are',async({page})=>{
  const problems=await openDesigner(page);
  const width=(ft:string)=>drawing(page).getByRole('button',{name:`Deck width ${ft} ft: type a new width`});
  await width('16').click();
  const box=page.getByLabel('Type the deck width in feet',{exact:true});
  await expect(box).toBeFocused();
  await box.fill('70');
  await box.press('Enter');
  await expect(size(page)).toContainText('60 × 12 ft');
  await expect(width('60')).toBeFocused();
  // Escape leaves the width as it was.
  await width('60').click();
  await box.fill('20');
  await box.press('Escape');
  await expect(box).toHaveCount(0);
  await expect(size(page)).toContainText('60 × 12 ft');
  await width('60').click();
  await box.fill('18.5');
  await box.press('Enter');
  await expect(size(page)).toContainText('18.5 × 12 ft');
  await drawing(page).getByRole('button',{name:'Deck depth 12 ft: type a new depth'}).click();
  await page.getByLabel('Type the deck depth in feet',{exact:true}).fill('14');
  await page.getByLabel('Type the deck depth in feet',{exact:true}).press('Enter');
  await expect(size(page)).toContainText('18.5 × 14 ft');
  await openSection(page,'Deck shape & size');
  await expect(page.getByLabel('Deck width',{exact:true})).toHaveValue('18.5');
  expect(problems).toEqual([]);
});

test('changes the shape from the shortcuts on the plan, and says what a wrap-around fixed',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
  await expect(shortcuts(page).getByRole('button',{name:'Rectangle',exact:true})).toHaveAttribute('aria-pressed','true');
  await shortcuts(page).getByRole('button',{name:'L-shape',exact:true}).click();
  await expect(shortcuts(page).getByRole('button',{name:'L-shape',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(planStatus(page)).toHaveText('Now an L-shape. Drag the gold cut-out handles to size the corner.');
  await expect((await price(page))).not.toHaveText(before??'');
  // The cut-out has handles of its own.
  const cut=planHandle(page,'Corner cut-out width, front right');
  await expect(cut).toHaveAttribute('aria-valuenow','8');
  await cut.focus();
  await page.keyboard.press('ArrowUp');
  await expect(cut).toHaveAttribute('aria-valuenow','8.5');
  // A wrap-around on diagonal boards: the same fix as the Deck section, named in the drawing's status line.
  await openSection(page,'Boards & finish');
  await page.getByLabel('Board layout',{exact:true}).selectOption('Diagonal');
  await showCanvas(page);
  await shortcuts(page).getByRole('button',{name:'Wrap left',exact:true}).click();
  await expect(planStatus(page)).toHaveText('Wrapped round the left house corner. Switched to a rectangle, straight boards so the corner can be mitred.');
  await expect(shortcuts(page).getByRole('button',{name:'Wrap left',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(shortcuts(page).getByRole('button',{name:'Rectangle',exact:true})).toHaveAttribute('aria-pressed','true');
  await openSection(page,'Deck shape & size');
  await expect(page.getByRole('checkbox',{name:'Around the left corner'})).toBeChecked();
  await expect(page.getByLabel('Deck shape',{exact:true})).toHaveValue('Rectangle');
  await openSection(page,'Proposal & files');
  await expect(summary(page)).toContainText('Wraps the left house corner');
  expect(problems).toEqual([]);
});

test('@phone drags a plan handle by touch, and a swipe over the plan still scrolls the page',async({page})=>{
  const problems=await openDesigner(page);
  const handle=planHandle(page,'Deck width, right end');
  await expect(handle).toHaveAttribute('aria-valuenow','16');
  const cdp=await page.context().newCDPSession(page);
  const touch=(type:'touchStart'|'touchMove'|'touchEnd',x:number,y:number)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  // The finger rests before it lifts, so a swipe ends without a fling that would keep the page moving afterwards.
  const swipe=async(x:number,y:number,dx:number,dy:number)=>{
    await touch('touchStart',x,y);
    for(let i=1;i<=10;i++){await touch('touchMove',x+dx*i/10,y+dy*i/10);await page.waitForTimeout(20);}
    await page.waitForTimeout(200);
    await touch('touchEnd',x+dx,y+dy);
  };
  const pageY=()=>page.evaluate(()=>window.scrollY);
  const settled=async()=>{let last=-1;await expect.poll(async()=>{const now=await pageY(),same=now===last;last=now;return same;},{intervals:[200]}).toBe(true);return last;};
  // A swipe up over the drawing, away from the handles, scrolls the page and leaves the design alone.
  const area=(await drawing(page).boundingBox())!,top=await pageY();
  await swipe(area.x+24,area.y+area.height-24,0,-220);
  await expect.poll(pageY).toBeGreaterThan(top+60);
  await expect(size(page)).toContainText('16 × 12 ft');
  // Dragging the right end by touch widens the deck, once, and does not scroll the page.
  await settled();
  // At the top of the page the handle is under the fixed price bar, so it is brought to the middle of the screen.
  await scrollToCentre(handle);
  // Sticky navigation may retain a small focus offset; the touch drag must preserve that actual starting scroll.
  const dragScroll=await settled();
  const b=(await handle.boundingBox())!,grip={x:b.x+b.width/2,y:b.y+b.height/2};
  expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest('[role=slider]')?.getAttribute('aria-label'),grip),'the finger lands on the handle').toBe('Deck width, right end');
  await swipe(grip.x,grip.y,70,0);
  await expect.poll(async()=>Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(16);
  expect(await settled()).toBe(dragScroll);
  const width=Number(await handle.getAttribute('aria-valuenow'));
  await expect(size(page)).toContainText(`${width} × 12 ft`);
  await fileTools(page).getByRole('button',{name:'Undo'}).click();
  await expect(size(page)).toContainText('16 × 12 ft');
  await expect(fileTools(page).getByRole('button',{name:'Undo'})).toBeDisabled();
  expect(problems).toEqual([]);
});

test('places the stairs on an edge from the plan and slides them along it, one undo step each',async({page})=>{
  const problems=await openDesigner(page);
  await planTool(page,'Stairs');
  // The page allows the front, left and right sides (the house is behind); the stairs are on the front now.
  const handle=planHandle(page,'Stairs, position along the edge');
  await expect(handle).toHaveAttribute('aria-valuenow','50');
  await expect(handle).toHaveAttribute('aria-valuetext','Stairs 6 ft from the left end of the front edge');
  await expect(stairMark(page,'left side')).toHaveAttribute('aria-pressed','false');
  await expect(stairMark(page,'right side')).toBeVisible();
  await expect(drawing(page).getByRole('button',{name:/^Put the stairs on the (back|front)/})).toHaveCount(0);
  await stairMark(page,'left side').click();
  await expect(planStatus(page)).toHaveText('Stairs on the left side.');
  await expect(handle).toHaveAttribute('aria-valuetext',/^Stairs [\d.]+ ft from the back end of the left side$/);
  await expect(handle).toBeFocused();
  await withSchedule(page,async()=>{ await expect(changes(page)).toHaveCount(1); });
  const placed=await (await price(page)).textContent();
  // Slide them toward the house: a ghost while dragging, then one change.
  const box=(await handle.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x,y-30,{steps:4});
  await page.waitForTimeout(700);
  await page.mouse.move(x,y-60,{steps:4});
  await expect(ghost(page)).toHaveCount(1);
  await expect((await price(page))).toHaveText(placed??'');
  await page.mouse.up();
  await expect(ghost(page)).toHaveCount(0);
  const offset=Number(await handle.getAttribute('aria-valuenow'));
  expect(offset).toBeLessThan(50);
  await withSchedule(page,async()=>{ await expect(changes(page)).toHaveCount(2); });
  await openSection(page,'Stairs & railings');
  await expect(page.getByLabel('Primary stair location',{exact:true})).toHaveValue('Left');
  await expect(page.getByLabel('Position along the edge',{exact:true})).toHaveValue(String(offset));
  // One undo takes the slide back, a second the move to the left side, and then there is nothing left to undo.
  await undoFromHeader(page);
  await expect(page.getByLabel('Position along the edge',{exact:true})).toHaveValue('50');
  await expect(page.getByLabel('Primary stair location',{exact:true})).toHaveValue('Left');
  await expect((await price(page))).toHaveText(placed??'');
  await undoFromHeader(page);
  await expect(page.getByLabel('Primary stair location',{exact:true})).toHaveValue('Front');
  await expect(fileTools(page).getByRole('button',{name:'Undo'})).toBeDisabled();
  expect(problems).toEqual([]);
});

test('resizes the house from its wall end on the plan, as the House section’s width does',async({page})=>{
  const problems=await openDesigner(page);
  await planTool(page,'House');
  const right=planHandle(page,'House width, right wall'),left=planHandle(page,'House width, left wall');
  await expect(right).toHaveAttribute('aria-valuenow','27');
  await expect(left).toBeVisible();
  const leftAt=(await left.boundingBox())!;
  const box=(await right.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+40,y,{steps:5});
  await expect(ghost(page)).toHaveCount(2);
  await expect(right).toHaveAttribute('aria-valuetext',/^House (2[89]|3\d)(\.5)? ft wide$/);
  await page.mouse.up();
  await expect(ghost(page)).toHaveCount(0);
  const width=Number(await right.getAttribute('aria-valuenow'));
  expect(width).toBeGreaterThan(27);
  // The other wall end stays where it was on the drawing (the drawing rescales to the wider house, so allow a little).
  expect(Math.abs((await left.boundingBox())!.x-leftAt.x)).toBeLessThan(40);
  await withSchedule(page,async()=>{ await expect(changes(page)).toHaveCount(1); });
  await openSection(page,'House');
  await expect(page.getByLabel('House width',{exact:true})).toHaveValue(String(width));
  // From the keyboard: Home is the House section's smallest house (a moment later, so it is an undo step of its own).
  await page.waitForTimeout(700);
  await showCanvas(page);
  await left.focus();
  await page.keyboard.press('Home');
  await expect(left).toHaveAttribute('aria-valuenow','12');
  await openSection(page,'House');
  await expect(page.getByLabel('House width',{exact:true})).toHaveValue('12');
  await undoFromHeader(page);await undoFromHeader(page);
  await expect(page.getByLabel('House width',{exact:true})).toHaveValue('27');
  await expect(fileTools(page).getByRole('button',{name:'Undo'})).toBeDisabled();
  expect(problems).toEqual([]);
});

test('drags a free outline edge diagonally with one commit and undo',async({page})=>{
  const problems=await openDesigner(page);await planTool(page,'Shape & points');
  const before=await (await price(page)).textContent(),edge=page.getByRole('button',{name:'Main deck edge 3',exact:true});
  await scrollToCentre(edge);
  const box=(await edge.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
  expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest('button')?.getAttribute('aria-label'),{x,y}),'the press lands on the edge').toBe('Main deck edge 3');
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y+35,{steps:6});
  await expect(drawing(page).locator('.dd-boundary-ghost')).toHaveCount(1);await expect((await price(page))).toHaveText(before??'');
  await page.mouse.up();await expect(drawing(page).locator('.dd-boundary-ghost')).toHaveCount(0);await expect((await price(page))).not.toHaveText(before??'');
  await withSchedule(page,async()=>{ await expect(changes(page)).toHaveCount(1); });await fileTools(page).getByRole('button',{name:'Undo'}).click();
  await expect((await price(page))).toHaveText(before??'');await expect(fileTools(page).getByRole('button',{name:'Undo'})).toBeDisabled();expect(problems).toEqual([]);
});

test('moves an outline point in both directions and refuses crossed edges',async({page})=>{
  const problems=await openDesigner(page);await planTool(page,'Shape & points');
  const point=page.getByRole('button',{name:'Main deck point 3',exact:true});await point.focus();
  await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowDown');
  await expand(preview(page),'Fine adjust a point');
  await expect(page.getByLabel('Selected point X in feet')).toHaveValue('17');await expect(page.getByLabel('Selected point Y in feet')).toHaveValue('13');
  await page.getByLabel('Selected point X in feet').fill('-1');await page.getByLabel('Selected point Y in feet').fill('6');
  await preview(page).getByRole('button',{name:'Apply',exact:true}).click();await expect(preview(page).locator('.dd-boundary-notice')).toContainText('cross');
  await expect.poll(async()=>(await savedConfiguration(page))?.deckOutlines?.main?.[2]??null).toEqual({x:17,y:13});
  await page.reload();await planTool(page,'Shape & points');
  await expand(preview(page),'Fine adjust a point');await page.getByLabel('Selected boundary point').selectOption('2');
  await expect(page.getByLabel('Selected point X in feet')).toHaveValue('17');await expect(page.getByLabel('Selected point Y in feet')).toHaveValue('13');expect(problems).toEqual([]);
});

test('@phone drags a boundary point by touch and leaves the page scrollable',async({page})=>{
  const problems=await openDesigner(page);await planTool(page,'Shape & points');
  const point=page.getByRole('button',{name:'Main deck point 3',exact:true});
  await point.scrollIntoViewIfNeeded();
  // Complete navigation scrolling before measuring a touch target or page movement.
  await expect.poll(async()=>{const before=await page.evaluate(()=>window.scrollY);await page.waitForTimeout(150);return Math.abs((await page.evaluate(()=>window.scrollY))-before);}).toBe(0);
  const b=(await point.boundingBox())!,x=b.x+b.width/2,y=b.y+b.height/2;
  const cdp=await page.context().newCDPSession(page),start=await page.evaluate(()=>window.scrollY);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  expect(await page.evaluate(()=>window.scrollY),'page stays still when the handle takes focus').toBe(start);
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+24*i/8,y:y+30*i/8}]});
  expect(await page.evaluate(()=>window.scrollY),'page stays still during the drag').toBe(start);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await page.evaluate(()=>window.scrollY)).toBe(start);await expect(preview(page).locator('.dd-boundary-notice')).toContainText('updated');
  await expand(preview(page),'Fine adjust a point');expect(Number(await page.getByLabel('Selected point X in feet').inputValue())).toBeGreaterThan(16);expect(Number(await page.getByLabel('Selected point Y in feet').inputValue())).toBeGreaterThan(12);
  await fileTools(page).getByRole('button',{name:'Undo'}).click();await expect(page.getByLabel('Selected point X in feet')).toHaveValue('16');
  // An ordinary swipe on the page margin still scrolls after editing.
  await page.evaluate(()=>window.scrollTo({top:100,behavior:'instant'}));
  const beforeSwipe=await page.evaluate(()=>window.scrollY);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:2,y:440}]});
  for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:2,y:440-240*i/8}]});await page.waitForTimeout(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(beforeSwipe+80);expect(problems).toEqual([]);
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
  await showOpenings(page);
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
  const before=await (await price(page)).textContent();
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
  await expect((await price(page))).toHaveText(before??'');
  await page.waitForTimeout(800);// autosave runs 450 ms after the last change
  await page.reload();
  const again=await openExterior(page);
  await expect(again.getByRole('group',{name:'House cladding'}).getByRole('button',{name:'Cedar shakes'})).toHaveAttribute('aria-pressed','true');
  await again.getByRole('button',{name:'Roof',exact:true}).click();
  await expect(again.getByRole('group',{name:'Roof finish'}).getByRole('button',{name:'Slate'})).toHaveAttribute('aria-pressed','true');
  await expect((await price(page))).toHaveText(before??'');
  expect(problems).toEqual([]);
});

test('finishes one wall with its own cladding and a wainscot, dresses the house in a look, and keeps both after a reload',async({page})=>{
  const problems=await openDesigner(page);
  const before=await (await price(page)).textContent();
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
  await expect((await price(page))).toHaveText(before??'');
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
  await expect((await price(page))).toHaveText(before??'');
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
  const tools=fileTools(page);await openFiles(page);
  const [download]=await Promise.all([page.waitForEvent('download'),tools.getByRole('button',{name:'Save JSON'}).click()]);
  const file=info.outputPath('design.json');await download.saveAs(file);
  expect(JSON.parse(readFileSync(file,'utf8')).format).toBe('golden-maple-deck-design');
  await openSection(page,'Deck shape & size');await setNumber(page,'Deck width',30);
  await expect(size(page)).toContainText('30 × 12 ft');
  await openFiles(page);await tools.getByLabel('Import Golden Maple design JSON').setInputFiles(file);
  await expect(size(page)).toContainText('18 × 12 ft');
});

test('shares a link that reopens the design and keeps the visitor’s own',async({page})=>{
  await openDesigner(page);
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',24);
  await expect(size(page)).toContainText('24 × 12 ft');
  const tools=fileTools(page);await openFiles(page);
  await tools.getByRole('button',{name:'Share link'}).click();
  const link=await tools.getByLabel('Link to this design').inputValue();
  expect(link).toMatch(/\/deck-designer\/?#d=1[zj]/);
  await expect(tools).toContainText('Your name and project address are not included');
  // Sharing closes the section so the file menu can open. The width field is in that section.
  await openSection(page,'Deck shape & size');
  await setNumber(page,'Deck width',30);
  await expect(size(page)).toContainText('30 × 12 ft');
  await page.waitForTimeout(800);
  await page.goto(link);await openFiles(page);
  await expect(size(page)).toContainText('24 × 12 ft');
  await expect(tools).toContainText('shared with you');
  await expect(page).not.toHaveURL(/#d=/);
  await tools.getByRole('button',{name:'Go back to my own design'}).click();
  await expect(size(page)).toContainText('30 × 12 ft');
});

test('sends a design to Golden Maple and hands the link to booking',async({page})=>{
  await openDesigner(page);
  // The branded proposal rides along as a multipart file (ATTACH_PROPOSAL_PDF); a plain post is the fallback.
  // Only a local post is intercepted, so the test can never reach the live form service.
  let posted='',postedOrigin='',pdf:{name:string;type:string;head:string;size:number}|null=null;
  await page.route(url=>['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.pathname==='/',async route=>{
    const request=route.request();
    if(request.method()!=='POST')return route.continue();
    postedOrigin=new URL(request.url()).origin;
    const type=request.headers()['content-type']??'';
    if(type.startsWith('multipart/form-data')){
      const form=await new Response(request.postDataBuffer(),{headers:{'content-type':type}}).formData(),text=new URLSearchParams();
      for(const [key,value] of form.entries()){
        if(typeof value==='string')text.append(key,value);
        else pdf={name:value.name,type:value.type,size:value.size,head:new TextDecoder().decode((await value.arrayBuffer()).slice(0,5))};
      }
      posted=text.toString();
    }else posted=request.postData()??'';
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
  expect(postedOrigin).toBe(new URL(page.url()).origin);
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
  // "One click sends the branded proposal": the sent design carries the proposal PDF itself.
  expect(pdf).toMatchObject({name:'golden-maple-deck-proposal.pdf',type:'application/pdf',head:'%PDF-'});
  expect(pdf!.size).toBeGreaterThan(20_000);
  await dialog.getByRole('link',{name:'Book a call'}).click();
  await expect(page).toHaveURL(/\/book/);
  expect(await page.evaluate(()=>(history.state?.usr?.bookingNotes as string|undefined)??'')).toContain('#d=1');
});

test('opens the proposal: a 3D cover and views, features, finishes, the site plan, the investment with its quote tags, next steps and the appendix',async({page})=>{
  test.setTimeout(180_000*PROPOSAL_WAIT);
  const problems=await openDesigner(page);
  const priced=wholeDollars(await (await price(page)).textContent());
  const dialog=await openProposal(page);
  // The cover, in the Golden Maple estimate branding: the 3D hero in daylight (no lights yet), the wordmark, the
  // document honestly named, the project (by its size: no name was given) and the price-book stamp.
  const cover=proposalSheet(page,'Cover');
  await expect(cover.getByRole('heading',{level:2})).toHaveText('16 × 12 ft Deck');
  await expect(cover.getByRole('img',{name:'3D view of the proposed deck, corner view'})).toBeVisible();
  for(const words of ['Golden Maple','Landscaping','Deck design · Planning estimate','Design proposal','Corner view · Design illustration','Price book'])await expect(cover).toContainText(words);
  await expect(cover).not.toContainText('Prepared for');
  await expect(proposalSheet(page,'Views').getByRole('img')).toHaveCount(2);
  await expect(proposalSheet(page,'Views')).toContainText('Front view');
  await expect(proposalSheet(page,'Lighting & features')).toContainText('The deck');
  await expect(proposalSheet(page,'Materials & finishes')).toContainText('Colours vary by screen; confirm with samples.');
  await expect(proposalSheet(page,'Site plan').getByRole('img',{name:'Site plan: the deck against the house'})).toBeVisible();
  // The investment: the price schedule's priced subtotal, before HST; quotes tagged, never $0.
  const invest=proposalSheet(page,'Investment');
  await expect(invest).toContainText('Planning estimate before HST');
  // Every numbered sheet has the running head and the contact footer with its page number.
  await expect(invest.locator('.dd-proposal-runhead')).toContainText('Golden Maple Landscaping');
  await expect(invest.locator('.dd-proposal-foot')).toContainText('(705) 300-8015');
  await expect(invest.locator('.dd-proposal-pageno')).toHaveText(/^Page 0\d$/);
  await expect(invest).toContainText('Not a final quote: measurements, connections and engineering are confirmed on site.');
  const subtotal=invest.getByRole('row').filter({has:page.getByRole('rowheader',{name:/^Priced subtotal/})}).getByRole('cell');
  expect(wholeDollars(await subtotal.textContent())).toBe(priced);
  await expect(invest.getByRole('region',{name:'Still to be quoted'}).getByRole('listitem').first()).toContainText('Supplier quote');
  const words=await dialog.textContent();
  expect(words).not.toMatch(ZERO);
  expect(words).not.toContain('Not provided');
  await expect(proposalSheet(page,'Next steps')).toContainText('Call or text Sophie, our AI receptionist, at (705) 300-8015');
  for(const part of ['Confirm before construction','Construction plan','Material and hardware list'])await expect(proposalSheet(page,'Appendix')).toContainText(part);
  // Printed: only the sheets, each exactly one Letter page.
  await page.emulateMedia({media:'print'});
  await expect(dialog.getByRole('button',{name:'Print / save as PDF'})).toBeHidden();
  expect(await proposalPages(page).evaluateAll(els=>els.map(el=>Math.round(el.getBoundingClientRect().height)))).toEqual(Array(await proposalPages(page).count()).fill(1056));
  await page.emulateMedia({media:'screen'});
  // Escape closes it; the drawing is back on the plan the visitor had.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Plan',exact:true})).toHaveAttribute('aria-selected','true');
  expect(problems).toEqual([]);
});

test('puts a lit design at night on the proposal cover, then gives the visitor back their view and design',async({page})=>{
  test.setTimeout(180_000*PROPOSAL_WAIT);
  const problems=await openDesigner(page);
  await viewTab(page,'3D');
  await page.getByRole('group',{name:'Day or night preview'}).getByRole('button',{name:'Night'}).click();
  await page.getByRole('button',{name:'Add post & step lights'}).click();
  await page.getByRole('group',{name:'Camera'}).getByRole('button',{name:'Front',exact:true}).click();
  const priced=await (await price(page)).textContent(),changed=await withSchedule(page,()=>changes(page).count());
  await openProposal(page);
  await expect(proposalSheet(page,'Cover').getByRole('img',{name:'3D view of the proposed deck, corner view at night'})).toBeVisible();
  await expect(proposalSheet(page,'Views').getByRole('img')).toHaveCount(3);
  await expect(proposalSheet(page,'Views')).toContainText('Corner view by day');
  await expect(proposalSheet(page,'Lighting & features')).toContainText('Railing posts:');
  await proposalDialog(page).getByRole('button',{name:'Close'}).click();
  // The pictures changed nothing: the visitor's camera and night view are back, with the same price and changes.
  await expect(page.getByRole('group',{name:'Camera'}).getByRole('button',{name:'Front',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('group',{name:'Day or night preview'}).getByRole('button',{name:'Night'})).toHaveAttribute('aria-pressed','true');
  await expect((await price(page))).toHaveText(priced??'');
  await withSchedule(page,async()=>{ await expect(changes(page)).toHaveCount(changed); });
  expect(problems).toEqual([]);
});

/**
 * The photographic renderer (Real Life G1) at its heaviest: night, post and step lights, a glass railing. Every
 * compiled shader stays within the GPU's texture units (each shadow-casting light takes one in every lit material),
 * none fails to compile, and the renderer never falls back to the plain one. KNOWN_CONSOLE lets THREE. messages
 * through, so those are watched for here on their own.
 */
test('draws the 3D view at night with lights and glass, within the GPU’s texture units and without a shader error',async({page})=>{
  test.setTimeout(150_000);
  const shaderProblems:string[]=[];
  page.on('console',m=>{if(/Shader Error|WebGLProgram|photographic renderer failed|capture drew without effects/.test(m.text()))shaderProblems.push(m.text().slice(0,300));});
  // three announces each renderer it makes to window.__THREE_DEVTOOLS__, which is how the test reaches the live one.
  await page.addInitScript(()=>{const w=window as unknown as {__THREE_DEVTOOLS__:EventTarget;__renderers:unknown[]};w.__renderers=[];w.__THREE_DEVTOOLS__=new EventTarget();w.__THREE_DEVTOOLS__.addEventListener('observe',e=>{const d=(e as CustomEvent).detail;if(d?.isWebGLRenderer)w.__renderers.push(d);});});
  const problems=await openDesigner(page);
  await openSection(page,'Stairs & railings');
  await page.getByLabel('Railing style',{exact:true}).selectOption('Glass Panels');
  await viewTab(page,'3D');
  await page.getByRole('group',{name:'Day or night preview'}).getByRole('button',{name:'Night'}).click();
  await page.getByRole('button',{name:'Add post & step lights'}).click();
  const canvas=viewer3d(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({timeout:20000});
  await page.waitForTimeout(4000);// every light's shader compiles on the next frames
  const units=await page.evaluate(()=>{
    type Program={program:WebGLProgram};
    const renderer=(window as unknown as {__renderers:{getContext:()=>WebGL2RenderingContext;info:{programs:Program[]|null}}[]}).__renderers.at(-1)!;
    const gl=renderer.getContext(),samplers=new Set<number>([gl.SAMPLER_2D,gl.SAMPLER_CUBE,gl.SAMPLER_3D,gl.SAMPLER_2D_SHADOW,gl.SAMPLER_2D_ARRAY,gl.SAMPLER_2D_ARRAY_SHADOW,gl.SAMPLER_CUBE_SHADOW,gl.INT_SAMPLER_2D,gl.UNSIGNED_INT_SAMPLER_2D]);
    let worst=0;
    for(const {program} of renderer.info.programs??[]){let used=0;for(let i=0,n=gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i<n;i++){const u=gl.getActiveUniform(program,i);if(u&&samplers.has(u.type))used+=u.size;}worst=Math.max(worst,used);}
    return {worst,limit:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number,programs:renderer.info.programs?.length??0};
  });
  expect(units.programs).toBeGreaterThan(5);
  expect(units.worst).toBeLessThanOrEqual(Math.min(16,units.limit));
  expect(shaderProblems).toEqual([]);
  expect(problems).toEqual([]);
});

/**
 * Night lighting at its heaviest (lighting plan L1): a cap light and a post light on every post and three under-step
 * lights on every 8 ft step, plus house and path lights. Step and post lights all light through the fixture light
 * texture instead of real three lights, so every compiled shader stays within the GPU's texture units and none fails
 * to compile; the lens glows are drawn, and go with the preview lights.
 */
test('lights a heavily lit design at night within the GPU’s texture units, and the glows go with the preview lights',async({page})=>{
  test.setTimeout(150_000);
  const shaderProblems:string[]=[];
  page.on('console',m=>{if(/Shader Error|WebGLProgram|FRAGMENT|VERTEX/.test(m.text()))shaderProblems.push(m.text().slice(0,300));});
  const design={format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:{height:48,stairWidth:96,sceneLighting:'Evening',lightingPreviewOn:true,
    lightingSystem:{wireDistance:40,selectedItems:[{productId:'puck',qty:30,zone:'posts'},{productId:'wedge',qty:30,zone:'posts'},{productId:'evo_hyde',qty:30,zone:'stairs'},{productId:'blink',qty:4,zone:'house'},{productId:'liv',qty:6,zone:'landscape'},{productId:'hub100',qty:2}]}}};
  // three announces each renderer and scene it makes to window.__THREE_DEVTOOLS__, which is how the test reaches them.
  await page.addInitScript(text=>{
    try{localStorage.setItem('golden-maple.deck-studio.deck-only.v1',text);}catch{}
    const w=window as unknown as {__THREE_DEVTOOLS__:EventTarget;__renderers:unknown[];__scenes:unknown[]};w.__renderers=[];w.__scenes=[];w.__THREE_DEVTOOLS__=new EventTarget();
    w.__THREE_DEVTOOLS__.addEventListener('observe',e=>{const d=(e as CustomEvent).detail;if(d?.isWebGLRenderer)w.__renderers.push(d);if(d?.isScene)w.__scenes.push(d);});
  },JSON.stringify(design));
  const problems=await openDesigner(page);
  await viewTab(page,'3D');
  const canvas=viewer3d(page);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({timeout:20000});
  await page.waitForTimeout(4000);// every material's shader compiles on the next frames
  const scene=()=>page.evaluate(()=>{
    type Obj={name:string;children:Obj[]};const scenes=(window as unknown as {__scenes:Obj[]}).__scenes;
    const names:string[]=[];const walk=(o:Obj)=>{names.push(o.name);o.children.forEach(walk);};scenes.forEach(walk);
    return {glows:names.includes('fixture-lens-glows'),steps:names.filter(n=>/^evo_hyde-\d+$/.test(n)).length,posts:names.filter(n=>/^wedge-\d+$/.test(n)).length,realLights:names.filter(n=>/-(surface|area)-illumination$/.test(n)).length};
  });
  const lit=await scene();
  expect(lit.glows).toBe(true);
  expect(lit.steps).toBeGreaterThan(8);
  expect(lit.posts).toBeGreaterThan(8);
  expect(lit.realLights).toBeLessThanOrEqual(16);
  const units=await page.evaluate(()=>{
    type Program={program:WebGLProgram};
    const renderer=(window as unknown as {__renderers:{getContext:()=>WebGL2RenderingContext;info:{programs:Program[]|null}}[]}).__renderers.at(-1)!;
    const gl=renderer.getContext(),samplers=new Set<number>([gl.SAMPLER_2D,gl.SAMPLER_CUBE,gl.SAMPLER_3D,gl.SAMPLER_2D_SHADOW,gl.SAMPLER_2D_ARRAY,gl.SAMPLER_2D_ARRAY_SHADOW,gl.SAMPLER_CUBE_SHADOW,gl.INT_SAMPLER_2D,gl.UNSIGNED_INT_SAMPLER_2D]);
    let worst=0;
    for(const {program} of renderer.info.programs??[]){let used=0;for(let i=0,n=gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i<n;i++){const u=gl.getActiveUniform(program,i);if(u&&samplers.has(u.type))used+=u.size;}worst=Math.max(worst,used);}
    return {worst,limit:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number,programs:renderer.info.programs?.length??0};
  });
  expect(units.programs).toBeGreaterThan(5);
  expect(units.worst).toBeLessThanOrEqual(Math.min(16,units.limit));
  // A drawn night scene whose lit materials carry the fixture light (asserted on the renderer, never on pixels).
  const drawn=await page.evaluate(()=>{
    type Program={program:WebGLProgram};
    const r=(window as unknown as {__renderers:{getContext:()=>WebGL2RenderingContext;info:{render:{frame:number};programs:Program[]|null}}[]}).__renderers.at(-1)!,gl=r.getContext();
    const lit=(r.info.programs??[]).filter(({program})=>{for(let i=0,n=gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i<n;i++)if(gl.getActiveUniform(program,i)?.name==='fxData')return true;return false;}).length;
    return {frame:r.info.render.frame,lit};
  });
  expect(drawn.frame).toBeGreaterThan(0);
  expect(drawn.lit).toBeGreaterThan(0);
  await page.getByRole('switch',{name:/Preview lights/}).uncheck();
  await expect.poll(async()=>(await scene()).glows).toBe(false);
  expect(shaderProblems).toEqual([]);
  expect(problems).toEqual([]);
});

test('downloads the proposal as a multi-page PDF, from Proposal & files and from the proposal itself',async({page},info)=>{
  test.setTimeout(240_000*PROPOSAL_WAIT);
  await openDesigner(page);
  await openSection(page,'Proposal & files');
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:120_000*PROPOSAL_WAIT}),page.getByRole('button',{name:'Download PDF'}).click()]);
  expect(download.suggestedFilename()).toBe('golden-maple-deck-proposal.pdf');
  const file=info.outputPath('proposal.pdf');await download.saveAs(file);
  const bytes=readFileSync(file);
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  // Cover, views, features, finishes, site plan, investment, next steps and the appendix's three sheets.
  expect(pdfPages(bytes)).toBeGreaterThanOrEqual(10);
  // The 3D views, both plans, the logo and a swatch photo.
  expect(pdfImages(bytes)).toBeGreaterThanOrEqual(6);
  // From the proposal itself, with the pictures it already has.
  const dialog=await openProposal(page);
  const [again]=await Promise.all([page.waitForEvent('download',{timeout:120_000*PROPOSAL_WAIT}),dialog.getByRole('button',{name:'Download PDF'}).click()]);
  const second=info.outputPath('proposal-2.pdf');await again.saveAs(second);
  expect(pdfPages(readFileSync(second))).toBe(pdfPages(bytes));
});

test('opens on the site plan, and a desktop fetches the 3D viewer once the page settles without showing it',async({page})=>{
  const viewer=viewerRequests(page);
  const problems=await openDesigner(page);
  await expect(page.getByRole('tab',{name:'Plan',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(size(page)).toContainText('Site plan · 16 × 12 ft deck');
  await expect.poll(()=>viewer.length,{timeout:20_000}).toBeGreaterThan(0);
  await expect(plan(page)).toBeVisible();
  await expect(viewer3d(page)).toHaveCount(0);
  // The 3D sheet shows it at once.
  await viewTab(page,'3D');
  await expect(viewer3d(page)).toBeVisible({timeout:30_000});
  expect(problems).toEqual([]);
});

test('@phone never downloads the 3D viewer until the 3D tab is chosen',async({page})=>{
  const viewer=viewerRequests(page);
  const problems=await openDesigner(page);
  await expect(planHandle(page,'Deck depth, front edge')).toBeVisible();// the page is running
  await page.waitForTimeout(6000);// past the page's own prefetch, 4 s after it settles
  expect(viewer).toHaveLength(0);
  await expect(plan(page)).toBeVisible();
  await viewTab(page,'Framing');// the framing plan is a drawing too
  await page.waitForTimeout(500);
  expect(viewer).toHaveLength(0);
  await viewTab(page,'3D');
  await expect.poll(()=>viewer.length,{timeout:20_000}).toBeGreaterThan(0);
  await expect(viewer3d(page)).toBeVisible({timeout:30_000});
  expect(problems).toEqual([]);
});

test('@phone keeps the price visible while editing and returns to the canvas without loading 3D',async({page})=>{
  const viewer=viewerRequests(page),problems=await openDesigner(page),bar=await phoneBar(page),before=await (await price(page)).textContent();
  // This workspace flow uses the new default editor; the shared legacy helper chooses Deck size for its sizing tests.
  await planTool(page,'Shape & points');
  await openSection(page,'Deck shape & size');await setNumber(page,'Deck width',20);
  await expect((await price(page))).not.toHaveText(before??'');await expect(preview(page)).toBeHidden();
  // The bar stays a strip at the foot of the screen: the amount beside the price schedule, the items still to quote and
  // the quote review, stacked, so at most 160 px tall.
  expect(await bar.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=window.innerHeight+1&&r.top>=window.innerHeight-160;})).toBe(true);
  await expect((await price(page))).toBeInViewport();
  await showCanvas(page);await expect(plan(page)).toBeVisible();await expect(size(page)).toContainText('20 × 12 ft');
  await expect(page.getByRole('group',{name:'Drawing navigation'})).toBeVisible();
  await page.waitForTimeout(6000);expect(viewer).toHaveLength(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await openSection(page,'Deck shape & size');await expect(page.getByLabel('Deck width',{exact:true})).toHaveValue('20');
  await expect(bar).toBeVisible();expect(problems).toEqual([]);
});

test('@phone fits the screen, with the send button in reach',async({page})=>{
  await openDesigner(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await openSection(page,'Proposal & files');
  const send=page.getByRole('region',{name:'Send your design to Golden Maple'}).getByRole('button',{name:'Send my design'});
  await expect(send).toBeVisible();
  await send.click();
  const dialog=page.getByRole('dialog',{name:'Send your design to Golden Maple'});
  await expect(dialog).toBeVisible();
  expect(await sendDialog(page).evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=window.innerWidth;})).toBe(true);
});
