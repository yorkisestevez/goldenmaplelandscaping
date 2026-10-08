import {Suspense,lazy,useEffect,useRef,useState,type KeyboardEvent} from 'react';
import type {WizardKind} from './ProWizards';
import {revealControl} from '../architectKeys';
import {setDesignerMode} from '../designerMode';
import {proMenuActions,type ProMenu,type ProMenuActions,type ProMenuItem,type ProPage} from './proTypes';
import './proWorkspace.css';

/** The Pro workspace's menus. Every entry runs an action the designer already offers in its header, sections or
 * drawing, so the menus add a way to reach things, not new behaviour. */
const ProWizards=lazy(()=>import('./ProWizards'));

export function proMenus(a:ProMenuActions,wizard:(kind:WizardKind)=>void=()=>{}):ProMenu[]{
  const off=!a.ready;
  return [
    {label:'File',items:[
      // New and Open go through the header's Files menu, as Ctrl+N and Ctrl+O do: New asks before replacing the design.
      {label:'New design…',keys:'Ctrl+N',run:()=>revealControl(document.querySelector('[data-architect-new]')),disabled:off},
      {label:'Open design file…',keys:'Ctrl+O',run:()=>document.querySelector<HTMLButtonElement>('[data-architect-open]')?.click(),disabled:off,dialog:true},
      {label:'Save design file',keys:'Ctrl+S',run:a.saveFile,disabled:off},
      '-',
      {label:'Saved jobs & versions…',run:a.jobs,dialog:true},
      '-',
      {label:'Print proposal…',run:a.proposal,disabled:off,dialog:true},
      {label:'Download proposal PDF',run:a.pdf,disabled:off},
      {label:'Permit set…',run:a.permit,disabled:off,dialog:true},
      '-',
      {label:'Export 3D model (DXF)',run:a.exportDxf,disabled:off},
      {label:'Export 3D model (OBJ)',run:a.exportObj,disabled:off},
      {label:'Export plan drawing (DXF)',run:a.exportPlanDxf,disabled:off},
      '-',
      {label:'Send my design…',run:a.send,disabled:off,dialog:true},
    ]},
    {label:'Edit',items:[
      {label:'Undo',keys:'Ctrl+Z',run:a.undo,disabled:!a.canUndo},
      {label:'Redo',keys:'Ctrl+Shift+Z',run:a.redo,disabled:!a.canRedo},
      '-',
      {label:'Select parts',run:()=>a.tool('components')},
      {label:'Edit shape & points',run:()=>a.tool('outline')},
      '-',
      {label:'Describe a change…',run:a.ask},
      {label:'Layout expert…',run:()=>a.askExpert('design')},
      {label:'Decking expert…',run:()=>a.askExpert('decking')},
      {label:'Outdoor living expert…',run:()=>a.askExpert('outdoor')},
      {label:'Construction expert…',run:()=>a.askExpert('construction')},
    ]},
    {label:'Add',items:[
      {label:'Deck shape & size',run:()=>a.openSection('deck')},
      {label:'Stairs & railings',run:()=>a.openSection('stairs')},
      {label:'House, doors & windows',run:()=>a.openSection('house')},
      {label:'Lighting',run:()=>a.openSection('lighting')},
      {label:'Privacy, skirting & extras',run:()=>a.openSection('extras')},
      {label:'Patios, walls & pools',run:()=>a.openSection('backyard')},
    ]},
    {label:'Settings',items:[
      {label:'Boards & finish',run:()=>a.openSection('boards')},
      {label:'Site & foundation',run:()=>a.openSection('site')},
      '-',
      {label:'Contractor presets…',run:a.presets,disabled:off,dialog:true},
      {label:'Quote costs…',run:a.quoteCosts,dialog:true},
    ]},
    {label:'View',items:[
      {label:'Plan',run:()=>a.sheet('plan')},
      {label:'3D',run:()=>a.sheet('3d')},
      {label:'Framing',run:()=>a.sheet('drawing')},
      '-',
      {label:'Full price list',run:a.fullList},
      '-',
      {label:'Leave the Pro workspace',run:()=>setDesignerMode(false)},
    ]},
    {label:'Tools',items:[
      {label:'Deck wizard…',run:()=>wizard('deck'),disabled:off,dialog:true},
      {label:'House wizard…',run:()=>wizard('house'),disabled:off,dialog:true},
      {label:'Patio wizard…',run:()=>wizard('patio'),disabled:off,dialog:true},
      {label:'Pool wizard…',run:()=>wizard('pool'),disabled:off,dialog:true},
      '-',
      // The site survey: a photo or PDF survey under the plan (scaled from a known length), measured points,
      // elevation import and grading, in the drawing panel's Elevations & build workspace.
      {label:'Site survey & photo import…',run:()=>window.dispatchEvent(new CustomEvent('deckcraft-pro-elevations',{detail:'site'}))},
      '-',
      {label:'Sketch a design…',run:a.sketch,disabled:off,dialog:true},
      {label:a.issueCount?`Review ${a.issueCount} issue${a.issueCount===1?'':'s'}…`:'Design review…',run:a.issues,dialog:true},
      {label:'Agents…',run:a.agents,dialog:true},
      '-',
      {label:'Proposal & files',run:()=>a.openSection('proposal')},
    ]},
    {label:'Help',items:[
      {label:'Keyboard shortcuts',keys:'F1',run:()=>document.querySelector<HTMLDialogElement>('#dd-shortcuts')?.showModal(),dialog:true},
    ]},
  ];
}

