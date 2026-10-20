/**
 * Builds the hydrangea floret and leaf atlases from CC0 iNaturalist photos (hydrangea pilot, 2026-10-20). Offline only:
 * the originals are downloaded to .photo-cache/hydrangea (git-ignored), cut out, colour-balanced to the botany colours
 * in hydrangeaSpecs.ts, and written with SOURCES.json, which check-hydrangeas.ts verifies in CI without the network.
 *
 *   npx tsx scripts/build-hydrangea-textures.mts [--preview <dir>]
 *
 * Cut-outs: a region grown from a seed by colour (Lab distance to the seed's mean colour), kept inside a hand-placed
 * outline (ellipses, in image-width units) so a touching neighbour floret or leaf is not taken with it. A tolerance of
 * Infinity keeps the outline as drawn (a soft, out-of-focus floret whose colour runs into its background).
 */
import sharp,{type OverlayOptions} from 'sharp';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {HYDRANGEA_SPECS} from '../src/features/deckcraft/components/viewer3d/hydrangea/hydrangeaSpecs';
import {FLORET_ATLAS,LEAF_ATLAS,HYDRANGEA_CULTIVARS} from '../src/features/deckcraft/components/viewer3d/hydrangea/hydrangeaTextures';
import type {HydrangeaCultivar} from '../src/features/deckcraft/hydrangeaCultivars';

const CACHE='.photo-cache/hydrangea',OUT='public/deckcraft/landscape/hydrangea';
const WORK=1100;

interface Photo {photoId:number;ext:'jpg'|'jpeg';observationId:number;observer:string;use:string}
/** Every photo's licence_code was "cc0" from the iNaturalist API on 2026-10-20 (research/inat-cc0-candidates.json). */
const PHOTOS:Photo[]=[
 {photoId:720834356,ext:'jpg',observationId:393278872,observer:'jacob_mullin',use:'Limelight (H. paniculata) floret'},
 {photoId:47732501,ext:'jpeg',observationId:30529047,observer:'lvdt',use:'Annabelle (H. arborescens) floret'},
 {photoId:422983973,ext:'jpeg',observationId:237654588,observer:'marinolinic',use:'Endless Summer (H. macrophylla) floret'},
 {photoId:730410163,ext:'jpg',observationId:398187027,observer:'roberto-rizzi',use:'H. paniculata leaf, upper side'},
 {photoId:702347193,ext:'jpg',observationId:383727485,observer:'jacob_mullin',use:'H. paniculata leaf, underside'},
 {photoId:669507718,ext:'jpg',observationId:366649561,observer:'ingolfaskevold',use:'H. arborescens leaf, upper side'},
 {photoId:413271678,ext:'jpg',observationId:232608060,observer:'kzoebel',use:'H. arborescens leaf, underside'},
 {photoId:601598413,ext:'jpg',observationId:331604936,observer:'fabiotenshi',use:'H. macrophylla leaf, upper side'},
];
/** [cx, cy, rx, ry, degrees]: centre as fractions of width and height, radii as fractions of width. */
type Ellipse=[number,number,number,number,number];
interface Cut {photoId:number;seed:[number,number];outline:Ellipse[];tolerance:number}
const FLORETS:Record<HydrangeaCultivar,Cut>={
 limelight:{photoId:720834356,seed:[.565,.605],tolerance:30,outline:[[.575,.5,.09,.135,-8],[.73,.545,.165,.085,-18],[.65,.725,.09,.135,-22],[.405,.625,.17,.075,6],[.565,.605,.07,.07,0]]},
 annabelle:{photoId:47732501,seed:[.49,.51],tolerance:Infinity,outline:[[.575,.325,.145,.155,0],[.295,.49,.175,.18,0],[.715,.555,.185,.17,0],[.53,.725,.13,.175,0],[.49,.51,.1,.1,0]]},
 'endless-summer':{photoId:422983973,seed:[.48,.47],tolerance:46,outline:[[.49,.495,.33,.3,0]]},
};
/** invertTip: the narrower-end rule picks the wrong end (a base cut off by the photo's edge is narrow too). */
interface LeafCut extends Cut {invertTip?:boolean;back:{photoId:number;centre:[number,number];midribDeg:number;spanW:number}|'tint'}
const LEAVES:Record<HydrangeaCultivar,LeafCut>={
 limelight:{photoId:730410163,seed:[.61,.5],tolerance:28,outline:[[.61,.47,.24,.64,0]],invertTip:true,back:{photoId:702347193,centre:[.47,.45],midribDeg:-16.7,spanW:.45}},
 annabelle:{photoId:669507718,seed:[.5,.55],tolerance:30,outline:[[.505,.53,.27,.3,8]],back:{photoId:413271678,centre:[.47,.43],midribDeg:33,spanW:.55}},
 'endless-summer':{photoId:601598413,seed:[.47,.55],tolerance:34,outline:[[.48,.57,.36,.56,-4]],back:'tint'},
};

