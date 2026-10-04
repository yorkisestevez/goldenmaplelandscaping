import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import type {PlanTool} from './constants';
import './planToolPicker.css';
const groups=[['Building',['size','outline','stairs','yard','house','edges']],['Landscape',['landscape','yard']],['Materials',['boards','inlays']],['Main',['components','size']]] as const;
const labels:Record<PlanTool,string>={size:'Deck size',outline:'Shape & points',stairs:'Stairs',yard:'Patios & walls',house:'House',edges:'Rails & screens',landscape:'Landscape',boards:'Board layout',inlays:'Inlays',components:'Select parts'};
const category=(tool:PlanTool)=>groups.findIndex(([,ids])=>(ids as readonly string[]).includes(tool));
export default function PlanToolPicker({tool,onPick,hint,onSketch,sketchReady=true}:{tool:PlanTool;onPick:(tool:PlanTool)=>void;hint:string;onSketch?:()=>void;sketchReady?:boolean}){
 const [group,setGroup]=useState(()=>category(tool)),row=useRef<HTMLDivElement>(null);
 useEffect(()=>{setGroup(current=>tool==='components'||(groups[current][1] as readonly string[]).includes(tool)?current:category(tool));},[tool]);
 const visible=[...new Set<PlanTool>([...groups[group][1],'components'])];
 const keys=(e:KeyboardEvent)=>{if(!(e.target instanceof HTMLElement)||e.target.getAttribute('role')!=='radio')return;const i=visible.indexOf(tool),n=visible.length,to=({ArrowLeft:(i+n-1)%n,ArrowUp:(i+n-1)%n,ArrowRight:(i+1)%n,ArrowDown:(i+1)%n,Home:0,End:n-1} as Record<string,number>)[e.key];if(to===undefined)return;e.preventDefault();const id=visible[to];onPick(id);requestAnimationFrame(()=>document.getElementById('dd-tool-'+id)?.focus());};
 return <section className="dd-simple-tools" aria-label="Drawing tools">
  <div className="dd-ribbon-tabs" role="tablist" aria-label="Tool categories" onKeyDown={e=>{const next=({ArrowRight:(group+1)%groups.length,ArrowLeft:(group+groups.length-1)%groups.length,Home:0,End:groups.length-1} as Record<string,number>)[e.key];if(next===undefined)return;e.preventDefault();setGroup(next);document.getElementById('dd-category-'+next)?.focus();}}>{groups.map(([name],i)=><button type="button" role="tab" id={'dd-category-'+i} key={name} aria-selected={group===i} aria-controls="dd-ribbon-panel" tabIndex={group===i?0:-1} onClick={()=>setGroup(i)}>{name}</button>)}</div>
  <div id="dd-ribbon-panel" role="tabpanel" aria-labelledby={'dd-category-'+group}><div ref={row} className="dd-simple-tools-grid" role="radiogroup" aria-label="Plan tools" onKeyDown={keys}>{visible.map((id,i)=><button key={id} id={'dd-tool-'+id} type="button" role="radio" aria-checked={tool===id} tabIndex={tool===id||(!visible.includes(tool)&&i===0)?0:-1} title={labels[id]} onClick={()=>onPick(id)}>{labels[id]}</button>)}{onSketch&&<button type="button" disabled={!sketchReady} aria-haspopup="dialog" aria-label="Sketch a design" onClick={onSketch}>Draw a new shape</button>}</div></div>
  <p className="dd-ribbon-hint" role="status"><strong>{labels[tool]}</strong> · {hint}</p>
 </section>;
}
