/** Denoise a linear still outside the browser.
 * Intel Open Image Denoise is used when its CPU tool is on the machine. The wavelet
 * below is the same step when it is not: fireflies are pulled out first, then an
 * edge-avoiding à-trous filter. Albedo and normal guides, when the still captured
 * them, keep foliage, caustics and window frames from being smeared. */

import {execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export interface PhotoGuides{
 albedo:Uint8Array;
 normal:Uint8Array;
 width:number;
 height:number;
}

export function oidnBinary(){
 const candidates=[process.env.DECK_OIDN,'/tmp/oidn/oidn-2.3.3.x86_64.linux/bin/oidnDenoise'].filter((path):path is string=>!!path);
 return candidates.find(path=>existsSync(path))??null;
}

function srgbToLinear(channel:number){
 return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
}

function writePfm(file:string,w:number,h:number,rgb:Float32Array){
 const header=Buffer.from(`PF\n${w} ${h}\n-1.0\n`);
 const floats=new Float32Array(w*h*3),row=w*3;
 for(let y=0;y<h;y++)floats.set(rgb.subarray((h-1-y)*row,(h-y)*row),y*row);
 writeFileSync(file,Buffer.concat([header,Buffer.from(floats.buffer)]));
}

function readPfm(file:string){
 const bytes=readFileSync(file);
 const header=bytes.toString('latin1',0,64);
 const match=/^PF\n(\d+) (\d+)\n(-?\d+(?:\.\d+)?)\n/.exec(header);
 if(!match)throw Error(`${file} is not a colour PFM`);
 const w=Number(match[1]),h=Number(match[2]),scale=Number(match[3]);
 const body=bytes.subarray(match[0].length);
 const aligned=new ArrayBuffer(body.length);new Uint8Array(aligned).set(body);
 const src=new Float32Array(aligned);
 const rgb=new Float32Array(w*h*3),row=w*3,flip=scale<0;
 for(let y=0;y<h;y++)rgb.set(src.subarray((flip?h-1-y:y)*row,(flip?h-y:y+1)*row),y*row);
 return {w,h,rgb};
}

function guideFloat(guide:Uint8Array,gw:number,gh:number,w:number,h:number,mode:'albedo'|'normal'){
 const out=new Float32Array(w*h*3);
 for(let y=0;y<h;y++){
  const gy=Math.min(gh-1,Math.max(0,Math.floor((y+.5)*gh/h)));
  for(let x=0;x<w;x++){
   const gx=Math.min(gw-1,Math.max(0,Math.floor((x+.5)*gw/w)));
   const s=(gy*gw+gx)*3,d=(y*w+x)*3;
   if(mode==='normal'){out[d]=guide[s]/255*2-1;out[d+1]=guide[s+1]/255*2-1;out[d+2]=guide[s+2]/255*2-1;}
   else{out[d]=srgbToLinear(guide[s]/255);out[d+1]=srgbToLinear(guide[s+1]/255);out[d+2]=srgbToLinear(guide[s+2]/255);}
  }
 }
 return out;
}

function denoiseOidn(binary:string,rgb:Float32Array,w:number,h:number,guides:PhotoGuides|null|undefined,quality:'high'|'balanced'){
 const dir=mkdtempSync(join(tmpdir(),'photo-oidn-'));
 try{
  const color=join(dir,'color.pfm'),output=join(dir,'out.pfm');
  writePfm(color,w,h,rgb);
  const args=['--device','cpu','--filter','RT','--hdr',color,'-o',output,'-q',quality,'--threads','4'];
  if(guides&&guides.albedo.length>=guides.width*guides.height*3&&guides.normal.length>=guides.width*guides.height*3){
   const albedo=join(dir,'albedo.pfm'),normal=join(dir,'normal.pfm');
   writePfm(albedo,w,h,guideFloat(guides.albedo,guides.width,guides.height,w,h,'albedo'));
   writePfm(normal,w,h,guideFloat(guides.normal,guides.width,guides.height,w,h,'normal'));
   args.push('--alb',albedo,'--nrm',normal);
  }
  execFileSync(binary,args,{stdio:'pipe'});
  const decoded=readPfm(output);
  if(decoded.w!==w||decoded.h!==h)throw Error(`OIDN returned ${decoded.w}x${decoded.h}`);
  return decoded.rgb;
 }finally{rmSync(dir,{recursive:true,force:true});}
}

/** A one-pixel spike becomes the neighbourhood. A real window, which is bright with its neighbours, stays. */
export function clampFireflies(rgb:Float32Array,w:number,h:number){
 const out=new Float32Array(rgb);
 const luma=(i:number)=>rgb[i]*0.2126+rgb[i+1]*0.7152+rgb[i+2]*0.0722;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*3,center=luma(i);
  const values:number[]=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;
   const xx=Math.min(w-1,Math.max(0,x+dx)),yy=Math.min(h-1,Math.max(0,y+dy));
   values.push(luma((yy*w+xx)*3));
  }
  values.sort((a,b)=>a-b);
  const median=values[values.length>>1];
  if(center<=median*8+1)continue;
  let r=0,g=0,b=0,n=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;
   const xx=Math.min(w-1,Math.max(0,x+dx)),yy=Math.min(h-1,Math.max(0,y+dy)),j=(yy*w+xx)*3;
   if(luma(j)>median*4+0.5)continue;
   r+=rgb[j];g+=rgb[j+1];b+=rgb[j+2];n++;
  }
  if(!n)continue;
  out[i]=r/n;out[i+1]=g/n;out[i+2]=b/n;
 }
 return out;
}