const photoUrl=(p:Photo)=>`https://inaturalist-open-data.s3.amazonaws.com/photos/${p.photoId}/original.${p.ext}`;
const photo=(id:number)=>{const p=PHOTOS.find(x=>x.photoId===id);if(!p)throw Error('Unlisted photo '+id);return p;};
async function original(id:number){
 const p=photo(id),path=`${CACHE}/${p.photoId}.${p.ext}`;
 if(!existsSync(path)){mkdirSync(CACHE,{recursive:true});const res=await fetch(photoUrl(p));if(!res.ok)throw Error(`Download ${p.photoId} failed: ${res.status}`);writeFileSync(path,Buffer.from(await res.arrayBuffer()));}
 return path;
}
interface Img {w:number;h:number;rgb:Uint8Array}
async function load(id:number):Promise<Img>{
 const {data,info}=await sharp(await original(id)).rotate().resize(WORK,WORK,{fit:'inside'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 return {w:info.width,h:info.height,rgb:new Uint8Array(data)};
}
const lin=(c:number)=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
function lab(r:number,g:number,b:number):[number,number,number]{
 const R=lin(r),G=lin(g),B=lin(b),f=(t:number)=>t>.008856?Math.cbrt(t):7.787*t+16/116;
 const x=f((.4124*R+.3576*G+.1805*B)/.9505),y=f(.2126*R+.7152*G+.0722*B),z=f((.0193*R+.1192*G+.9505*B)/1.089);
 return [116*y-16,500*(x-y),200*(y-z)];
}
function inOutline(img:Img,outline:Ellipse[],grow:number){
 const m=new Uint8Array(img.w*img.h);
 for(const [cx,cy,rx,ry,deg] of outline){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),X=cx*img.w,Y=cy*img.h,RX=rx*img.w*(1+grow),RY=ry*img.w*(1+grow);
  for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){const dx=x-X,dy=y-Y,u=(dx*c+dy*s)/RX,v=(-dx*s+dy*c)/RY;if(u*u+v*v<=1)m[y*img.w+x]=1;}}
 return m;
}
/** Region grown from the seed by Lab distance to the seed's mean, inside the outline; holes filled; edges softened. */
function cutOut(img:Img,cut:Cut):Float32Array{
 const {w,h,rgb}=img,allowed=inOutline(img,cut.outline,.06),labs=new Float32Array(w*h*3);
 for(let i=0;i<w*h;i++){const L=lab(rgb[i*3],rgb[i*3+1],rgb[i*3+2]);labs[i*3]=L[0];labs[i*3+1]=L[1];labs[i*3+2]=L[2];}
 const sx=Math.round(cut.seed[0]*w),sy=Math.round(cut.seed[1]*h),mean=[0,0,0];let n=0;
 for(let y=sy-12;y<=sy+12;y++)for(let x=sx-12;x<=sx+12;x++){const i=y*w+x;for(let k=0;k<3;k++)mean[k]+=labs[i*3+k];n++;}
 mean.forEach((v,k)=>mean[k]=v/n);
 const inside=new Uint8Array(w*h),stack=[sy*w+sx];inside[sy*w+sx]=1;
 const near=(i:number)=>Math.hypot((labs[i*3]-mean[0])*.5,labs[i*3+1]-mean[1],labs[i*3+2]-mean[2])<cut.tolerance;
 while(stack.length){const i=stack.pop()!,x=i%w,y=(i-x)/w;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=w||Y>=h)continue;const j=Y*w+X;if(!inside[j]&&allowed[j]&&near(j)){inside[j]=1;stack.push(j);}}}
 // Fill holes: whatever the border cannot reach is part of the cut-out (veins, the floret's eye, specks).
 const outside=new Uint8Array(w*h),edge:number[]=[];
 for(let x=0;x<w;x++)edge.push(x,(h-1)*w+x);for(let y=0;y<h;y++)edge.push(y*w,y*w+w-1);
 for(const i of edge)if(!inside[i]&&!outside[i]){outside[i]=1;const s=[i];while(s.length){const k=s.pop()!,x=k%w,y=(k-x)/w;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=w||Y>=h)continue;const j=Y*w+X;if(!inside[j]&&!outside[j]){outside[j]=1;s.push(j);}}}}
 // Open (erode, dilate) by 2 px to drop single-pixel spurs, then a 1.5 px soft edge.
 const morph=(src:Float32Array,op:'min'|'max')=>{const out=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=src[y*w+x];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const X=Math.min(w-1,Math.max(0,x+dx)),Y=Math.min(h-1,Math.max(0,y+dy)),u=src[Y*w+X];v=op==='min'?Math.min(v,u):Math.max(v,u);}out[y*w+x]=v;}return out;};
 let a=new Float32Array(w*h);for(let i=0;i<w*h;i++)a[i]=outside[i]?0:1;
 a=morph(morph(a,'min'),'max');
 const soft=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=Math.min(w-1,Math.max(0,x+dx)),Y=Math.min(h-1,Math.max(0,y+dy));s+=a[Y*w+X]*(dx||dy?1:2);c+=dx||dy?1:2;}soft[y*w+x]=s/c;}
 return soft;
}
/** RGBA buffer of the cut-out, cropped to it (plus a margin). */
function crop(img:Img,alpha:Float32Array,margin=4){
 let x0=img.w,y0=img.h,x1=0,y1=0;
 for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++)if(alpha[y*img.w+x]>.5){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 x0=Math.max(0,x0-margin);y0=Math.max(0,y0-margin);x1=Math.min(img.w-1,x1+margin);y1=Math.min(img.h-1,y1+margin);
 const w=x1-x0+1,h=y1-y0+1,out=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const s=(y+y0)*img.w+x+x0,d=(y*w+x)*4;out[d]=img.rgb[s*3];out[d+1]=img.rgb[s*3+1];out[d+2]=img.rgb[s*3+2];out[d+3]=Math.round(alpha[s]*255);}
 return {w,h,data:out};
}
type Rgba={w:number;h:number;data:Uint8Array};
async function rotate(src:Rgba,deg:number):Promise<Rgba>{
 const {data,info}=await sharp(Buffer.from(src.data),{raw:{width:src.w,height:src.h,channels:4}}).rotate(deg,{background:{r:0,g:0,b:0,alpha:0}}).raw().toBuffer({resolveWithObject:true});
 return {w:info.width,h:info.height,data:new Uint8Array(data)};
}
/** The leaf's long axis (alpha-weighted principal axis), degrees from vertical. */
function longAxisDeg(src:Rgba){
 let n=0,mx=0,my=0;for(let y=0;y<src.h;y++)for(let x=0;x<src.w;x++){const a=src.data[(y*src.w+x)*4+3]/255;n+=a;mx+=a*x;my+=a*y;}
 mx/=n;my/=n;let sxx=0,syy=0,sxy=0;
 for(let y=0;y<src.h;y++)for(let x=0;x<src.w;x++){const a=src.data[(y*src.w+x)*4+3]/255,dx=x-mx,dy=y-my;sxx+=a*dx*dx;syy+=a*dy*dy;sxy+=a*dx*dy;}
 return Math.atan2(2*sxy,sxx-syy)/2*180/Math.PI-90;
}
/** Trim to the opaque box. */
function trim(src:Rgba){
 let x0=src.w,y0=src.h,x1=0,y1=0;
 for(let y=0;y<src.h;y++)for(let x=0;x<src.w;x++)if(src.data[(y*src.w+x)*4+3]>127){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 const w=x1-x0+1,h=y1-y0+1,out=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)out.set(src.data.subarray(((y+y0)*src.w+x0)*4,((y+y0)*src.w+x0+w)*4),y*w*4);
 return {w,h,data:out};
}
function rowWidth(src:Rgba,y:number){let n=0;for(let x=0;x<src.w;x++)if(src.data[(y*src.w+x)*4+3]>127)n++;return n;}
const flip180=(src:Rgba):Rgba=>{const out=new Uint8Array(src.data.length);for(let i=0;i<src.w*src.h;i++)out.set(src.data.subarray(i*4,i*4+4),(src.w*src.h-1-i)*4);return {...src,data:out};};

