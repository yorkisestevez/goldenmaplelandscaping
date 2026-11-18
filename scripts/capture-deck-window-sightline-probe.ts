import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {DECK_RELEASE_STORAGE_KEY,serializeDeckReleaseDesign,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {DECK_SETTINGS} from '../src/features/deckcraft/defaults';

const url='http://127.0.0.1:4187/deck-designer/';
const output=new URL('../../../outputs/deckcraft-review-assets/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
mkdirSync(output,{recursive:true});
const ordinary=deckReleaseData(structuredClone(DEFAULT_DECK)),house=getHouseConfig(ordinary);
const prototype={...ordinary,houseConfig:{...house,openings:house.openings.map(o=>o.id.startsWith('front-window-')?{...o,bottomIn:ordinary.height+60,heightIn:Math.min(54,house.storeyHeightIn-ordinary.height-60-6)}:o)}};
const before=calculateDeckReleaseEstimate(ordinary,DECK_SETTINGS),after=calculateDeckReleaseEstimate(prototype,DECK_SETTINGS);
assert.equal(after.total,before.total);assert.equal(prototype.houseConfig.storeyHeightIn,house.storeyHeightIn);
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors:string[]=[];
try{
 const context=await browser.newContext({viewport:{width:1600,height:1050},deviceScaleFactor:1});
 await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms|googleapis\.com|gstatic\.com)\//,r=>r.fulfill({status:200,body:''}));
 await context.addInitScript(({key,saved})=>localStorage.setItem(key,saved),{key:DECK_RELEASE_STORAGE_KEY,saved:serializeDeckReleaseDesign(prototype)});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.getByRole('tab',{name:'3D',exact:true}).click();await page.locator('#deck-live-preview canvas').waitFor();
 for(const camera of ['Front','Corner']){
   await page.getByRole('group',{name:'Camera'}).getByRole('button',{name:camera,exact:true}).click();await page.waitForTimeout(4500);
   await page.locator('#deck-live-preview').screenshot({path:output+`house-window-sightline-probe-${camera.toLowerCase()}.png`});
 }
 assert.deepEqual(errors,[]);
 writeFileSync(new URL('../../../outputs/deckcraft-window-sightline-probe.json',import.meta.url),JSON.stringify({url,prototypeOnly:true,sourceChanged:false,bottomAboveDeckIn:60,windows:prototype.houseConfig.openings.filter(o=>o.type==='Window'),unchangedHouseHeightIn:house.storeyHeightIn,priceBefore:before.total,priceAfter:after.total,pageErrors:errors,images:['house-window-sightline-probe-front.png','house-window-sightline-probe-corner.png']},null,2));
 console.log('Sightline prototype captured; house size/roof and estimate unchanged. Images require visual inspection.');
}finally{await browser.close();}
