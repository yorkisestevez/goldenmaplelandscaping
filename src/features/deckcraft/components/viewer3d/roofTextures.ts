import type {RoofFinish} from '../../types';

/**
 * Greyscale roof textures (256 × 256 RGBA, repeating every 96 in of roof), multiplied by the roof colour and also
 * used as the bump map. Pure, with no three.js. 'Shingles' and 'Metal' keep the studio's original pixel code
 * verbatim (held to a golden by check-deck-house-finishes); the newer finishes tile on 16 and 32 px courses.
 */
export const ROOF_TEXTURE_SIZE=256;

/** Surface response per finish; the first two are the studio's original values. */
export const ROOF_LOOK:Record<RoofFinish,{metalness:number;roughness:number;bumpScale:number}>={
  Shingles:{metalness:0,roughness:.92,bumpScale:.12},
  Metal:{metalness:.6,roughness:.4,bumpScale:.06},
  'Architectural shingles':{metalness:0,roughness:.94,bumpScale:.16},
  'Cedar shakes':{metalness:0,roughness:.95,bumpScale:.2},
  Slate:{metalness:0,roughness:.72,bumpScale:.12},
  'Clay tile':{metalness:0,roughness:.78,bumpScale:.3},
  'Concrete tile':{metalness:0,roughness:.88,bumpScale:.22},
};

/** The studio's original shingle and standing-seam textures, verbatim. */
function originalPixels(metal:boolean){const size=256,pixels=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const row=Math.floor(y/24),seam=metal?x%42<2:y%24<2||(x+(row%2)*32)%64<2,n=Math.abs(Math.sin(x*127.1+y*311.7)*43758.5453)%1,t=seam?.69:.92+n*.08,i=(y*size+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=Math.round(255*t);pixels[i+3]=255;}return pixels;}

const hash=(i:number,j:number)=>Math.abs(Math.sin(i*127.1+j*311.7)*43758.5453)%1;
/** Pieces of random width along one course that wrap round the texture edge: each x's piece number and its left edge. */
function pieceRow(row:number,min:number,spread:number){
  const S=ROOF_TEXTURE_SIZE,start=Math.floor(hash(row,3)*S),piece=new Int16Array(S),left=new Int16Array(S);
  let at=0,k=0;
  while(at<S){const w=Math.min(S-at,Math.round(min+hash(row,k+11)*spread));for(let i=0;i<w;i++){const x=(start+at+i)%S;piece[x]=k;left[x]=i;}at+=w;k++;}
  return {piece,left};
}
function paint(tone:(x:number,y:number)=>number){
  const S=ROOF_TEXTURE_SIZE,pixels=new Uint8Array(S*S*4);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const i=(y*S+x)*4,v=Math.round(255*Math.max(0,Math.min(1,tone(x,y))));pixels[i]=pixels[i+1]=pixels[i+2]=v;pixels[i+3]=255;}
  return pixels;
}
/** Shingles or shakes: courses of random-width pieces, dark keyways between them, a shadow line under each butt. */
function courses(course:number,min:number,spread:number,{base,range,key,shadow,grain}:{base:number;range:number;key:number;shadow:number;grain:number}){
  const rows=Array.from({length:ROOF_TEXTURE_SIZE/course},(_,r)=>pieceRow(r,min,spread));
  return paint((x,y)=>{
    const r=Math.floor(y/course),inRow=y%course,{piece,left}=rows[r],p=piece[x];
    if(left[x]<key)return .45;
    let t=base+hash(r*31+p,5)*range+(hash(x,r*7+p)-.5)*grain+(hash(x,y)-.5)*.04;
    if(inRow>=course-shadow)t*=.7;
    return t;
  });
}

/** The texture for a roof finish. */
export function roofPixels(finish:RoofFinish):Uint8Array{
  if(finish==='Shingles'||finish==='Metal')return originalPixels(finish==='Metal');
  if(finish==='Architectural shingles')return courses(16,12,28,{base:.7,range:.26,key:1,shadow:4,grain:.02});
  if(finish==='Cedar shakes')return courses(32,10,20,{base:.66,range:.3,key:2,shadow:3,grain:.18});
  if(finish==='Slate')return paint((x,y)=>{
    // 12 × 12 in slates, every other course offset by half a slate, each its own tone, with a fine cleft texture.
    const r=Math.floor(y/32),col=Math.floor(((x+(r%2)*16)%256)/32),edge=y%32<2||(x+(r%2)*16)%32<1;
    return edge?.5:.78+hash(r*17+col,9)*.2+(hash(x,y)-.5)*.06;
  });
  const clay=finish==='Clay tile';
  return paint((x,y)=>{
    // Clay barrels (a rounded crown) or flatter concrete S-profile tiles, 12 in wide, with the lip of the course above.
    const r=Math.floor(y/32),u=(x%32)/32,profile=clay?Math.sin(Math.PI*u):.5+.5*Math.sin(2*Math.PI*u);
    let t=(clay?.6:.72)+(clay?.38:.22)*profile+(hash(r*13+Math.floor(x/32),4)-.5)*.1+(hash(x,y)-.5)*(clay?.03:.07);
    if(y%32>=32-(clay?5:3))t*=.68;
    return t;
  });
}
