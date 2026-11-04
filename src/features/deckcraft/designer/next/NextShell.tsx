import {useEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {dollars} from '../../designFacts';
import type {DeckData} from '../../types';
import {FRAMING_MODES,type PreviewMode} from '../constants';
import {phoneLayout,type HomeTab,type HomeTabId} from '../homeTabs';
import type {Ledger} from '../priceLedgerModel';
import type {SectionId} from '../sections';
import {WorkspaceIcon} from '../WorkspaceNavigation';
import './nextShell.css';

/**
 * The new look's floating controls (uiMode.ts, docs/deckcraft/ui-redesign-2026-10/PLAN.md): a top bar, a rail of five
 * design groups and the price pill. They sit over a full-bleed scene and drive the page's own state; the panel they open
 * is the homeowner panel (HomePanel.tsx) with its sections and editors unchanged.
 */

type Sheet='plan'|'3d'|'framing';
// The drawing's sheets keep the classic tab ids (dd-tab-0…2, in PreviewPanel's order), which its sheet labels by.
const SHEET_IDS:Record<Sheet,number>={plan:0,'3d':1,framing:2};
const SHEET_ORDER:readonly (readonly [Sheet,string])[]=[['3d','3D'],['plan','Plan'],['framing','Framing']];
const sheetOf=(mode:PreviewMode):Sheet=>mode==='plan'?'plan':FRAMING_MODES.includes(mode)?'framing':'3d';
const SHEET_MODE:Record<Sheet,PreviewMode>={plan:'plan','3d':'3d',framing:'drawing'};

export function NextTopBar({data,mode,setMode,saveState,saving,internalMode,tools,onSend}:{data:DeckData;mode:PreviewMode;setMode:(mode:PreviewMode)=>void;saveState:string;saving:boolean;internalMode:boolean;tools:ReactNode;onSend:()=>void}){
  const sheet=sheetOf(mode);
  const pick=(to:Sheet)=>{if(to!==sheet)setMode(SHEET_MODE[to]);};
  const keys=(e:KeyboardEvent)=>{
    // The sheets on show: a phone keeps Framing in the file menu.
    const shown=SHEET_ORDER.filter(([s])=>document.getElementById(`dd-tab-${SHEET_IDS[s]}`)?.offsetParent),at=shown.findIndex(([s])=>s===sheet),n=shown.length;
    const to=({ArrowLeft:(at+n-1)%n,ArrowRight:(at+1)%n,Home:0,End:n-1} as Record<string,number>)[e.key];
    if(to===undefined||!n)return;e.preventDefault();const next=shown[to][0];pick(next);document.getElementById(`dd-tab-${SHEET_IDS[next]}`)?.focus();
  };
  return <header className="dd-next-top">
    {/* The page's heading, as on the classic page; the scene says the rest. */}
    <h1 className="dd-next-sr">Draw your deck on your house.</h1>
    <div className="dd-next-start">
      <Link to="/" className="dd-next-chip dd-next-brand" aria-label="Golden Maple home"><span className="dd-next-mark" aria-hidden="true">◆</span><span>DeckCraft</span></Link>
      <p className="dd-next-chip dd-next-project" title={saveState}><span>{Math.round(data.width*100)/100} × {Math.round(data.length*100)/100} ft</span><i data-saving={saving||undefined} aria-hidden="true"/><span className="dd-next-sr">{saveState}</span></p>
      {internalMode&&<span className="dd-next-chip dd-next-internal" role="status">Internal · no leads</span>}
    </div>
    <div className="dd-next-sheets" role="tablist" aria-label="Drawing sheets" onKeyDown={keys}>
      {SHEET_ORDER.map(([id,name])=><button key={id} id={`dd-tab-${SHEET_IDS[id]}`} data-sheet={id} type="button" role="tab" aria-selected={sheet===id} aria-controls="dd-sheet" tabIndex={sheet===id||sheet==='framing'&&id==='3d'&&phoneLayout()?0:-1} onClick={()=>pick(id)}>{name}</button>)}
    </div>
    <div className="dd-next-end">{tools}<button type="button" className="dd-next-send" aria-haspopup="dialog" onClick={onSend}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13 M22 2l-7 20-4-9-9-4z"/></svg><span>Send</span><span className="dd-next-sr"> my design</span></button></div>
  </header>;
}

// Each group's icon is its first section's.
const GROUP_ICON:Partial<Record<HomeTabId,SectionId>>={shape:'deck',boards:'boards',stairs:'stairs',yard:'backyard',extras:'lighting'};

/** The five groups, any of them at any time; picking the open one again puts its panel away. */
export function NextRail({groups,open,onPick}:{groups:readonly HomeTab[];open:HomeTabId|null;onPick:(id:HomeTabId)=>void}){
  return <nav className="dd-next-rail" aria-label="Design groups">
    {groups.map(g=><button key={g.id} id={`dd-home-tab-${g.id}`} type="button" aria-pressed={open===g.id} aria-controls={open===g.id?'dd-home-panel':undefined} onClick={()=>onPick(g.id)}>{GROUP_ICON[g.id]&&<WorkspaceIcon id={GROUP_ICON[g.id]!}/>}<span>{g.name}</span></button>)}
  </nav>;
}

/** The planning total, always on screen: it opens the quote; the badge opens the design review. On a phone, Send leaves
 *  the top bar for this row. */
export function NextPricePill({ledger,open,onOpen,issues,onIssues,onSend}:{ledger:Ledger;open:boolean;onOpen:()=>void;issues:number;onIssues:()=>void;onSend:()=>void}){
  const quotes=ledger.quotes.length;
  return <section className="dd-next-price" aria-label="Live price">
    {issues>0&&<button type="button" className="dd-next-issues" aria-haspopup="dialog" onClick={onIssues}><span aria-hidden="true">!</span>{issues}<span className="dd-next-sr"> {issues===1?'issue':'issues'} to review</span></button>}
    <button type="button" className="dd-next-total" aria-expanded={open} aria-controls={open?'dd-home-panel':undefined} onClick={onOpen}><small>Planning estimate</small><strong>{dollars(ledger.subtotal)}</strong>{quotes>0&&<small>+ {quotes} to quote</small>}</button>
    <button type="button" className="dd-next-send dd-next-row-send" aria-haspopup="dialog" onClick={onSend}><span>Send</span><span className="dd-next-sr"> my design</span></button>
  </section>;
}

/**
 * A phone's 3D view controls fold into this one button (the viewer draws the bar; the page marks it open). Leaving 3D
 * unmounts the button, which puts the sheet away.
 */
export function NextViewButton(){
  const [open,setOpen]=useState(false),self=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const page=self.current?.closest('.deck-designer');
    page?.toggleAttribute('data-view-sheet',open);
    return()=>page?.removeAttribute('data-view-sheet');
  },[open]);
  return <button ref={self} type="button" className="dd-next-view" aria-expanded={open} onClick={()=>setOpen(!open)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>View</button>;
}
