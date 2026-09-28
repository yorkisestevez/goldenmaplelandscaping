import type {AgentRequest} from './deckAgentController';
import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import type {PlanFrame} from '../ConstructionPlan';
import {listPlanComponents} from './componentEditActions';
import {selectableBoards} from './boardLayoutActions';
import {listEdgeSections} from './edgeSectionActions';
type Point={x:number;y:number};
export interface AssistantTarget {id:string;label:string;polygon?:Point[];line?:Point[];anchor?:Point}
/** Highlight the existing physical targets of a validated preview, independently of cursor selection. */
export function assistantTargets(request:AgentRequest,data:DeckData,model:DeckTakeoff):AssistantTarget[]{
 const parts=listPlanComponents(data,model),out:AssistantTarget[]=[];
 const part=(id:string)=>{const found=parts.find(p=>p.id===id);if(found)out.push(found);};
 let stock:ReturnType<typeof selectableBoards>|undefined;
 const board=(level:number,index:number)=>{stock??=selectableBoards(data,model);const b=stock.find(b=>b.modelLevel===level&&b.index===index);if(b)out.push({id:`board:${level}:${index}`,label:`Level ${b.level} board ${index+1}`,polygon:b.polygon.map(p=>({x:p.x+b.offset.x,y:p.y+b.offset.y}))});};
 for(const c of request.commands){
  if(c.type==='component.edit')part(c.id);
  else if(c.type==='component.batch')c.ids.forEach(part);
  else if(c.type==='layout.board'||c.type==='layout.deleteBoard')board(c.modelLevel,c.index);
  else if(c.type==='layout.boards')c.targets.forEach(t=>board(t.modelLevel,t.index));
  else if(c.type.startsWith('boundary.'))part(`deck:${(c as {level:number}).level}`);
  else if(c.type==='layout.region')part(`deck:${c.region.level}`);
  else if(c.type==='layout.breaker')part(`deck:${c.breaker.level}`);
  else if(c.type==='layout.remove'){const item=[...(data.boardLayout?.regions??[]),...(data.boardLayout?.breakers??[]),...(data.boardLayout?.pieces??[])].find(i=>i.id===c.id);if(item)part(`deck:${item.level}`);}
  else if(c.type==='edge.edit'){
   const edit=c.edit;if('edgeId' in edit){const edge=listEdgeSections(data,model).find(e=>e.level===edit.level&&e.edgeId===edit.edgeId);if(edge){const start='startPct'in edit?edit.startPct/100:0,end='endPct'in edit?edit.endPct/100:1;out.push({id:`edge:${edge.id}`,label:edge.label,line:[start,end].map(t=>({x:edge.a.x+(edge.b.x-edge.a.x)*t,y:edge.a.y+(edge.b.y-edge.a.y)*t}))});}}
   else if('id'in edit&&edit.action.startsWith('screen'))part(`screen:${edit.id}`);
   else if('id'in edit){const saved=data.railSections?.find(s=>s.id===edit.id);if(saved)part(`deck:${saved.level}`);}
  }else if(c.type==='design.patch'){
   const keys=Object.keys(c.patch);if(keys.some(k=>k.startsWith('house')))part('house:main');
   if(keys.some(k=>k.startsWith('stair')||k==='landingDepthIn'))part('stairs:primary');
   if(keys.some(k=>['width2','length2','height2','level2Position','level2Offset','level2EdgeId','level2FullStep'].includes(k)))part('deck:2');
   if(keys.includes('level3'))part('deck:3');
   if(keys.some(k=>!k.startsWith('house')&&!k.startsWith('stair')&&!['landingDepthIn','width2','length2','height2','level2Position','level2Offset','level2EdgeId','level2FullStep','level3'].includes(k)))part('deck:1');
  }
 }
 return [...new Map(out.map(target=>[target.id,target])).values()];
}
export default function AssistantTargets({request,data,model,frame}:{request:AgentRequest;data:DeckData;model:DeckTakeoff;frame:PlanFrame}){
 const targets=assistantTargets(request,data,model);
 return <svg className="dd-assistant-targets" viewBox={frame.viewBox} aria-label="Reviewed edit targets" role="img"><title>{targets.length?`Reviewed targets: ${targets.map(t=>t.label).join(', ')}`:'This edit has no visible plan target'}</title>{targets.map(t=><g key={t.id} data-assistant-target={t.id}>{t.polygon&&<polygon points={t.polygon.map(p=>`${p.x},${p.y}`).join(' ')}/>} {t.line&&<polyline points={t.line.map(p=>`${p.x},${p.y}`).join(' ')}/>} {!t.polygon&&!t.line&&t.anchor&&<circle cx={t.anchor.x} cy={t.anchor.y} r={5}/>}</g>)}</svg>;
}
