import type {DeckData} from './types';
import type {SiteSurface} from './siteSurface';
import type {YardFeatureModel} from './yardModel';
import type {PlanPoint} from './lib/deckGeometry';
import {sitePlaneHeight} from './siteSurface';
import {transitionClip,transitionArea} from './gradingTransitionGeometry';
import {yardFeatureOutline} from './yardPathGeometry';
import {poolPermanentExclusion} from './poolGeometry';
export interface GradeDiscontinuity {a:PlanPoint;b:PlanPoint;maxJumpIn:number;wallId?:string;stepId?:string}
/** Match partial shared edges as well as full TIN edges. Exterior coverage
 * boundaries are not treated as an inferred adjacent ground elevation. */
export function gradeDiscontinuities(surface:Pick<SiteSurface,'proposedTriangles'>,walls:YardFeatureModel[]=[]):GradeDiscontinuity[]{
 const buckets=new Map<string,{a:PlanPoint;b:PlanPoint;start:number;end:number;dx:number;dy:number;side:number;plane:SiteSurface['proposedTriangles'][number]['plane']}[]>();
 for(const t of surface.proposedTriangles){const center={x:t.vertices.reduce((n,v)=>n+v.xIn/3,0),y:t.vertices.reduce((n,v)=>n+v.zIn/3,0)};for(let i=0;i<3;i++){const a={x:t.vertices[i].xIn,y:t.vertices[i].zIn},b={x:t.vertices[(i+1)%3].xIn,y:t.vertices[(i+1)%3].zIn},length=Math.hypot(b.x-a.x,b.y-a.y);if(length<1e-7)continue;let dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;if(dx<-1e-7||Math.abs(dx)<1e-7&&dy<0){dx=-dx;dy=-dy;}const key=[Math.round(dx*1e7),Math.round(dy*1e7),Math.round((dx*a.y-dy*a.x)*1e4)].join('/'),u=dx*a.x+dy*a.y,v=dx*b.x+dy*b.y,list=buckets.get(key)??[];list.push({a,b,start:Math.min(u,v),end:Math.max(u,v),dx,dy,side:Math.sign(dx*(center.y-a.y)-dy*(center.x-a.x)),plane:t.plane});buckets.set(key,list);}}
 const result:GradeDiscontinuity[]=[];
 const contains=(p:PlanPoint,poly:PlanPoint[])=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j],dx=b.x-a.x,dy=b.y-a.y,t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy);if(t>=0&&t<=1&&Math.abs(dx*(p.y-a.y)-dy*(p.x-a.x))<.00001*Math.hypot(dx,dy))return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
 const covers=(structures:YardFeatureModel[],p:PlanPoint,q:PlanPoint,planes:SiteSurface['proposedTriangles'][number]['plane'][])=>{const dx=q.x-p.x,dy=q.y-p.y,length=Math.hypot(dx,dy),spans:{a:number;b:number;low:number;high:number;id:string;step:boolean}[]=[],owners=new Set<string>();
  for(const wall of structures)for(const box of wall.boxes.filter(b=>wall.config.kind==='retaining-wall'?b.role==='wall-block':b.role==='stone-step')){const c=Math.cos(-(box.angle??0)),s=Math.sin(-(box.angle??0)),poly=box.polygon??[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:box.x+c*u*(box.w/2+.25)-s*v*(box.d/2+.25),y:box.z+s*u*(box.w/2+.25)+c*v*(box.d/2+.25)})),breaks=[0,1];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ux=b.x-a.x,uy=b.y-a.y,den=dx*uy-dy*ux;if(Math.abs(den)<1e-8)continue;const t=((a.x-p.x)*uy-(a.y-p.y)*ux)/den,v=((a.x-p.x)*dy-(a.y-p.y)*dx)/den;if(t>0&&t<1&&v>=0&&v<=1)breaks.push(t);}breaks.sort((a,b)=>a-b);for(let i=0;i+1<breaks.length;i++){const a=breaks[i],b=breaks[i+1],m=(a+b)/2;if(contains({x:p.x+m*dx,y:p.y+m*dy},poly))spans.push({a,b,low:box.y-box.h/2,high:box.y+box.h/2,id:wall.config.id,step:wall.config.kind!=='retaining-wall'});}}
  const stations=[...new Set([0,1,...spans.flatMap(s=>[s.a,s.b])])].sort((a,b)=>a-b);let uncovered=0;
  for(let i=0;i+1<stations.length;i++){const a=stations[i],b=stations[i+1],m=(a+b)/2,active=spans.filter(s=>s.a<=m&&s.b>=m).sort((a,b)=>a.low-b.low),heights=[a,b].flatMap(t=>planes.map(g=>sitePlaneHeight(g,p.x+t*dx,p.y+t*dy))),low=Math.min(...heights),high=Math.max(...heights);let cover=low;
   for(const s of active){if(s.low>cover+.25)break;if(s.high>cover){cover=s.high;owners.add(s.id);}if(cover>=high-.25)break;}if(cover<high-.25)uncovered+=(b-a)*length;
  }const stepId=spans.find(s=>s.step&&owners.has(s.id))?.id,wallId=spans.find(s=>!s.step&&owners.has(s.id))?.id;return {contained:uncovered<=.75,stepId,wallId};
 };
 for(const edges of buckets.values())for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){const a=edges[i],b=edges[j];if(a.side===b.side)continue;const start=Math.max(a.start,b.start),end=Math.min(a.end,b.end);if(end-start<1e-5)continue;const base=a.dx*a.a.x+a.dy*a.a.y,at=(u:number)=>({x:a.a.x+(u-base)*a.dx,y:a.a.y+(u-base)*a.dy}),p=at(start),q=at(end),maxJumpIn=Math.max(...[p,q].map(v=>Math.abs(sitePlaneHeight(a.plane,v.x,v.y)-sitePlaneHeight(b.plane,v.x,v.y))));if(maxJumpIn<.01)continue;
  const structural=walls.filter(w=>!w.excluded&&w.config.enabled&&(w.config.kind==='retaining-wall'||((w.config.stepAssembly||w.config.stoneSteps)&&(w.quantities.unsupportedBearingAreaSqft??0)<=.001))),covered=covers(structural,p,q,[a.plane,b.plane]);
  result.push({a:p,b:q,maxJumpIn,...(covered.contained?{...(covered.wallId?{wallId:covered.wallId}:{}),...(covered.stepId?{stepId:covered.stepId}:{})}:{})});
 }return result;
}
export function siteElevationWarnings(data:DeckData,surface:Pick<SiteSurface,'proposedTriangles'|'transitionModels'>,walls:YardFeatureModel[]=[]){
 const jumps=gradeDiscontinuities(surface,walls),unresolved=jumps.filter(j=>!j.wallId&&!j.stepId),warnings=unresolved.length?[`${unresolved.length} proposed grading boundary span(s) change elevation abruptly (maximum ${Math.max(...unresolved.map(j=>j.maxJumpIn)).toFixed(2)} in). Define a grading transition or a retaining wall; excavation quantities do not make this an executable grade.`]:[];
 for(const id of new Set(jumps.map(j=>j.stepId).filter(Boolean)))warnings.push(`${walls.find(w=>w.config.id===id)?.config.name}: solid stair stack meets the proposed grading. Bearing, drainage, reinforcement and retaining installation remain pending.`);
 for(const m of surface.transitionModels??[]){warnings.push(...m.warnings.map(w=>`${m.name}: ${w}`));if(m.status!=='ready')continue;
  // These explicit surfaces cannot silently pass through constructed objects.
  // Finished levels stay fixed; the designer resolves intersecting envelopes.
  for(const f of data.yardFeatures??[])if(f.enabled&&transitionArea(transitionClip(m.footprint,yardFeatureOutline(f),'intersection'))>.00001)warnings.push(`${m.name}: transition intersects ${f.name} (${f.kind}). Check the full construction formation, finished level and retaining interface; no object elevation is adjusted.`);
  for(const pool of data.pools??[])if(pool.enabled){if(transitionArea(transitionClip(m.footprint,poolPermanentExclusion(pool),'intersection'))>.00001)warnings.push(`${m.name}: transition intersects pool ${pool.name}. Resolve the fixed coping and pool construction envelope; no pool level is adjusted.`);}
 }
 return warnings;
}
