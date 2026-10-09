/** Raster versus path-traced stills of the Ontario backyard sample.
 * Software GPUs trace the live canvas (fewer samples than a 2K export). Run a designer first:
 *   npx react-router dev --port 4187
 *   DECKCRAFT_PROOF_URL=http://127.0.0.1:4187/deck-designer/ npx tsx scripts/capture-photo-stills.ts
 */
import {mkdirSync} from 'node:fs';
import {chromium,type Page} from '@playwright/test';

const url=process.env.DECKCRAFT_PROOF_URL??'http://127.0.0.1:4187/deck-designer/';
const samples=Number(process.env.DECK_PHOTO_SAMPLES??'8');
const output=process.env.DECK_PHOTO_OUT??'/opt/cursor/artifacts/photo-mode';
mkdirSync(output,{recursive:true});

const shots:[string,'day'|'golden'|'night','daylight'|'evening',boolean][]=[
 ['raster-day','day','daylight',false],
 ['raster-golden','golden','daylight',false],
 ['raster-night','night','evening',false],
 ['trace-day','day','daylight',true],
 ['trace-golden','golden','daylight',true],
 ['trace-night','night','evening',true],
];

async function openShot(page:Page,name:string,look:'day'|'golden'|'night',lighting:'daylight'|'evening',photo:boolean){
 const params=new URLSearchParams({ 'deck-sample':'ontario','deck-quality':'showcase','deck-context':'1','deck-lighting':lighting });
 if(photo){params.set('deck-photo','1');params.set('deck-photo-look',look);params.set('deck-photo-samples',String(samples));}
 const errors:string[]=[];
 page.removeAllListeners('pageerror');page.removeAllListeners('console');
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(/Shader Error|WebGLProgram|path tracing stopped|path tracing is unavailable/.test(message.text()))errors.push(message.text());});
 await page.goto(`${url.split('?')[0]}?${params}`);
 await page.getByRole('tab',{name:'3D',exact:true}).click();
 const canvas=page.locator('#deck-live-preview canvas');
 await canvas.waitFor({timeout:120_000});
 await page.waitForFunction(()=>document.querySelector('#deck-live-preview canvas')?.getAttribute('data-showcase-context')==='1',undefined,{timeout:120_000});
 if(!photo){
  await page.waitForFunction(()=>document.querySelector('#deck-live-preview canvas')?.getAttribute('data-photographic-pipeline')==='active',undefined,{timeout:120_000});
  await page.waitForTimeout(4000);
 }else{
  await page.waitForFunction(()=>{
   const phase=document.querySelector('#deck-live-preview canvas')?.getAttribute('data-photo-phase');
   return phase==='ready'||phase==='fallback';
  },undefined,{timeout:1_200_000});
  const phase=await canvas.getAttribute('data-photo-phase');
  if(phase==='fallback')throw Error(`${name}: ${await page.locator('#deck-live-preview [role=status]').last().innerText()}`);
 }
 await canvas.screenshot({path:`${output}/${name}.png`});
 if(errors.length)throw Error(`${name}: ${errors.join('\n')}`);
 console.log('wrote',`${output}/${name}.png`);
}

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms|googleapis\.com|gstatic\.com)\//,route=>route.fulfill({status:200,body:''}));
const page=await context.newPage();
try{
 for(const [name,look,lighting,photo] of shots)await openShot(page,name,look,lighting,photo);
}finally{await browser.close();}
