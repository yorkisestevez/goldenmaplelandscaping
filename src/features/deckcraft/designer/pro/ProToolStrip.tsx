import './proWorkspace.css';
import {MousePointer2,Ruler,Spline} from 'lucide-react';
import type {PlanTool} from '../constants';

const TOOLS:[PlanTool,string,typeof Ruler][]=[['components','Select parts',MousePointer2],['outline','Shape & points',Spline],['size','Deck size',Ruler]];

/** The Pro workspace's left strip: the everyday selection and shape tools, then the drawing's own pan and zoom
 * controls, which the plan view renders into `onSlot`'s element while it is showing. */
export default function ProToolStrip({tool,onPlan,onTool,onSlot}:{tool:PlanTool;onPlan:boolean;onTool:(tool:PlanTool)=>void;onSlot:(el:HTMLDivElement|null)=>void}){
  return <div className="dd-pro-strip">
    <div role="group" aria-label="Quick tools">
      {TOOLS.map(([id,label,Icon])=><button key={id} type="button" aria-label={label} title={label} aria-pressed={onPlan&&tool===id} onClick={()=>onTool(id)}><Icon size={19}/></button>)}
    </div>
    <div ref={onSlot} className="dd-pro-strip-navigation"/>
  </div>;
}