const SPLINE=[1/16,4/16,6/16,4/16,1/16];

function sampleGuide(guide:Uint8Array,gw:number,gh:number,x:number,y:number,w:number,h:number){
 const gx=Math.min(gw-1,Math.max(0,Math.floor((x+.5)*gw/w))),gy=Math.min(gh-1,Math.max(0,Math.floor((y+.5)*gh/h)));
 const o=(gy*gw+gx)*3;
 return [guide[o],guide[o+1],guide[o+2]] as [number,number,number];
}

/** Edge-avoiding à-trous. Colour stops the blur; albedo and normal stop it harder at a real silhouette. */
export function denoiseEdgeAware(rgb:Float32Array,w:number,h:number,guides?:PhotoGuides|null){
 let cur=clampFireflies(rgb,w,h);
 const albedo=guides?.albedo,normal=guides?.normal,gw=guides?.width??0,gh=guides?.height??0;
 const guided=!!albedo&&!!normal&&gw>0&&gh>0&&albedo.length>=gw*gh*3&&normal.length>=gw*gh*3;
 for(const step of [1,2,4,8,16]){
  if(step>Math.max(w,h)/2)break;
  const next=new Float32Array(cur.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*3;
   const cr=cur[i],cg=cur[i+1],cb=cur[i+2];
   const luma=cr*0.2126+cg*0.7152+cb*0.0722;
   const sigma=Math.max(0.045,luma*0.22+0.01);
   const ca=guided?sampleGuide(albedo!,gw,gh,x,y,w,h):null;
   const cn=guided?sampleGuide(normal!,gw,gh,x,y,w,h):null;
   let sum=0,r=0,g=0,b=0;
   for(let ky=0;ky<5;ky++){
    const yy=Math.min(h-1,Math.max(0,y+(ky-2)*step));
    for(let kx=0;kx<5;kx++){
     const xx=Math.min(w-1,Math.max(0,x+(kx-2)*step));
     const j=(yy*w+xx)*3;
     const dl=(cur[j]*0.2126+cur[j+1]*0.7152+cur[j+2]*0.0722)-luma;
     let weight=SPLINE[kx]*SPLINE[ky]*Math.exp(-(dl*dl)/(sigma*sigma));
     if(guided&&ca&&cn){
      const a=sampleGuide(albedo!,gw,gh,xx,yy,w,h),n=sampleGuide(normal!,gw,gh,xx,yy,w,h);
      const da=(a[0]-ca[0])/255,db=(a[1]-ca[1])/255,dc=(a[2]-ca[2])/255;
      const dot=((n[0]/255*2-1)*(cn[0]/255*2-1))+((n[1]/255*2-1)*(cn[1]/255*2-1))+((n[2]/255*2-1)*(cn[2]/255*2-1));
      weight*=Math.exp(-(da*da+db*db+dc*dc)/(0.06*0.06))*Math.pow(Math.max(0,dot),8);
     }
     sum+=weight;r+=weight*cur[j];g+=weight*cur[j+1];b+=weight*cur[j+2];
    }
   }
   next[i]=r/sum;next[i+1]=g/sum;next[i+2]=b/sum;
  }
  cur=next;
 }
 return cur;
}

export function denoisePlate(rgb:Float32Array,w:number,h:number,guides?:PhotoGuides|null,quality:'high'|'balanced'='high'){
 const prepared=clampFireflies(rgb,w,h);
 const binary=oidnBinary();
 if(binary){
  try{
   const clean=denoiseOidn(binary,prepared,w,h,guides,quality);
   console.log('denoise','oidn',quality,guides?'with guides':'beauty only');
   return clean;
  }catch(error){console.warn('DeckCraft photo: OIDN was skipped.',error instanceof Error?error.message:error);}
 }
 console.log('denoise','wavelet',guides?'with guides':'beauty only');
 return denoiseEdgeAware(prepared,w,h,guides);
}
