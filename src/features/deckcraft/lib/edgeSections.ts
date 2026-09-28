import type {DeckData,RailSection} from '../types';
import type {FootprintPlan,RailSegment} from './deckGeometry';

/** Coordinate identity is local inches, intentionally changing when an unnamed edge moves. */
export function edgeSectionId(fp:FootprintPlan,index:number):string{
  if(!Number.isInteger(index)||index<0||index>=fp.outline.length)throw new Error('Choose an actual deck edge.');
  if(fp.edgeIds?.[index]){const id=fp.edgeIds[index];if(!EDGE_SECTION_ID.test(id))throw new Error('Invalid deck edge identity.');return id;}
  const a=fp.outline[index],b=fp.outline[(index+1)%fp.outline.length],n=(v:number)=>{if(!Number.isFinite(v))throw new Error('Deck edge coordinates must be finite.');return String(Math.round(v*1e4)/1e4);};
  return `edge:${n(a.x)},${n(a.y)}:${n(b.x)},${n(b.y)}`;
}
export const EDGE_SECTION_ID=/^[a-zA-Z0-9_:.,+-]{1,160}$/;
/** Strict public schema, without evaluating supplied getters or accepting hidden/prototype fields. */
export function validateRailSections(input:unknown):RailSection[]{
  const fail=()=>{throw new Error('Rail sections need unique IDs, actual edge IDs, levels 1–3, non-overlapping ranges between 0 and 100%, and an on/off choice.');};
  if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype||input.length>64)fail();
  const array=input as unknown[];
  if(Reflect.ownKeys(array).length!==array.length+1)fail();
  const out:RailSection[]=[],ids=new Set<string>();
  for(let i=0;i<array.length;i++){
    const entry=Object.getOwnPropertyDescriptor(array,String(i));if(!entry||!('value'in entry)||!entry.enumerable)fail();
    const v=entry!.value;if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();
    const keys=['id','level','edgeId','startPct','endPct','enabled'],record:Record<string,unknown>={};
    if(Reflect.ownKeys(v).length!==keys.length)fail();
    for(const key of keys){const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!('value'in d)||!d.enumerable)fail();record[key]=d!.value;}
    const {id,level,edgeId,startPct,endPct,enabled}=record;
    if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||ids.has(id)||![1,2,3].includes(level as number)||typeof edgeId!=='string'||!EDGE_SECTION_ID.test(edgeId)||typeof startPct!=='number'||typeof endPct!=='number'||!Number.isFinite(startPct)||!Number.isFinite(endPct)||startPct<0||endPct>100||startPct>=endPct||typeof enabled!=='boolean')fail();
    const s=record as unknown as RailSection;
    if(out.some(o=>o.level===s.level&&o.edgeId===s.edgeId&&Math.max(o.startPct,s.startPct)<Math.min(o.endPct,s.endPct)))fail();
    ids.add(s.id);out.push({...s});
  }return out;
}
/** Only clips eligible post-opening perimeter guards. It never creates a guard across a house/stair/connection. */
export function applyRailSections(data:DeckData,fp:FootprintPlan,level:1|2|3,segments:RailSegment[]):RailSegment[]{
  if(!data.railSections?.length&&data.railDefault!==false)return segments;
  if(data.railingType==='None')return [];
  const local=(data.railSections??[]).filter(s=>s.level===level);
  return segments.flatMap(s=>{
    const index=fp.outline.findIndex((a,i)=>{const b=fp.outline[(i+1)%fp.outline.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);return len>.01&&Math.abs((s.a.x-a.x)*dy-(s.a.y-a.y)*dx)/len<.01&&Math.abs((s.b.x-a.x)*dy-(s.b.y-a.y)*dx)/len<.01&&Math.min((s.a.x-a.x)*dx+(s.a.y-a.y)*dy,(s.b.x-a.x)*dx+(s.b.y-a.y)*dy)>-.01*len&&Math.max((s.a.x-a.x)*dx+(s.a.y-a.y)*dy,(s.b.x-a.x)*dx+(s.b.y-a.y)*dy)<len*len+.01*len;});
    if(index<0)return data.railDefault===false?[]:[s];
    const a=fp.outline[index],b=fp.outline[(index+1)%fp.outline.length],len=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/len,uy=(b.y-a.y)/len,t=(p:{x:number;y:number})=>(p.x-a.x)*ux+(p.y-a.y)*uy;
    const ta=t(s.a),tb=t(s.b),lo=Math.min(ta,tb),hi=Math.max(ta,tb),choices=local.filter(o=>o.edgeId===edgeSectionId(fp,index));
    if(data.railDefault!==false&&!choices.some(o=>!o.enabled))return [s];
    let ranges:[number,number][]=data.railDefault===false?choices.filter(o=>o.enabled).map(o=>[Math.max(lo,len*o.startPct/100),Math.min(hi,len*o.endPct/100)]):[[lo,hi]];
    if(data.railDefault!==false)for(const o of choices.filter(o=>!o.enabled)){const l=len*o.startPct/100,h=len*o.endPct/100;ranges=ranges.flatMap(([x,y])=>h<=x||l>=y?[[x,y]]:[...(x<l?[[x,l] as [number,number]]:[]),...(y>h?[[h,y] as [number,number]]:[])]);}
    const merged:[number,number][]=[];for(const r of ranges.filter(([x,y])=>y>x).sort((a,b)=>a[0]-b[0])){const last=merged[merged.length-1];if(last&&r[0]<=last[1]+1e-8)last[1]=Math.max(last[1],r[1]);else merged.push(r);}
    const at=(x:number)=>({x:a.x+ux*x,y:a.y+uy*x});
    return merged.filter(([x,y])=>y-x>.01).map(([x,y])=>({...s,a:at(ta<=tb?x:y),b:at(ta<=tb?y:x)}));
  });
}