const enabledItems=(menu:HTMLElement|null)=>[...(menu?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)')??[])];

/** A desktop-style menu bar (WAI-ARIA menubar): arrows move between menus and items, Escape closes, Tab leaves. */
export default function ProMenuBar({page}:{page:ProPage}){
  const [wizard,setWizard]=useState<WizardKind|null>(null);
  const menus=proMenus(proMenuActions(page),setWizard),bar=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState<number|null>(null),[active,setActive]=useState(0);
  const focusItem=useRef<'first'|'last'|null>(null);
  useEffect(()=>{
    if(open===null)return;
    const close=(e:PointerEvent)=>{if(!bar.current?.contains(e.target as Node))setOpen(null);};
    document.addEventListener('pointerdown',close);return ()=>document.removeEventListener('pointerdown',close);
  },[open]);
  useEffect(()=>{
    if(open===null||!focusItem.current)return;
    const items=enabledItems(document.getElementById(`dd-pro-menu-${open}`));
    (focusItem.current==='last'?items.at(-1):items[0])?.focus();focusItem.current=null;
  },[open]);
  const trigger=(i:number)=>document.getElementById(`dd-pro-menubutton-${i}`);
  const show=(i:number,item:'first'|'last'|null=null)=>{focusItem.current=item;setActive(i);setOpen(i);if(!item)trigger(i)?.focus();};
  const close=(refocus=true)=>{const i=open;setOpen(null);if(refocus&&i!==null)trigger(i)?.focus();};
  const run=(item:ProMenuItem)=>{setOpen(null);if(!item.dialog&&open!==null)trigger(open)?.focus();item.run();};
  const step=(i:number,by:number)=>(i+by+menus.length)%menus.length;
  const onBarKey=(e:KeyboardEvent<HTMLButtonElement>,i:number)=>{
    const keys:Record<string,()=>void>={
      ArrowRight:()=>{const n=step(i,1);if(open!==null)show(n,'first');else{setActive(n);trigger(n)?.focus();}},
      ArrowLeft:()=>{const n=step(i,-1);if(open!==null)show(n,'first');else{setActive(n);trigger(n)?.focus();}},
      ArrowDown:()=>show(i,'first'),ArrowUp:()=>show(i,'last'),Enter:()=>show(i,'first'),' ':()=>show(i,'first'),
      Home:()=>{setActive(0);trigger(0)?.focus();},End:()=>{setActive(menus.length-1);trigger(menus.length-1)?.focus();},
      Escape:()=>close(),
    };
    const fn=keys[e.key];if(!fn)return;e.preventDefault();fn();
  };
  const onMenuKey=(e:KeyboardEvent<HTMLDivElement>,i:number)=>{
    const items=enabledItems(e.currentTarget),at=items.indexOf(document.activeElement as HTMLButtonElement);
    const keys:Record<string,()=>void>={
      ArrowDown:()=>items[(at+1)%items.length]?.focus(),ArrowUp:()=>items[(at-1+items.length)%items.length]?.focus(),
      Home:()=>items[0]?.focus(),End:()=>items.at(-1)?.focus(),
      ArrowRight:()=>show(step(i,1),'first'),ArrowLeft:()=>show(step(i,-1),'first'),
      Escape:()=>close(),Tab:()=>close(false),
    };
    const fn=keys[e.key];if(!fn)return;if(e.key!=='Tab')e.preventDefault();e.stopPropagation();fn();
  };
  return <><div ref={bar} className="dd-pro-menubar" role="menubar" aria-label="Pro workspace menu">
    {menus.map((menu,i)=><div key={menu.label} className="dd-pro-menu">
      <button id={`dd-pro-menubutton-${i}`} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open===i} aria-controls={open===i?`dd-pro-menu-${i}`:undefined} tabIndex={active===i?0:-1}
        onClick={()=>open===i?setOpen(null):show(i)} onPointerEnter={()=>{if(open!==null&&open!==i)show(i);}} onKeyDown={e=>onBarKey(e,i)}>{menu.label}</button>
      {open===i&&<div id={`dd-pro-menu-${i}`} className="dd-pro-menu-list" role="menu" aria-label={menu.label} onKeyDown={e=>onMenuKey(e,i)}>
        {menu.items.map((item,j)=>item==='-'?<div key={j} role="separator" className="dd-pro-menu-separator"/>:
          <button key={item.label} type="button" role="menuitem" tabIndex={-1} disabled={item.disabled} aria-haspopup={item.dialog?'dialog':undefined} aria-keyshortcuts={item.keys?.replace(/Ctrl/g,'Control')} onClick={()=>run(item)}>
            <span>{item.label}</span>{item.keys&&<kbd>{item.keys}</kbd>}
          </button>)}
      </div>}
    </div>)}
  </div>
  {wizard&&<Suspense fallback={null}><ProWizards kind={wizard} page={page} onClose={()=>{setWizard(null);requestAnimationFrame(()=>trigger(menus.findIndex(m=>m.label==='Tools'))?.focus());}}/></Suspense>}
  </>;
}
