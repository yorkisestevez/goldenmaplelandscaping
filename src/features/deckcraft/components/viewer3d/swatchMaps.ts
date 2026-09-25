/**
 * Board textures from a manufacturer's swatch photo (Real Life G2): an atlas of the photo's own board strips, each made
 * to repeat along the grain without a seam, with the photo's lighting evened out; a normal map and a roughness map
 * from the grain's relief. The atlas keeps the photo's mean colour exactly, so a board on screen is the colour of the
 * product. Plain typed arrays with no three.js, so check-deck-realism runs it on every swatch through sharp.
 *
 * Swatch layouts (src/features/deckcraft/assets/swatches): TimberTech's square photos show about four boards with dark
 * gaps between them and one board across them on the right; Deckorators' photos and TimberTech's 400 × 250 ones are
 * close-ups of one surface; the cedar photo's grain runs up the picture.
 */
export interface SwatchImage{width:number;height:number;data:Uint8Array|Uint8ClampedArray}
export interface Strip{x0:number;x1:number;y0:number;y1:number}
export interface SwatchLayout{rotated:boolean;kind:'boards'|'surface';strips:Strip[]}
export interface SwatchMaps{
  width:number;height:number;strips:number;
  /** RGBA bytes, rows top to bottom, strip k in rows k·128 to k·128+127 (an 8-row gutter above and below its 112). */
  albedo:Uint8Array;normal:Uint8Array;roughness:Uint8Array;
  layout:SwatchLayout;
  /** Mean sRGB colour (0–255) of the photo's strips, and of the atlas. */
  sourceMean:[number,number,number];atlasMean:[number,number,number];
}
export const ATLAS_WIDTH=512,STRIP_ROWS=128,STRIP_GUTTER=8,STRIP_BODY=STRIP_ROWS-2*STRIP_GUTTER;
/** Roughness of a composite's capped surface and of real wood; raised grain is a little smoother than its grooves. */
export const BOARD_ROUGHNESS={composite:.62,wood:.75,relief:.12};
/** How much of the photo's board-to-board tone difference each strip keeps. Multi-tone lines (Tigerwood) differ a lot
 * between the photo's four boards; at their full spread short pieces between butt joints read as a patchwork. */
export const BOARD_TONE_SPREAD=.6;
/** The steepest tilt the grain's relief gives the surface, in degrees. */
export const GRAIN_TILT_DEG=30;

const lumaAt=(d:SwatchImage['data'],i:number)=>(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])/255;

/** The photo turned a quarter turn, so vertical grain runs across the picture like the rest. */
export function rotate90(img:SwatchImage):SwatchImage{
  const {width:w,height:h,data}=img,out=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const s=(y*w+x)*4,t=(x*h+(h-1-y))*4;out[t]=data[s];out[t+1]=data[s+1];out[t+2]=data[s+2];out[t+3]=255;}
  return {width:h,height:w,data:out};
}

/** Grain runs across the photo when brightness changes more from row to row than along a row. */
export function grainIsVertical(img:SwatchImage){
  const {width:w,height:h,data}=img;let gx=0,gy=0;
  for(let y=Math.floor(h*.1);y<h*.9-1;y+=2)for(let x=Math.floor(w*.1);x<w*.6-1;x+=2){const i=(y*w+x)*4,l=lumaAt(data,i);gx+=Math.abs(lumaAt(data,i+4)-l);gy+=Math.abs(lumaAt(data,i+w*4)-l);}
  return gx>gy*1.15;
}

const median=(v:number[])=>{const s=[...v].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]??0;};

/**
 * Where the boards are. Gaps between boards are near-black rows (under 0.6 of the photo's median brightness, across the
 * left half, which is boards in every photo); a dark grain streak never gets that dark. Along those gap rows the gap
 * stays dark until it meets the board that runs across the others on the right: the strips stop short of that seam.
 * The boards between gaps (a tenth trimmed off each edge, where the photo shows the eased edge) are the strips. A photo
 * with fewer than two boards is a close-up of one surface, cut into three bands.
 */
