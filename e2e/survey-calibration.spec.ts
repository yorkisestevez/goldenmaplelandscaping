import {test,expect,type Page} from '@playwright/test';
import {jsPDF} from 'jspdf';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
const ready=async(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
const saved=async(page:Page)=>expect(page.locator('[data-autosave-state="saved"]')).toHaveCount(1);
test.beforeEach(async({context})=>{await context.addInitScript('window.__name=(target,value)=>target;');await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({body:''}));});
const surveyPdf=()=>{const pdf=new jsPDF();pdf.setDrawColor(0,0,0);pdf.line(30,40,130,40);return {name:'survey.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.output('arraybuffer'))};};
async function openSurvey(page:Page){
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();
 const survey=page.getByLabel('Survey file',{exact:true});
 if(!await survey.count())await page.getByRole('button',{name:'Elevations & build',exact:true}).click();
 await expect(survey).toBeVisible();return survey;
}
/** Clicks a point given in survey-image pixels, mapped through the letterboxed SVG's screen matrix. */
async function clickImagePixel(page:Page,x:number,y:number){
 const svg=page.getByRole('img',{name:'Survey calibration image'});await svg.scrollIntoViewIfNeeded();
 const p=await svg.evaluate((el,{x,y})=>{const s=el as SVGSVGElement,pt=s.createSVGPoint();pt.x=x;pt.y=y;const m=pt.matrixTransform(s.getScreenCTM()!);return {x:m.x,y:m.y};},{x,y});
 await page.mouse.click(p.x,p.y);
}
test('a calibrated PDF survey applies, autosaves and survives reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/deck-designer/');await ready(page);await saved(page);
 const survey=await openSurvey(page);const region=page.getByRole('region',{name:'Survey import and calibration'});
 const start=page.getByRole('button',{name:'Start planning site from current slope',exact:true});
 // Starting the site proposes a reviewed preview; nothing is saved until it is applied.
 if(await start.count()){await start.click();const applySite=page.getByRole('button',{name:'Apply site preview',exact:true});await expect(applySite).toBeEnabled();await applySite.click();}
 await expect.poll(async()=>!!(await read(page)).design.siteModel).toBe(true);
 await survey.setInputFiles(surveyPdf());
 const img=page.getByRole('img',{name:'Survey calibration image'});
 await expect(img.locator('image')).toHaveAttribute('href',/^blob:/);
 const apply=page.getByRole('button',{name:'Apply calibrated survey',exact:true});
 await clickImagePixel(page,200,300);await expect(apply).toBeDisabled();
 await clickImagePixel(page,800,300);await expect(apply).toBeEnabled();
 await page.getByLabel('Survey known distance',{exact:true}).fill('20');
 await page.getByLabel('Survey distance unit',{exact:true}).selectOption('ft');
 await page.getByLabel('Survey rotation',{exact:true}).fill('15');
 await page.getByLabel('Survey across origin',{exact:true}).fill('2');
 await page.getByLabel('Survey out origin',{exact:true}).fill('3');
 await apply.click();
 await expect(region).toContainText('Survey applied');
 const overlay=(await read(page)).design.siteModel?.overlay;
 expect(overlay).toBeTruthy();
 expect(overlay!.attachmentId).toMatch(/^survey-[a-f0-9]{32}$/);
 expect(overlay!.scaleInPerPx).toBeCloseTo(240/600,2);
 expect(overlay).toMatchObject({rotationDeg:15,originXIn:24,originZIn:36});
 expect(overlay!.widthPx).toBeGreaterThan(0);expect(overlay!.heightPx).toBeGreaterThan(0);
 await saved(page);
 await page.reload();await ready(page);
 expect((await read(page)).design.siteModel?.overlay).toEqual(overlay);
 await openSurvey(page);
 await expect(page.locator('svg[aria-label="Survey terrain plan"] image').first()).toHaveAttribute('href',/^blob:/);
 await expect(page.getByText(/Survey attachment is missing/)).toHaveCount(0);
 expect(errors.filter(e=>/destroy|pdf/i.test(e))).toEqual([]);
});
test('survey apply refuses without a site model',async({page})=>{
 await page.goto('/deck-designer/');await ready(page);await saved(page);
 test.skip(!!(await read(page)).design.siteModel,'Default design already carries a site model.');
 const survey=await openSurvey(page);
 await survey.setInputFiles(surveyPdf());
 await expect(page.getByRole('img',{name:'Survey calibration image'}).locator('image')).toHaveAttribute('href',/^blob:/);
 await clickImagePixel(page,200,300);await clickImagePixel(page,800,300);
 await page.getByRole('button',{name:'Apply calibrated survey',exact:true}).click();
 await expect(page.getByRole('region',{name:'Survey import and calibration'})).toContainText('Create or import elevation points');
 expect((await read(page)).design.siteModel).toBeFalsy();
});
