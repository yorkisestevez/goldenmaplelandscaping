import './proWorkspace.css';
import {useState,type KeyboardEvent,type ReactNode} from 'react';
import {BrickWall,Box,DoorOpen,Fence,FileText,Frame,Grid3x3,House,Layers,LayoutTemplate,Lightbulb,Map as MapIcon,Mountain,MousePointer2,Paintbrush,PenTool,Redo2,Ruler,Shapes,Shovel,Spline,Stamp,Trees,Undo2,Waves} from 'lucide-react';
import type {PlanTool,PreviewMode} from '../constants';
import type {ElevationArea} from '../ElevationWorkspace';
import type {SectionId} from '../sections';
import {WorkspaceIcon} from '../WorkspaceNavigation';
import type {ProCommands} from './proTypes';

type Sheet='plan'|'3d'|'framing';
type Button=
  |{kind:'tool';tool:PlanTool;label:string;icon:ReactNode}
  |{kind:'section';section:SectionId;label:string;icon?:ReactNode}
  |{kind:'sheet';sheet:Sheet;mode:PreviewMode;label:string;icon:ReactNode}
  |{kind:'command';id:string;label:string;icon:ReactNode;dialog?:boolean}
  |{kind:'elevation';area:ElevationArea;label:string;icon:ReactNode};
type Group={name:string;buttons:Button[]};
const size=22;
const tool=(t:PlanTool,label:string,icon:ReactNode):Button=>({kind:'tool',tool:t,label,icon});
const section=(s:SectionId,label:string,icon?:ReactNode):Button=>({kind:'section',section:s,label,icon});
/** The ribbon's tabs. Tools draw on the plan; sections open the matching design inspector; sheets switch the drawing. */
const TABS:{name:string;groups:Group[]}[]=[
  {name:'Main',groups:[
    {name:'History',buttons:[{kind:'command',id:'undo',label:'Undo',icon:<Undo2 size={size}/>},{kind:'command',id:'redo',label:'Redo',icon:<Redo2 size={size}/>}]},
    {name:'Select',buttons:[tool('components','Select parts',<MousePointer2 size={size}/>),tool('outline','Shape & points',<Spline size={size}/>)]},
    {name:'Design',buttons:[{kind:'command',id:'sketch',label:'Sketch',icon:<PenTool size={size}/>,dialog:true},{kind:'command',id:'presets',label:'Presets',icon:<LayoutTemplate size={size}/>,dialog:true}]},
  ]},
  {name:'Building',groups:[
    {name:'Deck',buttons:[tool('size','Deck size',<Ruler size={size}/>),tool('outline','Shape & points',<Spline size={size}/>),tool('stairs','Stairs',<WorkspaceIcon id="stairs"/>)]},
    {name:'Edges',buttons:[tool('edges','Rails & screens',<Fence size={size}/>)]},
    {name:'House',buttons:[tool('house','House',<House size={size}/>),section('house','Doors & windows',<DoorOpen size={size}/>)]},
    {name:'Options',buttons:[section('lighting','Outdoor lighting',<Lightbulb size={size}/>),section('extras','Privacy & extras',<Fence size={size}/>)]},
  ]},
  // Terrain opens the Elevations & build workspace at each of its areas: the site survey (photo or PDF underlay,
  // measured points, elevation import and grading), deck levels, patio and wall levels, and sections and earthworks.
  {name:'Terrain',groups:[
    {name:'Site',buttons:[{kind:'elevation',area:'site',label:'Ground & survey',icon:<Mountain size={size}/>},section('site','Site & foundation')]},
    {name:'Levels',buttons:[{kind:'elevation',area:'deck',label:'Deck levels',icon:<Layers size={size}/>},{kind:'elevation',area:'surfaces',label:'Patio & wall levels',icon:<BrickWall size={size}/>}]},
    {name:'Build',buttons:[{kind:'elevation',area:'build',label:'Sections & earthwork',icon:<Shovel size={size}/>}]},
  ]},
  {name:'Landscape',groups:[
    {name:'Hardscape',buttons:[tool('yard','Patios & walls',<BrickWall size={size}/>)]},
    {name:'Planting',buttons:[tool('landscape','Landscape',<Trees size={size}/>)]},
    {name:'Yard',buttons:[section('backyard','Pools & backyard',<Waves size={size}/>)]},
  ]},
  {name:'Materials',groups:[
    {name:'Decking',buttons:[tool('boards','Board layout',<Grid3x3 size={size}/>),tool('inlays','Inlays',<Shapes size={size}/>),section('boards','Boards & finish',<Paintbrush size={size}/>)]},
  ]},
  {name:'Plan Detail',groups:[
    {name:'Sheets',buttons:[{kind:'sheet',sheet:'plan',mode:'plan',label:'Plan',icon:<MapIcon size={size}/>},{kind:'sheet',sheet:'3d',mode:'3d',label:'3D',icon:<Box size={size}/>},{kind:'sheet',sheet:'framing',mode:'drawing',label:'Framing',icon:<Frame size={size}/>}]},
    {name:'Documents',buttons:[{kind:'command',id:'permit',label:'Permit set',icon:<Stamp size={size}/>,dialog:true},section('proposal','Proposal & files',<FileText size={size}/>)]},
  ]},
];
const tabOf=(t:PlanTool)=>Math.max(0,TABS.findIndex(tab=>tab.groups.some(g=>g.buttons.some(b=>b.kind==='tool'&&b.tool===t))));

