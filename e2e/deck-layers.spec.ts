import {test,expect,type Page} from '@playwright/test';
import {filesSummary,savedConfiguration} from './nav';

/**
 * Layers outside Pro (S8): the homeowner page's file menu lists the design's layers with Show and Lock (the same
 * validated change, one undo step, that Pro's Layers control makes) and opens the full layers editor in Pools & backyard.
 */
const ready=(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as {deckcraft?:{read():{ready:boolean}}}).deckcraft?.read().ready??false),{timeout:60_000}).toBe(true);
const menu=(page:Page)=>page.locator('details.dd-workspace-files');
const fold=(page:Page)=>menu(page).locator('details.dd-layer-menu');
const layers=(page:Page)=>page.getByRole('group',{name:'Layers',exact:true});
const savedLayer=async(page:Page)=>((await savedConfiguration(page))?.editorOrganization?.layers?.[0]??{visible:true,locked:false}) as {visible:boolean;locked:boolean};

async function openLayers(page:Page){
  await page.goto('/deck-designer/');await ready(page);
  await filesSummary(page).click();
  await expect(fold(page).locator('summary')).toHaveText(/^Layers \(1\)/);
  await fold(page).locator('summary').click();
  await expect(layers(page)).toBeVisible();
}

test('shows and locks layers from the file menu as one undo step each',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await openLayers(page);
  // A new design has one layer with nothing on it, so the fold says what Show and Lock would act on.
  await expect(layers(page)).toContainText('Nothing is on a layer yet');
  const design=layers(page).getByRole('listitem').filter({hasText:'Design'});
  await design.getByRole('checkbox',{name:'Show'}).uncheck();
  await expect(fold(page).locator('summary')).toContainText('1 hidden');
  await design.getByRole('checkbox',{name:'Lock'}).check();
  await expect(fold(page).locator('summary')).toContainText('1 locked');
  await expect.poll(()=>savedLayer(page)).toEqual(expect.objectContaining({visible:false,locked:true}));
  const undo=page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo'});
  await undo.click();
  await expect(fold(page).locator('summary')).not.toContainText('locked');
  await undo.click();
  await expect(fold(page).locator('summary')).toHaveText(/^Layers \(1\)$/);
  await expect.poll(()=>savedLayer(page)).toEqual(expect.objectContaining({visible:true,locked:false}));
});

test('opens the full layers editor in Pools & backyard and puts the menu away',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await openLayers(page);
  await layers(page).getByRole('button',{name:'Manage layers & groups…'}).click();
  await expect(menu(page)).not.toHaveAttribute('open');
  const editor=page.locator('#dd-home-panel details.dd-advanced[open]').filter({has:page.locator('summary',{hasText:'Layers, groups'})});
  await expect(editor).toBeVisible();
  await expect(editor.locator('summary')).toBeFocused();
});

test('waits for a slow Pools & backyard and still lands on the full layers editor',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  // The full editor's code arrives late, as on a phone on mobile data.
  let held=0;
  await page.route('**/OrganizationEditor*',async route=>{held++;await new Promise(r=>setTimeout(r,2500));await route.continue();});
  await openLayers(page);
  await layers(page).getByRole('button',{name:'Manage layers & groups…'}).click();
  // While it loads, the focus waits on the menu's opener rather than falling to the page.
  await expect(filesSummary(page)).toBeFocused();
  const summary=page.locator('#dd-home-panel details.dd-advanced[open] summary',{hasText:'Layers, groups'});
  await expect(summary).toBeFocused({timeout:15_000});
  expect(held).toBeGreaterThan(0);
});

test('a phone reaches the layers from the file menu with full-size controls @phone',async({page})=>{
  await openLayers(page);
  const width=page.viewportSize()!.width;
  for(const control of [layers(page).getByRole('checkbox',{name:'Show'}),layers(page).getByRole('checkbox',{name:'Lock'}),layers(page).getByRole('button',{name:'Manage layers & groups…'})]){
    const row=(await control.evaluate(el=>{const r=(el.closest('label,button') as HTMLElement).getBoundingClientRect();return {x:r.x,right:r.right,height:r.height};}));
    expect(row.height).toBeGreaterThanOrEqual(44);
    expect(row.x).toBeGreaterThanOrEqual(0);
    expect(row.right).toBeLessThanOrEqual(width);
  }
  await layers(page).getByRole('button',{name:'Manage layers & groups…'}).click();
  await expect(page.locator('#dd-home-panel details.dd-advanced[open] summary',{hasText:'Layers, groups'})).toBeVisible();
});
