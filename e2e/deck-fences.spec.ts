import {test,expect,type Page} from '@playwright/test';
import {openDesignTask,openDesignerMode,pickPlanTool,pricedSubtotal,railGroups,savedConfiguration,showSheet,startOnPlan} from './nav';

/**
 * Fences and gates (S9a): a fence added in Pools & backyard is priced at the standard installed rate (unconfirmed,
 * editable per user), drawn on the site plan with its posts and gates, saved with the design and undone in one step.
 */
const dollars=async(page:Page)=>Number((await pricedSubtotal(page).innerText()).replace(/[^\d.]/g,''));
const editor=(page:Page)=>page.locator('#dd-home-panel section.dd-fence-editor');
const summary=(page:Page)=>editor(page).getByLabel('Fence summary');

async function addFence(page:Page){
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/deck-designer/');await startOnPlan(page);
  await openDesignTask(page,'Backyard');
  await editor(page).getByRole('button',{name:'Add a fence'}).click();
  // The default fence runs 36 ft across the yard: 16 ft deck + 10 ft each side.
  await expect(summary(page)).toContainText('36 ft long · 36 ft of fence · $1,296');
}

test('adds a priced fence, changes its style, height and gates, and draws it on the plan',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/deck-designer/');await startOnPlan(page);
  const before=await dollars(page);
  await openDesignTask(page,'Backyard');
  await editor(page).getByRole('button',{name:'Add a fence'}).click();
  await expect(summary(page)).toContainText('$1,296');
  await expect.poll(()=>dollars(page)).toBe(before+1296);
  // Vinyl is $50/lf; 5 ft takes 11.5% off.
  await editor(page).getByLabel('Fence style').selectOption({label:'Vinyl privacy'});
  await expect(summary(page)).toContainText('$1,800');
  await editor(page).getByLabel('Fence height').selectOption('5');
  await expect(summary(page)).toContainText('$1,593');
  // A single gate: 4 ft less fence, plus $950.
  await editor(page).getByRole('button',{name:'Add a gate'}).click();
  await expect(summary(page)).toContainText('32 ft of fence and 1 gate · $2,366');
  await expect.poll(()=>dollars(page)).toBe(before+2366);
  // The site plan draws the run, its posts and the gate.
  const plan=page.locator('[aria-label="Fences and gates"]');
  await expect(plan.locator('[data-fence]')).toHaveCount(1);
  await expect(plan.locator('[data-gate]')).toHaveCount(1);
  await expect(plan).toContainText('Fence 1 · 5 ft');
  // Saved with the design.
  await expect.poll(async()=>(await savedConfiguration(page))?.fences?.[0]?.gates?.length).toBe(1);
});

test('moves a corner, refuses a gate that does not fit, and keeps the fence over a reload',async({page})=>{
  await addFence(page);
  // Turning the run: corner 2 comes 10 ft toward the house, so the run measures its new length.
  const out=editor(page).getByLabel('Corner 2 out');
  await out.fill('17');await out.press('Enter');
  await expect(summary(page)).toContainText(/37\.4 ft long/);
  // A gate past the end of the fence is refused with a reason, and nothing changes.
  await editor(page).getByRole('button',{name:'Add a gate'}).click();
  const at=editor(page).getByLabel('Gate 1 centre along the fence');
  await at.fill('80');await at.press('Enter');
  await expect(editor(page).getByRole('status')).toContainText('must fit inside one straight part');
  await expect(at).not.toHaveValue('80');
  await expect.poll(async()=>(await savedConfiguration(page))?.fences?.[0]?.gates?.length).toBe(1);
  await page.reload();await startOnPlan(page);
  await openDesignTask(page,'Backyard');
  await expect(summary(page)).toContainText(/37\.4 ft long · 33\.4 ft of fence and 1 gate/);
});

// S9b: drawing and editing on the plan, with the Patios & walls tool.
const surface=(page:Page)=>page.locator('.dd-fence-shape>svg');
async function onPlan(page:Page){
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/deck-designer/');await startOnPlan(page);
  await pickPlanTool(page,'Patios & walls');
  await expect(page.getByRole('button',{name:'Draw fence',exact:true})).toBeVisible();
}
/** Clicks the plan at a fraction of the drawing's box. */
async function tap(page:Page,fx:number,fy:number){const b=(await surface(page).boundingBox())!;await page.mouse.click(b.x+b.width*fx,b.y+b.height*fy);}

