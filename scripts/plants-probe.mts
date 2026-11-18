/**
 * Local speed probe for placed plants and beds, per render tier, on this machine's real GPU.
 *
 *   npm run build && node e2e/static-server.mjs          (or any served build)
 *   npx tsx scripts/plants-probe.mts [--url=http://127.0.0.1:4031/deck-designer/] [--out=probe-out] [--tiers=high,balanced,constrained] [--scenes=demo,estate]
 *
 * Tiers are reached the way a real device reaches them (renderQuality.ts): the high and balanced desktops report 8 and
 * 4 GB / cores, the constrained phone (390 x 844) reports a software renderer. Each run opens one scene in the 3D view,
 * orbits it with the mouse for a few seconds and records, per drawn frame: draw calls, triangles, frame interval (vsync
 * and the frame-rate limit are off, so the interval is the frame's cost) and the GPU time of the frame when the browser
 * exposes timer queries. It also records programs, textures, texture bytes, shadow-map redraws and the sun shadow
 * extent, then runs the magenta leak probe (page showing through the canvas) and the black-frame probe.
 * Scenes: `demo` is scripts/fixtures/plants-realism-demo.json (every library species in beds, three mulch colours, steel
 * edging); `estate` is the Ontario showcase sample opened from its own design link.
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium,type Browser,type Page} from '@playwright/test';
import sharp from 'sharp';
import {encodeDesignLink} from '../src/features/deckcraft/designLink';
import {ontarioShowcaseDesign} from '../src/features/deckcraft/showcaseSample';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';

const arg=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const url=arg('url','http://127.0.0.1:4031/deck-designer/');
const out=arg('out','probe-out');
const tiers=arg('tiers','high,balanced,constrained').split(',') as Tier[];
const scenes=arg('scenes','demo,estate').split(',') as Scene[];
type Tier='high'|'balanced'|'constrained';
type Scene='demo'|'estate';
const DEVICES:Record<Tier,{viewport:{width:number;height:number};scale:number;memory:number;cores:number;software:boolean}>={
 high:{viewport:{width:1600,height:900},scale:1,memory:8,cores:8,software:false},
 balanced:{viewport:{width:1600,height:900},scale:1,memory:4,cores:4,software:false},
 constrained:{viewport:{width:390,height:844},scale:2,memory:4,cores:8,software:true},
};
mkdirSync(out,{recursive:true});

const quantile=(values:number[],q:number)=>{if(!values.length)return 0;const s=[...values].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(q*(s.length-1)+.5))];};
const round=(n:number,d=2)=>Math.round(n*10**d)/10**d;

let estateHash:string|undefined;
async function sceneUrl(scene:Scene){
 if(scene==='demo')return url;
 if(!estateHash){const design=ontarioShowcaseDesign();await ensureLiveDesignExtensions(design);estateHash=new URL(await encodeDesignLink(design,'http://127.0.0.1')).hash;}
 return url+estateHash;
}

/** Runs in the page before any script: device hints for the tier, and a hook on every renderer three announces. */
function instrument(device:{memory:number;cores:number;software:boolean}){
 Object.defineProperty(Navigator.prototype,'deviceMemory',{get:()=>device.memory,configurable:true});
 Object.defineProperty(Navigator.prototype,'hardwareConcurrency',{get:()=>device.cores,configurable:true});
 if(device.software)for(const proto of [WebGL2RenderingContext.prototype,WebGLRenderingContext.prototype]){
  const get=proto.getParameter;
  proto.getParameter=function(this:WebGLRenderingContext,p:number){return p===0x9246?'Google SwiftShader (probe)':get.call(this,p);} as typeof get;
 }
 type Info={render:{calls:number;triangles:number};memory:{geometries:number;textures:number};programs:unknown[]|null;autoReset:boolean};
 type Renderer={isWebGLRenderer:boolean;info:Info;render:(scene:unknown,camera:unknown)=>void;getContext:()=>WebGL2RenderingContext;shadowMap:{render:(...a:unknown[])=>void;autoUpdate:boolean;needsUpdate:boolean;enabled:boolean}};
 const w=window as unknown as {__THREE_DEVTOOLS__:EventTarget;__probe:unknown};
 const probe={renderers:[] as Renderer[],recording:false,frames:[] as {dt:number;calls:number;triangles:number;cpuMs:number}[],calls:0,triangles:0,cpu:0,frame:0,shadowRenders:0,mainScene:null as unknown,gpu:{} as Record<number,number>,depth:0};
 w.__probe=probe;
 w.__THREE_DEVTOOLS__=new EventTarget();
 w.__THREE_DEVTOOLS__.addEventListener('observe',e=>{
  const r=(e as CustomEvent).detail as Renderer;
  if(!r?.isWebGLRenderer||probe.renderers.includes(r))return;
  probe.renderers.push(r);
  const render=r.render.bind(r);
  let timer:{ext:{TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}|null;pending:{query:WebGLQuery;frame:number}[]}|null=null;
  r.render=(scene,camera)=>{
   const gl=r.getContext();
   if(!timer){const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2') as {TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}|null;timer={ext,pending:[]};}
   const top=probe.depth===0;probe.depth++;const started=performance.now();
   let query:WebGLQuery|null=null;
   if(top&&probe.recording&&timer.ext){query=gl.createQuery();if(query)gl.beginQuery(timer.ext.TIME_ELAPSED_EXT,query);}
   try{render(scene,camera);}finally{
    probe.depth--;
    if(query&&timer.ext){gl.endQuery(timer.ext.TIME_ELAPSED_EXT);timer.pending.push({query,frame:probe.frame});}
    if(top)probe.cpu+=performance.now()-started;
   }
   probe.calls+=r.info.render.calls;probe.triangles+=r.info.render.triangles;
   if(top&&scene&&(scene as {isScene?:boolean}).isScene&&(scene as {children:unknown[]}).children.length>((probe.mainScene as {children?:unknown[]})?.children?.length??0))probe.mainScene=scene;
   if(timer.ext&&timer.pending.length){
    const disjoint=gl.getParameter(timer.ext.GPU_DISJOINT_EXT);
    // A frame's GPU time is the sum of its top-level render calls (scene, shadow-free post passes, overlays).
    timer.pending=timer.pending.filter(({query:q,frame})=>{
     if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))return true;
     if(!disjoint&&probe.recording)probe.gpu[frame]=(probe.gpu[frame]??0)+gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;
     gl.deleteQuery(q);return false;
    });
   }
  };
  const shadow=r.shadowMap.render.bind(r.shadowMap);
  r.shadowMap.render=(...a:unknown[])=>{if(probe.recording&&r.shadowMap.enabled&&(r.shadowMap.autoUpdate||r.shadowMap.needsUpdate))probe.shadowRenders++;shadow(...a);};
 });
 let last=0;
 const tick=(t:number)=>{
  if(probe.recording&&probe.calls>0){
   probe.frames.push({dt:last?t-last:0,calls:probe.calls,triangles:probe.triangles,cpuMs:probe.cpu});
   last=t;
  }else if(!probe.recording)last=0;
  probe.calls=0;probe.triangles=0;probe.cpu=0;probe.frame++;
  requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
}

