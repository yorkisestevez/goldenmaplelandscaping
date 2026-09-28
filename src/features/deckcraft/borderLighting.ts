import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {getHouseContact} from './houseContact';
import {finishedFasciaOffset} from './lib/finishedFootprint';

/** A design concept for a supported/recessed border, not an approved board cantilever.
 * in-lite EVO HYDE 550 requires a 5–6 cm overhang mounting space; 2.5 in accommodates
 * the upper end of that range. Structural support and fasteners require a builder detail.
 * https://in-lite.com/en-CA/evo-hyde-550-black */
export const BORDER_LIGHTING={productId:'evo_hyde_550',mountingSpaceIn:2.5,lengthIn:556/25.4,heightIn:22/25.4,depthIn:16/25.4,spacingIn:48,endClearanceIn:6,maxFixtures:30} as const;
export const hasPictureFrame=(data:DeckData)=>!!data.pictureFrameRows||data.pattern==='Picture Frame';
export const borderLightingSelected=(data:DeckData)=>!!data.autoLighting?.border&&hasPictureFrame(data);
export const borderLightingEnabled=(data:DeckData)=>borderLightingSelected(data)&&data.lightingZoneEnabled?.border!==false;
export const BORDER_SUPPORT_QUOTE='Custom picture-frame lighting support, connections and wiring (builder quote)';
export const BORDER_SUPPORT_NOTE='The 2.5 in picture-frame mounting-space preview is a custom supported/recessed edge concept, not an approved 2.5 in decking cantilever. Structural support, fasteners, weather protection, cable routing and manufacturer compatibility require a builder detail and quote; extra support is not represented as verified framing.';

type Span=[number,number];
const cut=(spans:Span[],lo:number,hi:number):Span[]=>spans.flatMap(([s,e]):Span[]=>hi<=s||lo>=e?[[s,e]]:[...(lo>s?[[s,lo] as Span]:[]),...(hi<e?[[hi,e] as Span]:[])]);
function inside(p:PlanPoint,poly:PlanPoint[]){let odd=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)odd=!odd;}return odd;}
/** Split at polygon crossings, then remove spans covered by another level. */
function coveredSpans(a:PlanPoint,u:PlanPoint,len:number,poly:PlanPoint[]):Span[]{
  const ts=[0,len];
  poly.forEach((p,i)=>{const q=poly[(i+1)%poly.length],d={x:q.x-p.x,y:q.y-p.y},den=u.x*d.y-u.y*d.x;if(Math.abs(den)<1e-9)return;const w={x:p.x-a.x,y:p.y-a.y},t=(w.x*d.y-w.y*d.x)/den,s=(w.x*u.y-w.y*u.x)/den;if(t>0&&t<len&&s>=0&&s<=1)ts.push(t);});
  ts.sort((x,y)=>x-y);const spans:Span[]=[];
  for(let i=0;i+1<ts.length;i++){const m=(ts[i]+ts[i+1])/2;if(inside({x:a.x+u.x*m,y:a.y+u.y*m},poly))spans.push([ts[i],ts[i+1]]);}
  return spans;
}
export interface BorderMount{productId:string;x:number;y:number;z:number;angle:number;zone:'border';level:number;edge:number;span:Span;along:number}
/** Actual exposed deck-edge mounts. House/flush edges, stair openings, level joins and
 * spans too short for the uncut 550 fixture plus end clearance are omitted. Landings
 * and winders belong to stair lighting, so they never acquire this deck-edge option. */
export function borderLightingPlan(data:DeckData,model:DeckTakeoff){
  const mounts:BorderMount[]=[],contact=getHouseContact(data,model.levels[0].footprint),allOutlines=model.levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z})));
  model.levels.forEach((level,li)=>{
    if(level.kind&&level.kind!=='deck')return;
    const outline=allOutlines[li];
    outline.forEach((a,ei)=>{
      if(li===0&&(contact.isContactEdge(ei)||contact.isFlushEdge?.(ei)))return;
      const b=outline[(ei+1)%outline.length],len=Math.hypot(b.x-a.x,b.y-a.y);if(len<BORDER_LIGHTING.lengthIn+2*BORDER_LIGHTING.endClearanceIn)return;
      const u={x:(b.x-a.x)/len,y:(b.y-a.y)/len},out={x:u.y,y:-u.x},along=(p:PlanPoint)=>(p.x-a.x)*u.x+(p.y-a.y)*u.y,across=(p:PlanPoint)=>Math.abs((p.x-a.x)*u.y-(p.y-a.y)*u.x);
      let spans:Span[]=[[0,len]];
      allOutlines.forEach((poly,oi)=>{
        if(oi===li)return;
        poly.forEach((p,i)=>{const q=poly[(i+1)%poly.length],el=Math.hypot(q.x-p.x,q.y-p.y);if(el>.5&&Math.abs((q.x-p.x)*u.y-(q.y-p.y)*u.x)<.01*el&&across(p)<.5){const t0=along(p),t1=along(q);spans=cut(spans,Math.min(t0,t1),Math.max(t0,t1));}});
        for(const [s,e] of coveredSpans(a,u,len,poly))spans=cut(spans,s,e);
      });
      for(const flight of model.flights)for(const endpoint of [flight.start,flight.end]){
        const p={x:endpoint.x,y:endpoint.z};if(Math.abs(endpoint.y-level.top)>.6||across(p)>3)continue;
        const t=along(p);spans=cut(spans,t-flight.width/2-1,t+flight.width/2+1);
      }
      for(const [s,e] of spans){
        const clear=BORDER_LIGHTING.lengthIn/2+BORDER_LIGHTING.endClearanceIn,from=s+clear,to=e-clear;if(to<from)continue;
        const fitting=Math.floor((to-from)/(BORDER_LIGHTING.lengthIn+2))+1,n=Math.min(BORDER_LIGHTING.maxFixtures,fitting,Math.max(1,Math.ceil((e-s)/BORDER_LIGHTING.spacingIn)));
        for(let slot=0;slot<n;slot++){
          const t=n===1?(from+to)/2:from+(to-from)*slot/(n-1),offset=finishedFasciaOffset(data)+BORDER_LIGHTING.mountingSpaceIn/2;
          mounts.push({productId:BORDER_LIGHTING.productId,x:a.x+u.x*t+out.x*offset,z:a.y+u.y*t+out.y*offset,y:level.top-1-BORDER_LIGHTING.heightIn/2,angle:Math.atan2(out.x,out.y),zone:'border',level:li,edge:ei,span:[s,e],along:t});
        }
      }
    });
  });
  const selected=borderLightingSelected(data),enabled=borderLightingEnabled(data),placed=mounts.slice(0,BORDER_LIGHTING.maxFixtures);
  const warnings=selected?[BORDER_SUPPORT_NOTE,...(!mounts.length?['No exposed deck-border span fits the full EVO HYDE 550 fixture; none is included.']:[]),...(mounts.length>BORDER_LIGHTING.maxFixtures?[`The border preview includes ${BORDER_LIGHTING.maxFixtures} of ${mounts.length} eligible mounts; ask the builder to quote the remaining edge lights.`]:[])]:[];
  return {selected,enabled,mounts:enabled?placed:[],availableMounts:placed,availableCount:mounts.length,warnings};
}
