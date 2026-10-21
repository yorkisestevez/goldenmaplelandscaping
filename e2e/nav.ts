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

/** Canvas-first drawing focus hides the task menus; "All options" shows them. Designer Mode has no drawing focus. */
export async function showProjectControls(page:Page){
  if(await page.locator('.deck-designer[data-pro]').count())return;
  const toggle=page.locator('.dd-drawing-focus-toggle');
  await expect(toggle).toBeVisible();
  if(await toggle.getAttribute('aria-pressed')==='true')await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
}

/** The ribbon tab of each plan tool; Designer Mode's ribbon uses the same tab names. Select parts is a Designer Mode tool. */
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

/** The design inspector is a dialog over the drawing. Plan tools underneath it are not clickable until it is dismissed. */
export async function dismissDesignInspector(page:Page){
  const inspector=page.getByRole('dialog',{name:'Design inspector',exact:true});
  if(await inspector.isVisible()){
    await inspector.getByRole('button',{name:'Done · back to drawing',exact:true}).click();
    await expect(inspector).toBeHidden();
  }
}

/** Picks a plan tool, opening its category tab when that radio is not on the current ribbon. */
export async function pickPlanTool(page:Page,name:string){
  if(await page.locator('.deck-designer[data-pro]').count())return pickProTool(page,name);
  await dismissDesignInspector(page);
  const radio=page.getByRole('radio',{name,exact:true});
  if(!await radio.isVisible()){
    const tab=PLAN_TABS[name]??'Building';
    await page.getByRole('tablist',{name:'Tool categories'}).getByRole('tab',{name:tab,exact:true}).click();
  }
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked','true');
  return radio;
}

const TASK_GROUPS:Record<string,string>={
  'Deck shape & size':'Design','House':'Design','Boards & finish':'Design','Stairs & railings':'Design','Lighting':'Design',
  'Privacy, skirting & extras':'Build & landscape','Site & foundation':'Build & landscape','Backyard':'Build & landscape',
  'Proposal & files':'Your project',
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

/** Opens a design-task section from its menu. The menu closes after the choice, and the inspector dialog covers that menu until it is dismissed. */
export async function openDesignTask(page:Page,name:string){
  await dismissDesignInspector(page);
  await showProjectControls(page);
  const nav=page.getByRole('navigation',{name:'Design tasks'});
  const button=nav.getByRole('button',{name,exact:true});
  if(!await button.isVisible()){
    const group=TASK_GROUPS[name];
    if(!group)throw Error(`No design-task menu for ${name}`);
    await nav.locator('summary').filter({hasText:new RegExp(`^${group}$`)}).click();
  }
  await button.click();
}
