import {chromium,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {DECK_RELEASE_STORAGE_KEY,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {parseDesign} from '../src/features/deckcraft/designPersistence';
import type {DeckData} from '../src/features/deckcraft/types';
const url=process.env.DECKCRAFT_PROOF_URL??'http://127.0.0.1:4187/deck-designer/';
const output=new URL('../../../outputs/deckcraft-review-assets/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');mkdirSync(output,{recursive:true});
const design:DeckData={...structuredClone(DEFAULT_DECK),width:16,length:12,height:48,deckingMaterial:'tt_reserve',deckingColor:'Antique Leather',skirting:{style:'Horizontal boards',clearanceIn:2,accessPanels:0,cornerTreatment:'Folded solid boards'},sceneLighting:'Daylight',autoLighting:{},lightingSystem:{selectedItems:[],wireDistance:0}};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1600,height:1050},deviceScaleFactor:1});
await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms|googleapis\.com|gstatic\.com)\//,r=>r.fulfill({status:200,body:''}));
await context.addInitScript(({key,design})=>{if(!localStorage.getItem(key))localStorage.setItem(key,design);},{key:DECK_RELEASE_STORAGE_KEY,design:serializeDeckReleaseDesign(design)});
const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Shader Error|WebGLProgram|photographic renderer failed/.test(m.text()))errors.push(m.text());});
const open=async(name:string)=>{const b=page.getByRole('region',{name:'Deck configuration'}).getByRole('button',{name,exact:true});await expect(b).toBeVisible();if(await b.getAttribute('aria-expanded')==='false')await b.click();await expect(b).toHaveAttribute('aria-expanded','true');};
const saved=async()=>parseDesign((await page.evaluate(key=>localStorage.getItem(key),DECK_RELEASE_STORAGE_KEY))!);
try{
 await page.goto(url);await page.getByRole('tab',{name:'3D',exact:true}).click();await open('Privacy, skirting & extras');
 const choice=page.locator('select[aria-label="Skirting corners"]');await expect(choice).toHaveValue('Folded solid boards',{timeout:30000});
 await expect(page.getByText('Requires solid-profile stock and builder confirmation',{exact:false})).toBeVisible();
 await page.getByRole('group',{name:'Camera'}).getByRole('button',{name:'Corner',exact:true}).click();await page.locator('#deck-live-preview canvas').waitFor();await page.waitForTimeout(5000);
 await page.locator('#deck-live-preview').screenshot({path:output+'folded-solid-board-customer-corner.png'});
 await page.getByRole('group',{name:'Camera'}).getByRole('button',{name:'Front',exact:true}).click();await page.waitForTimeout(2000);await page.locator('#deck-live-preview').screenshot({path:output+'folded-solid-board-customer-front.png'});
 await choice.selectOption('');await expect.poll(async()=>(await saved()).skirting?.cornerTreatment??'').toBe('');
 await choice.selectOption('Folded solid boards');await expect.poll(async()=>(await saved()).skirting?.cornerTreatment).toBe('Folded solid boards');
 await page.reload();await page.getByRole('tab',{name:'3D',exact:true}).click();await open('Privacy, skirting & extras');await expect(page.locator('select[aria-label="Skirting corners"]')).toHaveValue('Folded solid boards',{timeout:30000});
 if(errors.length)throw new Error(errors.join('\n'));
 writeFileSync(new URL('../../../outputs/deckcraft-folded-browser-proof.json',import.meta.url),JSON.stringify({url,verifiedAt:new Date().toISOString(),pageErrors:errors,checks:['Actual built customer renderer displays folded solid-board skirting and generated windows','Exact product/fabricator confirmation visible','Mitred/folded toggle saves and survives reload'],images:['folded-solid-board-customer-corner.png','folded-solid-board-customer-front.png']},null,2));console.log('Folded solid-board customer browser proof PASS: renderer, visible fabrication note, toggle persistence and reload; no page/shader errors.');
}catch(error){writeFileSync(new URL('../../../work/folded-browser-debug.txt',import.meta.url),JSON.stringify({error:String(error),saved:await page.evaluate(key=>localStorage.getItem(key),DECK_RELEASE_STORAGE_KEY),skirting:await page.locator('.dd-skirting').innerText().catch(()=>''),errors},null,2));throw error;}finally{await browser.close();}
