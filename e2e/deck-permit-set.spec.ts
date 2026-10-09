import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {openDesignTask} from './nav';

// The permit drawing set in the designer: Proposal & files opens it, its nine sheets preview, the lot for the site plan
// can be entered from a survey in metres, and the PDF and DXF download with the right names and contents. Nothing is
// sent anywhere.
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&['GET','HEAD'].includes(route.request().method())?route.fallback():route.abort();});
});

/** Opens Proposal & files. Drawing focus hides the task menu until the project controls are shown. */
async function openProposalFiles(page:Page){
  await openDesignTask(page,'Proposal & files');
}
async function openPermitSet(page:Page){
  await page.goto('/deck-designer/');
  await openProposalFiles(page);
  const permit=page.locator('details').filter({has:page.locator('summary',{hasText:'Permit drawings (planning set)'})});
  await permit.locator('summary').click();
  await permit.getByRole('button',{name:'Open permit drawings',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Permit drawing set'});
  await expect(dialog).toBeVisible();
  return dialog;
}

test('opens the permit set, previews each sheet and downloads the PDF and DXF',async({page},info)=>{
  const dialog=await openPermitSet(page);
  await dialog.getByText(/^Review all \d+ open items$/).click();
  await expect(dialog.getByText('Check the exact clause, current edition and local applicability on G-0.').first()).toBeVisible();
  for(const [id,title] of [['G-0','General notes and code references'],['A-0','Site plan'],['A-1','Elevations'],['S-1','Foundation plan'],['S-2','Framing plan'],['S-3','Decking and guard plan'],['S-4','Typical section'],['S-5','Typical details'],['S-6','Schedules']]){
    await dialog.getByRole('tab',{name:`${id} · ${title}`}).click();
    await expect(dialog.getByRole('tab',{name:`${id} · ${title}`})).toHaveAttribute('aria-selected','true');
    await expect(dialog.getByRole('img',{name:new RegExp(`^${id} ${title}, (scale |not to scale)`)})).toBeVisible();
  }
  await dialog.getByRole('button',{name:'Zoom in'}).click();await expect(dialog.getByRole('button',{name:'Fit the sheet'})).toHaveAttribute('aria-pressed','true');
  const [pdf]=await Promise.all([page.waitForEvent('download',{timeout:60_000}),dialog.getByRole('button',{name:'Download permit PDF'}).click()]);
  expect(pdf.suggestedFilename()).toBe('golden-maple-deck-permit-drawings.pdf');
  const pdfFile=info.outputPath('permit.pdf');await pdf.saveAs(pdfFile);const bytes=readFileSync(pdfFile).toString('latin1');
  expect(bytes.startsWith('%PDF-')).toBe(true);expect((bytes.match(/\/Type \/Page\b/g)??[]).length).toBe(9);
  const [dxf]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Download DXF (all sheets)'}).click()]);
  expect(dxf.suggestedFilename()).toBe('golden-maple-deck-permit-plans.dxf');
  const dxfFile=info.outputPath('permit.dxf');await dxf.saveAs(dxfFile);const text=readFileSync(dxfFile,'utf8');
  expect(text).toContain('AC1009');for(const layer of ['S-FTNG','S-POST','S-JOIS','S-BEAM','A-RAIL','S-FRMG','C-TOPO'])expect(text).toContain(`\n${layer}\n`);
  await dialog.getByRole('button',{name:'Back to design'}).click();
  await expect(dialog).toBeHidden();
});

test('enters the lot from a survey in metres and the site plan draws the lot lines and setbacks',async({page},info)=>{
  let dialog=await openPermitSet(page);
  const sheet=dialog.getByRole('img',{name:/^A-0 Site plan, scale /}),lot=dialog.getByRole('region',{name:'Lot and setbacks'});
  await expect(dialog.getByRole('tab',{name:'A-0 · Site plan'})).toHaveAttribute('aria-selected','true');
  await expect(sheet).toContainText('PROPERTY LINES NOT ENTERED');
  await expect(dialog.getByRole('status')).toContainText('for the site plan');
  await lot.getByRole('radio',{name:'Metres'}).click();
  for(const [label,value] of [['Lot width','15.24'],['Lot depth','36.58'],['Left side yard','3.05'],['Rear yard','12.19']] as const)await lot.getByLabel(`${label} (metres)`).fill(value);
  await lot.getByLabel('Rear yard (metres)').press('Enter');
  await lot.getByLabel('The back yard faces').selectOption('S');
  await expect(sheet).toContainText('FRONT LOT LINE · STREET');
  await expect(sheet).toContainText('(15.24 m)');
  await expect(sheet).not.toContainText('PROPERTY LINES NOT ENTERED');
  await expect(lot).toContainText('From the house model: right side yard');
  await expect(dialog.getByRole('status')).not.toContainText('for the site plan');
  const [dxf]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Download DXF (all sheets)'}).click()]);
  const dxfFile=info.outputPath('site.dxf');await dxf.saveAs(dxfFile);expect(readFileSync(dxfFile,'utf8')).toContain('\nC-PROP\n');
  // The lot is part of the design: it opens folded to one line when the drawings open again, in feet, and it can be
  // cleared.
  await dialog.getByRole('button',{name:'Back to design'}).click();
  await expect(page.locator('[data-autosave-state="saved"]')).toContainText(/saved/i);
  dialog=await openPermitSet(page);
  const folded=dialog.getByRole('region',{name:'Lot and setbacks'});
  await expect(folded).toContainText('Lot 50\'-0" × 120\'-0"');
  await expect(folded.getByLabel('Lot width (feet)')).toBeHidden();
  await folded.getByRole('heading',{name:'Lot and setbacks'}).click();
  await expect(folded.getByLabel('Lot width (feet)')).toHaveValue('50');
  await dialog.getByRole('button',{name:'Clear the lot'}).click();
  await expect(dialog.getByRole('img',{name:/^A-0 Site plan, scale /})).toContainText('PROPERTY LINES NOT ENTERED');
});

test('@phone the permit set opens and previews on a phone',async({page})=>{
  const dialog=await openPermitSet(page);
  await expect(dialog.getByRole('img',{name:/^A-0 Site plan, scale /})).toBeVisible();
  await expect(dialog.getByRole('region',{name:'Lot and setbacks'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('CAD downloads and assistant permit actions use the current design',async({page},info)=>{
  await page.goto('/deck-designer/');
  await openProposalFiles(page);
  await page.locator('summary',{hasText:'CAD & 3D model exports'}).click();
  for(const [label,extension,signature] of [['Download COLLADA (.dae)','dae','<COLLADA'],['Download GLB','glb','glTF'],['Materials CSV','csv','"estimate item ID","section"']] as const){
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:label}).click()]);
    expect(download.suggestedFilename().endsWith(`.${extension}`)).toBe(true);
    const file=info.outputPath(`model.${extension}`);await download.saveAs(file);
    expect(readFileSync(file).toString('utf8').includes(signature)).toBe(true);
  }
  for(const [action,extension,signature] of [['permit.pdf','pdf','%PDF-'],['export.dxf2d','dxf','AC1009']] as const){
    const [download]=await Promise.all([page.waitForEvent('download'),page.evaluate(async actionName=>{
      const api=(window as typeof window&{deckcraft?:{execute:(request:unknown)=>Promise<{ok:boolean}>}}).deckcraft;
      return api?.execute({id:`e2e-${actionName}`,commands:[{type:'action',action:actionName}]});
    },action)]);
    expect(download.suggestedFilename().endsWith(`.${extension}`)).toBe(true);
    const file=info.outputPath(`agent.${extension}`);await download.saveAs(file);
    expect(readFileSync(file).toString('utf8').includes(signature)).toBe(true);
  }
});
