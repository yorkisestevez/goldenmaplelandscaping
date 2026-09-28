import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

// The permit drawing set in the designer: Proposal & files opens it, its six sheets preview, and the PDF and DXF
// download with the right names and contents. Nothing is sent anywhere.
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&['GET','HEAD'].includes(route.request().method())?route.fallback():route.abort();});
});

async function openPermitSet(page:Page){
  await page.goto('/deck-designer/');
  const section=page.getByRole('region',{name:'Deck configuration'}).getByRole('button',{name:'Proposal & files',exact:true});
  if(await section.getAttribute('aria-expanded')==='false')await section.click();
  await page.locator('summary',{hasText:'Permit drawings (planning set)'}).click();
  await page.getByRole('button',{name:'Open permit drawings',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Permit drawing set'});
  await expect(dialog).toBeVisible();
  return dialog;
}

test('opens the permit set, previews each sheet and downloads the PDF and DXF',async({page},info)=>{
  const dialog=await openPermitSet(page);
  for(const [id,title] of [['A-1','Elevations'],['S-1','Foundation plan'],['S-2','Framing plan'],['S-3','Decking and guard plan'],['S-4','Typical section'],['S-5','Typical details']]){
    await dialog.getByRole('tab',{name:`${id} · ${title}`}).click();
    await expect(dialog.getByRole('tab',{name:`${id} · ${title}`})).toHaveAttribute('aria-selected','true');
    await expect(dialog.getByRole('img',{name:new RegExp(`^${id} ${title}, scale `)})).toBeVisible();
  }
  await dialog.getByRole('button',{name:'Zoom in'}).click();await expect(dialog.getByRole('button',{name:'Fit the sheet'})).toHaveAttribute('aria-pressed','true');
  const [pdf]=await Promise.all([page.waitForEvent('download',{timeout:60_000}),dialog.getByRole('button',{name:'Download permit PDF'}).click()]);
  expect(pdf.suggestedFilename()).toBe('golden-maple-deck-permit-drawings.pdf');
  const pdfFile=info.outputPath('permit.pdf');await pdf.saveAs(pdfFile);const bytes=readFileSync(pdfFile).toString('latin1');
  expect(bytes.startsWith('%PDF-')).toBe(true);expect((bytes.match(/\/Type \/Page\b/g)??[]).length).toBe(6);
  const [dxf]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Download DXF (all sheets)'}).click()]);
  expect(dxf.suggestedFilename()).toBe('golden-maple-deck-permit-plans.dxf');
  const dxfFile=info.outputPath('permit.dxf');await dxf.saveAs(dxfFile);const text=readFileSync(dxfFile,'utf8');
  expect(text).toContain('AC1009');for(const layer of ['S-FTNG','S-POST','S-JOIS','S-BEAM','A-RAIL','S-FRMG','C-TOPO'])expect(text).toContain(`\n${layer}\n`);
  await dialog.getByRole('button',{name:'Back to design'}).click();
  await expect(dialog).toBeHidden();
});

test('@phone the permit set opens and previews on a phone',async({page})=>{
  const dialog=await openPermitSet(page);
  await expect(dialog.getByRole('img',{name:/^A-1 Elevations, scale /})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