/** Scene totals read from the live renderer: programs, textures and their bytes, the sun's shadow extent. */
function sceneTotals(){
 type Tex={id:number;image?:{width?:number;height?:number;data?:{byteLength?:number}}|{width?:number;height?:number}[];mipmaps?:unknown[];generateMipmaps?:boolean;isCompressedTexture?:boolean;isCubeTexture?:boolean};
 type Obj={traverse:(f:(o:Record<string,unknown>)=>void)=>void;environment?:Tex|null;background?:Tex|null};
 const probe=(window as unknown as {__probe:{renderers:{info:{programs:unknown[]|null;memory:{geometries:number;textures:number}}}[];mainScene:Obj|null}}).__probe;
 const r=probe.renderers.at(-1),scene=probe.mainScene;
 const textures=new Map<number,Tex>();
 const add=(t:unknown)=>{const x=t as Tex|null;if(x&&typeof x==='object'&&'isTexture' in x&&!textures.has(x.id))textures.set(x.id,x);};
 let sun:{mapSize:number;extent:number[]}|null=null,meshes=0,instances=0,casters=0;
 scene?.traverse(o=>{
  const m=o.material as Record<string,unknown>|Record<string,unknown>[]|undefined;
  for(const mat of [m].flat())if(mat)for(const v of Object.values(mat)){add(v);if(v&&typeof v==='object'&&'value' in (v as object))add((v as {value:unknown}).value);}
  const uniforms=(m as {uniforms?:Record<string,{value:unknown}>})?.uniforms;if(uniforms)for(const u of Object.values(uniforms))add(u?.value);
  if(o.isMesh){meshes++;if(o.castShadow)casters++;if(o.isInstancedMesh)instances+=(o.count as number)??0;}
  if(o.isDirectionalLight&&o.castShadow){const s=o.shadow as {mapSize:{x:number};camera:{left:number;right:number;top:number;bottom:number}};if(!sun||s.mapSize.x>sun.mapSize)sun={mapSize:s.mapSize.x,extent:[s.camera.left,s.camera.right,s.camera.top,s.camera.bottom].map(v=>Math.round(v*100)/100)};}
 });
 add(scene?.environment);add(scene?.background);
 let bytes=0;
 for(const t of textures.values()){
  const images=Array.isArray(t.image)?t.image:[t.image];
  for(const img of images){
   if(!img)continue;
   const w=Number((img as {width?:number}).width??0),h=Number((img as {height?:number}).height??0);
   const data=(img as {data?:{byteLength?:number}}).data;
   const base=t.isCompressedTexture&&data?.byteLength?data.byteLength:w*h*4;
   bytes+=base*(t.generateMipmaps!==false&&!t.isCompressedTexture?4/3:1);
  }
 }
 return {programs:r?.info.programs?.length??0,geometries:r?.info.memory.geometries??0,textures:r?.info.memory.textures??0,sceneTextures:textures.size,textureMB:Math.round(bytes/1e4)/100,meshes,shadowCasters:casters,instances,sun};
}