export interface ProRibbonProps{
  tool:PlanTool;sheet:Sheet;onTool:(tool:PlanTool)=>void;onSheet:(mode:PreviewMode)=>void;
  commands:ProCommands;
  /** The Elevations & build area showing, if any, and opening (or closing) one. */
  elevation?:ElevationArea;onElevations:(area:ElevationArea)=>void;onSketch?:()=>void;sketchReady:boolean;
}

/** The Pro workspace's ribbon: tabs of large labelled buttons for every drawing tool and design area. */
export default function ProRibbon({tool:current,sheet,onTool,onSheet,commands,elevation,onElevations,onSketch,sketchReady}:ProRibbonProps){
  const [tab,setTab]=useState(()=>tabOf(current));
  const pickTab=(i:number)=>{setTab(i);document.getElementById(`dd-pro-tab-${i}`)?.focus();};
  const tabKeys=(e:KeyboardEvent)=>{const n=TABS.length,next=({ArrowRight:(tab+1)%n,ArrowLeft:(tab+n-1)%n,Home:0,End:n-1} as Record<string,number>)[e.key];if(next===undefined)return;e.preventDefault();pickTab(next);};
  const command=(id:string)=>({undo:commands.undo,redo:commands.redo,sketch:()=>onSketch?.(),presets:commands.presets,permit:commands.permit} as Record<string,()=>void>)[id];
  const render=(b:Button)=>{
    const common={type:'button' as const,className:'dd-pro-ribbon-button'};
    if(b.kind==='tool')return <button key={'t'+b.tool} {...common} aria-pressed={sheet==='plan'&&current===b.tool} onClick={()=>onTool(b.tool)}>{b.icon}<span>{b.label}</span></button>;
    // Sections open in the docked properties panel beside the drawing, not in a pop-over.
    if(b.kind==='section')return <button key={'s'+b.section} {...common} aria-controls="dd-pro-properties" onClick={()=>commands.openSection(b.section)}>{b.icon??<WorkspaceIcon id={b.section}/>}<span>{b.label}</span></button>;
    if(b.kind==='sheet')return <button key={'v'+b.sheet} {...common} aria-pressed={sheet===b.sheet} onClick={()=>onSheet(b.mode)}>{b.icon}<span>{b.label}</span></button>;
    if(b.kind==='elevation')return <button key={'e'+b.area} {...common} aria-pressed={elevation===b.area} aria-controls="dd-elevation-tools" onClick={()=>onElevations(b.area)}>{b.icon}<span>{b.label}</span></button>;
    const disabled=b.id==='undo'?!commands.canUndo:b.id==='redo'?!commands.canRedo:b.id==='sketch'?!onSketch||!sketchReady:false;
    return <button key={'c'+b.id} {...common} disabled={disabled} aria-haspopup={b.dialog?'dialog':undefined} onClick={command(b.id)}>{b.icon}<span>{b.label}</span></button>;
  };
  return <section className="dd-pro-ribbon" aria-label="Ribbon">
    <div className="dd-pro-ribbon-tabs" role="tablist" aria-label="Ribbon tabs" onKeyDown={tabKeys}>
      {TABS.map((t,i)=><button key={t.name} id={`dd-pro-tab-${i}`} type="button" role="tab" aria-selected={tab===i} aria-controls="dd-pro-ribbon-panel" tabIndex={tab===i?0:-1} onClick={()=>setTab(i)}>{t.name}</button>)}
    </div>
    <div id="dd-pro-ribbon-panel" className="dd-pro-ribbon-panel" role="tabpanel" aria-labelledby={`dd-pro-tab-${tab}`}>
      {TABS[tab].groups.map(g=><div key={g.name} className="dd-pro-ribbon-group" role="group" aria-label={g.name}><div className="dd-pro-ribbon-buttons">{g.buttons.map(render)}</div><span className="dd-pro-ribbon-caption" aria-hidden="true">{g.name}</span></div>)}
    </div>
  </section>;
}
