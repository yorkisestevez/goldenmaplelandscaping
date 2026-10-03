import type {Box,DeckLevel,Member,RailRun,V3} from './deckTakeoff';
import type {EditableRailSection} from './railingLayout';
import type {FramelessSystem} from './framelessSystems';
import {offsetPolygons,polygonCut,signedArea} from './lib/polygonCuts';
import type {PlanPoint} from './lib/deckGeometry';

const at=(r:RailRun,t:number):V3=>({x:r.a.x+(r.b.x-r.a.x)*t,y:r.a.y+(r.b.y-r.a.y)*t,z:r.a.z+(r.b.z-r.a.z)*t});
const distance=(a:V3,b:V3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function liesOn(part:RailRun,whole:RailRun){
  const length=distance(whole.a,whole.b);
  return [part.a,part.b].every(p=>Math.abs(distance(whole.a,p)+distance(p,whole.b)-length)<.001);
}
export const FRAMELESS_PREVIEW_SETBACK_IN=3;
function mountingRun(section:RailRun,system:FramelessSystem,levels:DeckLevel[]):{run:RailRun;outline:PlanPoint[]}|undefined{
  for(const level of levels){
    if(level.kind==='winder'||Math.abs(level.top-section.a.y)>.001)continue;
    const outline=level.footprint.outline.map(p=>({x:p.x+level.offset.x,y:p.y+level.offset.z}));
    const inset=offsetPolygons([outline],FRAMELESS_PREVIEW_SETBACK_IN);
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length],edge={a:{x:a.x,y:level.top,z:a.y},b:{x:b.x,y:level.top,z:b.y}};
      if(!liesOn(section,edge))continue;
      const length=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/length,uz=(b.y-a.y)/length;
      const direction=signedArea(outline)>0?1:-1,nx=-uz*direction,nz=ux*direction;
      const project=(p:PlanPoint)=>(p.x-a.x)*ux+(p.y-a.y)*uz;
      const first=project({x:section.a.x,y:section.a.z}),last=project({x:section.b.x,y:section.b.z});
      for(const polygon of inset)for(let j=0;j<polygon.length;j++){
        const p=polygon[j],q=polygon[(j+1)%polygon.length];
        const normal=(v:PlanPoint)=>(v.x-a.x)*nx+(v.y-a.y)*nz;
        if(Math.abs(normal(p)-FRAMELESS_PREVIEW_SETBACK_IN)>.001||Math.abs(normal(q)-FRAMELESS_PREVIEW_SETBACK_IN)>.001)continue;
        // Only physical corners shorten a run. Interior panel bays keep their
        // original stationing, so editing one bay never redistributes all panels.
        const clearance=(system.mount==='shoe'?system.hardwareDepthIn:system.glassThicknessIn)/2;
        const edgeLo=Math.min(project(p),project(q)),edgeHi=Math.max(project(p),project(q));
        const lo=Math.max(Math.min(first,last),edgeLo+clearance),hi=Math.min(Math.max(first,last),edgeHi-clearance);
        if(hi-lo<4)continue;
        const point=(t:number):V3=>({x:a.x+ux*t+nx*FRAMELESS_PREVIEW_SETBACK_IN,y:level.top,z:a.y+uz*t+nz*FRAMELESS_PREVIEW_SETBACK_IN});
        return {run:{a:point(first<=last?lo:hi),b:point(first<=last?hi:lo)},outline};
      }
    }
  }
}
function boxOutline(b:Box):PlanPoint[]{
  const angle=b.angle??0,c=Math.cos(angle),s=Math.sin(angle);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:b.x+c*x*b.w/2+s*z*b.d/2,y:b.z-s*x*b.w/2+c*z*b.d/2}));
}
function supported(box:Box,outline:PlanPoint[]){
  const shape=boxOutline(box),area=Math.abs(signedArea(shape));
  return polygonCut([shape],[outline]).reduce((n,p)=>n+Math.abs(signedArea(p)),0)>=area-.001;
}
/** Deliberately schematic stock envelopes, NOT fabrication/anchor design.
 * Glass stays vertical. Stair and winder guards remain unresolved scope.
 * Joint values are source-linked or explicitly illustrative in the system record. */
export function buildFramelessGeometry(sections:EditableRailSection[],system:FramelessSystem,winderRuns:RailRun[]=[],levels:DeckLevel[]=[]){
  const glass:Member[]=[],mounts:Box[]=[],issues:string[]=[],unmodeledSectionIds:string[]=[];
  let spigotCount=0,shoeLengthIn=0,unmodeledLengthIn=0;
  for(const section of sections){
    if(!section.enabled)continue;
    const scopeLength=distance(section.a,section.b);
    const unsupported=Math.abs(section.a.y-section.b.y)>.001||winderRuns.some(r=>liesOn(section,r));
    const placement=unsupported?undefined:mountingRun(section,system,levels),run=placement?.run??section;
    const length=distance(run.a,run.b),inset=(system.panelGapIn??1)/2,panelLength=length-inset*2;
    if(!placement||panelLength<Math.max(4,system.hardwareWidthIn*4)){
      unmodeledSectionIds.push(section.id);unmodeledLengthIn+=scopeLength;continue;
    }
    const a=at(run,inset/length),b=at(run,1-inset/length),height=system.previewHeightIn-system.glassBottomIn;
    const panel:Member={a:{...a,y:a.y+system.glassBottomIn+height/2},b:{...b,y:b.y+system.glassBottomIn+height/2},width:system.glassThicknessIn,depth:height,role:'frameless-glass-preview',assemblyId:section.id};
    const angle=-Math.atan2(run.b.z-run.a.z,run.b.x-run.a.x),sectionMounts:Box[]=[];
    if(system.mount==='shoe'){
      const p=at(run,.5);
      sectionMounts.push({...p,y:p.y+system.hardwareHeightIn/2,w:length,h:system.hardwareHeightIn,d:system.hardwareDepthIn,angle});
    }else{
      for(const t of [.25,.75]){
        const p=at({a,b},t);
        sectionMounts.push({...p,y:p.y+.125,w:system.hardwareWidthIn,h:.25,d:system.hardwareDepthIn,angle});
        sectionMounts.push({...p,y:p.y+system.hardwareHeightIn/2,w:Math.min(2,system.hardwareWidthIn),h:system.hardwareHeightIn,d:Math.min(2,system.hardwareDepthIn),angle});
      }
    }
    if(!sectionMounts.every(m=>supported(m,placement.outline))){unmodeledSectionIds.push(section.id);unmodeledLengthIn+=scopeLength;continue;}
    glass.push(panel);mounts.push(...sectionMounts);
    if(system.mount==='shoe')shoeLengthIn+=length;else spigotCount+=2;
  }
  if(unmodeledSectionIds.length)issues.push(`${unmodeledSectionIds.length} frameless railing section(s) (${(unmodeledLengthIn/12).toFixed(1)} ft) are unresolved and NOT drawn: sloped stairs, winders, short runs or unsupported mounting footprints require a separately reviewed guard/handrail system. Missing geometry is not permission to leave an edge unguarded.`);
  if(glass.length)issues.push('Frameless glass and mounting envelopes use an illustrative 3 in inward centerline setback and schematic corner clearances, NOT an anchorage recommendation. Panel sizes, joints, glass specification, supporting structure and anchorage require the selected manufacturer’s current detail and project-specific review before ordering, permitting or installation.');
  return {glass,mounts,issues,unmodeledSectionIds,unmodeledLengthIn,spigotCount,shoeLengthIn};
}
