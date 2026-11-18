import type {SiteSurfaceSnapshot} from '../../siteSurface';
export function snapshotHeight(site:SiteSurfaceSnapshot|undefined,x:number,z:number,kind:'existing'|'proposed'='proposed'){
 for(const t of (kind==='existing'?site?.existingTriangles:site?.proposedTriangles)??[]){const [a,b,c]=t.vertices,cross=(p:typeof a,q:typeof a)=>(q.xIn-p.xIn)*(z-p.zIn)-(q.zIn-p.zIn)*(x-p.xIn),ds=[cross(a,b),cross(b,c),cross(c,a)];if(ds.every(v=>v>=-1e-6)||ds.every(v=>v<=1e-6))return t.plane.x*x+t.plane.z*z+t.plane.constant;}
 return undefined;
}
