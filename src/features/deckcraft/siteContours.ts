import type {SiteSurfaceTriangle} from './siteSurface';
export function siteContours(triangles:SiteSurfaceTriangle[],intervalIn=12){
 if(!triangles.length)return {lines:[] as {elevationIn:number;a:{x:number;y:number};b:{x:number;y:number}}[],arrows:[] as {x:number;y:number;dx:number;dy:number;slopePct:number}[],lowPoint:undefined,lowPoints:[] as typeof triangles[number]['vertices'][number][]};
 const vertices=triangles.flatMap(t=>t.vertices),lo=Math.min(...vertices.map(v=>v.elevationIn)),hi=Math.max(...vertices.map(v=>v.elevationIn)),step=Math.max(intervalIn,Math.ceil((hi-lo)/30/intervalIn)*intervalIn),lines:{elevationIn:number;a:{x:number;y:number};b:{x:number;y:number}}[]=[];
 for(const t of triangles)for(let level=Math.ceil(lo/step)*step;level<=hi+1e-7;level+=step){const hits:{x:number;y:number}[]=[];for(let i=0;i<3;i++){const a=t.vertices[i],b=t.vertices[(i+1)%3],delta=b.elevationIn-a.elevationIn;if(Math.abs(delta)<1e-8)continue;const s=(level-a.elevationIn)/delta;if(s>=-1e-8&&s<=1+1e-8){const p={x:a.xIn+s*(b.xIn-a.xIn),y:a.zIn+s*(b.zIn-a.zIn)};if(!hits.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<1e-6))hits.push(p);}}if(hits.length===2)lines.push({elevationIn:level,a:hits[0],b:hits[1]});}
 const stride=Math.max(1,Math.ceil(triangles.length/24)),arrows=triangles.filter((_,i)=>i%stride===0).filter(t=>Math.hypot(t.plane.x,t.plane.z)>1e-6).map(t=>{const len=Math.hypot(t.plane.x,t.plane.z);return {x:t.vertices.reduce((n,v)=>n+v.xIn/3,0),y:t.vertices.reduce((n,v)=>n+v.zIn/3,0),dx:-t.plane.x/len,dy:-t.plane.z/len,slopePct:len*100};});
 const neighbours=new Map<string,{point:typeof vertices[number];levels:number[]}>();
 for(const t of triangles)for(const v of t.vertices){const key=[Math.round(v.xIn*1e5),Math.round(v.zIn*1e5),Math.round(v.elevationIn*1e5)].join('/'),entry=neighbours.get(key)??{point:v,levels:[]};entry.levels.push(...t.vertices.map(p=>p.elevationIn));neighbours.set(key,entry);}
 const lowPoints=[...neighbours.values()].filter(v=>v.levels.every(h=>h>=v.point.elevationIn-1e-7)&&v.levels.some(h=>h>v.point.elevationIn+1e-7)).map(v=>v.point);
 return {lines,arrows,lowPoint:vertices.reduce((a,b)=>a.elevationIn<b.elevationIn?a:b),lowPoints};
}
