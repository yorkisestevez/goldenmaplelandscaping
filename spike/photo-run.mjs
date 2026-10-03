// THROWAWAY G0 spike driver: loads a design into the deck designer (render-luxury.mjs recipe), then runs path-traced
// photo jobs through window.__deckcraftPhoto (only present with ?photo-api=1) and saves PNGs + stats.
// usage: node spike/photo-run.mjs <design.json> <outDir> <jobs.json | inline JSON> [baseUrl]
//   baseUrl omitted: serves this worktree's build/client on E2E_PORT (default 4091).
import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {chromium} from '../node_modules/playwright-core/index.mjs';

const [designFile,OUT,jobsArg,baseArg]=process.argv.slice(2);
const jobs=JSON.parse(existsSync(jobsArg)?readFileSync(jobsArg,'utf8'):jobsArg);
mkdirSync(OUT,{recursive:true});
const design=readFileSync(designFile,'utf8');
const PORT=process.env.E2E_PORT||'4091';
let server=null;
if(!baseArg){server=spawn(process.execPath,['e2e/static-server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,E2E_PORT:PORT},stdio:'ignore'});await new Promise(r=>setTimeout(r,1500));}
const BASE=baseArg||`http://127.0.0.1:${PORT}`;

const gpuNow=()=>{const r=spawnSync('nvidia-smi',['--query-gpu=memory.used,utilization.gpu','--format=csv,noheader,nounits']);const [mem,util]=String(r.stdout).trim().split(',').map(Number);return {mem,util};};
function gpuSampler(){const samples=[];const t=setInterval(()=>samples.push(gpuNow()),1000);return {stop(){clearInterval(t);return {maxMemMiB:Math.max(...samples.map(s=>s.mem)),maxUtil:Math.max(...samples.map(s=>s.util)),n:samples.length};}};}

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu-rasterization']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await context.addInitScript(text=>{
  try{localStorage.setItem('golden-maple.deck-studio.deck-only.v1',text);}catch{}
  window.__THREE_DEVTOOLS__=new EventTarget();window.__threeSeen=[];
  window.__THREE_DEVTOOLS__.addEventListener('observe',e=>window.__threeSeen.push(e.detail));
},design);
const page=await context.newPage();
const errors=[],warnings=[];
page.on('pageerror',e=>errors.push('pageerror: '+String(e).slice(0,400)));
page.on('console',m=>{const t=m.text();if(m.type()==='error')errors.push(t.slice(0,400));else if(m.type()==='warning'&&!/GPU stall|Automatic fallback/.test(t))warnings.push(t.slice(0,300));});
await page.route(/googletagmanager|clarity\.ms|facebook\.net|doubleclick|google-analytics/,r=>r.fulfill({status:200,body:''}));
const tLoad=Date.now();
await page.goto(`${BASE}/deck-designer/?photo-api=1`,{waitUntil:'networkidle',timeout:180000});
await page.getByRole('tab',{name:'3D',exact:true}).click();
await page.locator('.dd-canvas canvas').first().waitFor({state:'visible',timeout:180000});
await page.waitForLoadState('networkidle');
await page.waitForTimeout(15000);
const chunksBefore=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/photo|BVH|bvh/i.test(n)));
const hasApi=await page.evaluate(()=>!!window.__deckcraftPhoto);
console.log(JSON.stringify({loadedMs:Date.now()-tLoad,hasApi,photoChunksBeforeUse:chunksBefore}));
if(!hasApi)throw new Error('window.__deckcraftPhoto missing');
const collapse=await page.evaluate(()=>window.__deckcraftPhoto.testInstancedCollapse());
const chunksAfter=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/photo|BVH|bvh/i.test(n)));
console.log(JSON.stringify({instancedCollapse:collapse,photoChunksAfterLoad:chunksAfter}));

const FULL=`body *{visibility:hidden!important}
#deck-live-preview,#deck-live-preview .dd-canvas,#deck-live-preview .dd-canvas *{visibility:visible!important}
#deck-live-preview{position:fixed!important;inset:0!important;z-index:9999!important;padding:0!important;margin:0!important;border:0!important;outline:0!important;max-height:none!important}
#deck-live-preview>:not(#dd-sheet),#dd-sheet>:not(.dd-canvas),.dd-canvas>div>p,.dd-canvas>p{display:none!important}
#deck-live-preview .dd-canvas,#deck-live-preview .dd-canvas>div{width:100vw!important;height:100vh!important;aspect-ratio:auto!important;border:0!important;margin:0!important}`;

const results=[];
let lastTime=null,lastPreset=null;
for(const job of jobs){
  if(job.preset!==lastPreset||job.time!==lastTime){
    await page.evaluate(()=>document.getElementById('gm-full')?.remove());
    await page.waitForTimeout(300);
    await page.getByRole('group',{name:'Camera'}).getByRole('button',{name:job.preset==='Above'?'Front':'Above',exact:true}).click();
    await page.waitForTimeout(2000);
    await page.getByRole('group',{name:'Camera'}).getByRole('button',{name:job.preset,exact:true}).click();
    await page.getByRole('group',{name:'Day or night preview'}).getByRole('button',{name:job.time==='night'?/Night/:/Day/}).click();
    await page.addStyleTag({content:FULL}).then(h=>h.evaluate(el=>{el.id='gm-full';}));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    await page.locator('.dd-canvas canvas').first().screenshot({path:`${OUT}/${job.name}-live.png`});
    lastTime=job.time;lastPreset=job.preset;
  }
  const gpu=gpuSampler();const t0=Date.now();
  const {png,denoised,stats}=await page.evaluate(o=>window.__deckcraftPhoto.render(o),job.opts);
  stats.wallMs=Date.now()-t0;stats.gpu=gpu.stop();
  if(png)writeFileSync(`${OUT}/${job.name}.png`,Buffer.from(png.split(',')[1],'base64'));
  if(denoised)writeFileSync(`${OUT}/${job.name}-denoised.png`,Buffer.from(denoised.split(',')[1],'base64'));
  results.push({job:job.name,time:job.time,stats});
  console.log(JSON.stringify({job:job.name,stats}));
  writeFileSync(`${OUT}/${job.name}.stats.json`,JSON.stringify(stats,null,1));
}
const liveLost=await page.evaluate(()=>{const c=document.querySelector('.dd-canvas canvas');const g=c?.getContext('webgl2');return g?g.isContextLost():'no-ctx';});
await browser.close();server?.kill();
writeFileSync(`${OUT}/run-${Date.now()}.json`,JSON.stringify({design:designFile,collapse,chunksBefore,chunksAfter,results,errors,warnings:[...new Set(warnings)].slice(0,40),liveContextLostAtEnd:liveLost},null,1));
console.log(JSON.stringify({errors,warnings:[...new Set(warnings)].slice(0,40),liveContextLostAtEnd:liveLost}));
