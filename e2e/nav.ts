import {mkdirSync} from 'node:fs';
import {expect,type Page} from '@playwright/test';

/** Owner proof shots live beside the checkout. `E2E_OUTPUTS` points that folder at a writable
 * directory (CI and this VM cannot create `/outputs`). Otherwise fall back inside the run. */
export function proofDir(name:string){
  const roots=process.env.E2E_OUTPUTS?[process.env.E2E_OUTPUTS]:['../outputs','test-results/outputs'];
  for(const dir of roots.map(root=>`${root}/${name}`)){
    try{mkdirSync(dir,{recursive:true});return dir;}catch{/* parent not writable */}
  }
  throw Error(`Cannot create proof directory ${name}`);
}

async function storedProjectJson(page:Page,slot:'current'|'jobs'){
  return page.evaluate(async slot=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('golden-maple.deckcraft-projects.v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});
    try{
      const json=await new Promise<string|null>((resolve,reject)=>{const request=db.transaction('projects','readonly').objectStore('projects').get(slot);request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result?.json??null);});
      return json?JSON.parse(json):undefined;
    }finally{db.close();}
  },slot);
}

/** Durable autosave. New saves commit in IndexedDB; localStorage is only the legacy migration source. */
export async function savedConfiguration(page:Page){
  return (await storedProjectJson(page,'current'))?.configuration;
}

/** Saved jobs commit in the same database. The old localStorage library is only the first-open migration source. */
export async function savedJobLibrary(page:Page){
  return storedProjectJson(page,'jobs');
}

/** The homeowner page has no task menus to show since its four tabs (Draw · Materials · Extras · Price & send) replaced the
 * rail and its "All options" toggle, so this waits for the tabs. Designer Mode keeps its own menus. */
export async function showProjectControls(page:Page){
  if(await page.locator('.deck-designer[data-pro]').count())return;
  await expect(homeTabs(page)).toBeVisible();
}

/** The homeowner's four tabs. */
export const homeTabs=(page:Page)=>page.getByRole('tablist',{name:'Design',exact:true});

/** Opens one of the homeowner's four tabs (a tab other than Draw also opens its panel). A design still loading (a share
 * link) puts the page back on Draw, and an open Files menu covers the tabs, so it waits for the one and closes the other. */