export function detectLayout(input:SwatchImage):SwatchLayout{
  const rotated=grainIsVertical(input),img=rotated?rotate90(input):input,{width:w,height:h,data}=img,L=(x:number,y:number)=>lumaAt(data,(y*w+x)*4);
  let x0=Math.floor(w*.015),x1=Math.ceil(w*.985);const left=Math.floor(w*.55);
  const lumas:number[]=[];for(let y=0;y<h;y++)for(let x=x0;x<left;x+=3)lumas.push(L(x,y));
  const mid=median(lumas),gap:boolean[]=[];
  for(let y=0;y<h;y++){let s=0,n=0;for(let x=x0;x<left;x+=3){s+=L(x,y);n++;}gap.push(s/n<mid*.6);}
  const gapRows=gap.flatMap((g,y)=>g?[y]:[]),between:[number,number][]=[];
  for(let y=0;y<h;){while(y<h&&gap[y])y++;const top=y;while(y<h&&!gap[y])y++;if(y-top>=h*.12)between.push([top,y]);}
  if(between.length>=2){
    const dark:number[]=[];for(let x=0;x<w;x++){let d=0;for(const y of gapRows)if(L(x,y)<mid*.8)d++;dark.push(d/gapRows.length);}
    const run=Math.max(2,Math.round(w*.02));
    for(let x=Math.floor(w*.5);x<w*.95;x++){let m=0;for(let k=0;k<run;k++)m+=dark[x+k];if(m/run<.4){x1=Math.max(x0+8,Math.floor(x-w*.015));break;}}
  }
  if(between.length>=2)return {rotated,kind:'boards',strips:between.map(([top,bottom])=>{const trim=Math.round((bottom-top)*.1);return {x0,x1,y0:top+trim,y1:bottom-trim};})};
  const y0=Math.floor(h*.03),band=(h*.94)/3;
  return {rotated,kind:'surface',strips:[0,1,2].map(k=>({x0,x1,y0:Math.round(y0+band*k+band*.03),y1:Math.round(y0+band*(k+1)-band*.03)}))};
}

/** Separable box blur of one channel (a sliding sum), wrapping along x and clamped in y. */
function boxBlur(src:Float32Array,w:number,h:number,rx:number,ry:number){
  const tmp=new Float32Array(w*h),out=new Float32Array(w*h),nx=2*rx+1,ny=2*ry+1;
  for(let y=0;y<h;y++){const row=y*w;let s=0;for(let k=-rx;k<=rx;k++)s+=src[row+((k%w)+w)%w];for(let x=0;x<w;x++){tmp[row+x]=s/nx;s+=src[row+(x+rx+1)%w]-src[row+((x-rx)%w+w)%w];}}
  for(let x=0;x<w;x++){let s=0;for(let k=-ry;k<=ry;k++)s+=tmp[Math.min(h-1,Math.max(0,k))*w+x];for(let y=0;y<h;y++){out[y*w+x]=s/ny;s+=tmp[Math.min(h-1,y+ry+1)*w+x]-tmp[Math.max(0,y-ry)*w+x];}}
  return out;
}

/** One strip of the photo resampled to the atlas (bilinear), repeating along x: its first eighth fades in from the
 * photo just past its end, so the last column runs straight on into the first. Channels 0–255, as floats. */
function resample(img:SwatchImage,s:Strip,w:number,h:number){
  const {width:W,height:H,data}=img,out=[new Float32Array(w*h),new Float32Array(w*h),new Float32Array(w*h)];
  const span=s.x1-s.x0,overlap=span*.125,run=span-overlap;
  const sample=(sx:number,sy:number,c:number)=>{
    const x=Math.min(W-1.001,Math.max(0,sx)),y=Math.min(H-1.001,Math.max(0,sy)),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,i=(iy*W+ix)*4+c;
    return (data[i]*(1-fx)+data[i+4]*fx)*(1-fy)+(data[i+W*4]*(1-fx)+data[i+W*4+4]*fx)*fy;
  };
  for(let y=0;y<h;y++){const sy=s.y0+(y+.5)/h*(s.y1-s.y0)-.5;for(let x=0;x<w;x++){
    const p=(x+.5)/w*run,f=p<overlap?p/overlap:1;
    for(let c=0;c<3;c++)out[c][y*w+x]=f<1?sample(s.x0+p,sy,c)*f+sample(s.x0+p+run,sy,c)*(1-f):sample(s.x0+p,sy,c);
  }}
  return out;
}

const toLab=([r,g,b]:number[])=>{
  const lin=(v:number)=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;},[R,G,B]=[lin(r),lin(g),lin(b)];
  const f=(t:number)=>t>.008856?Math.cbrt(t):7.787*t+16/116,X=f((R*.4124+G*.3576+B*.1805)/.95047),Y=f(R*.2126+G*.7152+B*.0722),Z=f((R*.0193+G*.1192+B*.9505)/1.08883);
  return [116*Y-16,500*(X-Y),200*(Y-Z)];
};
/** CIE76 colour difference between two sRGB colours (0–255). */
export function deltaE(a:number[],b:number[]){const [p,q]=[toLab(a),toLab(b)];return Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);}

