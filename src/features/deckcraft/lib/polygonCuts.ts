import ClipperLib from 'clipper-lib';
import type {PlanPoint,BoardRun} from './deckGeometry';

const SCALE=10000000;
const path=(p:PlanPoint[])=>p.map(v=>({X:Math.round(v.x*SCALE),Y:Math.round(v.y*SCALE)}));
const points=(p:{X:number;Y:number}[])=>p.map(v=>({x:v.X/SCALE,y:v.Y/SCALE}));
export const signedArea=(p:PlanPoint[])=>p.reduce((n,v,i)=>{const q=p[(i+1)%p.length];return n+v.x*q.y-q.x*v.y;},0)/2;
export function offsetPolygons(polys:PlanPoint[][],inset:number):PlanPoint[][]{
  if(!inset)return polys.map(p=>p.map(v=>({...v})));
  const offset=new ClipperLib.ClipperOffset(10,.01*SCALE),out=[];
  offset.AddPaths(polys.map(path),ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);
  offset.Execute(out,-inset*SCALE);
  return out.map(points).filter(p=>signedArea(p)>.001);
}
export function polygonCut(subject:PlanPoint[][],clip:PlanPoint[][],difference=false):PlanPoint[][]{
  if(!subject.length)return [];if(!clip.length)return difference?subject:[];
  const c=new ClipperLib.Clipper(),out=[];
  c.AddPaths(subject.map(path),ClipperLib.PolyType.ptSubject,true);
  c.AddPaths(clip.map(path),ClipperLib.PolyType.ptClip,true);
  c.Execute(difference?ClipperLib.ClipType.ctDifference:ClipperLib.ClipType.ctIntersection,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
  return out.map(points).filter(p=>signedArea(p)>.001);
}
export function polygonUnion(polys:PlanPoint[][]):PlanPoint[][]{
  if(!polys.length)return [];
  const c=new ClipperLib.Clipper(),out=[];
  c.AddPaths(polys.map(path),ClipperLib.PolyType.ptSubject,true);
  c.Execute(ClipperLib.ClipType.ctUnion,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
  return out.map(points).filter(p=>signedArea(p)>.001);
}
export function polygonBoard(polygon:PlanPoint[],angleDeg:number,role:BoardRun['role']='field'):BoardRun{
  const a=angleDeg*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),u=polygon.map(p=>p.x*ux+p.y*uy),v=polygon.map(p=>-p.x*uy+p.y*ux),lo=Math.min(...u),hi=Math.max(...u),vl=Math.min(...v),vh=Math.max(...v),uc=(lo+hi)/2,vc=(vl+vh)/2;
  return {cx:uc*ux-vc*uy,cy:uc*uy+vc*ux,length:hi-lo,width:vh-vl,angleDeg,polygon,role};
}
export function boardOutline(b:BoardRun,width:number):PlanPoint[]{
  if(b.polygon)return b.polygon;
  const a=b.angleDeg*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),w=b.width??width;
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:b.cx+ux*x*b.length/2-uy*y*w/2,y:b.cy+uy*x*b.length/2+ux*y*w/2}));
}
/** Split the actual polygon at stock joints, including mitres and clipped end pieces. */
export function splitBoard(b:BoardRun,width:number,stock:number,gap:number):BoardRun[]{
  if(b.length<=stock+.0001)return [b];
  const count=Math.ceil(b.length/stock),length=(b.length-gap*(count-1))/count,a=b.angleDeg*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),out:BoardRun[]=[];
  for(let i=0;i<count;i++){
    const along=-b.length/2+length/2+i*(length+gap),strip={...b,cx:b.cx+ux*along,cy:b.cy+uy*along,length,width:(b.width??width)+.01,polygon:undefined};
    for(const poly of polygonCut([boardOutline(b,width)],[boardOutline(strip,width)]))out.push(polygonBoard(poly,b.angleDeg,b.role));
  }
  return out;
}
