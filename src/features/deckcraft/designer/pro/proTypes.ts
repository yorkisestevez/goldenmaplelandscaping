import type {ReactNode} from 'react';
import type {DeckData} from '../../types';
import type {PlanTool,PreviewMode} from '../constants';
import type {SectionId} from '../sections';

/** The page's own functions and state, handed over as they are. The Pro chunks (loaded only in Designer Mode) turn
 * them into menu and ribbon actions, so the public route carries no Pro code beyond this one object. */
export interface ProPage{
  ready:boolean;issueCount:number;canUndo:boolean;canRedo:boolean;
  undo:()=>void;redo:()=>void;
  openSection:(id:SectionId,bringIntoView?:boolean)=>void;
  /** The open design area and its settings: the docked properties panel shows them in place of the section pop-over. */
  open:ReadonlySet<SectionId>;renderSection:(id:SectionId)=>ReactNode;
  /** The design, and the page's one-step change (one undo step), for the Tools → Wizards. */
  data:DeckData;apply:(patch:Partial<DeckData>)=>void;
  setPlanTool:(tool:PlanTool)=>void;setMode:(mode:PreviewMode)=>void;showCanvas:()=>void;showFullList:()=>void;
  saveJSON:()=>void;openProposal:()=>Promise<unknown>;downloadPdf:()=>Promise<unknown>;
  exportModel:(kind:'dxf'|'obj')=>Promise<unknown>;exportPermit:(kind:'dxf2d')=>Promise<unknown>;
  setPresetsOpen:(open:boolean)=>void;setPermitOpen:(open:boolean)=>void;setJobsOpen:(open:boolean)=>void;setSendOpen:(open:boolean)=>void;
  setQuoteReviewOpen:(open:boolean)=>void;setIssuesOpen:(open:boolean)=>void;setSketchOpen:(open:boolean)=>void;
  setAgentOpen:(open:boolean)=>void;setAskOpen:(open:boolean)=>void;
}

/** The design-wide commands the Pro ribbon needs (the drawing panel owns tools and sheets). */
export interface ProCommands{
  undo:()=>void;redo:()=>void;canUndo:boolean;canRedo:boolean;
  openSection:(id:SectionId)=>void;
  presets:()=>void;permit:()=>void;
}
export const proCommands=(p:ProPage):ProCommands=>({undo:p.undo,redo:p.redo,canUndo:p.canUndo,canRedo:p.canRedo,openSection:id=>p.openSection(id,true),presets:()=>p.setPresetsOpen(true),permit:()=>p.setPermitOpen(true)});

/** Everything the Pro menu bar runs. Each entry is an action the page already offers elsewhere. */
export interface ProMenuActions extends ProCommands{
  ready:boolean;issueCount:number;
  saveFile:()=>void;jobs:()=>void;
  proposal:()=>void;pdf:()=>void;exportDxf:()=>void;exportObj:()=>void;exportPlanDxf:()=>void;send:()=>void;
  tool:(tool:PlanTool)=>void;sheet:(mode:PreviewMode)=>void;
  quoteCosts:()=>void;fullList:()=>void;ask:()=>void;issues:()=>void;sketch:()=>void;agents:()=>void;
}
export const proMenuActions=(p:ProPage):ProMenuActions=>({...proCommands(p),ready:p.ready,issueCount:p.issueCount,
  saveFile:()=>p.saveJSON(),jobs:()=>p.setJobsOpen(true),
  proposal:()=>void p.openProposal(),pdf:()=>void p.downloadPdf(),exportDxf:()=>void p.exportModel('dxf'),exportObj:()=>void p.exportModel('obj'),exportPlanDxf:()=>void p.exportPermit('dxf2d'),send:()=>p.setSendOpen(true),
  tool:next=>{p.setPlanTool(next);p.setMode('plan');p.showCanvas();},sheet:next=>{p.setMode(next);p.showCanvas();},
  quoteCosts:()=>p.setQuoteReviewOpen(true),fullList:p.showFullList,ask:()=>{p.showCanvas();p.setAskOpen(true);},issues:()=>p.setIssuesOpen(true),
  sketch:()=>p.setSketchOpen(true),agents:()=>p.setAgentOpen(true)});

export type ProMenuItem={label:string;run:()=>void;keys?:string;disabled?:boolean;dialog?:boolean};
export type ProMenu={label:string;items:(ProMenuItem|'-')[]};
