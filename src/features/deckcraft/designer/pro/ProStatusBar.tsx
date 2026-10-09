import './proWorkspace.css';
import type {PlanTool} from '../constants';

type Keys=readonly (readonly [string,string])[];
/** The keys each tool answers to, as listed in the keyboard shortcuts sheet (F1). */
const TOOL_KEYS:Partial<Record<PlanTool,Keys>>={
  components:[['J','properties'],['A','select all'],['L','select similar'],['N','select none']],
  outline:[['Enter','exact length'],['Shift','keep the angle'],['Backspace','remove last point'],['Right-click','finish']],
  inlays:[['Escape','cancel placing']],
  yard:[['Enter','exact length'],['Ctrl+A','angle snapping'],['G','snap settings']],
  landscape:[['Enter','exact length'],['Backspace','remove last point']],
  fence:[['Enter','exact length'],['Backspace','remove last point']],
};
const VIEW_KEYS:Keys=[['Wheel','zoom'],['Z','fit']];
const SHEET_KEYS:Record<'3d'|'framing',Keys>={'3d':[['T','move'],['R','rotate'],['S','scale']],framing:[]};
const ALWAYS:Keys=[['Ctrl+Z','undo'],['F1','all shortcuts']];

/** The Pro workspace's status bar: what the current tool does, and the keys it answers to. */
export default function ProStatusBar({sheet,toolLabel,hint,tool}:{sheet:'plan'|'3d'|'framing';toolLabel:string;hint:string;tool:PlanTool}){
  const keys=[...(sheet==='plan'?[...(TOOL_KEYS[tool]??[]),...VIEW_KEYS]:SHEET_KEYS[sheet]),...ALWAYS];
  return <div className="dd-pro-statusbar" role="region" aria-label="Status bar">
    <p role="status"><strong>{sheet==='plan'?toolLabel:sheet==='3d'?'3D view':'Framing'}</strong>{sheet==='plan'?` · ${hint}`:sheet==='3d'?' · Drag to orbit, scroll to zoom, or pick a camera.':' · Inspect framing, connections and below-ground parts.'}</p>
    <ul aria-label="Keys for this tool">{keys.map(([key,what])=><li key={key+what}><kbd>{key}</kbd> {what}</li>)}</ul>
  </div>;
}
