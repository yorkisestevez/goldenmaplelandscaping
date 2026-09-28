// Measures the deck designer's load on a throttled phone against the production build (run `npm run build`
// first). Pixel 7 viewport, 4x CPU slowdown and Slow 4G (Lighthouse's mobile settings), median of N runs.
// Usage: node scripts/measure-deck-perf.mjs [runs=3] [--json]
import {spawn} from 'node:child_process';
import {chromium,devices} from '@playwright/test';

const runs=Number(process.argv.find(a=>/^\d+$/.test(a))??3),asJson=process.argv.includes('--json');
const PORT=4033,URL=`http://127.0.0.1:${PORT}/deck-designer/`;
const server=spawn('node',['e2e/static-server.mjs'],{env:{...process.env,E2E_PORT:String(PORT)},stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
const browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const median=values=>{const s=[...values].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const samples=[];
try{
  for(let run=0;run<runs;run++){
    const context=await browser.newContext({...devices['Pixel 7']});
    const page=await context.newPage();
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.addInitScript(()=>{
      window.__perf={longTasks:[],lcp:0};
      new PerformanceObserver(list=>{for(const e of list.getEntries())window.__perf.longTasks.push([e.startTime,e.duration]);}).observe({type:'longtask',buffered:true});
      new PerformanceObserver(list=>{for(const e of list.getEntries())window.__perf.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
    });
    await page.goto(URL,{waitUntil:'load'});
    await page.waitForTimeout(12_000);// long enough for the 3D viewer to load if it is going to
    const m=await page.evaluate(()=>{
      const fcp=performance.getEntriesByName('first-contentful-paint')[0]?.startTime??0;
      const scripts=performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script'||/\.js(\?|$)/.test(r.name));
      const viewer=scripts.find(r=>/Deck3DViewer-/.test(r.name));
      const jsBytes=scripts.reduce((n,r)=>n+(r.transferSize||0),0);
      // Blocking time: the part of each long task beyond 50 ms, after first contentful paint.
      const tbt=window.__perf.longTasks.filter(([s])=>s>=fcp).reduce((n,[,d])=>n+Math.max(0,d-50),0);
      const busyBefore3d=window.__perf.longTasks.filter(([s])=>!viewer||s<viewer.startTime).reduce((n,[,d])=>n+d,0);
      return {fcp,lcp:window.__perf.lcp,tbt,jsKB:jsBytes/1024,viewerRequestedAt:viewer?viewer.startTime:null,busyBefore3d};
    });
    samples.push(m);await context.close();
  }
}finally{await browser.close();server.kill();}
const keys=['fcp','lcp','tbt','jsKB','busyBefore3d'];
const result=Object.fromEntries(keys.map(k=>[k,Math.round(median(samples.map(s=>s[k])))]));
result.viewerRequestedAt=samples.map(s=>s.viewerRequestedAt===null?'not requested':Math.round(s.viewerRequestedAt));
if(asJson)console.log(JSON.stringify(result));
else console.log(`Deck designer, Pixel 7, 4x CPU, Slow 4G, median of ${runs}:\n  FCP ${result.fcp} ms | LCP ${result.lcp} ms | blocking time ${result.tbt} ms | JS transferred ${result.jsKB} KB\n  3D viewer requested at: ${result.viewerRequestedAt.join(', ')} ms | long-task time before it: ${result.busyBefore3d} ms`);
