/**
 * Builds DeckCraft's sky (Real Life G3) from a Poly Haven CC0 HDRI: a development tool, not part of lint.
 *
 * usage: npx tsx scripts/build-deck-sky.ts <day.hdr> <evening.hdr> [outDir]
 *
 * For each HDRI (8K equirectangular, Radiance RGBE, read a scanline at a time):
 * 1. Finds the sun: the brightest pixel, then the disc 12° round it (its flare and halo too). Each row of the disc is
 *    filled with the sky just outside it on that row, blended across; the disc's light above that fill is the sun's
 *    irradiance, and its brightness-weighted centre the sun's direction.
 * 2. Paints the sun out with that fill, so the lighting HDRI has no sun in it: the scene's directional light is the
 *    sun, and casts the shadows. A dim sun (under a fifth of the light, as at dusk) is left in as the sky's glow.
 * 3. White-balances so sun plus sky light a horizontal white card in neutral grey, and scales so that card's radiance
 *    is 1 (irradiance π): a sunlit board then shows its swatch's own colour under Neutral tone mapping.
 * 4. Writes sky-<name>-ibl.hdr (1024 × 512 RGBE, run-length encoded) for the lighting, sky-<name>-band.webp (8192 ×
 *    1024, the horizon from −4° to +41°, sRGB of radiance ÷ bandScale) for the sky dome, and sky.json.
 *
 * Directions follow three.js's equirectUv: u = atan2(z, x)/2π + ½, v = asin(y)/π + ½, image row 0 at the zenith.
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';

const [dayFile,eveningFile,outDir='src/features/deckcraft/components/viewer3d/assets/sky']=process.argv.slice(2);
if(!dayFile||!eveningFile)throw new Error('usage: npx tsx scripts/build-deck-sky.ts <day.hdr> <evening.hdr> [outDir]');

// The photos' suns carry a lens flare and a bright halo about 12° wide: the whole of it goes into the sun.
const IBL_W=1024,IBL_H=512,BAND_TOP_DEG=41,BAND_BOTTOM_DEG=-4,SUN_RADIUS_DEG=12,FILL_MARGIN_DEG=1;
/** Below this share of a horizontal card's light, a sun (a dusk sun behind haze) is left in the sky as its glow. */
const DIM_SUN_SHARE=.2;
const luma=(r:number,g:number,b:number)=>.2126*r+.7152*g+.0722*b;

interface Hdr{width:number;height:number;header:Buffer;data:Buffer}
/** The file's header and its (RLE) pixel data, left encoded. */
function openHdr(file:string):Hdr{
  const bytes=readFileSync(file);let at=0,line='';const lines:string[]=[];
  while(at<bytes.length){const c=bytes[at++];if(c===10){lines.push(line);if(/^[-+][YX] \d+ [-+][YX] \d+$/.test(line))break;line='';}else line+=String.fromCharCode(c);}
  const res=lines.at(-1)!.match(/-Y (\d+) \+X (\d+)/);if(!res)throw new Error(`${file}: expected a "-Y H +X W" resolution line`);
  return {height:+res[1],width:+res[2],header:bytes.subarray(0,at),data:bytes.subarray(at)};
}
/** Decodes the scanlines one at a time into linear RGB floats, calling visit(y, row). */
function eachRow(hdr:Hdr,visit:(y:number,row:Float32Array)=>void){
  const {width:w,height:h,data}=hdr,scan=new Uint8Array(w*4),row=new Float32Array(w*3);let at=0;
  for(let y=0;y<h;y++){
    if(data[at]!==2||data[at+1]!==2||(data[at+2]<<8|data[at+3])!==w)throw new Error(`row ${y}: not a new-style RLE scanline`);
    at+=4;
    for(let c=0;c<4;c++)for(let x=0;x<w;){let n=data[at++];if(n>128){n-=128;const v=data[at++];for(let k=0;k<n;k++)scan[(x++)*4+c]=v;}else for(let k=0;k<n;k++)scan[(x++)*4+c]=data[at++];}
    for(let x=0;x<w;x++){const e=scan[x*4+3],f=e?2**(e-136):0;row[x*3]=scan[x*4]*f;row[x*3+1]=scan[x*4+1]*f;row[x*3+2]=scan[x*4+2]*f;}
    visit(y,row);
  }
}
const dirOf=(u:number,v:number)=>{const az=(u-.5)*2*Math.PI,el=(v-.5)*Math.PI;return [Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)];};
const angle=(a:number[],b:number[])=>Math.acos(Math.min(1,Math.max(-1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])));

