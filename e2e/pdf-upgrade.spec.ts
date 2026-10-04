import {test,expect} from '@playwright/test';
import {jsPDF} from 'jspdf';
test('patched PDF importer renders pages and rejects invalid PDFs',async({page})=>{
 await page.goto('/deck-designer/');
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();
 const survey=page.getByLabel('Survey file',{exact:true});
 if(!await survey.count()) {
  await page.getByRole('button',{name:'Elevations & build',exact:true}).click();
 }
 await expect(survey).toBeVisible();
 const pdf=new jsPDF();pdf.setFillColor(200,0,0);pdf.rect(20,20,80,50,'F');pdf.addPage();pdf.setFillColor(0,0,200);pdf.rect(20,20,50,80,'F');
 await survey.setInputFiles({name:'two-pages.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.output('arraybuffer'))});
 const pages=page.getByLabel('PDF survey page',{exact:true}),img=page.getByRole('img',{name:'Survey calibration image'}).locator('image');
 await expect(pages).toBeEnabled();await expect(pages.locator('option')).toHaveCount(2);await expect(img).toHaveAttribute('href',/^blob:/);
 const first=await img.getAttribute('href');await pages.selectOption('2');await expect(pages).toBeEnabled();await expect(img).not.toHaveAttribute('href',first!);
 await survey.setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});
 await expect(page.getByRole('region',{name:'Survey import and calibration'})).toContainText(/Invalid PDF|PDF.*invalid/i);
 await expect(survey).toBeEnabled();
 await survey.setInputFiles({name:'recovered.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.output('arraybuffer'))});
 await expect(pages).toBeEnabled();await expect(pages).toHaveValue('1');await expect(pages.locator('option')).toHaveCount(2);
 await expect(page.getByRole('region',{name:'Survey import and calibration'})).not.toContainText(/Invalid PDF|destroy is not a function/i);
});
