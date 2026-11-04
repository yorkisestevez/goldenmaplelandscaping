import {test,expect} from '@playwright/test';
import {proofDir} from './nav';
import {choose,design,field,fileMenu,group,open,panel,pick,picks,ready,shell,sheet,topBar,rail} from './next-ui';

// The new look (docs/deckcraft/ui-redesign-2026-10/PLAN.md, slice S1): `?ui=next` swaps the homeowner screens for a
// full-bleed scene with a top bar, a five-group rail, a docked panel and a price pill, remembered on the device until
// `?ui=classic`. The design, its sections and their editors are the same ones the classic page uses.
const shots=proofDir('deckcraft-next-shell');
test.beforeEach(async({page})=>{await page.setViewportSize({width:1440,height:900});});

test('the classic page stays the default until the new look is asked for',async({page,context})=>{
 await open(page,context,'/deck-designer/');
 await expect(page.getByRole('tablist',{name:'Design',exact:true})).toBeVisible();
 await expect(shell(page)).toHaveCount(0);
});

test('the new look puts the scene first with a top bar, a rail and the price',async({page,context})=>{
 await open(page,context);
 await expect(shell(page)).toHaveCount(1);
 await expect(page.getByRole('link',{name:'Golden Maple home'})).toBeVisible();
 await expect(page.getByRole('heading',{level:1})).toHaveText('Draw your deck on your house.');
 for(const name of ['3D','Plan','Framing'])await expect(sheet(page,name)).toBeVisible();
 await expect(fileMenu(page)).toBeVisible();
 for(const name of ['Undo','Redo','Send my design'])await expect(topBar(page).getByRole('button',{name,exact:true})).toBeVisible();
 await expect(rail(page).getByRole('button')).toHaveText(['Shape','Boards','Stairs','Yard','Extras']);
 await expect(page.getByRole('region',{name:'Live price'})).toBeVisible();
 // The classic navigation is gone: no four tabs, no old price bar.
 await expect(page.getByRole('tablist',{name:'Design',exact:true})).toHaveCount(0);
 await expect(page.locator('.dd-workspace-price')).toHaveCount(0);
 // The scene fills the window under the floating controls.
 const canvas=(await page.locator('#deck-live-preview .dd-canvas').boundingBox())!;
 expect(canvas.width).toBeGreaterThan(1400);
 expect(canvas.height).toBeGreaterThan(820);
 await page.screenshot({path:`${shots}/desktop-start.png`,animations:'disabled'});
});

test('each rail group docks its sections beside the scene, with their full editors',async({page,context})=>{
 await open(page,context);
 const groups:[string,string[]][]=[['Shape',['Deck shape & size','House']],['Boards',['Boards & finish']],['Stairs',['Stairs & railings']],['Yard',['Backyard']],['Extras',['Lighting','Privacy, skirting & extras','Site & foundation']]];
 for(const [name,sections] of groups){
  await group(page,name).click();
  await expect(group(page,name)).toHaveAttribute('aria-pressed','true');
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('heading',{level:2})).toHaveText(name);
  // Quick picks come first; the sections wait, folded, under More.
  await expect(panel(page).locator('.dd-next-quick')).toBeVisible();
  await expect(panel(page).getByRole('heading',{level:3,name:'More',exact:true})).toBeVisible();
  for(const section of sections)await expect(panel(page).locator('.dd-home-row',{hasText:section})).toBeVisible();
  await expect(panel(page).locator('.dd-section-body')).toHaveCount(0);
  // Each section still opens its full editor, so nothing the classic page offers is missing.
  await panel(page).locator('.dd-home-row',{hasText:sections[0]}).click();
  await expect(panel(page).locator('.dd-section-body')).toBeVisible();
 }
 // The panel docks beside the rail without covering it.
 const railBox=(await rail(page).boundingBox())!,panelBox=(await panel(page).boundingBox())!;
 expect(panelBox.x).toBeGreaterThanOrEqual(railBox.x+railBox.width);
 await page.screenshot({path:`${shots}/desktop-extras.png`,animations:'disabled'});
 // Picking the open group again puts the panel away.
 await group(page,'Extras').click();
 await expect(panel(page)).toBeHidden();
 await expect(group(page,'Extras')).toHaveAttribute('aria-pressed','false');
});

