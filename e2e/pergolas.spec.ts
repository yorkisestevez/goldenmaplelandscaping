import {expect,test,type Page} from '@playwright/test';
import {openDesignTask} from './nav';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const extrasName='Privacy, skirting & extras';
async function openExtras(page:Page){
 await openDesignTask(page,extrasName);
 await expect(page.getByRole('region',{name:'Aluminum pergolas'})).toBeVisible();
}
async function show3D(page:Page){const canvasButton=page.getByRole('button',{name:'Show canvas',exact:true});if(await canvasButton.isVisible())await canvasButton.click();await page.getByRole('tab',{name:'3D',exact:true}).click();}
async function openFiles(page:Page){const menu=page.getByRole('region',{name:'Save and restore design'}).locator('details.dd-workspace-files');if(await menu.getAttribute('open')===null)await menu.locator(':scope>summary').click();}
const panel=(page:Page)=>page.getByRole('region',{name:'Aluminum pergolas',includeHidden:true});
test.beforeEach(async({context})=>{
 await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
 await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
});
test('pergola catalog, costs, autosave, public JSON, undo and 3D',async({page,browser},info)=>{
 const problems:string[]=[];page.on('pageerror',e=>problems.push(String(e)));
 await page.goto('/deck-designer/');await openExtras(page);
 await panel(page).getByLabel('Pergola supplier',{exact:true}).selectOption('costco');
 await expect(panel(page).getByRole('button',{name:'Select LOUSOL Junior 10 × 12 ft',exact:true})).toHaveCount(0);
 await panel(page).getByRole('button',{name:'Select Mirador 8.8 × 14.4 ft',exact:true}).click();
 await expect(panel(page)).toContainText('kit dimensions are unchanged');
 await panel(page).getByLabel('Pergola rotation (degrees)',{exact:true}).fill('30');
 await panel(page).getByLabel('Louver opening',{exact:true}).fill('60');
 await panel(page).locator('summary',{hasText:'Contractor costs'}).click();
 await panel(page).getByLabel('Pergola kit supply cost (CAD)',{exact:true}).fill('2345');
 await panel(page).getByLabel('Installation labour cost (CAD)',{exact:true}).fill('987');
 for(const name of ['Delivery','Anchoring','Structural preparation','Electrical'])await panel(page).getByLabel(`${name} cost (CAD)`,{exact:true}).fill('0');
 await panel(page).getByLabel('Supplier / accessory costs confirmed for this scope',{exact:true}).check();await panel(page).getByLabel('Availability and kit completeness confirmed',{exact:true}).check();
 await page.waitForTimeout(650);await page.reload();await openExtras(page);await panel(page).locator('summary',{hasText:'Contractor costs'}).click();
 await expect(panel(page).getByLabel('Pergola kit supply cost (CAD)',{exact:true})).toHaveValue('2345');
 await expect(panel(page).getByLabel('Louver opening',{exact:true})).toHaveValue('60');
 const snapshot=()=>page.evaluate(()=>window.deckcraft!.read());
 await expect.poll(async()=>{const state=await snapshot();return state.pricing.sections.find(s=>s.title==='Aluminum pergola')?.total;}).toBe(2345*1.35+987);
 const before=await snapshot(),colour=before.design.deckingColor,other=await page.evaluate(()=>window.deckcraft!.describe().catalogue.decking.find(m=>m.id===window.deckcraft!.read().design.deckingMaterial)!.colors.find(c=>c.name!==window.deckcraft!.read().design.deckingColor)!.name);
 const command={type:'design.patch' as const,patch:{deckingColor:other}},request={id:'pergola-reload-colour',commands:[command],expectedRevision:before.revision};
 const proposed=await page.evaluate(r=>window.deckcraft!.preview(r),request);expect(proposed.ok).toBe(true);if(proposed.ok)expect(proposed.snapshot.pricing.sections.find(s=>s.title==='Aluminum pergola')?.total).toBe(2345*1.35+987);
 expect((await snapshot()).pricing.total).toBe(before.pricing.total);
 const applied=await page.evaluate(r=>window.deckcraft!.execute(r),request);expect(applied.ok).toBe(true);expect((await snapshot()).pricing.sections.find(s=>s.title==='Aluminum pergola')?.total).toBe(2345*1.35+987);
 await page.evaluate(()=>window.deckcraft!.execute({id:'pergola-reload-colour-undo',commands:[{type:'history.undo'}]}));await expect.poll(async()=>(await snapshot()).design.deckingColor).toBe(colour);expect((await snapshot()).pricing.total).toBe(before.pricing.total);
 await openFiles(page);const tools=page.getByRole('region',{name:'Save and restore design'}),[download]=await Promise.all([page.waitForEvent('download'),tools.getByRole('button',{name:'Save JSON',exact:true}).click()]);const file=info.outputPath('pergola.json');await download.saveAs(file);const json=readFileSync(file,'utf8'),saved=JSON.parse(json);
 expect(saved.configuration.pergola.productId).toBe('costco-mirador');expect(saved.configuration.pergola.rotationDeg).toBe(30);expect(json).not.toContain('2345');expect(json).not.toContain('987');expect(json).not.toContain('supplyConfirmed');
 await panel(page).getByLabel('Supply responsibility',{exact:true}).selectOption('install-only');await expect(panel(page).getByLabel('Pergola kit supply cost (CAD)',{exact:true})).toHaveCount(0);
 await tools.getByRole('button',{name:'Undo',exact:true}).click();await expect(panel(page).getByLabel('Supply responsibility',{exact:true})).toHaveValue('supply-install');
 await openFiles(page);await tools.getByRole('button',{name:'Share link',exact:true}).click();const link=await tools.getByLabel('Link to this design').inputValue();expect(link).toMatch(/#d=1/);
 const recipient=await browser.newContext();await recipient.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));const shared=await recipient.newPage();await shared.goto(link);await openExtras(shared);await panel(shared).locator('summary',{hasText:'Contractor costs'}).click();await expect(panel(shared).getByLabel('Pergola kit supply cost (CAD)',{exact:true})).toHaveValue('');await expect(panel(shared).getByLabel('Installation labour cost (CAD)',{exact:true})).toHaveValue('');await expect(panel(shared).getByLabel('Louver opening',{exact:true})).toHaveValue('60');await recipient.close();
 await show3D(page);await expect(page.locator('#deck-live-preview canvas')).toBeVisible({timeout:60000});
 await expect(page.getByRole('region',{name:'Pergola preview controls'})).toBeVisible();await expect(page.locator('#deck-live-preview').getByText(/Loading the\s*3D\s*view/)).toHaveCount(0);await page.waitForTimeout(400);const out=resolve('C:/Users/yorki/Documents/Codex/2026-09-26/fo/outputs');mkdirSync(out,{recursive:true});await page.locator('#deck-live-preview').screenshot({path:resolve(out,'deckcraft-aluminum-pergola-preview.png')});expect(problems).toEqual([]);
});
test('pergola mobile filters, comparison, conceptual dimensions and sold-out status @phone',async({page})=>{
 const problems:string[]=[];page.on('pageerror',e=>problems.push(String(e)));
 await page.goto('/deck-designer/');await openExtras(page);
 await panel(page).getByLabel('Roof operation',{exact:true}).selectOption('motorized');await expect(panel(page).getByRole('button',{name:'Select Kimbel Louvered Custom configuration',exact:true})).toBeVisible();
 await panel(page).getByLabel('Roof operation',{exact:true}).selectOption('');await panel(page).getByLabel('Compare LOUSOL Junior',{exact:true}).check();await panel(page).getByLabel('Compare Mirador',{exact:true}).check();await expect(panel(page).getByRole('table')).toContainText('Exact dimensions unknown');
 await panel(page).getByRole('button',{name:'Select Domi Louvered 10 × 10 ft',exact:true}).click();await expect(panel(page)).toContainText('conceptual dimensions');
 await panel(page).locator('summary',{hasText:'Contractor costs'}).click();await expect(panel(page)).toContainText('catalog: sold-out');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await panel(page).getByRole('heading',{name:'Domi Louvered · 10 × 10 ft'}).scrollIntoViewIfNeeded();const out=resolve('C:/Users/yorki/Documents/Codex/2026-09-26/fo/outputs');mkdirSync(out,{recursive:true});await page.screenshot({path:resolve(out,'deckcraft-pergola-mobile.png')});expect(problems).toEqual([]);
});

