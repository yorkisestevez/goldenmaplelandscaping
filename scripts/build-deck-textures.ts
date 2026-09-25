/**
 * Builds DeckCraft's scanned surface textures (Real Life G3) from Poly Haven CC0 downloads: a development tool, not
 * part of lint.
 *
 * usage: npx tsx scripts/build-deck-textures.ts <polyhavenDir> [outDir]
 *
 * The lawn is leafy_grass (a photoscan, 2 m square). Its colour map is graded to a natural lawn: each pixel keeps its
 * brightness relative to the scan's mean and a share of its own tint, around a target mean (the scan itself is an
 * autumn lawn with leaf litter). The normal (OpenGL) and roughness maps are only re-encoded.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';

const [source,outDir='src/features/deckcraft/components/viewer3d/assets']=process.argv.slice(2);
if(!source)throw new Error('usage: npx tsx scripts/build-deck-textures.ts <polyhavenDir> [outDir]');

/** The lawn's mean colour (sRGB) and how much of the scan's own tint each pixel keeps. */
export const LAWN_GRADE={mean:[77,97,49] as const,tint:.35};
const toLinear=(v:number)=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
const toSrgb=(v:number)=>Math.round(255*Math.max(0,Math.min(1,v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055)));
const luma=(r:number,g:number,b:number)=>.2126*r+.7152*g+.0722*b;

async function gradeLawn(file:string,out:string){
  const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true}),n=info.width*info.height;
  const lum=new Float32Array(n),tint=[new Float32Array(n),new Float32Array(n),new Float32Array(n)],sum=[0,0,0];let meanL=0;
  for(let i=0;i<n;i++){const rgb=[toLinear(data[i*3]),toLinear(data[i*3+1]),toLinear(data[i*3+2])],l=luma(rgb[0],rgb[1],rgb[2]);lum[i]=l;meanL+=l;rgb.forEach((v,c)=>{tint[c][i]=v/Math.max(1e-4,l);sum[c]+=v;});}
  meanL/=n;
  const target=LAWN_GRADE.mean.map(toLinear),targetL=luma(target[0],target[1],target[2]),targetTint=target.map(t=>t/targetL),meanTint=sum.map(s=>s/n/meanL);
  const pixels=Buffer.alloc(n*3);
  for(let i=0;i<n;i++){const l=lum[i]/meanL*targetL;for(let c=0;c<3;c++)pixels[i*3+c]=toSrgb(l*targetTint[c]*(1+LAWN_GRADE.tint*(tint[c][i]/meanTint[c]-1)));}
  await sharp(pixels,{raw:{width:info.width,height:info.height,channels:3}}).webp({quality:82}).toFile(out);
}

mkdirSync(outDir,{recursive:true});
await gradeLawn(join(source,'leafy_grass_diff_1k.jpg'),join(outDir,'lawn-color.webp'));
await sharp(join(source,'leafy_grass_nor_gl_1k.jpg')).webp({quality:90}).toFile(join(outDir,'lawn-normal.webp'));
await sharp(join(source,'leafy_grass_rough_1k.jpg')).greyscale().webp({quality:85}).toFile(join(outDir,'lawn-roughness.webp'));
const stats=await sharp(join(outDir,'lawn-color.webp')).stats(),mean=stats.channels.slice(0,3).map(c=>Math.round(c.mean));
writeFileSync(join(outDir,'lawn.json'),JSON.stringify({source:'Poly Haven leafy_grass (CC0), 1K',tileInches:78.74,meanSrgb:mean,grade:LAWN_GRADE},null,1)+'\n');
console.log('lawn mean',mean);
