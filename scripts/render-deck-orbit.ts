// Renders a DeckCraft design for the marketing reels (video/README.md): the designer is opened with
// ?deck-capture=1, the 3D view fills the browser window at the output size, and every picture is posed and grabbed
// through the page's own photographic pipeline.
//
// Stills, any number per browser session (name@WIDTHxHEIGHT:azimuthDeg:elevationDeg:distance:liftFt):
//   npx tsx scripts/render-deck-orbit.ts --design video/designs/shanty-bay.json --scene night \
//     --stills "hero@1920x1080:0:14:0.95:2;plan@1920x1080:0:80:1.1:0" --out video/out/stills/shanty-bay-night
// A camera move, joined by ffmpeg (rendered at --fps, motion-interpolated up to --interp):
//   npx tsx scripts/render-deck-orbit.ts --design video/designs/shanty-bay.json --size 1280x720 \
//     --move orbit --sweep 24 --seconds 4 --fps 12 --interp 30 --out video/out/clips/shanty-bay-orbit.mp4
//
// Azimuth is relative to the designer's own 3D camera, elevation is absolute (degrees above the horizon) and distance
// is a multiple of the designer's camera distance. Software WebGL draws about 0.1 megapixel a second, so frame
// count times frame size is the budget.
// Needs the production build served (node e2e/static-server.mjs) or DECKCRAFT_PROOF_URL pointing at a dev server.
// CHROMIUM_PATH picks a Chromium other than the one this Playwright version expects; E2E_CHANNEL picks e.g. msedge.
import {chromium,type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {DECK_RELEASE_STORAGE_KEY,parseDeckReleaseDesign,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';

const arg=(name:string,fallback?:string)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback;};
const designPath=arg('design');if(!designPath)throw new Error('--design <file.json> is required');
const out=arg('out');if(!out)throw new Error('--out is required');
const scene=arg('scene'),stills=arg('stills');
const url=(process.env.DECKCRAFT_PROOF_URL??'http://127.0.0.1:4031/deck-designer/')+'?deck-capture=1';
type Vec=[number,number,number];
interface Pose {az:number;elev:number;dist:number;lift:number}

let design=parseDeckReleaseDesign(readFileSync(designPath,'utf8'));
if(scene)design={...design,sceneLighting:scene==='night'?'Evening':'Daylight'};

/** Sizes the 3D view to exactly width × height: inline !important outranks the designer's sized-preview rules. */
async function frameView(page:Page,width:number,height:number){
  await page.setViewportSize({width,height});
  await page.evaluate(({width,height})=>{
    const view=document.querySelector<HTMLElement>('[aria-label="Interactive deck construction model"]')!;
    for(const [k,v] of Object.entries({position:'fixed',left:'0',top:'0',width:width+'px',height:height+'px','max-width':'none','max-height':'none','aspect-ratio':'auto','z-index':'2147483646'}))view.style.setProperty(k,v,'important');
    view.querySelectorAll<HTMLElement>(':scope>p').forEach(p=>p.style.setProperty('display','none','important'));
  },{width,height});
  const canvasSize=()=>page.evaluate(()=>{const c=document.querySelector<HTMLCanvasElement>('[aria-label="Interactive deck construction model"] canvas');return c?`${c.width}x${c.height}`:'no canvas';});
  await page.waitForFunction(({width,height})=>{const c=document.querySelector<HTMLCanvasElement>('[aria-label="Interactive deck construction model"] canvas');return !!c&&c.width===width&&c.height===height;},{width,height},{timeout:90_000})
    .catch(async error=>{throw new Error(`3D view never reached ${width}x${height} (canvas ${await canvasSize()}): ${error.message}`);});
  await page.waitForTimeout(500);
}

const [firstW,firstH]=(stills?stills.split(';')[0].split('@')[1].split(':')[0]:arg('size','1280x720')!).split('x').map(Number);
const browser=await chromium.launch({channel:process.env.E2E_CHANNEL,executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:firstW,height:firstH},deviceScaleFactor:1});
await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|google-analytics\.com|facebook\.net|clarity\.ms|googleapis\.com|gstatic\.com)\//,r=>r.fulfill({status:200,body:''}));
await context.addInitScript(({key,saved})=>localStorage.setItem(key,saved),{key:DECK_RELEASE_STORAGE_KEY,saved:serializeDeckReleaseDesign(design)});
const page=await context.newPage(),errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(/Shader Error|WebGLProgram|photographic renderer failed/.test(m.text()))errors.push(m.text());});
try{
  await page.goto(url);
  const tab=page.getByRole('tab',{name:'3D',exact:true});
  if(await tab.count())await tab.click();
  await page.waitForFunction(()=>!!(window as any).__deckCapture,null,{timeout:120_000});
  await frameView(page,firstW,firstH);
  await page.waitForFunction(()=>(window as any).__deckCapture.ready(),null,{timeout:120_000,polling:1000});
  await page.waitForTimeout(4000); // sky and environment textures
  const home=await page.evaluate(()=>(window as any).__deckCapture.home()) as {position:number[];target:number[]};
  const [tx,ty,tz]=home.target,off=home.position.map((v,i)=>v-home.target[i]);
  const radius=Math.hypot(...off),az0=Math.atan2(off[0],off[2]),el0=Math.asin(off[1]/radius),deg=Math.PI/180;
  const shoot=async(p:Pose)=>{
    const r=radius*p.dist,az=az0+p.az*deg,el=p.elev*deg,target:Vec=[tx,ty+p.lift,tz];
    const position:Vec=[tx+r*Math.cos(el)*Math.sin(az),ty+p.lift+r*Math.sin(el),tz+r*Math.cos(el)*Math.cos(az)];
    const jpeg=await page.evaluate(({position,target})=>{const c=(window as any).__deckCapture;c.pose(position,target);return c.shot();},{position,target}) as string|null;
    if(!jpeg)throw new Error('a frame failed to render');
    return Buffer.from(jpeg.split(',')[1],'base64');
  };
  if(stills){
    mkdirSync(out,{recursive:true});
    for(const spec of stills.split(';')){
      const [name,rest]=spec.split('@'),[size,az,elev,dist,lift]=rest.split(':'),[w,h]=size.split('x').map(Number);
      await frameView(page,w,h);
      writeFileSync(join(out,name+'.jpg'),await shoot({az:Number(az),elev:Number(elev),dist:Number(dist),lift:Number(lift??0)}));
      console.log(`${join(out,name)}.jpg`);
    }
  }else{
    const move=arg('move','orbit') as 'orbit'|'reveal'|'push',fps=Number(arg('fps','12')),interp=Number(arg('interp','30')),seconds=Number(arg('seconds','4'));
    const sweep=Number(arg('sweep','24')),dist=Number(arg('dist','1')),lift=Number(arg('lift','0')),elev=Number(arg('elev',String(el0/deg))),az=Number(arg('az','0'));
    const frames=Math.round(fps*seconds),frameDir=out.replace(/\.mp4$/,'')+'.frames';
    rmSync(frameDir,{recursive:true,force:true});mkdirSync(frameDir,{recursive:true});
    const ease=(t:number)=>t*t*(3-2*t);
    for(let f=0;f<frames;f++){
      const t=ease(f/(frames-1));
      const pose:Pose=move==='orbit'?{az:az+(t-.5)*sweep,elev,dist:dist*(1.04-.08*t),lift}
        :move==='reveal'?{az:az+(t-1)*sweep*.5,elev:84-(84-elev)*t,dist:dist*(1.2-.2*t),lift}
        :{az:az+(t-.5)*sweep*.25,elev,dist:dist*(1.1-.25*t),lift};
      writeFileSync(join(frameDir,`f${String(f).padStart(4,'0')}.jpg`),await shoot(pose));
      process.stdout.write(`\r${out}: ${f+1}/${frames}`);
    }
    mkdirSync(dirname(out),{recursive:true});
    const smooth=interp>fps?`minterpolate=fps=${interp}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,`:'';
    execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',join(frameDir,'f%04d.jpg'),'-vf',`${smooth}format=yuv420p`,'-c:v','libx264','-preset','slow','-crf','14','-movflags','+faststart',out]);
    if(!process.argv.includes('--keep-frames'))rmSync(frameDir,{recursive:true,force:true});
    console.log(`\n${out}: ${frames} frames`);
  }
  if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
