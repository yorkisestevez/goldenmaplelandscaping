/**
 * Builds DeckCraft's scanned surface textures (Real Life G3) from Poly Haven CC0 downloads: a development tool, not
 * part of lint.
 *
 * usage: npx tsx scripts/build-deck-textures.ts <polyhavenDir> [outDir]
 *
 * The lawn is leafy_grass (a photoscan, 2 m square). Its colour map is graded to a natural lawn: each pixel keeps its
 * brightness relative to the scan's mean and a share of its own tint, around a target mean (the scan itself is an
 * autumn lawn with leaf litter). The normal (OpenGL) and roughness maps are only re-encoded.
 *
 * Masonry (concrete_floor_01, 2 m) and rock (rock_face_03, 2.7 m) are the house's surface detail (Real Life G4): their
 * colour becomes a grey detail map, linear, with a mean of exactly 0.5, which the cladding's own colour (doubled)
 * multiplies, so a wall keeps the colour the customer picked on average. The normal map is re-encoded (walls are rough
 * enough that a roughness map would not show).
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

/** A scan's colour as a grey detail map: linear luminance scaled to a mean of 0.5, stored as linear bytes. */
async function detailMap(file:string,out:string){
  const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true}),n=info.width*info.height,lum=new Float32Array(n);let mean=0;
  for(let i=0;i<n;i++){lum[i]=luma(toLinear(data[i*3]),toLinear(data[i*3+1]),toLinear(data[i*3+2]));mean+=lum[i];}
  mean/=n;
  // Bright specks clip at white and pull the mean down, so the scale is raised until the clipped map averages 0.5.
  let scale=.5/mean;for(let k=0;k<8;k++){let m=0;for(let i=0;i<n;i++)m+=Math.min(1,lum[i]*scale);scale*=.5/(m/n);}
  const pixels=Buffer.alloc(n);for(let i=0;i<n;i++)pixels[i]=Math.round(255*Math.min(1,lum[i]*scale));
  await sharp(pixels,{raw:{width:info.width,height:info.height,channels:1}}).webp({quality:90}).toFile(out);
}

mkdirSync(outDir,{recursive:true});
await gradeLawn(join(source,'leafy_grass_diff_1k.jpg'),join(outDir,'lawn-color.webp'));
await sharp(join(source,'leafy_grass_nor_gl_1k.jpg')).webp({quality:90}).toFile(join(outDir,'lawn-normal.webp'));
await sharp(join(source,'leafy_grass_rough_1k.jpg')).greyscale().webp({quality:85}).toFile(join(outDir,'lawn-roughness.webp'));
for(const [scan,name] of [['concrete_floor_01','masonry'],['rock_face_03','rock']] as const){
  await detailMap(join(source,`${scan}_diff_1k.jpg`),join(outDir,`${name}-detail.webp`));
  await sharp(join(source,`${scan}_nor_gl_1k.jpg`)).webp({quality:90}).toFile(join(outDir,`${name}-normal.webp`));
}
const stats=await sharp(join(outDir,'lawn-color.webp')).stats(),mean=stats.channels.slice(0,3).map(c=>Math.round(c.mean));
writeFileSync(join(outDir,'lawn.json'),JSON.stringify({source:'Poly Haven leafy_grass (CC0), 1K',tileInches:78.74,meanSrgb:mean,grade:LAWN_GRADE},null,1)+'\n');
console.log('lawn mean',mean);