export async function openHomeTab(page:Page,name:'Draw'|'Materials'|'Extras'|'Price & send'){
  await expect.poll(()=>page.evaluate(()=>(window as {deckcraft?:{read():{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
  const files=page.locator('details.dd-workspace-files[open]');
  if(await files.count())await files.locator(':scope>summary').click();
  const tab=homeTabs(page).getByRole('tab',{name,exact:true});
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected','true');
  // The panel loads on demand: wait for it, so a caller that puts it away does not race it.
  if(name!=='Draw')await expect(page.locator('#dd-home-panel')).toBeVisible();
}

/** The homeowner tab that shows each plan tool (designer/homeTabs.ts). Select parts is a Designer Mode tool. */
const HOME_TOOL_TABS:Record<string,'Draw'|'Materials'|'Extras'>={
  'Deck size':'Draw','Shape & points':'Draw','Stairs':'Draw','House':'Draw','Rails & screens':'Draw',
  'Landscape':'Extras','Patios & walls':'Extras','Board layout':'Materials','Inlays':'Materials',
};

/** Designer Mode's ribbon tab of each plan tool. */
const PLAN_TABS:Record<string,string>={
  'Deck size':'Building','Shape & points':'Building','Stairs':'Building','House':'Building','Rails & screens':'Building',
  'Landscape':'Landscape','Patios & walls':'Landscape','Board layout':'Materials','Inlays':'Materials','Select parts':'Main',
};

/** Opens Designer Mode, which keeps the contractor tools the homeowner page leaves out. */
export async function openDesignerMode(page:Page,path='/deck-designer/?designer=1'){
  await page.goto(path);
  await expect(page.getByRole('menubar',{name:'Pro workspace menu'})).toBeVisible({timeout:60_000});
  await expect.poll(()=>page.evaluate(()=>(window as {deckcraft?:{read():{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
}

/** Opens a Designer Mode menu item, such as ('Tools', 'Agents…'). */
export async function proMenu(page:Page,menu:string,item:string|RegExp){
  await page.getByRole('menubar',{name:'Pro workspace menu'}).getByRole('menuitem',{name:menu,exact:true}).click();
  await page.getByRole('menu',{name:menu}).getByRole('menuitem',{name:item,exact:typeof item==='string'}).click();
}

/** Designer Mode picks plan tools from its quick-tools strip or its ribbon. */
async function pickProTool(page:Page,name:string){
  const quick=page.getByRole('group',{name:'Quick tools'}).getByRole('button',{name,exact:true});
  const button=await quick.count()?quick:page.locator('#dd-pro-ribbon-panel').getByRole('button',{name,exact:true});
  if(button!==quick&&!await button.isVisible())await page.getByRole('tablist',{name:'Ribbon tabs'}).getByRole('tab',{name:PLAN_TABS[name]??'Building',exact:true}).click();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  return button;
}

/** On phones the homeowner's tab panel is a drawer over the foot of the screen, so it is put away before using the plan.
 * A desktop docks it beside the drawing, where it stays. */
export async function dismissDesignInspector(page:Page){
  const panel=page.locator('#dd-home-panel');
  if((page.viewportSize()?.width??1280)<=800&&await panel.isVisible()){
    await panel.getByRole('button',{name:'Hide panel',exact:true}).click();
    await expect(panel).toBeHidden();
  }
}

/** The section id of each section (designer/sections.ts). */
const SECTION_IDS:Record<string,string>={
  'Deck shape & size':'deck','House':'house','Stairs & railings':'stairs','Boards & finish':'boards','Lighting':'lighting',
  'Privacy, skirting & extras':'extras','Backyard':'backyard','Site & foundation':'site','Proposal & files':'proposal',
};

/** Brings a section's tab and panel forward the way a link to it does (the agent's `section.open`), leaving the view as it
 * is. Picking Materials or Extras opens the 3D view, which CI's software WebGL draws slowly and which crowds out the work a
 * test is about; the tabs' own tests pick them (deck-home-tabs.spec.ts). */
async function revealSection(page:Page,id:string){
  await expect.poll(()=>page.evaluate(()=>(window as {deckcraft?:{read():{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
  const result=await page.evaluate(section=>(window as unknown as {deckcraft:{execute(r:unknown):Promise<{ok:boolean}>}}).deckcraft.execute({id:`nav-${section}-${Date.now()}`,commands:[{type:'section.open',section}]}),id);
  expect(result.ok,JSON.stringify(result)).toBe(true);
  await expect(page.locator('#dd-home-panel')).toBeVisible();
}

/** Shows a homeowner tab's plan tools: Draw from its tab; Materials and Extras brought forward as a link does, so the view
 * stays as it is; then the plan sheet when another view is showing. */
export async function showTabTools(page:Page,tab:'Draw'|'Materials'|'Extras'){
  if(tab==='Draw')await openHomeTab(page,'Draw');else await revealSection(page,tab==='Materials'?'boards':'lighting');
  if(!await page.getByRole('radiogroup',{name:'Plan tools'}).isVisible())await page.getByRole('tablist',{name:'Drawing sheets'}).getByRole('tab',{name:'Plan',exact:true}).click();
}

/** Picks a plan tool, showing its tab's tools first when they are not on screen. */
export async function pickPlanTool(page:Page,name:string){
  if(await page.locator('.deck-designer[data-pro]').count())return pickProTool(page,name);
  const radio=page.getByRole('radio',{name,exact:true});
  if(!await radio.isVisible())await showTabTools(page,HOME_TOOL_TABS[name]??'Draw');
  await dismissDesignInspector(page);
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked','true');
  return radio;
}

/** The homeowner tab whose panel holds each section (designer/homeTabs.ts). */
const SECTION_TABS:Record<string,'Draw'|'Materials'|'Extras'|'Price & send'>={
  'Deck shape & size':'Draw','House':'Draw','Stairs & railings':'Draw','Boards & finish':'Materials',
  'Lighting':'Extras','Privacy, skirting & extras':'Extras','Backyard':'Extras','Site & foundation':'Price & send','Proposal & files':'Price & send',
};

/** Opens Sketch. The plan-tool button is the homeowner path; Pro keeps the same dialog under Tools. */
export async function openSketch(page:Page){
  const button=page.getByRole('button',{name:'Sketch a design',exact:true});
  if(await button.isVisible())await button.click();
  else{
    await page.getByRole('menubar',{name:'Pro workspace menu'}).getByRole('menuitem',{name:'Tools',exact:true}).click();
    await page.getByRole('menu',{name:'Tools'}).getByRole('menuitem',{name:/^Sketch a design/}).click();
  }
  const modal=page.getByRole('dialog',{name:'Sketch a design',exact:true});
  await expect(modal).toBeVisible();
  return modal;
}

/** Measurements, the shape list and sketch files sit in this panel. It starts closed while drawing. */
export async function openSketchMeasurements(page:Page){
  const inspector=page.getByRole('dialog',{name:'Sketch a design',exact:true}).locator('details.dd-sketch-inspector');
  if(!await inspector.evaluate(el=>(el as HTMLDetailsElement).open))await inspector.locator('summary').first().click();
  await expect(inspector).toHaveJSProperty('open',true);
  return inspector;
}

/** Sketch files are nested inside the measurements panel. */
export async function openSketchFiles(page:Page){
  await openSketchMeasurements(page);
  const files=page.getByRole('dialog',{name:'Sketch a design',exact:true}).locator('details.dd-sketch-files');
  if(!await files.evaluate(el=>(el as HTMLDetailsElement).open))await files.locator('summary').click();
  return files;
}

/** Closes the measurements panel so canvas clicks are not swallowed by the shape list underneath it. */
export async function closeSketchMeasurements(page:Page){
  const inspector=page.getByRole('dialog',{name:'Sketch a design',exact:true}).locator('details.dd-sketch-inspector');
  if(await inspector.evaluate(el=>(el as HTMLDetailsElement).open))await inspector.locator('summary').first().click();
  await expect(inspector).toHaveJSProperty('open',false);
}

/** Opens a section in its tab's panel, then makes sure its row is expanded. Draw's panel opens from "Deck settings"; the
 * other tabs' sections open as a link opens them, so the view stays as it is. */
export async function openDesignTask(page:Page,name:string){
  const tab=SECTION_TABS[name];
  if(!tab)throw Error(`No homeowner tab holds ${name}`);
  const panel=page.locator('#dd-home-panel'),drawOpen=await homeTabs(page).getByRole('tab',{name:'Draw',exact:true}).getAttribute('aria-selected')==='true';
  if(tab!=='Draw')await revealSection(page,SECTION_IDS[name]);
  else if(!drawOpen||!await panel.isVisible()){
    await openHomeTab(page,'Draw');
    await page.getByRole('button',{name:'Deck settings',exact:true}).click();
  }
  const row=panel.locator('.dd-home-row').filter({has:page.locator('strong').getByText(name,{exact:true})});
  await expect(row).toBeVisible();
  if(await row.getAttribute('aria-expanded')!=='true')await row.click();
  await expect(row).toHaveAttribute('aria-expanded','true');
}
