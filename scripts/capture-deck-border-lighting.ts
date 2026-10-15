import {chromium,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {DECK_RELEASE_STORAGE_KEY,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import type {DeckData} from '../src/features/deckcraft/types';

const url=process.env.DECKCRAFT_PROOF_URL??'http://127.0.0.1:4187/deck-designer/';
const output=new URL('../../../outputs/deckcraft-review-assets/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
mkdirSync(output,{recursive:true});
const design:DeckData={...structuredClone(DEFAULT_DECK),width:20,length:12,height:36,railingType:'None',pictureFrameRows:1,pictureFrameOverhangIn:.5,autoLighting:{border:false},lightingSystem:{selectedItems:[],wireDistance:0},sceneLighting:'Daylight',lightingPreviewOn:true};
const saved=serializeDeckReleaseDesign(design);
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1600,height:1050},deviceScaleFactor:1});
await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms|googleapis\.com|gstatic\.com)\//,r=>r.fulfill({status:200,body:''}));
await context.addInitScript(({key,design})=>localStorage.setItem(key,design),{key:DECK_RELEASE_STORAGE_KEY,design:saved});
const page=await context.newPage(),errors:string[]=[];
const openSection=async(name:string)=>{
  const button=page.getByRole('region',{name:'Deck configuration'}).getByRole('button',{name,exact:true});
  for(let retry=0;retry<3;retry++)try{
    await expect(button).toBeVisible();
    if(await button.getAttribute('aria-expanded')==='false')await button.click();
    await expect(button).toHaveAttribute('aria-expanded','true',{timeout:3000});return;
  }catch(error){if(retry===2)throw error;}
};
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(/Shader Error|WebGLProgram|photographic renderer failed/.test(m.text()))errors.push(m.text());});
try{
await page.goto(url);
await page.getByRole('tab',{name:'3D',exact:true}).click();
await openSection('Outdoor lighting');
await page.getByRole('checkbox',{name:'Light under the picture-frame deck edge',exact:true}).check();
await expect(page.getByRole('region',{name:'Price schedule',exact:true})).toContainText('Custom picture-frame lighting support, connections and wiring');
await page.getByRole('group',{name:'Camera'}).getByRole('button',{name:'Front',exact:true}).click();
await page.locator('#deck-live-preview canvas').waitFor();
await page.waitForTimeout(5000);
await page.locator('#deck-live-preview').screenshot({path:output+'border-lighting-day.png'});
await page.getByRole('group',{name:'Day or night preview'}).getByRole('button',{name:'Night'}).click();
await page.waitForTimeout(4500);
await page.locator('#deck-live-preview').screenshot({path:output+'border-lighting-night.png'});
await openSection('Boards & finish');
const overhang=page.getByRole('spinbutton',{name:'Outer frame overhang beyond fascia',exact:true});
await expect(overhang).toHaveValue('2.5');await expect(overhang).toBeDisabled();
await openSection('Outdoor lighting');
await page.getByRole('checkbox',{name:'Light under the picture-frame deck edge',exact:true}).uncheck();
await openSection('Boards & finish');
await expect(overhang).toHaveValue('0.5');await expect(overhang).toBeEnabled();
if(errors.length)throw new Error(errors.join('\n'));
writeFileSync(new URL('../../../outputs/deckcraft-border-browser-proof.json',import.meta.url),JSON.stringify({url,pageErrors:errors,checks:['Customer checkbox changes live estimate','Support/connections/wiring remains explicit quote','2.5in custom mounting-space shown and normal knob disabled','Turning lights off restores saved 0.5in ordinary overhang','Day/night screenshots captured without shader errors'],images:['border-lighting-day.png','border-lighting-night.png']},null,2));
console.log('Deck-border browser proof: PASS (UI/estimate/overhang restoration/day-night shader; screenshots saved)');
}catch(error){console.log(JSON.stringify({pageErrors:errors,stage:'border browser proof failed'}));throw error;}
finally{await browser.close();}
