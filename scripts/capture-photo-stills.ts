/** Raster versus path-traced stills of the Ontario backyard sample.
 * Software GPUs trace the live canvas (fewer samples than a 2K export). Run a designer first:
 *   npx react-router dev --port 4187
 *   DECKCRAFT_PROOF_URL=http://127.0.0.1:4187/deck-designer/ npx tsx scripts/capture-photo-stills.ts
 */
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {chromium,type Browser,type Page} from '@playwright/test';
import {PHOTO_GRADE,type PhotoLook} from '../src/features/deckcraft/components/viewer3d/photoGrade';

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
async function openShot(page:Page,name:string,look:'day'|'golden'|'night',lighting:'daylight'|'evening',photo:boolean,pass?:{samples:number;seed:number}){
 console.log('shot',name,pass?`pass ${pass.seed}+${pass.samples}`:'');
 const params=new URLSearchParams({ 'deck-sample':'ontario','deck-quality':'showcase','deck-context':'1','deck-lighting':lighting });
 const passSamples=pass?.samples??samples;
 if(photo){params.set('deck-photo','1');params.set('deck-photo-look',look);params.set('deck-photo-samples',String(passSamples));params.set('deck-photo-edge',process.env.DECK_PHOTO_EDGE??'2048');params.set('deck-photo-linear','1');params.set('deck-photo-seed',String(pass?.seed??0));if(process.env.DECK_PHOTO_SCALE)params.set('deck-photo-scale',process.env.DECK_PHOTO_SCALE);if(process.env.DECK_PHOTO_TILES)params.set('deck-photo-tiles',process.env.DECK_PHOTO_TILES);if(process.env.DECK_PHOTO_BOUNCES)params.set('deck-photo-bounces',process.env.DECK_PHOTO_BOUNCES);if(process.env.DECK_PHOTO_TRANSMISSIVE)params.set('deck-photo-transmissive',process.env.DECK_PHOTO_TRANSMISSIVE);}
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
 const ask=bindAsk(page,name);
 if(!photo){
  await page.waitForFunction(()=>document.querySelector('#deck-live-preview canvas')?.getAttribute('data-photographic-pipeline')==='active',undefined,{timeout:120_000});
  await page.waitForTimeout(4000);
  await saveStill(page,name,false);
  if(errors.length)throw Error(`${name}: ${errors.join('\n')}`);
  console.log('wrote',`${output}/${name}.png`);
  return null;
 }
 return finishPass(page,name,ask,errors,passSamples);
}
function bindAsk(page:Page,name:string){
 return <T>(fn:()=>T,ms=Number(process.env.DECK_PHOTO_ASK_MS??'360000'))=>new Promise<T>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error(`${name}: the path tracer stopped answering`)),ms);
  page.evaluate(fn).then(value=>{clearTimeout(timer);resolve(value as T);},error=>{clearTimeout(timer);reject(error);});
 });
}
async function finishPass(page:Page,name:string,ask:ReturnType<typeof bindAsk>,errors:string[],passSamples:number){
 const budget=Math.max(5_400_000,passSamples*180_000+1_800_000);
 const deadline=Date.now()+budget;let last='',lastChange=Date.now(),savedStill='';
 while(Date.now()<deadline){
  const state=await ask(()=>{const canvas=document.querySelector('#deck-live-preview canvas');return {phase:canvas?.getAttribute('data-photo-phase')??'',samples:canvas?.getAttribute('data-photo-samples')??'',target:canvas?.getAttribute('data-photo-target')??'',census:canvas?.getAttribute('data-photo-census')??'',still:canvas?.getAttribute('data-photo-still')??'',buffer:canvas?.getAttribute('data-photo-buffer')??'',tiles:canvas?.getAttribute('data-photo-tiles')??''};});
  const line=`${state.phase||'waiting'} ${state.samples||'0'}/${state.target||'?'} ${state.buffer} tiles=${state.tiles} census=${state.census} still=${state.still}`;
  if(line!==last){console.log(new Date().toISOString(),name,line);last=line;lastChange=Date.now();}
  else if(Date.now()-lastChange>1_200_000)throw Error(`${name}: no sample progress for 20 minutes (${line})`);
  if(state.still&&state.still!==savedStill){
   savedStill=state.still;
   const data=await ask(()=>(window as Window&{__DECK_PHOTO_PNG?:string}).__DECK_PHOTO_PNG??'',180_000);
   if(data.startsWith('data:image/png;base64,')){
    const preview=`${output}/${name}-${state.samples}.png`;
    writeFileSync(preview,Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
    console.log('preview',preview);
   }
  }
  if(state.phase==='ready'||state.phase==='fallback')break;
  await page.waitForTimeout(3000);
 }
 const phase=await ask(()=>document.querySelector('#deck-live-preview canvas')?.getAttribute('data-photo-phase')??'');
 if(phase!=='ready')throw Error(`${name}: photo phase ${phase??'missing'}. ${await page.locator('#deck-live-preview [role=status]').last().innerText().catch(()=>'')} ${errors.join(' | ')}`);
 if(errors.length)throw Error(`${name}: ${errors.join('\n')}`);
 const packed=await ask(()=>{const record=window as Window&{__DECK_PHOTO_LINEAR?:string;__DECK_PHOTO_LINEAR_SIZE?:string};return {data:record.__DECK_PHOTO_LINEAR??'',size:record.__DECK_PHOTO_LINEAR_SIZE??''};},180_000);
 if(!packed.data||!packed.size.startsWith('rgbe:'))throw Error(`${name}: the linear pass was not stored (${packed.size||'empty'})`);
 const [w,h,n]=packed.size.slice(5).split('x').map(Number);
 const bytes=Buffer.from(packed.data,'base64');
 if(bytes.length!==w*h*4)throw Error(`${name}: RGBE length ${bytes.length} is not ${w}x${h}`);
 const rgb=new Float32Array(w*h*3);
 let peak=0,lit=0;
 for(let i=0,p=0;i<bytes.length;i+=4,p+=3){
  const exponent=bytes[i+3];if(!exponent)continue;
  const scale=2**(exponent-128);
  rgb[p]=bytes[i]/255*scale;rgb[p+1]=bytes[i+1]/255*scale;rgb[p+2]=bytes[i+2]/255*scale;
  peak=Math.max(peak,rgb[p],rgb[p+1],rgb[p+2]);if(rgb[p]+rgb[p+1]+rgb[p+2]>1e-4)lit++;
 }
 console.log('pass',name,packed.size,`peak ${peak.toFixed(3)}`,`lit ${(100*lit/(w*h)).toFixed(1)}%`);
 return {w,h,n,rgb};
}
async function nextPass(page:Page,name:string,seed:number,passSamples:number){
 console.log('continue',name,`seed ${seed}`);
 const ask=bindAsk(page,name);
 const started=await page.evaluate(next=>{const hook=(window as Window&{__DECK_PHOTO_CONTINUE?:(value:number)=>boolean}).__DECK_PHOTO_CONTINUE;return hook?hook(next):false;},seed);
 if(!started)throw Error(`${name}: the next pass did not start`);
 return finishPass(page,name,ask,[],passSamples);
}

const browserArgs=['--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox'];
async function launchBrowser(){
 return process.env.DECK_BROWSER
  ?chromium.launch({executablePath:process.env.DECK_BROWSER,headless:true,args:browserArgs})
  :chromium.launch({channel:'msedge',headless:true,args:browserArgs}).catch(()=>chromium.launch({executablePath:'/opt/google/chrome/chrome',headless:true,args:browserArgs}));
}
function chromePids(){
 try{return new Set(execFileSync('ps',['-C','chrome','-o','pid='],{encoding:'utf8'}).split('\n').map(line=>line.trim()).filter(Boolean));}
 catch{return new Set<string>();}
}
function killNewChrome(before:Set<string>){
 for(const pid of chromePids())if(!before.has(pid)){try{process.kill(Number(pid),'SIGKILL');}catch{/* already gone */}}
}
async function closeBrowser(browser:Browser,before:Set<string>){
 const closed=browser.close().catch(()=>undefined);
 await Promise.race([closed,new Promise<void>(resolve=>setTimeout(resolve,10_000))]);
 killNewChrome(before);
 await Promise.race([closed,new Promise<void>(resolve=>setTimeout(resolve,2_000))]);
}
async function withPage<T>(run:(page:Page)=>Promise<T>){
 const before=chromePids();
 const browser:Browser=await launchBrowser();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1200},deviceScaleFactor:1});
  await context.route(/^https:\/\/([\w-]+\.)*(googletagmanager\.com|facebook\.net|clarity\.ms|googleapis\.com|gstatic\.com)\//,route=>route.fulfill({status:200,body:''}));
  const page=await context.newPage();
  page.setDefaultTimeout(180_000);page.setDefaultNavigationTimeout(180_000);
  return await run(page);
 }finally{await closeBrowser(browser,before);}
}
function pngChunk(type:string,data:Buffer){
 const body=Buffer.concat([Buffer.from(type),data]);
 let c=0xffffffff;
 for(const byte of body){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^(c&1?0xedb88320:0);}
 const out=Buffer.alloc(12+data.length);
 out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE((c^0xffffffff)>>>0,8+data.length);
 return out;
}
function writePng(file:string,w:number,h:number,rgba:Buffer){
 const raw=Buffer.alloc((w*4+1)*h);
 for(let y=0;y<h;y++){raw[(w*4+1)*y]=0;rgba.copy(raw,(w*4+1)*y+1,y*w*4,(y+1)*w*4);}
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))]));
}
function mul(columns:number[][],v:[number,number,number]):[number,number,number]{
 return [
  columns[0][0]*v[0]+columns[1][0]*v[1]+columns[2][0]*v[2],
  columns[0][1]*v[0]+columns[1][1]*v[1]+columns[2][1]*v[2],
  columns[0][2]*v[0]+columns[1][2]*v[1]+columns[2][2]*v[2],
 ];
}
const SRGB_TO_REC2020=[[0.6274,0.0691,0.0164],[0.3293,0.9195,0.0880],[0.0433,0.0113,0.8956]];
const REC2020_TO_SRGB=[[1.6605,-0.1246,-0.0182],[-0.5876,1.1329,-0.1006],[-0.0728,-0.0083,1.1187]];
const AGX_INSET=[[0.856627153315983,0.137318972929847,0.11189821299995],[0.0951212405381588,0.761241990602591,0.0767994186031903],[0.0482516061458583,0.101439036467562,0.811302368396859]];
const AGX_OUTSET=[[1.1271005818144368,-0.1413297634984383,-0.14132976349843826],[-0.11060664309660323,1.157823702216272,-0.11060664309660294],[-0.016493938717834573,-0.016493938717834257,1.2519364065950405]];
function agx(color:[number,number,number]):[number,number,number]{
 let v=mul(SRGB_TO_REC2020,color);
 v=mul(AGX_INSET,v);
 const minEv=-12.47393,maxEv=4.026069;
 v=v.map(channel=>{const encoded=(Math.log2(Math.max(channel,1e-10))-minEv)/(maxEv-minEv);return Math.min(1,Math.max(0,encoded));}) as [number,number,number];
 const contrast=v.map(x=>{const x2=x*x,x4=x2*x2;return 15.5*x4*x2-40.14*x4*x+31.96*x4-6.868*x2*x+0.4298*x2+0.1191*x-0.00232;}) as [number,number,number];
 v=mul(AGX_OUTSET,contrast).map(channel=>Math.max(0,channel)**2.2) as [number,number,number];
 return mul(REC2020_TO_SRGB,v);
}
function srgbByte(channel:number){
 const c=Math.min(1,Math.max(0,channel));
 return Math.round(255*(c<=0.0031308?c*12.92:1.055*c**(1/2.4)-0.055));
}
function denoiseLinear(rgb:Float32Array,w:number,h:number,sigma:number,threshold:number){
 const radius=Math.max(1,Math.min(2,Math.round(sigma))),radQ=radius*radius,out=new Float32Array(rgb.length);
 const invSigmaQx2=0.5/(sigma*sigma),invSigmaQx2PI=0.3183098861837907*invSigmaQx2,invThresholdSqx2=0.5/(threshold*threshold),invThresholdSqrt2PI=0.3989422804014327/threshold;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const at=(y*w+x)*3,center:[number,number,number]=[rgb[at],rgb[at+1],rgb[at+2]];
  let z=0,ar=0,ag=0,ab=0;
  for(let dx=-radius;dx<=radius;dx++){
   const pt=Math.sqrt(Math.max(0,radQ-dx*dx));
   for(let dy=Math.ceil(-pt);dy<=Math.floor(pt);dy++){
    const sx=Math.min(w-1,Math.max(0,x+dx)),sy=Math.min(h-1,Math.max(0,y+dy)),j=(sy*w+sx)*3;
    const blur=Math.exp(-(dx*dx+dy*dy)*invSigmaQx2)*invSigmaQx2PI;
    const dr=rgb[j]-center[0],dg=rgb[j+1]-center[1],db=rgb[j+2]-center[2];
    const weight=Math.exp(-(dr*dr+dg*dg+db*db)*invThresholdSqx2)*invThresholdSqrt2PI*blur;
    z+=weight;ar+=weight*rgb[j];ag+=weight*rgb[j+1];ab+=weight*rgb[j+2];
   }
  }
  out[at]=ar/z;out[at+1]=ag/z;out[at+2]=ab/z;
 }
 return out;
}
function gradeStill(rgb:Float32Array,w:number,h:number,look:PhotoLook,sampleCount:number){
 const grade=PHOTO_GRADE[look];
 const sigma=Math.max(1,Math.min(7,16/Math.sqrt(Math.max(1,sampleCount))));
 const clean=denoiseLinear(rgb,w,h,sigma,.08);
 const rgba=Buffer.alloc(w*h*4);
 for(let i=0,p=0;i<clean.length;i+=3,p+=4){
  const color:[number,number,number]=[
   Math.min(clean[i],12)*grade.exposure*grade.balance[0],
   Math.min(clean[i+1],12)*grade.exposure*grade.balance[1],
   Math.min(clean[i+2],12)*grade.exposure*grade.balance[2],
  ];
  const luma=color[0]*0.2126+color[1]*0.7152+color[2]*0.0722;
  const sat=grade.saturation;
  const mixed:[number,number,number]=[luma+(color[0]-luma)*sat,luma+(color[1]-luma)*sat,luma+(color[2]-luma)*sat];
  const mapped=agx(mixed);
  rgba[p]=srgbByte(mapped[0]);rgba[p+1]=srgbByte(mapped[1]);rgba[p+2]=srgbByte(mapped[2]);rgba[p+3]=255;
 }
 return rgba;
}
for(const [name,look,lighting,photo] of shots){
 if(!photo){
  try{await withPage(page=>openShot(page,name,look,lighting,false));}
  catch(error){console.error('failed',name,error instanceof Error?error.message:error);}
  continue;
 }
 const passSize=Math.max(4,Number(process.env.DECK_PHOTO_PASS??'8')||8);
 const sessionPasses=Math.max(1,Number(process.env.DECK_PHOTO_SESSION??'8')||8);
 const cache=`${output}/${name}.sum`;
 let sum:Float32Array|null=null,width=0,height=0,count=0;
 try{
  const stored=readFileSync(cache);
  if(stored.readUInt32LE(0)===0x46333250){
   width=stored.readUInt32LE(4);height=stored.readUInt32LE(8);count=stored.readUInt32LE(12);
   const view=new Float32Array(stored.buffer,stored.byteOffset+16,(stored.length-16)/4);
   sum=new Float32Array(view);
   console.log('resume',name,`${count}/${samples}`);
  }
 }catch{/* a new still */}
 const absorb=(frame:NonNullable<Awaited<ReturnType<typeof openShot>>>,n:number)=>{
  if(frame.n!==n||frame.rgb.length!==frame.w*frame.h*3)throw Error(`${name}: pass ${frame.w}x${frame.h} x${frame.n} does not match ${n} samples`);
  if(!sum){sum=new Float32Array(frame.rgb.length);width=frame.w;height=frame.h;}
  if(frame.w!==width||frame.h!==height)throw Error(`${name}: pass size changed`);
  for(let i=0;i<sum.length;i++)sum[i]+=frame.rgb[i]*frame.n;
  count+=frame.n;
  const header=Buffer.alloc(16);
  header.writeUInt32LE(0x46333250,0);header.writeUInt32LE(width,4);header.writeUInt32LE(height,8);header.writeUInt32LE(count,12);
  writeFileSync(cache,Buffer.concat([header,Buffer.from(sum.buffer,sum.byteOffset,sum.byteLength)]));
  console.log(new Date().toISOString(),name,`${count}/${samples} accumulated`);
  if(count%64===0||count>=samples){
   const mean=new Float32Array(sum.length);
   for(let i=0;i<sum.length;i++)mean[i]=sum[i]/count;
   const file=count>=samples?`${output}/${name}.png`:`${output}/${name}-${count}.png`;
   writePng(file,width,height,gradeStill(mean,width,height,look,count));
   console.log('wrote',file,`${width}x${height}`,count,'samples');
  }
 };
 try{
  while(count<samples){
   const startCount=count;
   let lastError:unknown;
   for(let attempt=0;attempt<4&&count===startCount;attempt++){
    try{
     await withPage(async page=>{
      const n=Math.min(passSize,samples-count);
      const first=await openShot(page,name,look,lighting,true,{samples:n,seed:count+attempt*1_000_003});
      if(!first)throw Error(`${name}: pass at ${count} was empty`);
      absorb(first,n);
      for(let extra=1;extra<sessionPasses&&samples-count>=passSize;extra++){
       const more=await nextPass(page,name,count,passSize);
       absorb(more,passSize);
      }
     });
    }catch(error){lastError=error;console.error('retry',name,count,error instanceof Error?error.message:error);}
   }
   if(count===startCount)throw lastError instanceof Error?lastError:Error(`${name}: pass at ${count} failed`);
  }
 }catch(error){console.error('failed',name,error instanceof Error?error.message:error);}
}
