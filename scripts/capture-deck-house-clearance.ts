import assert from 'node:assert/strict';
import {chromium,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {DECK_RELEASE_STORAGE_KEY,serializeDeckReleaseDesign,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {houseRailingConflicts} from '../src/features/deckcraft/houseRailingClearance';
import type {DeckData} from '../src/features/deckcraft/types';

// Run only once the parent task confirms the final production preview has rebuilt.
const url='http://127.0.0.1:4187/deck-designer/';
const output=new URL('../../../outputs/deckcraft-review-assets/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
mkdirSync(output,{recursive:true});
const ordinary=deckReleaseData(structuredClone(DEFAULT_DECK));
const house=getHouseConfig(ordinary),placement=getHousePlacement(ordinary);
const measured:DeckData={...ordinary,houseConfig:{...house,storeys:2,openings:[{id:'measured-window',type:'Window',facade:'Front',offsetPct:(0-placement.x0)/placement.widthIn*100,bottomIn:48,widthIn:48,heightIn:54}]}};
assert.equal(houseRailingConflicts(ordinary,buildDeckTakeoff(ordinary)).filter(c=>c.openingId.startsWith('front-window-')).length,0);
assert(houseRailingConflicts(measured,buildDeckTakeoff(measured)).some(c=>c.openingId==='measured-window'));
const raised={...measured,houseConfig:{...measured.houseConfig!,openings:measured.houseConfig!.openings.map(o=>({...o,bottomIn:100}))}};
assert(!houseRailingConflicts(raised,buildDeckTakeoff(raised)).some(c=>c.openingId==='measured-window'));
if(process.argv.includes('--prepare-only')){console.log('House browser proof fixtures ready: default windows clear; measured window clashes at48in and clears at100in. No browser opened.');process.exit(0);}

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors:string[]=[];
const seededPage=async(design:DeckData)=>{
  const context=await browser.newContext({viewport:{width:1600,height:1050},deviceScaleFactor:1});
  await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms|googleapis\.com|gstatic\.com)\//,r=>r.fulfill({status:200,body:''}));
  await context.addInitScript(({key,saved})=>localStorage.setItem(key,saved),{key:DECK_RELEASE_STORAGE_KEY,saved:serializeDeckReleaseDesign(design)});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/Shader Error|WebGLProgram|photographic renderer failed/.test(m.text()))errors.push(m.text());});
  await page.goto(url);
  return page;
};
const openSection=async(page:Page,name:string)=>{
  const button=page.getByRole('region',{name:'Deck configuration'}).getByRole('button',{name,exact:true});
  await expect(button).toBeVisible();
  if(await button.getAttribute('aria-expanded')==='false')await button.click();
  await expect(button).toHaveAttribute('aria-expanded','true');
};
const front=async(page:Page)=>{
  await page.getByRole('tab',{name:'3D',exact:true}).click();
  await page.getByRole('group',{name:'Camera'}).getByRole('button',{name:'Front',exact:true}).click();
  await page.locator('#deck-live-preview canvas').waitFor();
  await page.waitForTimeout(4500);
};
try{
  const defaultPage=await seededPage(ordinary);
  await front(defaultPage);
  await defaultPage.locator('#deck-live-preview').screenshot({path:output+'house-default-front-clear.png'});
  await defaultPage.getByRole('group',{name:'Camera'}).getByRole('button',{name:'Corner',exact:true}).click();
  await defaultPage.waitForTimeout(4500);
  await defaultPage.locator('#deck-live-preview').screenshot({path:output+'house-default-corner-clear.png'});
  await defaultPage.close();
  const page=await seededPage(measured);
  await front(page);
  await openSection(page,'House');
  await openSection(page,'Proposal & files');
  const review=page.getByRole('region',{name:'Construction review items'});
  const clash=review.getByText(/The railing crosses window measured-window or its trim/);
  await expect(clash).toBeVisible();
  const price=page.getByRole('region',{name:'Price schedule',exact:true});
  const priceTable=price.getByRole('table'),quoteList=price.getByRole('list',{name:'Still to be quoted: not in the totals above',exact:true});
  const before={prices:(await priceTable.textContent())!,quotes:(await quoteList.textContent())!};
  await page.locator('#deck-live-preview').screenshot({path:output+'house-measured-window-clash.png'});
  const bottom=page.getByRole('spinbutton',{name:'Opening bottom above grade',exact:true});
  await bottom.fill('100');await bottom.press('Enter');
  await expect(bottom).toHaveValue('100');
  await expect(clash).toHaveCount(0);
  await expect(priceTable).toHaveText(before.prices);await expect(quoteList).toHaveText(before.quotes);
  await expect(price.getByRole('list',{name:'Your changes',exact:true})).toContainText('No price change');
  await page.waitForTimeout(3500);
  await page.locator('#deck-live-preview').screenshot({path:output+'house-measured-window-clear.png'});
  const after={prices:await priceTable.textContent(),quotes:await quoteList.textContent()};
  await bottom.fill('48');await bottom.press('Enter');
  await expect(clash).toBeVisible();
  await expect(priceTable).toHaveText(before.prices);await expect(quoteList).toHaveText(before.quotes);
  assert.deepEqual(errors,[]);
  writeFileSync(new URL('../../../outputs/deckcraft-house-browser-proof.json',import.meta.url),JSON.stringify({url,pageErrors:errors,checks:['Generated default front windows clear of actual railing volumes','Actual generated default captured in Front and Corner views without an explicit house override','Measured window remains in saved position and initially shows collision warning','House editor raising the measured window to100in removes the live warning','Lowering it back to48in restores the live warning','Complete priced schedule unchanged across both appearance-only edits'],priceBefore:before,priceAfter:after,images:['house-default-front-clear.png','house-default-corner-clear.png','house-measured-window-clash.png','house-measured-window-clear.png']},null,2));
  console.log('House browser proof: PASS (default front clear, live warning adds/removes without price changes; screenshots saved)');
}catch(error){console.log(JSON.stringify({pageErrors:errors,stage:'house browser proof failed'}));throw error;}
finally{await browser.close();}