/** Radiance RGBE with the standard per-channel run-length encoding. */
function writeHdr(file:string,w:number,h:number,rgb:Float32Array){
  const parts:Buffer[]=[Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`,'ascii')];
  const scan=new Uint8Array(w*4);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){const i=(y*w+x)*3,m=Math.max(rgb[i],rgb[i+1],rgb[i+2]);if(m<1e-32){scan.fill(0,x*4,x*4+4);continue;}const e=Math.ceil(Math.log2(m)+1e-9),f=256/2**e;scan[x*4]=Math.min(255,Math.floor(rgb[i]*f));scan[x*4+1]=Math.min(255,Math.floor(rgb[i+1]*f));scan[x*4+2]=Math.min(255,Math.floor(rgb[i+2]*f));scan[x*4+3]=e+128;}
    const out:number[]=[2,2,w>>8,w&255];
    for(let c=0;c<4;c++){
      for(let x=0;x<w;){
        let run=1;while(x+run<w&&run<127&&scan[(x+run)*4+c]===scan[x*4+c])run++;
        if(run>=3){out.push(128+run,scan[x*4+c]);x+=run;continue;}
        let lit=0;const start=x;
        while(x<w&&lit<128){let r=1;while(x+r<w&&r<3&&scan[(x+r)*4+c]===scan[x*4+c])r++;if(r>=3)break;x++;lit++;}
        out.push(lit);for(let k=0;k<lit;k++)out.push(scan[(start+k)*4+c]);
      }
    }
    parts.push(Buffer.from(out));
  }
  writeFileSync(file,Buffer.concat(parts));
}

const srgb=(v:number)=>v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055;

async function build(file:string,name:'day'|'evening'){
  const hdr=openHdr(file),{width:W,height:H}=hdr,bx=W/IBL_W,by=H/IBL_H;
  // Pass 1: the lighting image downsampled, the horizon band at full size, and the brightest pixel.
  const ibl=new Float32Array(IBL_W*IBL_H*3),bandY0=Math.round(H*(90-BAND_TOP_DEG)/180),bandY1=Math.round(H*(90-BAND_BOTTOM_DEG)/180),bandH=bandY1-bandY0;
  const band=new Float32Array(W*bandH*3);let peak=0,peakX=0,peakY=0;
  eachRow(hdr,(y,row)=>{
    const iy=Math.floor(y/by);
    for(let x=0;x<W;x++){const r=row[x*3],g=row[x*3+1],b=row[x*3+2],l=luma(r,g,b),i=(iy*IBL_W+Math.floor(x/bx))*3;ibl[i]+=r;ibl[i+1]+=g;ibl[i+2]+=b;if(l>peak){peak=l;peakX=x;peakY=y;}}
    if(y>=bandY0&&y<bandY1)band.set(row,(y-bandY0)*W*3);
  });
  for(let i=0;i<ibl.length;i++)ibl[i]/=bx*by;
  const peakDir=dirOf((peakX+.5)/W,1-(peakY+.5)/H),radius=SUN_RADIUS_DEG*Math.PI/180,margin=FILL_MARGIN_DEG*Math.PI/180;
  const peakAz=Math.atan2(peakDir[2],peakDir[0]),peakEl=Math.asin(peakDir[1]);
  /** For one row (elevation el) of an image w wide: the disc's columns there and the sky fill across them, or null. */
  const fillRow=(row:Float32Array,w:number,el:number)=>{
    const c=(Math.cos(radius)-Math.sin(el)*Math.sin(peakEl))/(Math.cos(el)*Math.cos(peakEl));if(c>=1)return null;
    const half=c<=-1?Math.PI:Math.acos(c),col=(az:number)=>((Math.round(((az/(2*Math.PI))+.5)*w-.5)%w)+w)%w;
    const x0=col(peakAz-half-margin),x1=col(peakAz+half+margin),span=((x1-x0)%w+w)%w,fill=new Float32Array(span*3),a=[row[x0*3],row[x0*3+1],row[x0*3+2]],b=[row[x1*3],row[x1*3+1],row[x1*3+2]];
    for(let k=0;k<span;k++){const t=k/span;for(let ch=0;ch<3;ch++)fill[k*3+ch]=a[ch]*(1-t)+b[ch]*t;}
    return {x0,span,fill};
  };
  // Pass 2, over the disc's rows at full size: the sun's light above the fill, and its centre.
  let energy=[0,0,0],cx=0,cy=0,cz=0,count=0;
  eachRow(hdr,(y,row)=>{
    const v=1-(y+.5)/H,el=(v-.5)*Math.PI;if(Math.abs(el-peakEl)>radius)return;
    const f=fillRow(row,W,el);if(!f)return;const dOmega=Math.cos(el)*(2*Math.PI/W)*(Math.PI/H);
    for(let k=0;k<f.span;k++){
      const x=(f.x0+k)%W,px=[row[x*3],row[x*3+1],row[x*3+2]],d=dirOf((x+.5)/W,v);if(angle(d,peakDir)>radius)continue;
      const above=px.map((p,ch)=>Math.max(0,p-f.fill[k*3+ch])*dOmega),wgt=luma(above[0],above[1],above[2]);
      energy=energy.map((e,ch)=>e+above[ch]);cx+=d[0]*wgt;cy+=d[1]*wgt;cz+=d[2]*wgt;if(wgt>0)count++;
    }
  });
  const len=Math.hypot(cx,cy,cz)||1,sunDir=count?[cx/len,cy/len,cz/len]:peakDir;
  // How much of a horizontal card's light the sun gives, against the sky's (measured before painting).
  const cardFromSky=(img:Float32Array)=>{let e=0;for(let y=0;y<IBL_H;y++){const el=(.5-(y+.5)/IBL_H)*Math.PI;if(el<=0)continue;const w=Math.sin(el)*Math.cos(el)*(2*Math.PI/IBL_W)*(Math.PI/IBL_H);for(let x=0;x<IBL_W;x++){const i=(y*IBL_W+x)*3;e+=luma(img[i],img[i+1],img[i+2])*w;}}return e;};
  const sunShare=luma(energy[0],energy[1],energy[2])*Math.max(0,sunDir[1])/cardFromSky(ibl),bright=sunShare>=DIM_SUN_SHARE;
  if(!bright)energy=[0,0,0];
  // Paint the sun out of the lighting image and the band with the same fill.
  const paint=(img:Float32Array,w:number,h:number,y0:number,fullH:number)=>{for(let y=0;y<h;y++){const el=(.5-(y0+y+.5)/fullH)*Math.PI;if(Math.abs(el-peakEl)>radius)continue;const row=img.subarray(y*w*3,(y+1)*w*3),f=fillRow(row,w,el);if(!f)continue;for(let k=0;k<f.span;k++){const x=(f.x0+k)%w;if(angle(dirOf((x+.5)/w,.5+el/Math.PI),peakDir)>radius)continue;row.set(f.fill.subarray(k*3,k*3+3),x*3);}}};
  if(bright){paint(ibl,IBL_W,IBL_H,0,IBL_H);paint(band,W,bandH,bandY0,H);}
  // Sky irradiance on a horizontal card (from the painted lighting image), plus the sun's.
  const skyE=[0,0,0];
  for(let y=0;y<IBL_H;y++){const v=1-(y+.5)/IBL_H,el=(v-.5)*Math.PI;if(el<=0)continue;const w=Math.sin(el)*Math.cos(el)*(2*Math.PI/IBL_W)*(Math.PI/IBL_H);for(let x=0;x<IBL_W;x++)for(let c=0;c<3;c++)skyE[c]+=ibl[(y*IBL_W+x)*3+c]*w;}
  const sunUp=Math.max(0,sunDir[1]),total=skyE.map((e,c)=>e+energy[c]*sunUp);
  const grey=luma(total[0],total[1],total[2]),balance=total.map(t=>grey/t),scale=Math.PI/grey;
  const gain=balance.map(b=>b*scale);
  // Reusing one photographed clearing retains its trees when switching modes. Give that evening study a cool
  // skylight grade, keeping luminance irradiance at π; unlike daylight this is intentionally not neutral white.
  const eveningGrade=name==='evening'&&dayFile===eveningFile?[.48,.72,1.25]:[1,1,1];
  if(eveningGrade[0]!==1){
    const e=luma(...(skyE.map((v,c)=>v*gain[c]*eveningGrade[c]) as [number,number,number]));
    for(let c=0;c<3;c++)gain[c]*=eveningGrade[c]*Math.PI/e;
  }
  for(const img of [ibl,band])for(let i=0;i<img.length;i+=3)for(let c=0;c<3;c++)img[i+c]*=gain[c];
  const sunRgb=energy.map((e,c)=>e*gain[c]),sunIntensity=luma(sunRgb[0],sunRgb[1],sunRgb[2]),sunColor=bright?sunRgb.map(c=>c/Math.max(...sunRgb)):[1,1,1];
  // The band as sRGB of radiance ÷ bandScale, where bandScale is its 99.5th-percentile brightness.
  const lums:number[]=[];for(let i=0;i<band.length;i+=3*37)lums.push(luma(band[i],band[i+1],band[i+2]));
  lums.sort((a,b)=>a-b);const bandScale=lums[Math.floor(lums.length*.995)]*1.05;
  const pixels=new Uint8Array(W*bandH*3);for(let i=0;i<band.length;i++)pixels[i]=Math.round(255*srgb(Math.min(1,band[i]/bandScale)));
  // The horizon's colour (the band's bottom quarter, above the horizon line), for the fog.
  const horizon=[0,0,0];let hn=0;const hy0=Math.round(bandH*(BAND_TOP_DEG-2)/(BAND_TOP_DEG-BAND_BOTTOM_DEG)),hy1=Math.round(bandH*BAND_TOP_DEG/(BAND_TOP_DEG-BAND_BOTTOM_DEG));
  for(let y=hy0;y<hy1;y++)for(let x=0;x<W;x+=4){for(let c=0;c<3;c++)horizon[c]+=band[(y*W+x)*3+c];hn++;}
  mkdirSync(outDir,{recursive:true});
  writeHdr(join(outDir,`sky-${name}-ibl.hdr`),IBL_W,IBL_H,ibl);
  await sharp(Buffer.from(pixels),{raw:{width:W,height:bandH,channels:3}}).webp({quality:80,effort:6}).toFile(join(outDir,`sky-${name}-band.webp`));
  const deg=(r:number)=>Math.round(r*180/Math.PI*100)/100;
  return {
    source:file.split(/[\\/]/).pop(),sunAzimuthDeg:deg(Math.atan2(sunDir[2],sunDir[0])),sunElevationDeg:deg(Math.asin(sunDir[1])),
    sunIntensity:+sunIntensity.toFixed(4),sunColor:sunColor.map(c=>+c.toFixed(4)),sunPixels:count,sunShare:+sunShare.toFixed(3),sunPainted:bright,
    skyIrradiance:+luma(...(skyE.map((e,c)=>e*gain[c]) as [number,number,number])).toFixed(4),
    bandScale:+bandScale.toFixed(4),bandTopDeg:BAND_TOP_DEG,bandBottomDeg:BAND_BOTTOM_DEG,
    horizonColor:horizon.map(c=>+(c/hn).toFixed(4)),whiteBalance:balance.map(b=>+b.toFixed(4)),eveningGrade,
  };
}

const day=await build(dayFile,'day'),evening=await build(eveningFile,'evening');
writeFileSync(join(outDir,'sky.json'),JSON.stringify({day,evening},null,1)+'\n');
console.log(JSON.stringify({day,evening},null,1));
