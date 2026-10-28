import {type KeyboardEvent} from 'react';
import type {PlanTool} from './constants';
import type {HomeTab,HomeTabId} from './homeTabs';
// Styles: planToolPicker.css, imported by the page (DeckDesigner.tsx): the tabs are in the prerendered page, so they must be
// styled at first paint, not when this chunk lands.
// Select parts ('components') is a Designer Mode tool; locating a warning or the agent interface can still choose it here.
const labels:Record<PlanTool,string>={size:'Deck size',outline:'Shape & points',stairs:'Stairs',yard:'Patios & walls',house:'House',edges:'Rails & screens',landscape:'Landscape',boards:'Board layout',inlays:'Inlays',components:'Select parts'};
/**
 * The homeowner's four tabs (homeTabs.ts) above the drawing, on every sheet, and on the plan the open tab's tools. The page
 * owns the open tab: a tab also opens its panel and view, and a tool picked elsewhere (a located warning, the agent) brings
 * its own tab forward. The arrow keys move between tabs and Enter or Space opens one, since opening Materials or Extras
 * loads the 3D view.
 */
export default function PlanToolPicker({tool,onPick,hint,onSketch,sketchReady=true,tab,tabs,onTab,onPlan,onSettings}:{tool:PlanTool;onPick:(tool:PlanTool)=>void;hint:string;onSketch?:()=>void;sketchReady?:boolean;tab:HomeTabId;tabs:readonly HomeTab[];onTab:(tab:HomeTabId)=>void;onPlan:boolean;onSettings?:()=>void}){
 const visible=onPlan?tabs.find(t=>t.id===tab)?.tools??[]:[],current=tabs.findIndex(t=>t.id===tab);
 const keys=(e:KeyboardEvent)=>{if(!(e.target instanceof HTMLElement)||e.target.getAttribute('role')!=='radio')return;const i=visible.indexOf(tool),n=visible.length,to=({ArrowLeft:(i+n-1)%n,ArrowUp:(i+n-1)%n,ArrowRight:(i+1)%n,ArrowDown:(i+1)%n,Home:0,End:n-1} as Record<string,number>)[e.key];if(to===undefined)return;e.preventDefault();const id=visible[to];onPick(id);requestAnimationFrame(()=>document.getElementById('dd-tool-'+id)?.focus());};
 return <section className="dd-simple-tools" aria-label="Drawing tools">
  <div className="dd-ribbon-tabs dd-home-tabs" role="tablist" aria-label="Design" onKeyDown={e=>{const n=tabs.length,at=tabs.findIndex(t=>document.activeElement?.id==='dd-home-tab-'+t.id),from=at<0?current:at,next=({ArrowRight:(from+1)%n,ArrowLeft:(from+n-1)%n,Home:0,End:n-1} as Record<string,number>)[e.key];if(next===undefined)return;e.preventDefault();document.getElementById('dd-home-tab-'+tabs[next].id)?.focus();}}>{tabs.map(t=><button type="button" role="tab" id={'dd-home-tab-'+t.id} key={t.id} aria-selected={tab===t.id} aria-controls={visible.length&&tab===t.id?'dd-ribbon-panel':undefined} tabIndex={tab===t.id?0:-1} onClick={()=>onTab(t.id)}>{t.name}</button>)}</div>
  {visible.length>0&&<><div id="dd-ribbon-panel" role="tabpanel" aria-labelledby={'dd-home-tab-'+tab}><div className="dd-simple-tools-grid" role="radiogroup" aria-label="Plan tools" onKeyDown={keys}>{visible.map((id,i)=><button key={id} id={'dd-tool-'+id} type="button" role="radio" aria-checked={tool===id} tabIndex={tool===id||(!visible.includes(tool)&&i===0)?0:-1} title={labels[id]} onClick={()=>onPick(id)}>{labels[id]}</button>)}{onSketch&&<button type="button" disabled={!sketchReady} aria-haspopup="dialog" aria-label="Sketch a design" onClick={onSketch}>Draw a new shape</button>}{onSettings&&tab==='draw'&&<button type="button" onClick={onSettings}>Deck settings</button>}</div></div>
  <p className="dd-ribbon-hint" role="status"><strong>{labels[tool]}</strong> · {hint}</p></>}
 </section>;
}
