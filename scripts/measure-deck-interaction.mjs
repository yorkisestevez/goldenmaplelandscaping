// Measures how the deck designer feels on a desktop with a real GPU, against the production build (run
// `npm run build` first): startup on the Plan tab (what loads before anyone opens 3D), then in 3D an orbit drag
// (frame times), and a colour change (main-thread work it causes). Median of N runs.
// Usage: node scripts/measure-deck-interaction.mjs [runs=3] [--json]
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';

const runs=Number(process.argv.find(a=>/^\d+$/.test(a))??3),asJson=process.argv.includes('--json');
const PORT=4063,URL=`http://127.0.0.1:${PORT}/deck-designer/`;
const server=spawn('node',['e2e/static-server.mjs'],{env:{...process.env,E2E_PORT:String(PORT)},stdio:'ignore'});
await new Promise(r=>setTimeout(r,1200));
// Hardware ANGLE, not SwiftShader: this measures the desktop app's experience on a real GPU.
const browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',args:['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu-rasterization']});
const median=values=>{const s=[...values].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const percentile=(values,p)=>{const s=[...values].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*p))]??0;};
const samples=[];
try{
  for(let run=0;run<runs;run++){
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await context.newPage();
    await page.addInitScript(()=>{
      window.__perf={longTasks:[]};
      new PerformanceObserver(list=>{for(const e of list.getEntries())window.__perf.longTasks.push([e.startTime,e.duration]);}).observe({type:'longtask',buffered:true});
    });
    const busy=(from,to)=>page.evaluate(([a,b])=>window.__perf.longTasks.filter(([s])=>s>=a&&s<b).reduce((n,[,d])=>n+d,0),[from,to]);
    const now=()=>page.evaluate(()=>performance.now());
    await page.goto(URL,{waitUntil:'load'});
    await page.waitForTimeout(8000);
    const plan=await page.evaluate(()=>{
      const res=performance.getEntriesByType('resource'),js=res.filter(r=>/\.m?js(\?|$)/.test(r.name));
      return {startupBusy:window.__perf.longTasks.reduce((n,[,d])=>n+d,0),startupJsKB:js.reduce((n,r)=>n+(r.decodedBodySize||0),0)/1024,
        viewerLoadedOnPlan:res.some(r=>/Deck3DViewer-/.test(r.name)),hdrLoadedOnPlan:res.some(r=>/\.hdr(\?|$)/.test(r.name)),texturesOnPlan:res.filter(r=>/lawn-|room-|\.hdr/.test(r.name)).length};
    });
    // Open 3D and let it settle.
    // A 50 ms heartbeat: any time the page cannot run it is time a click or a drag would also have waited, whatever
    // size of task blocked it (shader compile waits come in pieces too small for the long-task observer).
    await page.evaluate(()=>{window.__beats=[];let last=performance.now();window.__beat=setInterval(()=>{const t=performance.now();window.__beats.push([t,t-last]);last=t;},50);});
    const t3d=await now();
    await page.getByRole('tab',{name:'3D',exact:true}).click();
    await page.locator('.dd-canvas canvas').waitFor({state:'visible',timeout:60_000});
    await page.waitForTimeout(8000);
    const stall=await page.evaluate(a=>{clearInterval(window.__beat);const b=window.__beats.filter(([t])=>t>=a);const late=b.filter(([,g])=>g>150);
      return {open3dStall:b.reduce((n,[,g])=>n+Math.max(0,g-50),0),open3dWorstStall:Math.max(0,...b.map(([,g])=>g)),open3dSettledAt:late.length?late.at(-1)[0]-a:0};},t3d);
    const renderer=await page.evaluate(()=>{const c=document.querySelector('.dd-canvas canvas'),gl=c?.getContext('webgl2');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
    const open3dBusy=await busy(t3d,await now());
    // Orbit: a 3 s drag across the canvas, counting frames the page actually paints.
    const box=await page.locator('.dd-canvas canvas').boundingBox();
    await page.evaluate(()=>{window.__frames=[];const tick=t=>{window.__frames.push(t);if(window.__framesOn)requestAnimationFrame(tick);};window.__framesOn=true;requestAnimationFrame(tick);});
    const tOrbit=await now();
    await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await page.mouse.down();
    for(let i=0;i<=90;i++){await page.mouse.move(box.x+box.width*(.3+.4*i/90),box.y+box.height*(.5-.1*Math.sin(i/90*Math.PI)));await page.waitForTimeout(33);}
    await page.mouse.up();
    const orbit=await page.evaluate(()=>{window.__framesOn=false;const f=window.__frames,gaps=f.slice(1).map((t,i)=>t-f[i]);return {frames:f.length,gaps};});
    const orbitBusy=await busy(tOrbit,await now());
    // A colour change in 3D: the estimate, the model and the scene all react.
    await page.waitForTimeout(1500);
    await page.getByRole('tab',{name:'Materials'}).click();await page.waitForTimeout(1500);
    const tColour=await now();
    const pick=page.locator('.dd-colours button[aria-pressed="false"]').first(),name=await pick.getAttribute('aria-label');
    await pick.click();await page.waitForTimeout(3000);
    if(await page.locator(`.dd-colours button[aria-label="${name}"]`).getAttribute('aria-pressed')!=='true')throw new Error(`The colour click did not select ${name}`);
    const colourBusy=await busy(tColour,await now());
    const longestColourTask=await page.evaluate(a=>Math.max(0,...window.__perf.longTasks.filter(([s])=>s>=a).map(([,d])=>d)),tColour);
    samples.push({...plan,...stall,renderer,open3dBusy,orbitFps:orbit.frames/3.0,orbitP95FrameMs:percentile(orbit.gaps,.95),orbitBusy,colourBusy,longestColourTask});
    await context.close();
  }
}finally{await browser.close();server.kill();}
const keys=['startupBusy','startupJsKB','open3dBusy','open3dStall','open3dWorstStall','open3dSettledAt','orbitFps','orbitP95FrameMs','orbitBusy','colourBusy','longestColourTask'];
const result=Object.fromEntries(keys.map(k=>[k,Math.round(median(samples.map(s=>s[k])))]));
Object.assign(result,{renderer:samples[0]?.renderer,viewerLoadedOnPlan:samples.map(s=>s.viewerLoadedOnPlan),hdrLoadedOnPlan:samples.map(s=>s.hdrLoadedOnPlan)});
if(asJson)console.log(JSON.stringify(result));
else console.log(`Deck designer, desktop 1440x900, ${result.renderer}, median of ${runs}:
  Plan startup: ${result.startupBusy} ms main-thread busy, ${result.startupJsKB} KB JS; 3D viewer loaded on Plan: ${result.viewerLoadedOnPlan}; sky HDR on Plan: ${result.hdrLoadedOnPlan}
  Open 3D: ${result.open3dBusy} ms in long tasks, page frozen ${result.open3dStall} ms (worst ${result.open3dWorstStall} ms), settled ${result.open3dSettledAt} ms after the click
  Orbit: ${result.orbitFps} fps, p95 frame ${result.orbitP95FrameMs} ms, ${result.orbitBusy} ms busy
  Colour change in 3D: ${result.colourBusy} ms busy, longest task ${result.longestColourTask} ms`);
