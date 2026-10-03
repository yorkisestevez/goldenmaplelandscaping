import type {RailRun,V3} from './deckTakeoff';

export interface EditableRailSection extends RailRun {id:string;label:string;enabled:boolean;lengthIn:number}
const length=(r:RailRun)=>Math.hypot(r.b.x-r.a.x,r.b.y-r.a.y,r.b.z-r.a.z);
const at=(r:RailRun,t:number):V3=>({x:r.a.x+(r.b.x-r.a.x)*t,y:r.a.y+(r.b.y-r.a.y)*t,z:r.a.z+(r.b.z-r.a.z)*t});
/** Coordinate identities fail safe when dimensions/topology change: an old
 * removal never silently transfers to a different bay by array index. */
export function railSectionId(r:RailRun):string{
  const point=(p:V3)=>[p.x,p.y,p.z].map(n=>Number(n.toFixed(4))).join(':');
  return `rail_${[point(r.a),point(r.b)].sort().join('|')}`;
}
export function editableRailingLayout(source:RailRun[],maxSpan:number,removedIds:string[]=[]){
  const removed=new Set(removedIds),sections:EditableRailSection[]=[],runs:(RailRun&{bayCount:number})[]=[];
  for(const r of source){
    const len=length(r);if(len<1)continue;
    const bays=Math.max(1,Math.ceil(len/maxSpan));let start=-1;
    for(let i=0;i<bays;i++){
      const part={a:at(r,i/bays),b:at(r,(i+1)/bays)},id=railSectionId(part),enabled=!removed.has(id);
      sections.push({...part,id,enabled,lengthIn:len/bays,label:`${r.a.y===r.b.y?'Deck / landing':'Stair'} section ${sections.length+1}`});
      if(enabled&&start<0)start=i;
      if(start>=0&&(!enabled||i===bays-1)){const end=enabled?i+1:i;runs.push({a:at(r,start/bays),b:at(r,end/bays),bayCount:end-start});start=-1;}
    }
  }
  return {sections,runs,staleIds:removedIds.filter(id=>!sections.some(s=>s.id===id))};
}