const linColor=(hex:string)=>[1,3,5].map(i=>lin(parseInt(hex.slice(i,i+2),16)));
const enc=(c:number)=>Math.round(255*Math.min(1,c<=.0031308?c*12.92:1.055*c**(1/2.4)-.055));
/** Scale each channel (in linear light) so the opaque texels average the target colour; soften the brightest glints. */
function balance(src:Rgba,hex:string){
 const target=linColor(hex),sum=[0,0,0];let n=0;
 for(let i=0;i<src.w*src.h;i++)if(src.data[i*4+3]>200){for(let k=0;k<3;k++)sum[k]+=lin(src.data[i*4+k]);n++;}
 const gain=target.map((t,k)=>t/(sum[k]/n));
 for(let i=0;i<src.w*src.h;i++)for(let k=0;k<3;k++){const v=lin(src.data[i*4+k])*gain[k],glint=target[k]*2.2;src.data[i*4+k]=enc(v>glint?glint+(v-glint)*.25:v);}
 return src;
}
/** Light and shade only (grey, its bright sepals near white): the floret colour comes from each instance. */
function greyscale(src:Rgba){
 const ls:number[]=[];for(let i=0;i<src.w*src.h;i++)if(src.data[i*4+3]>200)ls.push(.2126*lin(src.data[i*4])+.7152*lin(src.data[i*4+1])+.0722*lin(src.data[i*4+2]));
 ls.sort((a,b)=>a-b);const white=ls[Math.floor(ls.length*.9)];
 for(let i=0;i<src.w*src.h;i++){const l=(.2126*lin(src.data[i*4])+.7152*lin(src.data[i*4+1])+.0722*lin(src.data[i*4+2]))/white*.96,v=enc(Math.min(1,l));src.data[i*4]=src.data[i*4+1]=src.data[i*4+2]=v;}
 return src;
}
/** Fit into a cell (keeping proportions), centred; transparent texels take their nearest opaque colour so mips do not darken edges. */
async function fit(src:Rgba,cellW:number,cellH:number,fill:number):Promise<Rgba&{fill:[number,number]}>{
 const s=Math.min(cellW*fill/src.w,cellH*fill/src.h),w=Math.max(1,Math.round(src.w*s)),h=Math.max(1,Math.round(src.h*s));
 const scaled=await sharp(Buffer.from(src.data),{raw:{width:src.w,height:src.h,channels:4}}).resize(w,h,{kernel:'lanczos3'}).raw().toBuffer();
 const out=new Uint8Array(cellW*cellH*4),ox=Math.round((cellW-w)/2),oy=Math.round((cellH-h)/2);
 for(let y=0;y<h;y++)out.set(scaled.subarray(y*w*4,(y+1)*w*4),((y+oy)*cellW+ox)*4);
 return {...pad({w:cellW,h:cellH,data:out}),fill:[+(w/cellW).toFixed(4),+(h/cellH).toFixed(4)]};
}
function pad(src:Rgba):Rgba{
 const {w,h,data}=src,known=new Uint8Array(w*h);for(let i=0;i<w*h;i++)known[i]=data[i*4+3]>0?1:0;
 for(let pass=0;pass<24;pass++){const next=known.slice();let changed=false;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(known[i])continue;const s=[0,0,0];let n=0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=w||Y>=h||!known[Y*w+X])continue;for(let k=0;k<3;k++)s[k]+=data[(Y*w+X)*4+k];n++;}if(n){for(let k=0;k<3;k++)data[i*4+k]=Math.round(s[k]/n);next[i]=1;changed=true;}}
  known.set(next);if(!changed)break;}
 return src;
}
/** Several florets stamped about a disc at random turns and sizes, the lower ones a little shaded: a distant head's card. */
async function cluster(single:Rgba,cell:number,seed:number):Promise<Rgba>{
 let a=seed>>>0;const rand=()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
 const layers:OverlayOptions[]=[];
 for(let i=0;i<22;i++){
  const r=Math.sqrt((i+.5)/22)*cell*.33,phi=i*2.39996,size=Math.round(cell*(.3+rand()*.1));
  const shade=.78+.22*(1-r/(cell*.33));
  const tinted=Buffer.from(single.data.map((v,k)=>k%4===3?v:Math.round(v*shade)));
  const img=await sharp(tinted,{raw:{width:single.w,height:single.h,channels:4}}).resize(size,size,{fit:'inside'}).rotate(rand()*360,{background:{r:0,g:0,b:0,alpha:0}}).resize(size,size,{fit:'inside'}).png().toBuffer();
  layers.push({input:img,left:Math.round(cell/2+Math.cos(phi)*r-size/2),top:Math.round(cell/2+Math.sin(phi)*r-size/2)});
 }
 const {data,info}=await sharp({create:{width:cell,height:cell,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers.reverse()).raw().toBuffer({resolveWithObject:true});
 return pad({w:info.width,h:info.height,data:new Uint8Array(data)});
}
/** The underside: the back photo's tissue, midrib upright, inside the upper side's outline. */
async function underside(front:Rgba,cut:LeafCut,cultivar:HydrangeaCultivar):Promise<Rgba>{
 // The same outline as the upper side, so a leaf drawn from either side has one silhouette (and one shadow).
 const shape=front;
 if(cut.back==='tint'){const out={...shape,data:shape.data.slice()};return balance(out,HYDRANGEA_SPECS[cultivar].leaf.back);}
 const b=cut.back,src=await load(b.photoId),span=Math.round(b.spanW*src.w);
 const rgba=new Uint8Array(src.w*src.h*4);for(let i=0;i<src.w*src.h;i++){rgba.set(src.rgb.subarray(i*3,i*3+3),i*4);rgba[i*4+3]=255;}
 const turned=await rotate({w:src.w,h:src.h,data:rgba},-b.midribDeg);
 // The photo centre moves with the turn; find it again from the rotation about the image centre.
 const a=-b.midribDeg*Math.PI/180,cx=b.centre[0]*src.w-src.w/2,cy=b.centre[1]*src.h-src.h/2;
 const X=Math.round(turned.w/2+cx*Math.cos(a)-cy*Math.sin(a)),Y=Math.round(turned.h/2+cx*Math.sin(a)+cy*Math.cos(a));
 const tall=Math.round(span*shape.h/shape.w),left=Math.max(0,X-span/2|0),top=Math.max(0,Y-tall/2|0);
 const tissue=await sharp(Buffer.from(turned.data),{raw:{width:turned.w,height:turned.h,channels:4}}).extract({left,top,width:Math.min(span,turned.w-left),height:Math.min(tall,turned.h-top)}).resize(shape.w,shape.h,{fit:'fill'}).raw().toBuffer();
 const out=new Uint8Array(shape.data.length);for(let i=0;i<shape.w*shape.h;i++){out.set(tissue.subarray(i*4,i*4+3),i*4);out[i*4+3]=shape.data[i*4+3];}
 return balance({w:shape.w,h:shape.h,data:out},HYDRANGEA_SPECS[cultivar].leaf.back);
}
async function leafFront(cut:LeafCut,cultivar:HydrangeaCultivar){
 const img=await load(cut.photoId);
 const cut0=crop(img,cutOut(img,cut));
 let leaf=trim(await rotate(cut0,-longAxisDeg(cut0)));
 // The acuminate tip is the narrower end: put it at the top (the card's +y runs petiole to tip).
 const band=Math.max(2,Math.round(leaf.h*.12));if((rowWidth(leaf,band)>rowWidth(leaf,leaf.h-1-band))!==!!cut.invertTip)leaf=flip180(leaf);
 return balance(leaf,HYDRANGEA_SPECS[cultivar].leaf.front);
}

async function build(previewDir?:string){
 mkdirSync(OUT,{recursive:true});
 const florets=new Uint8Array(FLORET_ATLAS.width*FLORET_ATLAS.height*4),leaves=new Uint8Array(LEAF_ATLAS.width*LEAF_ATLAS.height*4);
 const blit=(atlas:Uint8Array,atlasW:number,cell:Rgba,x:number,y:number)=>{for(let r=0;r<cell.h;r++)atlas.set(cell.data.subarray(r*cell.w*4,(r+1)*cell.w*4),((y+r)*atlasW+x)*4);};
 const leafFill:Record<string,[number,number]>={},floretFill:Record<string,[number,number]>={};
 for(const [i,cultivar] of HYDRANGEA_CULTIVARS.entries()){
  const fc=FLORETS[cultivar],img=await load(fc.photoId),single=await fit(greyscale(trim(crop(img,cutOut(img,fc)))),FLORET_ATLAS.cell,FLORET_ATLAS.cell,.96);
  blit(florets,FLORET_ATLAS.width,single,i*FLORET_ATLAS.cell,0);floretFill[cultivar]=single.fill;
  blit(florets,FLORET_ATLAS.width,await cluster(single,FLORET_ATLAS.cell,fc.photoId),i*FLORET_ATLAS.cell,FLORET_ATLAS.cell);
  const lc=LEAVES[cultivar],front=await leafFront(lc,cultivar),back=await underside(front,lc,cultivar);
  const upper=await fit(front,LEAF_ATLAS.cellW,LEAF_ATLAS.cellH,.98);leafFill[cultivar]=upper.fill;
  blit(leaves,LEAF_ATLAS.width,upper,i*LEAF_ATLAS.cellW,0);
  blit(leaves,LEAF_ATLAS.width,await fit(back,LEAF_ATLAS.cellW,LEAF_ATLAS.cellH,.98),i*LEAF_ATLAS.cellW,LEAF_ATLAS.cellH);
 }
 const write=async(name:string,data:Uint8Array,w:number,h:number)=>{const buf=await sharp(Buffer.from(data),{raw:{width:w,height:h,channels:4}}).webp({quality:88,alphaQuality:100,effort:6}).toBuffer();writeFileSync(`${OUT}/${name}`,buf);
  if(previewDir){mkdirSync(previewDir,{recursive:true});await sharp(buf).flatten({background:'#ff00ff'}).png().toFile(`${previewDir}/${name}.png`);}
  return {file:name,sha256:createHash('sha256').update(buf).digest('hex'),bytes:buf.length};};
 const textures=[
  {...await write('florets.webp',florets,FLORET_ATLAS.width,FLORET_ATLAS.height),photoIds:Object.values(FLORETS).map(c=>c.photoId),fill:floretFill},
  {...await write('leaves.webp',leaves,LEAF_ATLAS.width,LEAF_ATLAS.height),photoIds:[...new Set(Object.values(LEAVES).flatMap(c=>[c.photoId,...c.back==='tint'?[]:[c.back.photoId]]))],fill:leafFill},
 ];
 const manifest={note:'Hydrangea floret and leaf textures, cut out and colour-balanced from CC0 (public-domain) iNaturalist photos by scripts/build-hydrangea-textures.mts. iNaturalist grades cultivated plants "casual"; the photos show these species, not a verified cultivar. No CC0 underside photo of H. macrophylla was usable, so the Endless Summer underside is its upper-side photo recoloured to the underside colour.',
  photos:PHOTOS.map(p=>({photoId:p.photoId,url:photoUrl(p),observationUrl:`https://www.inaturalist.org/observations/${p.observationId}`,observer:p.observer,licence:'cc0',use:p.use})),textures};
 writeFileSync(`${OUT}/SOURCES.json`,JSON.stringify(manifest,null,1)+'\n');
 console.log(textures.map(t=>`${t.file} ${(t.bytes/1024).toFixed(1)} KB`).join(', '));
}
const at=process.argv.indexOf('--preview');
await build(at>0?process.argv[at+1]:undefined);

