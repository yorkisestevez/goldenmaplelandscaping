/** Raster versus path-traced stills of the Ontario backyard sample.
 * Software GPUs trace the live canvas (fewer samples than a 2K export). Run a designer first:
 *   npx react-router dev --port 4187
 *   DECKCRAFT_PROOF_URL=http://127.0.0.1:4187/deck-designer/ npx tsx scripts/capture-photo-stills.ts
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,type Page} from '@playwright/test';

const url=process.env.DECKCRAFT_PROOF_URL??'http://127.0.0.1:4187/deck-designer/';
const samples=Number(process.env.DECK_PHOTO_SAMPLES??'256');
const output=process.env.DECK_PHOTO_OUT??'/opt/cursor/artifacts/photo-mode';
mkdirSync(output,{recursive:true});

const all:[string,'day'|'golden'|'night','daylight'|'evening',boolean][]=[
 ['raster-day','day','daylight',false],
 ['raster-golden','golden','daylight',false],
 ['raster-night','night','evening',false],
 ['trace-day','day','daylight',true],
 ['trace-golden','golden','daylight',true],
 ['trace-night','night','evening',true],
];
const only=new Set((process.env.DECK_PHOTO_ONLY??'').split(',').filter(Boolean));
const shots=all.filter(shot=>only.size===0||only.has(shot[0]));

async function saveStill(page:Page,name:string,photo:boolean){
 if(photo){
  const data=await page.evaluate(()=>(window as Window&{__DECK_PHOTO_PNG?:string}).__DECK_PHOTO_PNG??'');
  if(!data.startsWith('data:image/png;base64,'))throw Error(`${name}: the path-traced still was not stored`);
  writeFileSync(`${output}/${name}.png`,Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
  return;
 }
 await saveCanvas(page,name);
}
async function saveCanvas(page:Page,name:string){
 await page.evaluate(()=>{
  document.querySelector('#deck-live-preview canvas')?.scrollIntoView({block:'center',inline:'nearest'});
  document.querySelectorAll('#deck-live-preview .absolute').forEach(el=>el.remove());
 });
 await page.waitForTimeout(400);
 const box=await page.evaluate(()=>{
  const canvas=document.querySelector('#deck-live-preview canvas');if(!canvas)return null;
  const rect=canvas.getBoundingClientRect();
  const top=Math.max(0,rect.top),left=Math.max(0,rect.left);
  const bottom=Math.min(window.innerHeight,rect.bottom),right=Math.min(window.innerWidth,rect.right);
  return {x:left,y:top,width:right-left,height:bottom-top};
 });
 if(!box||box.width<32||box.height<32)throw Error(`${name}: the 3D view has no canvas to capture`);
 const session=await page.context().newCDPSession(page);
 const shot=await session.send('Page.captureScreenshot',{format:'png',clip:{x:Math.round(box.x),y:Math.round(box.y),width:Math.round(box.width),height:Math.round(box.height),scale:1},captureBeyondViewport:false});
 writeFileSync(`${output}/${name}.png`,Buffer.from(shot.data,'base64'));
 await session.detach();
}
async function openShot(page:Page,name:string,look:'day'|'golden'|'night',lighting:'daylight'|'evening',photo:boolean){
 console.log('shot',name);
 const params=new URLSearchParams({ 'deck-sample':'ontario','deck-quality':'showcase','deck-context':'1','deck-lighting':lighting });
 if(photo){params.set('deck-photo','1');params.set('deck-photo-look',look);params.set('deck-photo-samples',String(samples));params.set('deck-photo-edge',process.env.DECK_PHOTO_EDGE??'2048');if(process.env.DECK_PHOTO_SCALE)params.set('deck-photo-scale',process.env.DECK_PHOTO_SCALE);}
 const errors:string[]=[];
 page.removeAllListeners('pageerror');page.removeAllListeners('console');
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{const text=message.text();if(/Shader Error|WebGLProgram|path tracing stopped|path tracing is unavailable|trace triangles/.test(text))errors.push(text.slice(0,700));});
 await page.goto(`${url.split('?')[0]}?${params}`);
 await page.getByRole('tab',{name:'3D',exact:true}).click();
 const appeared=Date.now()+180_000;let canvasSeen=false;
 while(Date.now()<appeared){
  canvasSeen=await page.evaluate(()=>{const canvas=document.querySelector('#deck-live-preview canvas');const box=canvas?.getBoundingClientRect();return !!box&&box.width>32&&box.height>32;});
  if(canvasSeen)break;
  await page.waitForTimeout(1000);
 }
 if(!canvasSeen){const body=await page.locator('body').innerText().catch(()=>'');throw Error(`${name}: the 3D canvas never appeared. ${body.slice(0,240).replace(/\s+/g,' ')}`);}
 await page.waitForFunction(()=>document.querySelector('#deck-live-preview canvas')?.getAttribute('data-showcase-context')==='1',undefined,{timeout:120_000});
 if(!photo){
  await page.waitForFunction(()=>document.querySelector('#deck-live-preview canvas')?.getAttribute('data-photographic-pipeline')==='active',undefined,{timeout:120_000});
  await page.waitForTimeout(4000);
 }else{
  const deadline=Date.now()+5_400_000;let last='',lastChange=Date.now();
  while(Date.now()<deadline){
   const state=await page.evaluate(()=>{const canvas=document.querySelector('#deck-live-preview canvas');return {phase:canvas?.getAttribute('data-photo-phase')??'',samples:canvas?.getAttribute('data-photo-samples')??'',target:canvas?.getAttribute('data-photo-target')??'',census:canvas?.getAttribute('data-photo-census')??'',still:canvas?.getAttribute('data-photo-still')??'',buffer:canvas?.getAttribute('data-photo-buffer')??''};});
   const line=`${state.phase||'waiting'} ${state.samples||'0'}/${state.target||'?'} ${state.buffer} census=${state.census} still=${state.still}`;
   if(line!==last){console.log(name,line);last=line;lastChange=Date.now();}
   else if(Date.now()-lastChange>1_200_000)throw Error(`${name}: no sample progress for 20 minutes (${line})`);
   if(state.phase==='ready'||state.phase==='fallback')break;
   await page.waitForTimeout(3000);
  }
  const phase=await page.evaluate(()=>document.querySelector('#deck-live-preview canvas')?.getAttribute('data-photo-phase')??'');
  if(phase!=='ready')throw Error(`${name}: photo phase ${phase??'missing'}. ${await page.locator('#deck-live-preview [role=status]').last().innerText().catch(()=>'')} ${errors.join(' | ')}`);
 }
 await saveStill(page,name,photo);
 if(errors.length)throw Error(`${name}: ${errors.join('\n')}`);
 console.log('wrote',`${output}/${name}.png`);
}

const browserArgs=['--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox'];
for(const [name,look,lighting,photo] of shots){
 const browser=process.env.DECK_BROWSER
  ?await chromium.launch({executablePath:process.env.DECK_BROWSER,headless:true,args:browserArgs})
  :await chromium.launch({channel:'msedge',headless:true,args:browserArgs}).catch(()=>chromium.launch({executablePath:'/opt/google/chrome/chrome',headless:true,args:browserArgs}));
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1200},deviceScaleFactor:1});
  await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms|googleapis\.com|gstatic\.com)\//,route=>route.fulfill({status:200,body:''}));
  const page=await context.newPage();
  page.setDefaultTimeout(180_000);page.setDefaultNavigationTimeout(180_000);
  await openShot(page,name,look,lighting,photo);
 }catch(error){console.error('failed',name,error instanceof Error?error.message:error);}
 finally{await browser.close();}
}