async function pixels(path:string){
 const {data,info}=await sharp(path).raw().toBuffer({resolveWithObject:true});
 let magenta=0,black=0;const n=info.width*info.height;
 for(let i=0;i<data.length;i+=info.channels){
  const r=data[i],g=data[i+1],b=data[i+2];
  if(r>200&&g<60&&b>200)magenta++;
  if(r<12&&g<12&&b<12)black++;
 }
 return {magenta,blackShare:round(black/n,4)};
}

async function drag(page:Page,seconds:number){
 const box=await page.locator('#deck-live-preview canvas').first().boundingBox();
 if(!box)throw Error('no canvas to orbit');
 const cx=box.x+box.width/2,cy=box.y+box.height/2,reach=Math.min(box.width,box.height)*.3;
 await page.mouse.move(cx,cy);await page.mouse.down();
 const steps=Math.round(seconds*60);
 for(let i=1;i<=steps;i++){const a=i/steps*Math.PI*2;await page.mouse.move(cx+Math.sin(a)*reach,cy+Math.sin(a*2)*reach*.25,{steps:1});await page.waitForTimeout(16);}
 await page.mouse.up();
}

async function run(browser:Browser,tier:Tier,scene:Scene){
 const device=DEVICES[tier];
 const context=await browser.newContext({viewport:device.viewport,deviceScaleFactor:device.scale,isMobile:tier==='constrained',hasTouch:tier==='constrained'});
 const page=await context.newPage();
 const problems:string[]=[];
 page.on('pageerror',e=>problems.push(e.message.slice(0,300)));
 // A driver's precision warnings (D3D X4122) are not errors.
 page.on('console',m=>{const t=m.text();if(/Shader Error|WebGLProgram|ERROR: 0:|CONTEXT_LOST/.test(t)&&!(/Program Info Log/.test(t)&&!/error/i.test(t)))problems.push(t.slice(0,300));});
 // tsx keeps function names with an __name helper the page does not have.
 await page.addInitScript('window.__name=(f)=>f');
 await page.addInitScript(instrument,device);
 await page.goto(await sceneUrl(scene));
 await page.waitForFunction(()=>(window as unknown as {deckcraft?:{read:()=>{ready:boolean}}}).deckcraft?.read().ready,undefined,{timeout:90_000});
 if(scene==='demo'){
  const objects=JSON.parse(readFileSync('scripts/fixtures/plants-realism-demo.json','utf8'));
  const result=await page.evaluate(o=>(window as unknown as {deckcraft:{execute:(r:unknown)=>Promise<{ok:boolean}>}}).deckcraft.execute({id:'plants-probe',commands:[{type:'design.patch',patch:{landscapeObjects:o}}]}),objects);
  if(!result.ok)throw Error(`${tier}/${scene}: the demo planting was refused`);
 }
 await page.getByRole('tab',{name:'3D',exact:true}).click();
 const canvas=page.locator('#deck-live-preview canvas').first();
 await canvas.waitFor({state:'visible',timeout:90_000});
 const quality=await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].map(c=>c.dataset.renderQuality).find(Boolean),undefined,{timeout:60_000}).then(h=>h.jsonValue());
 if(quality!==tier)problems.push(`asked for the ${tier} tier, the viewer chose ${quality}`);
 const corner=page.getByRole('button',{name:'Corner',exact:true});
 if(await corner.isVisible().catch(()=>false))await corner.click();
 // Let models, textures and the shadow map settle.
 await page.waitForTimeout(scene==='estate'?25_000:18_000);
 const settled=sceneTotals;
 await page.evaluate(()=>{const p=(window as unknown as {__probe:{recording:boolean;frames:unknown[];gpu:Record<number,number>;shadowRenders:number}}).__probe;p.frames=[];p.gpu={};p.shadowRenders=0;p.recording=true;});
 await drag(page,5);
 await page.waitForTimeout(600);
 const raw=await page.evaluate(()=>{const p=(window as unknown as {__probe:{recording:boolean;frames:{dt:number;calls:number;triangles:number;cpuMs:number}[];gpu:Record<number,number>;shadowRenders:number}}).__probe;p.recording=false;return {frames:p.frames,gpu:Object.values(p.gpu),shadowRenders:p.shadowRenders};});
 const totals=await page.evaluate(settled);
 const frames=raw.frames.filter(f=>f.dt>0);
 const name=`${out}/${tier}-${scene}`;
 if(await corner.isVisible().catch(()=>false)){await corner.click();await page.waitForTimeout(5000);}
 await canvas.screenshot({path:`${name}.png`});
 const still=await pixels(`${name}.png`);
 await page.evaluate(()=>{const c=document.querySelector('#deck-live-preview canvas') as HTMLCanvasElement;c.style.background='#ff00ff';c.parentElement!.style.background='#ff00ff';});
 await page.waitForTimeout(800);
 await canvas.screenshot({path:`${name}-magenta.png`});
 const leak=await pixels(`${name}-magenta.png`);
 const gpu=await page.evaluate(()=>{const c=document.querySelector('#deck-live-preview canvas') as HTMLCanvasElement,g=c.getContext('webgl2')!,d=g.getExtension('WEBGL_debug_renderer_info');return d?String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)):'?';});
 await context.close();
 return {
  tier,scene,quality,gpu,
  frames:frames.length,
  frameMs:{p50:round(quantile(frames.map(f=>f.dt),.5)),p95:round(quantile(frames.map(f=>f.dt),.95))},
  cpuMs:{p50:round(quantile(frames.map(f=>f.cpuMs),.5)),p95:round(quantile(frames.map(f=>f.cpuMs),.95))},
  gpuMs:raw.gpu.length?{p50:round(quantile(raw.gpu,.5)),p95:round(quantile(raw.gpu,.95)),frames:raw.gpu.length}:null,
  drawCalls:{p50:quantile(frames.map(f=>f.calls),.5),max:Math.max(0,...frames.map(f=>f.calls))},
  triangles:{p50:quantile(frames.map(f=>f.triangles),.5),max:Math.max(0,...frames.map(f=>f.triangles))},
  shadowRedrawsPerFrame:round(raw.shadowRenders/Math.max(1,raw.frames.length)),
  ...totals,
  magentaPixels:leak.magenta,
  blackShare:still.blackShare,
  problems,
 };
}

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-gpu-vsync','--disable-frame-rate-limit']});
const results=[];
try{
 for(const scene of scenes)for(const tier of tiers){
  console.log(`probe ${tier} / ${scene}`);
  const r=await run(browser,tier,scene);
  console.log(JSON.stringify({tier,scene,quality:r.quality,p95:r.frameMs.p95,cpu:r.cpuMs.p95,gpu:r.gpuMs?.p95,calls:r.drawCalls.p50,tris:r.triangles.p50,magenta:r.magentaPixels,problems:r.problems.length}));
  results.push(r);
 }
}finally{await browser.close();}
writeFileSync(`${out}/metrics.json`,JSON.stringify({url,at:new Date().toISOString(),results},null,1)+'\n');
console.log(`wrote ${out}/metrics.json`);