test('pergola mesh selection, dragging, rotation, cancel and lighting',async({page},info)=>{
 const problems:string[]=[];page.on('pageerror',e=>problems.push(String(e)));
 const design=JSON.parse(readFileSync(resolve('e2e/fixtures/pergola.json'),'utf8'));
 await page.goto('/deck-designer/#d=1j'+Buffer.from(JSON.stringify(design)).toString('base64url'));await openExtras(page);await show3D(page);
 const tools=page.getByRole('region',{name:'Pergola preview controls'}),canvas=page.locator('#deck-live-preview canvas');await expect(canvas).toBeVisible({timeout:60000});
 await page.getByRole('button',{name:'Above',exact:true}).click();await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 let box=(await canvas.boundingBox())!;await canvas.click({position:{x:box.width*.5,y:box.height*.45}});await expect(tools.getByRole('button',{name:'Done editing pergola',exact:true})).toBeVisible();
 box=(await canvas.boundingBox())!;const x=box.x+box.width*.5,y=box.y+box.height*.45;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y+20,{steps:8});await expect(panel(page).getByLabel('Pergola centre across (ft)',{exact:true})).toHaveValue('12');await page.mouse.up();
 const moved=Number(await panel(page).getByLabel('Pergola centre across (ft)',{exact:true}).inputValue());expect(moved).toBeGreaterThan(12);
 await tools.getByRole('button',{name:'Rotate pergola',exact:true}).click();await page.mouse.move(x+45,y+5);await page.mouse.down();await page.mouse.move(x+50,y+55,{steps:8});await page.mouse.up();
 const angle=Number(await panel(page).getByLabel('Pergola rotation (degrees)',{exact:true}).inputValue());expect(angle).not.toBe(0);
 await tools.getByRole('button',{name:'Move pergola',exact:true}).click();await page.mouse.move(x+35,y+20);await page.mouse.down();await page.mouse.move(x+60,y+30,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();await expect(panel(page).getByLabel('Pergola centre across (ft)',{exact:true})).toHaveValue(String(moved));
 await tools.getByRole('button',{name:'Move pergola right half a foot',exact:true}).click();await expect(panel(page).getByLabel('Pergola centre across (ft)',{exact:true})).toHaveValue(String(moved+.5));
 await tools.getByRole('group',{name:'Pergola position and rotation',exact:true}).focus();await page.keyboard.press('Shift+ArrowRight');await expect(panel(page).getByLabel('Pergola rotation (degrees)',{exact:true})).not.toHaveValue(String(angle));
 await tools.getByLabel('Pergola LED lighting',{exact:true}).check();await page.getByRole('button',{name:'Night',exact:false}).click();await expect(page.getByText('No lights on this design yet.',{exact:false})).toHaveCount(0);
 await expect(panel(page)).toContainText('Planned perimeter LEDs');await panel(page).locator('summary',{hasText:'Contractor costs'}).click();await expect(panel(page).getByLabel('Pergola perimeter LED lighting supply cost (CAD)',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Corner',exact:true}).click();
 const out=resolve('C:/Users/yorki/Documents/Codex/2026-09-26/fo/outputs');mkdirSync(out,{recursive:true});await page.waitForTimeout(300);await page.locator('#deck-live-preview').screenshot({path:resolve(out,'deckcraft-pergola-editing-night.png')});await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(300);await canvas.screenshot({path:resolve(out,'deckcraft-pergola-canvas-night.png')});
 await page.getByRole('switch',{name:/Preview lights/}).uncheck();await page.waitForTimeout(300);await page.locator('#deck-live-preview').screenshot({path:resolve(out,'deckcraft-pergola-editing-lights-off.png')});await expect(tools.getByLabel('Pergola LED lighting',{exact:true})).toBeChecked();await page.getByRole('switch',{name:/Preview lights/}).check();
 await openFiles(page);const save=page.getByRole('region',{name:'Save and restore design'}),[download]=await Promise.all([page.waitForEvent('download'),save.getByRole('button',{name:'Save JSON',exact:true}).click()]);const file=info.outputPath('lit-pergola.json');await download.saveAs(file);const saved=JSON.parse(readFileSync(file,'utf8'));expect(saved.configuration.pergola.lighting).toBe('perimeter-led');expect(saved.configuration.pergola.xFt).toBe(moved+.5);
 await page.reload();await openExtras(page);await expect(panel(page).getByLabel('Pergola perimeter LED lighting supply cost (CAD)',{exact:true})).toHaveValue('');await expect(panel(page).getByText('Pergola lighting · warm white LEDs',{exact:true}).locator('..').getByRole('checkbox')).toBeChecked();expect(problems).toEqual([]);
});

test('pergola touch drag, rotation and lighting controls @phone',async({page,context})=>{
 const problems:string[]=[];page.on('pageerror',e=>problems.push(String(e)));
 const design=JSON.parse(readFileSync(resolve('e2e/fixtures/pergola.json'),'utf8'));delete design.configuration.pergola;
 await page.goto('/deck-designer/#d=1j'+Buffer.from(JSON.stringify(design)).toString('base64url'));await openExtras(page);await show3D(page);
 const tools=page.getByRole('region',{name:'Pergola preview controls'}),canvas=page.locator('#deck-live-preview canvas');await expect(canvas).toBeVisible({timeout:60000});await tools.getByLabel('3D pergola product',{exact:true}).selectOption('costco-mirador|8-8x14-4');await tools.getByRole('button',{name:'Done editing pergola',exact:true}).click();await page.getByRole('button',{name:'Above',exact:true}).click();await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 let box=(await canvas.boundingBox())!;await page.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.45);await expect(tools.getByRole('button',{name:'Done editing pergola',exact:true})).toBeVisible();
 await canvas.scrollIntoViewIfNeeded();box=(await canvas.boundingBox())!;const x=box.x+box.width*.5,y=box.y+box.height*.45,session=await context.newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+20*i/6,y:y+10*i/6,id:0}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
 expect(Number(await panel(page).getByLabel('Pergola centre across (ft)',{exact:true}).inputValue())).toBeGreaterThan(12);
 await tools.getByRole('button',{name:'Rotate +15°',exact:true}).click();await expect(panel(page).getByLabel('Pergola rotation (degrees)',{exact:true})).toHaveValue('15');await tools.getByLabel('Pergola LED lighting',{exact:true}).check();
 await page.getByRole('button',{name:'Night',exact:false}).click();await page.getByRole('button',{name:'Corner',exact:true}).click();await expect(page.getByRole('switch',{name:/Preview lights/})).toBeChecked();
 const out=resolve('C:/Users/yorki/Documents/Codex/2026-09-26/fo/outputs');mkdirSync(out,{recursive:true});await page.waitForTimeout(300);await page.locator('#deck-live-preview').screenshot({path:resolve(out,'deckcraft-pergola-mobile-editing.png')});await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(300);await canvas.screenshot({path:resolve(out,'deckcraft-pergola-canvas-phone.png')});
 await page.getByRole('switch',{name:/Preview lights/}).uncheck();await expect(tools.getByLabel('Pergola LED lighting',{exact:true})).toBeChecked();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);expect(problems).toEqual([]);
});
