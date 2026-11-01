import {expect,type Page,type BrowserContext} from '@playwright/test';

// The new look's page parts (docs/deckcraft/ui-redesign-2026-10/PLAN.md), shared by its desktop and phone specs.
export const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
export async function open(page:Page,context:BrowserContext,path='/deck-designer/?ui=next'){
 await context.addInitScript('window.__name=(t,v)=>t');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
 await page.goto(path);await ready(page);
}
export const shell=(page:Page)=>page.locator('.deck-designer[data-ui="next"]');
export const rail=(page:Page)=>page.getByRole('navigation',{name:'Design groups'});
export const group=(page:Page,name:string)=>rail(page).getByRole('button',{name,exact:true});
export const panel=(page:Page)=>page.locator('#dd-home-panel');
// The top bar sits inside the site's <main>, so it is not a banner landmark. Its file menu opens from a <summary>, which
// has no button role for Playwright.
export const topBar=(page:Page)=>page.locator('.dd-next-top');
export const fileMenu=(page:Page)=>topBar(page).locator('summary[aria-label="File menu"]');
export const sheet=(page:Page,name:string)=>page.getByRole('tablist',{name:'Drawing sheets'}).getByRole('tab',{name,exact:true});
export const price=(page:Page)=>page.getByRole('region',{name:'Live price'});

// The design as the agent interface reads it, and the quick picks (slice S2).
export const design=(page:Page)=>page.evaluate(()=>(window as any).deckcraft.read().design);
export const field=async(page:Page,key:string)=>(await design(page))[key];
export const picks=(page:Page,name:string)=>panel(page).getByRole('group',{name,exact:true});
// A RegExp name matches a button whose name also carries a count or a reason (the deck lights).
export const pick=(page:Page,groupName:string,name:string|RegExp)=>picks(page,groupName).getByRole('button',{name,exact:typeof name==='string'});
export async function choose(page:Page,groupName:string,name:string|RegExp){
 await pick(page,groupName,name).click();
 await expect(pick(page,groupName,name)).toHaveAttribute('aria-pressed','true');
}