test('draws a fence corner by corner, prices it and keeps it saved',async({page})=>{
  await onPlan(page);
  const before=await dollars(page);
  await page.getByRole('button',{name:'Draw fence',exact:true}).click();
  const bar=page.getByRole('region',{name:'Draw a fence'});
  await expect(bar).toContainText('0 corners');
  await tap(page,.2,.85);await tap(page,.2,.95);await tap(page,.6,.95);
  await expect(bar).toContainText('3 corners');
  await bar.getByRole('button',{name:'Finish fence'}).click();
  await expect(bar).toHaveCount(0);
  await expect.poll(async()=>(await savedConfiguration(page))?.fences?.[0]?.points?.length).toBe(3);
  await expect.poll(()=>dollars(page)).toBeGreaterThan(before);
  await expect(page.locator('[data-fence-handles] .dd-fence-shape-corner')).toHaveCount(3);
});

test('Esc stops drawing a fence and changes nothing',async({page})=>{
  await onPlan(page);
  const before=await dollars(page);
  await page.getByRole('button',{name:'Draw fence',exact:true}).click();
  await tap(page,.2,.85);await tap(page,.6,.85);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region',{name:'Draw a fence'})).toHaveCount(0);
  expect(await dollars(page)).toBe(before);
  expect((await savedConfiguration(page))?.fences).toBeUndefined();
});

test('drags a corner and nudges it with the arrow keys, each one undo step',async({page})=>{
  await addFence(page);
  await pickPlanTool(page,'Patios & walls');
  const corner=page.getByRole('button',{name:'Fence 1 corner 2'}),box=(await corner.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y-60,{steps:6});await page.mouse.up();
  // The corner moved toward the house, so the run is longer than 36 ft.
  await expect.poll(async()=>(await savedConfiguration(page))?.fences?.[0]?.points?.[1]?.zIn).toBeLessThan(324);
  const z=(await savedConfiguration(page))!.fences[0].points[1].zIn as number;
  await corner.focus();await page.keyboard.press('ArrowDown');
  await expect.poll(async()=>(await savedConfiguration(page))?.fences?.[0]?.points?.[1]?.zIn).toBe(z+1);
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo'}).click();
  await expect.poll(async()=>(await savedConfiguration(page))?.fences?.[0]?.points?.[1]?.zIn).toBe(z);
});

test('the Yard group\'s Fence tile adds a fence and shows it on the plan with its handles',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/deck-designer/');await startOnPlan(page);
  const before=await dollars(page);
  await railGroups(page).getByRole('button',{name:'Yard'}).click();
  await page.locator('#dd-home-panel').getByRole('button',{name:'Add a fence'}).click();
  await expect(page.getByRole('radio',{name:'Patios & walls',exact:true})).toHaveAttribute('aria-checked','true');
  await expect(page.locator('[data-fence-handles] .dd-fence-shape-corner')).toHaveCount(2);
  await expect.poll(()=>dollars(page)).toBe(before+1296);
});

test('owner fence rates: an empty field is refused, an unchanged one saves nothing, a new one is kept',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await openDesignerMode(page);
  await page.getByRole('button',{name:'Review quote costs',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Complete the missing costs',exact:true}),rate=dialog.getByLabel('Pressure-treated privacy per lf rate');
  await expect(rate).toHaveValue('36');
  const fenceRates=async()=>(await savedConfiguration(page))?.hardscapeLabour?.fenceRates;
  // Passing through the field changes nothing.
  await rate.focus();await rate.blur();
  expect(await fenceRates()).toBeUndefined();
  // Clearing it would price fences at $0: refused, and the field shows the rate again.
  await rate.fill('');await rate.blur();
  await expect(dialog.getByRole('alert')).toContainText('Enter a fence rate');
  await expect(rate).toHaveValue('36');
  expect(await fenceRates()).toBeUndefined();
  await rate.fill('40');await rate.blur();
  await expect.poll(fenceRates).toEqual({pressureTreated:40});
});

test('removes a fence in one undo step',async({page})=>{
  await addFence(page);
  await page.getByRole('region',{name:'Save and restore design'}).getByRole('button',{name:'Undo'}).click();
  await expect(editor(page).getByLabel('Fence summary')).toHaveCount(0);
  await showSheet(page,'Plan');
  await expect(page.locator('[aria-label="Fences and gates"]')).toHaveCount(0);
});
