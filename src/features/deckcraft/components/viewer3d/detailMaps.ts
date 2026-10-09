/**
 * Shared 2K surface detail for showcase and the high tier. Albedo is zero-mean around 128
 * so a doubled product colour keeps its colour. Normals face out. Height sits in the normal
 * alpha for a cheap parallax offset. No three.js, so the check can build a small map.
 */
export type DetailKind='paver'|'slab'|'cap'|'stone'|'deck'|'siding';
export interface SurfaceDetail{size:number;albedo:Uint8Array;normal:Uint8Array;roughness:Uint8Array}

const hash=(x:number,y:number)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};
const fade=(t:number)=>t*t*(3-2*t);
function noise(x:number,y:number){
  const ix=Math.floor(x),iy=Math.floor(y),fx=fade(x-ix),fy=fade(y-iy);
  const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
  return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
}
function fbm(x:number,y:number){return noise(x,y)*.55+noise(x*2.03+5,y*2.03)*.3+noise(x*4.07,y*4.07+9)*.15;}
function wrap(u:number){return u-Math.floor(u);}

/** Height 0–1, periodic in both axes, so the repeat has no seam. */
function heightOf(kind:DetailKind,u:number,v:number){
  const n=fbm(u*18,v*18);
  if(kind==='paver'||kind==='slab'){
    const cells=kind==='paver'?5:2.5,fx=wrap(u*cells),fy=wrap(v*cells);
    const joint=fx<.055||fx>.945||fy<.055||fy>.945;
    return joint?.18:.58+(n-.5)*(kind==='paver'?.16:.1);
  }
  if(kind==='cap')return .62+(fbm(u*10,v*8)-.5)*.08;
  if(kind==='siding'){const fy=wrap(v*7);return fy<.07?.22:.6+(noise(u*28,v*3)-.5)*.12;}
  if(kind==='deck')return .55+(noise(u*46,v*3.2)*.65+noise(u*90,v*7)*.35-.5)*.2;
  return .5+(fbm(u*9+2,v*11)*.7+fbm(u*23,v*19+3)*.3-.5)*.45;
}

function sample(grid:Float32Array,size:number,x:number,y:number){
  const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
  const xa=((x0%size)+size)%size,ya=((y0%size)+size)%size,xb=(xa+1)%size,yb=(ya+1)%size;
  const a=grid[ya*size+xa],b=grid[ya*size+xb],c=grid[yb*size+xa],d=grid[yb*size+xb];
  return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
}

export function buildSurfaceDetail(kind:DetailKind,size:number):SurfaceDetail{
  const coarse=Math.max(4,size>>2),low=new Float32Array(coarse*coarse);
  for(let y=0;y<coarse;y++)for(let x=0;x<coarse;x++)low[y*coarse+x]=heightOf(kind,(x+.5)/coarse,(y+.5)/coarse);
  const height=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const base=sample(low,coarse,(x+.5)*coarse/size-.5,(y+.5)*coarse/size-.5);
    const hf=(noise(x/3.1,y/3.1)-.5)*.04;
    height[y*size+x]=Math.min(1,Math.max(0,base+hf));
  }
  const albedo=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4);
  const strength=kind==='stone'?2.4:kind==='cap'?0.8:1.6;
  let sum=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,h=height[i];
    const dx=(height[y*size+(x+1)%size]-height[y*size+(x-1+size)%size])*strength;
    const dy=(height[((y+1)%size)*size+x]-height[((y-1+size)%size)*size+x])*strength;
    const nz=1/Math.hypot(dx,dy,1),o=i*4;
    const rough=Math.min(255,Math.max(0,Math.round((kind==='cap'?.55:kind==='deck'?.62:.78+(Math.hypot(dx,dy)-.15)*.35)*255)));
    albedo[o]=albedo[o+1]=albedo[o+2]=Math.min(255,Math.max(0,Math.round(128+(h-.55)*42)));albedo[o+3]=255;sum+=albedo[o];
    normal[o]=Math.round((-dx*nz*.5+.5)*255);normal[o+1]=Math.round((-dy*nz*.5+.5)*255);normal[o+2]=Math.round((nz*.5+.5)*255);normal[o+3]=Math.round(h*255);
    roughness[o]=roughness[o+1]=roughness[o+2]=rough;roughness[o+3]=255;
  }
  const count=size*size;let drift=sum-128*count;
  while(drift!==0){
    const step=drift>0?-1:1;let moved=0;
    for(let i=0;drift!==0&&i<albedo.length;i+=4){const next=albedo[i]+step;if(next<0||next>255)continue;albedo[i]=albedo[i+1]=albedo[i+2]=next;drift+=step;moved++;}
    if(!moved)break;
  }
  return {size,albedo,normal,roughness};
}
