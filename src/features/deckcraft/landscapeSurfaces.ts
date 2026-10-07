import type {LandscapeAssetId,LandscapeObject,LandscapePoint} from './landscapeTypes';
/** Original visual proxies; colours and grain sizes are planning appearances, not supplier specifications. */
export const LANDSCAPE_SURFACES = [
 {id:'mulch-bed',name:'Brown mulch',type:'mulch',color:'#73503a',grainIn:.7,defaultDepthIn:3},
 {id:'black-mulch-bed',name:'Black mulch',type:'mulch',color:'#34302b',grainIn:.7,defaultDepthIn:3},
 {id:'cedar-mulch-bed',name:'Cedar mulch',type:'mulch',color:'#a97548',grainIn:.7,defaultDepthIn:3},
 {id:'river-rock-bed',name:'River rock',type:'aggregate',color:'#a49b85',grainIn:1.6,defaultDepthIn:3},
 {id:'mexican-beach-pebbles-bed',name:'Mexican beach pebbles',type:'aggregate',color:'#53575a',grainIn:1.4,defaultDepthIn:3},
 {id:'white-stone-bed',name:'White stone',type:'aggregate',color:'#e1ded3',grainIn:1,defaultDepthIn:3},
 {id:'crushed-granite-bed',name:'Crushed granite',type:'aggregate',color:'#aa9281',grainIn:.3,defaultDepthIn:3},
 {id:'artificial-grass',name:'Artificial grass',type:'turf',color:'#466738',grainIn:.06,defaultDepthIn:.5},
 {id:'putting-green',name:'Putting green',type:'turf',color:'#608348',grainIn:.04,defaultDepthIn:.25},
 {id:'pea-gravel-bed',name:'Pea gravel',type:'aggregate',color:'#b3a38b',grainIn:.375,defaultDepthIn:3},
 {id:'clear-limestone-bed',name:'Clear limestone',type:'aggregate',color:'#a7aaa4',grainIn:.75,defaultDepthIn:3},
 {id:'limestone-screenings-bed',name:'Limestone screenings',type:'aggregate',color:'#a6a397',grainIn:.12,defaultDepthIn:3},
 {id:'granular-base-bed',name:'Granular base',type:'aggregate',color:'#8c8475',grainIn:.7,defaultDepthIn:3},
] as const;
export const landscapeSurface=(id:LandscapeAssetId)=>LANDSCAPE_SURFACES.find(s=>s.id===id);
export const landscapeSurfaceDepth=(o:LandscapeObject)=>o.surfaceDepthIn??o.mulchDepthIn??0;
/** R&A Rules of Golf, Definitions / Hole. Installation depth and drainage remain recorded site inputs. */
export const PUTTING_CUP_DIAMETER_IN=4.25;
export function puttingCupWorld(o:LandscapeObject,p:LandscapePoint){const r=o.rotationDeg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return {x:o.xIn+c*p.x-s*p.z,z:o.zIn+s*p.x+c*p.z};}
export function cupFitsOutline(p:LandscapePoint,outline:LandscapePoint[]){
 let inside=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));if(Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<PUTTING_CUP_DIAMETER_IN/2)return false;}return inside;
}

export function cupOutsideHole(p:LandscapePoint,hole:LandscapePoint[]){let inside=false;for(let i=0,j=hole.length-1;i<hole.length;j=i++){const a=hole[i],b=hole[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));if(Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<PUTTING_CUP_DIAMETER_IN/2)return false;}return !inside;}