/** Builds the atlas and its maps. Yields between strips (`await pause()`), so a large photo never blocks the page. */
export async function buildSwatchMaps(input:SwatchImage,kind:'composite'|'wood',pause:()=>Promise<void>=async()=>{}):Promise<SwatchMaps>{
  const layout=detectLayout(input),img=layout.rotated?rotate90(input):input,n=layout.strips.length,W=ATLAS_WIDTH,B=STRIP_BODY;
  const height=n*STRIP_ROWS,albedo=new Uint8Array(W*height*4),normal=new Uint8Array(W*height*4),roughness=new Uint8Array(W*height*4);
  // The photo's own mean over the strips it gives, the colour the atlas must keep.
  const sum=[0,0,0];let count=0;
  for(const s of layout.strips)for(let y=s.y0;y<s.y1;y++)for(let x=s.x0;x<s.x1;x++){const i=(y*img.width+x)*4;sum[0]+=img.data[i];sum[1]+=img.data[i+1];sum[2]+=img.data[i+2];count++;}
  const sourceMean=sum.map(v=>v/Math.max(1,count)) as [number,number,number];
  const bodies:Float32Array[][]=[];
  for(const s of layout.strips){bodies.push(resample(img,s,W,B));await pause();}
  const channelMean=(v:Float32Array)=>{let m=0;for(const x of v)m+=x;return m/v.length;};
  const stripMeans=bodies.map(ch=>ch.map(channelMean)),overall=[0,1,2].map(c=>stripMeans.reduce((n,m)=>n+m[c],0)/n);
  for(const [k,ch] of bodies.entries()){
    // Even out the photo's lighting: divide by a very soft blur, back to the strip's own tone, drawn towards the rest.
    for(let c=0;c<3;c++){const soft=boxBlur(ch[c],W,B,W>>2,B>>1),tone=overall[c]+(stripMeans[k][c]-overall[c])*BOARD_TONE_SPREAD;for(let i=0;i<ch[c].length;i++)ch[c][i]=ch[c][i]/Math.max(1,soft[i])*tone;}
    await pause();
  }
  // Every channel scaled so the atlas's mean is the photo's.
  const gain=[0,1,2].map(c=>{let m=0;for(const b of bodies)for(const v of b[c])m+=v;m/=n*W*B;return m>0?sourceMean[c]/m:1;});
  const rough=kind==='wood'?BOARD_ROUGHNESS.wood:BOARD_ROUGHNESS.composite,tilt=Math.tan(GRAIN_TILT_DEG*Math.PI/180);
  bodies.forEach((ch,k)=>{
    const luma=new Float32Array(W*B);
    for(let i=0;i<W*B;i++){for(let c=0;c<3;c++)ch[c][i]=Math.min(255,Math.max(0,ch[c][i]*gain[c]));luma[i]=(.2126*ch[0][i]+.7152*ch[1][i]+.0722*ch[2][i])/255;}
    // Relief: the grain's fine detail (lighter is higher), and its slope, scaled so the steepest 1% tilts GRAIN_TILT_DEG.
    const soft=boxBlur(luma,W,B,8,3),height2=new Float32Array(W*B);for(let i=0;i<W*B;i++)height2[i]=luma[i]-soft[i];
    const at=(x:number,y:number)=>height2[Math.min(B-1,Math.max(0,y))*W+((x%W)+W)%W];
    const dx=new Float32Array(W*B),dy=new Float32Array(W*B),slopes:number[]=[];
    for(let y=0;y<B;y++)for(let x=0;x<W;x++){
      const i=y*W+x;
      dx[i]=(at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1)-at(x-1,y-1)-2*at(x-1,y)-at(x-1,y+1))/8;
      dy[i]=(at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1)-at(x-1,y-1)-2*at(x,y-1)-at(x+1,y-1))/8;
      if((i&7)===0)slopes.push(Math.hypot(dx[i],dy[i]));
    }
    slopes.sort((a,b)=>a-b);const steep=slopes[Math.floor(slopes.length*.99)]||1,scale=tilt/steep;
    let hi=0;for(const v of height2)hi=Math.max(hi,Math.abs(v));
    for(let row=0;row<STRIP_ROWS;row++){
      const y=Math.min(B-1,Math.max(0,row-STRIP_GUTTER)),o=((k*STRIP_ROWS+row)*W)*4;
      for(let x=0;x<W;x++){
        const i=y*W+x,t=o+x*4,nx=-dx[i]*scale,ny=-dy[i]*scale,nz=1/Math.hypot(nx,ny,1);
        albedo[t]=ch[0][i];albedo[t+1]=ch[1][i];albedo[t+2]=ch[2][i];albedo[t+3]=255;
        normal[t]=Math.round((nx*nz*.5+.5)*255);normal[t+1]=Math.round((ny*nz*.5+.5)*255);normal[t+2]=Math.round((nz*.5+.5)*255);normal[t+3]=255;
        const r=Math.round(255*Math.min(1,Math.max(0,rough-BOARD_ROUGHNESS.relief*height2[i]/(hi||1))));roughness[t]=roughness[t+1]=roughness[t+2]=r;roughness[t+3]=255;
      }
    }
  });
  const atlasSum=[0,0,0];for(let i=0;i<albedo.length;i+=4){atlasSum[0]+=albedo[i];atlasSum[1]+=albedo[i+1];atlasSum[2]+=albedo[i+2];}
  const atlasMean=atlasSum.map(v=>v/(albedo.length/4)) as [number,number,number];
  return {width:W,height,strips:n,albedo,normal,roughness,layout,sourceMean,atlasMean};
}
