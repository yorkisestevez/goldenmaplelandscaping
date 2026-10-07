/** Keep the deck's horizontal extent in frame when the viewer changes from wide desktop to square phone layout.
 * The geometric mean balances horizontal clearance with useful board detail; desktop composition stays at 1. */
export function cameraSetback(aspect:number){return Math.max(1,Math.sqrt((16/9)/Math.max(.5,aspect)));}

/** Fit the complete house/deck/yard envelope to the actual perspective frustum.
 * The old radius multiplier left large yards tiny on wide screens. Corner
 * depth is included so a close wall or roof cannot be cut off by the tighter fit. */
export function overviewCamera({w,d,cx,cz,height,aspect,points,direction=[.9,.8,1.3]}:{w:number;d:number;cx:number;cz:number;height:number;aspect:number;points?:{x:number;y:number;z:number}[];direction?:[number,number,number]},fov=38){
 const length=Math.hypot(...direction),n=direction.map(v=>v/length),horizontal=Math.hypot(n[0],n[2]);
 const right=[n[2]/horizontal,0,-n[0]/horizontal],up=[-n[1]*n[0]/horizontal,horizontal,-n[1]*n[2]/horizontal];
 const target:[number,number,number]=[cx,height*.5,cz],tan=Math.tan(fov*Math.PI/360),ratio=Math.max(.05,aspect),margin=1.12;
 const corners:{x:number;y:number;z:number}[]=[];
 if(points?.length)corners.push(...points.map(p=>({x:p.x-cx,y:p.y-height*.5,z:p.z-cz})));
 else for(const x of [-w/2,w/2])for(const y of [-height/2-1,height/2])for(const z of [-d/2,d/2])corners.push({x,y,z});
 // Centre the visible envelopes in the image plane, rather than the empty air
 // above a low patio at the front of a tall house's global bounding box.
 const horizontalValues=corners.map(p=>p.x*right[0]+p.z*right[2]),verticalValues=corners.map(p=>p.x*up[0]+p.y*up[1]+p.z*up[2]);
 const shiftA=(Math.min(...horizontalValues)+Math.max(...horizontalValues))/2,shiftB=(Math.min(...verticalValues)+Math.max(...verticalValues))/2;
 for(let i=0;i<3;i++)target[i]+=right[i]*shiftA+up[i]*shiftB;
 let distance=Math.max(w,d)*.25;
 for(const p of corners){
  const x=p.x-right[0]*shiftA-up[0]*shiftB,y=p.y-up[1]*shiftB,z=p.z-right[2]*shiftA-up[2]*shiftB;
  const depth=x*n[0]+y*n[1]+z*n[2],a=x*right[0]+z*right[2],b=x*up[0]+y*up[1]+z*up[2];
  distance=Math.max(distance,depth+Math.abs(a)*margin/(tan*ratio),depth+Math.abs(b)*margin/tan);
 }
 return {target,position:target.map((v,i)=>v+n[i]*distance) as [number,number,number]};
}
