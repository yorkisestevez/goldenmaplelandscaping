import {mkdirSync} from 'node:fs';
import {expect,type Page} from '@playwright/test';

/** Owner proof shots live beside the checkout. This VM cannot create that folder, so fall back inside the run. */
export function proofDir(name:string){
  for(const dir of [`../outputs/${name}`,`test-results/outputs/${name}`]){
    try{mkdirSync(dir,{recursive:true});return dir;}catch{/* parent not writable */}
  }
  throw Error(`Cannot create proof directory ${name}`);
}

/** Durable autosave. New saves commit in IndexedDB; localStorage is only the legacy migration source. */
export async function savedConfiguration(page:Page){
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('golden-maple.deckcraft-projects.v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});
    try{
      const json=await new Promise<string|null>((resolve,reject)=>{const request=db.transaction('projects','readonly').objectStore('projects').get('current');request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result?.json??null);});
      return json?JSON.parse(json).configuration:undefined;
    }finally{db.close();}
  });
}

/** Canvas-first drawing focus hides the task menus, the price bar and the job-tool buttons. */
export async function showProjectControls(page:Page){
  const toggle=page.locator('.dd-drawing-focus-toggle');
  await expect(toggle).toBeVisible();
  if(await toggle.getAttribute('aria-pressed')==='true')await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
}

const PLAN_TABS:Record<string,string>={
  'Deck size':'Building','Shape & points':'Building','Stairs':'Building','Patios & walls':'Building','House':'Building','Rails & screens':'Building',
  'Landscape':'Landscape','Board layout':'Materials','Inlays':'Materials','Select parts':'Main',
};

/** Picks a plan tool, opening its category tab when that radio is not on the current ribbon. */
export async function pickPlanTool(page:Page,name:string){
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

/** Opens a design-task section from its menu. The menu closes after the choice. */
export async function openDesignTask(page:Page,name:string){
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