test('Boards shows the deck in 3D, and the view switch changes sheets',async({page,context})=>{
 await open(page,context);
 await sheet(page,'Plan').click();
 await expect(sheet(page,'Plan')).toHaveAttribute('aria-selected','true');
 await group(page,'Boards').click();
 await expect(sheet(page,'3D')).toHaveAttribute('aria-selected','true');
 await sheet(page,'Framing').click();
 await expect(sheet(page,'Framing')).toHaveAttribute('aria-selected','true');
});

test('the price pill opens the quote, and Send opens the send dialog',async({page,context})=>{
 await open(page,context);
 await page.getByRole('region',{name:'Live price'}).getByRole('button',{name:/Planning estimate/}).click();
 await expect(panel(page).getByRole('heading',{level:2})).toHaveText('Your quote');
 await expect(panel(page).getByRole('list',{name:'Your design'})).toBeVisible();
 await expect(panel(page).getByRole('button',{name:'Price schedule'})).toBeVisible();
 await expect(panel(page).locator('.dd-home-row',{hasText:'Proposal & files'})).toBeVisible();
 await page.screenshot({path:`${shots}/desktop-quote.png`,animations:'disabled'});
 await panel(page).getByRole('button',{name:'Send my design'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
});

test('the file menu keeps every file action',async({page,context})=>{
 await open(page,context);
 await fileMenu(page).click();
 for(const name of ['Save JSON','Import design'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 await page.getByText('Portable site project & presentation').click();
 for(const name of ['Export project ZIP','Import project ZIP'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Link to this design|Share/}).first()).toBeVisible();
 await topBar(page).locator('summary',{hasText:'Start over'}).click();
 await expect(topBar(page).getByRole('button',{name:'Start a new design',exact:true})).toBeVisible();
});

test('the choice is remembered on the device until the classic look is asked for',async({page,context})=>{
 await open(page,context);
 await page.goto('/deck-designer/');await ready(page);
 await expect(shell(page)).toHaveCount(1);
 await page.goto('/deck-designer/?ui=classic');await ready(page);
 await expect(shell(page)).toHaveCount(0);
 await page.goto('/deck-designer/');await ready(page);
 await expect(shell(page)).toHaveCount(0);
});

// Slice S2: each group's quick picks make the same edits as the full editors under More.
test('Shape picks change the shape, size, connection and levels',async({page,context})=>{
 await open(page,context);
 await group(page,'Shape').click();
 await expect(picks(page,'Deck shape').getByRole('button')).toHaveText(['Rectangle','L-Shape','Multi-corner','Curved','Custom outline']);
 await choose(page,'Deck shape','L-Shape');
 await expect.poll(()=>field(page,'shape')).toBe('L-Shape');
 // One pick is one undo step.
 await topBar(page).getByRole('button',{name:'Undo',exact:true}).click();
 await expect.poll(()=>field(page,'shape')).toBe('Rectangle');
 await expect(pick(page,'Deck shape','Rectangle')).toHaveAttribute('aria-pressed','true');
 // The steppers step, and a tapped number is selected so typing replaces it.
 const width=picks(page,'Size').getByRole('textbox',{name:'Width',exact:true});
 await expect(width).toHaveValue('16');
 await pick(page,'Size','Increase width').click();
 await expect.poll(()=>field(page,'width')).toBe(17);
 await width.click();
 expect(await width.evaluate((el:HTMLInputElement)=>[el.selectionStart,el.selectionEnd])).toEqual([0,2]);
 await page.keyboard.type('20');await page.keyboard.press('Enter');
 await expect.poll(()=>field(page,'width')).toBe(20);
 // A number out of range is held to the full editor's limits.
 const height=picks(page,'Size').getByRole('textbox',{name:'Height',exact:true});
 await height.fill('400');await height.press('Enter');
 await expect.poll(()=>field(page,'height')).toBe(144);
 await choose(page,'How it connects','Freestanding');
 await expect.poll(()=>field(page,'deckType')).toBe('Freestanding');
 await choose(page,'Levels','2 levels');
 await expect.poll(()=>field(page,'levels')).toBe(2);
 await page.screenshot({path:`${shots}/quick-shape.png`,animations:'disabled'});
});

test('Boards picks change the collection, colour, layout, border and fasteners',async({page,context})=>{
 await open(page,context);
 await group(page,'Boards').click();
 const collections=picks(page,'Collection').getByRole('button');
 // Each collection is a photo swatch; picking one takes its first colour, as the full editor does.
 await expect(collections.first().locator('img')).toBeVisible();
 expect(await collections.count()).toBeGreaterThan(2);
 const colours=picks(page,'Colour').getByRole('button');
 const before=await field(page,'deckingMaterial');
 let picked=before;
 for(const name of await picks(page,'Collection').locator('button[aria-pressed="false"]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')!))){
  await choose(page,'Collection',name);
  picked=await field(page,'deckingMaterial');
  if(await colours.count()>1)break;
 }
 expect(picked).not.toBe(before);
 await expect(colours.first()).toHaveAttribute('aria-pressed','true');
 expect(await colours.first().getAttribute('aria-label')).toBe(await field(page,'deckingColor'));
 const second=(await colours.nth(1).getAttribute('aria-label'))!;
 await choose(page,'Colour',second);
 await expect.poll(()=>field(page,'deckingColor')).toBe(second);
 await expect(panel(page).locator('.dd-next-pick-label')).toHaveText(['Colour','Board layout','Border','Fasteners','Collection']);
 await choose(page,'Board layout','Diagonal');
 await expect.poll(()=>field(page,'pattern')).toBe('Diagonal');
 await choose(page,'Border','2 rows');
 await expect.poll(()=>field(page,'pictureFrameRows')).toBe(2);
 await choose(page,'Fasteners','Hidden');
 await expect.poll(()=>field(page,'fasteningSystem')).toBe('Hidden');
 await page.screenshot({path:`${shots}/quick-boards.png`,animations:'disabled'});
});

test('Stairs picks change the flights, layout, side, width and railing',async({page,context})=>{
 await open(page,context);
 await group(page,'Stairs').click();
 await choose(page,'Stair layout','Landing');
 await expect.poll(()=>field(page,'stairType')).toBe('Landing');
 // The mini plan offers the sides the house leaves open, in reading order; the house side is not one of them.
 await expect(picks(page,'Stair side').getByRole('button')).toHaveText(['Left','Right','Front']);
 await choose(page,'Stair side','Left');
 await expect.poll(()=>field(page,'stairPosition')).toBe('Left');
 await pick(page,'Stair width','Increase stair width').click();
 await expect.poll(()=>field(page,'stairWidth')).toBe(54);
 await expect(picks(page,'Railing').getByRole('button')).toHaveCount(9);
 await choose(page,'Railing','Cable');
 await expect.poll(()=>field(page,'railingType')).toBe('Cable');
 await page.screenshot({path:`${shots}/quick-stairs.png`,animations:'disabled'});
 await expect(pick(page,'Stairs','No stairs')).toHaveText('No stairs');
 await choose(page,'Stairs','No stairs');
 await expect.poll(()=>field(page,'stairFlights')).toBe(0);
 await expect(picks(page,'Stair layout')).toHaveCount(0);
});

test('Yard picks add features, open the plan tools and set the allowances',async({page,context})=>{
 await open(page,context);
 await group(page,'Yard').click();
 await pick(page,'Add to the yard','Add a patio').click();
 await expect.poll(async()=>((await field(page,'yardFeatures'))??[]).map((f:{kind:string})=>f.kind)).toEqual(['patio']);
 await choose(page,'Fire pit','Gas');
 await expect.poll(async()=>(await field(page,'yardAllowances'))?.firePit).toBe('gas');
 // Turning the last allowance off leaves the design as one without allowances.
 await choose(page,'Fire pit','None');
 await expect.poll(()=>field(page,'yardAllowances')).toBeUndefined();
 await page.screenshot({path:`${shots}/quick-yard.png`,animations:'disabled'});
 await pick(page,'Draw on the plan','Landscape areas').click();
 await expect(sheet(page,'Plan')).toHaveAttribute('aria-selected','true');
 await expect(page.getByRole('radio',{name:'Landscape',exact:true})).toBeChecked();
});

test('Extras picks light the deck, add a screen, add demolition and pick the foundation',async({page,context})=>{
 await open(page,context);
 await group(page,'Extras').click();
 await expect(picks(page,'Draw on the plan')).toHaveCount(0);
 await expect(pick(page,'Around the deck',/^Add a privacy screen/)).toHaveText('Add a privacy screen');
 await choose(page,'Deck lighting',/^Step lights/);
 await expect.poll(async()=>(await field(page,'autoLighting'))?.stairs).toBe(true);
 await choose(page,'Deck lighting',/^Post lights/);
 await expect.poll(async()=>(await field(page,'autoLighting'))?.posts).toBe(true);
 await pick(page,'Around the deck',/^Add a privacy screen/).click();
 await expect.poll(async()=>((await field(page,'privacyScreens'))??[]).length).toBe(1);
 await choose(page,'Around the deck','Remove an existing deck');
 await expect.poll(()=>field(page,'hasDemo')).toBe(true);
 await choose(page,'Foundation','Helical Piles');
 await expect.poll(()=>field(page,'foundation')).toBe('Helical Piles');
 await page.screenshot({path:`${shots}/quick-extras.png`,animations:'disabled'});
});

// Review fixes and gaps (S2).
test('a group opens folded when a plan tool or Start over brought it forward',async({page,context})=>{
 await open(page,context);
 // A plan tool that belongs to Shape brings that group forward while the panel is shut.
 await page.getByRole('radio',{name:'Shape & points',exact:true}).click();
 await group(page,'Shape').click();
 await expect(panel(page).locator('.dd-next-quick')).toBeVisible();
 await expect(panel(page).locator('.dd-section-body')).toHaveCount(0);
 // A new design keeps the groups folded too.
 await group(page,'Shape').click();
 await fileMenu(page).click();
 await topBar(page).locator('summary',{hasText:'Start over'}).click();
 await topBar(page).getByRole('button',{name:'Start a new design',exact:true}).click();
 await expect.poll(()=>field(page,'width')).toBe(16);
 await group(page,'Shape').click();
 await expect(panel(page).locator('.dd-next-quick')).toBeVisible();
 await expect(panel(page).locator('.dd-section-body')).toHaveCount(0);
});

test('tapping the current railing again keeps a manufacturer railing',async({page,context})=>{
 await open(page,context);
 await group(page,'Stairs').click();
 await panel(page).locator('.dd-home-row',{hasText:'Stairs & railings'}).click();
 const system=panel(page).getByRole('combobox',{name:'Manufacturer railing system',exact:true});
 const id=(await system.locator('option').nth(1).getAttribute('value'))!;
 await system.selectOption(id);
 await expect.poll(()=>field(page,'catalogueRailingId')).toBe(id);
 const base=await field(page,'railingType');
 await expect(pick(page,'Railing',base)).toHaveAttribute('aria-pressed','true');
 await pick(page,'Railing',base).click();
 expect(await field(page,'catalogueRailingId')).toBe(id);
 await expect(system).toHaveValue(id);
});

test('a stepper keeps a typed number as typed, and tabbing through it changes nothing',async({page,context})=>{
 await open(page,context);
 await group(page,'Shape').click();
 const width=picks(page,'Size').getByRole('textbox',{name:'Width',exact:true});
 await width.fill('12.125');await width.press('Enter');
 await expect.poll(()=>field(page,'width')).toBe(12.125);
 await width.focus();await width.press('Tab');
 expect(await field(page,'width')).toBe(12.125);
 // A comma reads as a decimal point, and the arrow keys step.
 await width.fill('14,5');await width.press('Enter');
 await expect.poll(()=>field(page,'width')).toBe(14.5);
 await width.focus();await width.press('ArrowUp');
 await expect.poll(()=>field(page,'width')).toBe(15.5);
 // An arrow key steps from a number still being typed.
 await width.fill('20');await width.press('ArrowDown');
 await expect.poll(()=>field(page,'width')).toBe(19);
 // At its limit the button keeps the focus and does nothing.
 const height=picks(page,'Size').getByRole('textbox',{name:'Height',exact:true});
 await height.fill('144');await height.press('Enter');
 const up=pick(page,'Size','Increase height');
 await expect(up).toHaveAttribute('aria-disabled','true');
 // Playwright will not click an aria-disabled button unless forced; a visitor can.
 await up.click({force:true});
 await expect(up).toBeFocused();
 expect(await field(page,'height')).toBe(144);
});

test('Shape picks lock where the full editor locks, and a locked choice stays readable',async({page,context})=>{
 await open(page,context);
 await group(page,'Shape').click();
 await choose(page,'Deck shape','Custom outline');
 // A locked number names its reason, as the full editor's fields do.
 for(const name of [/^Width Set by the outline$/,/^Depth Set by the outline$/])await expect(picks(page,'Size').getByRole('textbox',{name})).toBeDisabled();
 for(const name of ['1 level','2 levels','3 levels'])await expect(pick(page,'Levels',name)).toBeDisabled();
 const [colour,background]=await pick(page,'Levels','1 level').evaluate(el=>{const s=getComputedStyle(el);return [s.color,s.backgroundColor];});
 expect(colour).toBe('rgb(255, 255, 255)');
 expect(background).not.toBe('rgb(20, 38, 28)');
});

test('a stair side follows that side, dropping an edge picked under More',async({page,context})=>{
 await open(page,context);
 await group(page,'Shape').click();
 await choose(page,'Deck shape','Custom outline');
 await group(page,'Stairs').click();
 await panel(page).locator('.dd-home-row',{hasText:'Stairs & railings'}).click();
 const edge=panel(page).getByRole('combobox',{name:'Stair edge',exact:true});
 await edge.selectOption({index:1});
 await expect.poll(()=>field(page,'stairEdgeId')).toBeTruthy();
 // While an edge is picked no side shows as current.
 await expect(picks(page,'Stair side').locator('button[aria-pressed="true"]')).toHaveCount(0);
 await choose(page,'Stair side','Right');
 await expect.poll(()=>field(page,'stairEdgeId')).toBeUndefined();
 await expect.poll(()=>field(page,'stairPosition')).toBe('Right');
 await expect(edge).toHaveValue('');
});

test('a new yard feature is the selected one, and the lights wait for a railing and stairs',async({page,context})=>{
 await open(page,context);
 await group(page,'Yard').click();
 await pick(page,'Add to the yard','Add a wall').click();
 await expect.poll(async()=>((await field(page,'yardFeatures'))??[]).length).toBe(1);
 const [wall]=await field(page,'yardFeatures');
 expect(wall.kind).toBe('retaining-wall');
 await panel(page).locator('.dd-home-row',{hasText:'Backyard'}).click();
 await expect(panel(page).getByRole('combobox',{name:'Selected yard feature',exact:true})).toHaveValue(wall.id);
 await group(page,'Stairs').click();
 await choose(page,'Railing','None');
 await choose(page,'Stairs','No stairs');
 await group(page,'Extras').click();
 await expect(pick(page,'Deck lighting',/^Post lights Add a railing$/)).toBeDisabled();
 await expect(pick(page,'Deck lighting',/^Step lights Add stairs$/)).toBeDisabled();
});

test('the mini plan keeps the house behind an attached deck whose back is open',async({page,context})=>{
 await open(page,context);
 await group(page,'Shape').click();
 // A wrap-around wing's end faces back, so Back becomes an open side while the deck stays fastened to the house.
 await panel(page).locator('.dd-home-row',{hasText:'Deck shape & size'}).click();
 await panel(page).getByRole('checkbox',{name:'Around the left corner',exact:true}).check();
 await expect.poll(async()=>!!(await field(page,'wrap'))?.left).toBe(true);
 await group(page,'Stairs').click();
 await expect(pick(page,'Stair side','Back')).toBeVisible();
 await expect(picks(page,'Stair side').locator('.dd-next-sides-house')).toBeVisible();
});

test('a shared design link opens the groups folded',async({page,context})=>{
 await open(page,context);
 await group(page,'Shape').click();
 await choose(page,'Deck shape','Custom outline');
 const share=await page.evaluate(()=>(window as any).deckcraft.execute({id:'share-folded',commands:[{type:'action',action:'share.create'}]}));
 expect(share.ok).toBe(true);
 // A fresh tab opens the link; a custom outline brings the Shape group forward with its plan tool.
 const visitor=await context.newPage();
 await visitor.setViewportSize({width:1440,height:900});
 await visitor.goto(share.result.url);await ready(visitor);
 await expect.poll(()=>visitor.evaluate(()=>(window as any).deckcraft.read().design.shape)).toBe('Custom');
 await group(visitor,'Shape').click();
 await expect(panel(visitor).locator('.dd-next-quick')).toBeVisible();
 await expect(panel(visitor).locator('.dd-section-body')).toHaveCount(0);
});
