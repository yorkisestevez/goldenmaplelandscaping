import ClipperLib from 'clipper-lib';
import type {PlanPoint} from './deckGeometry';
/** Preserve the exact integer precision grid while removing irrelevant world
 * translation. Small distant polygons should not pay Clipper's Int128 cost. */
export function localPolygonClip(subject:PlanPoint[][],clip:PlanPoint[][],operation:'union'|'difference'|'intersection',scale:number):PlanPoint[][] {
 if(!subject.length||!clip.length&&operation==='intersection')return [];
 const paths=(ps:PlanPoint[][])=>ps.map(p=>p.map(v=>({X:Math.round(v.x*scale),Y:Math.round(v.y*scale)}))),a=paths(subject),b=paths(clip);
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(const paths of [a,b])for(const p of paths)for(const v of p){x0=Math.min(x0,v.X);x1=Math.max(x1,v.X);y0=Math.min(y0,v.Y);y1=Math.max(y1,v.Y);}
 const x=Math.round((x0+x1)/2),y=Math.round((y0+y1)/2);
 for(const paths of [a,b])for(const p of paths)for(const v of p){v.X-=x;v.Y-=y;}
 const engine=new ClipperLib.Clipper(),out:{X:number;Y:number}[][]=[];
 engine.AddPaths(a,ClipperLib.PolyType.ptSubject,true);if(b.length)engine.AddPaths(b,ClipperLib.PolyType.ptClip,true);
 engine.Execute(operation==='union'?ClipperLib.ClipType.ctUnion:operation==='difference'?ClipperLib.ClipType.ctDifference:ClipperLib.ClipType.ctIntersection,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
 return out.map(p=>p.map(v=>({x:(v.X+x)/scale,y:(v.Y+y)/scale})));
}
