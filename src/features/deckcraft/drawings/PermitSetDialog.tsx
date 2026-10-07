import {useEffect,useMemo,useRef,useState} from 'react';
import type {DeckData,PermitSite} from '../types';
import {houseOutline} from '../houseFootprint';
import type {DeckTakeoff} from '../deckTakeoff';
import {PRICE_BOOK} from '../priceBook';
import {downloadFile} from '../designer/fields';
import {buildPermitSet} from './permitSheets';
import {buildPermitDxf} from './renderDxf';
import PermitSheetSvg from './PermitSheetSvg';
import PermitSiteEditor from './PermitSiteEditor';
import '../designer/easyEditTools.css';

export const PERMIT_PDF_NAME='golden-maple-deck-permit-drawings.pdf',PERMIT_DXF_NAME='golden-maple-deck-permit-plans.dxf';

/** The permit drawing set: a preview of each 11 × 17 sheet, including the code reference index. */
export default function PermitSetDialog({data,model,reviewItems,materialName,railingName,date,onClose,onOutput,onSiteChange}:{
  data:DeckData;model:DeckTakeoff;reviewItems:readonly string[];materialName:string;railingName:string;date:string;
  onClose:()=>void;onOutput?:(kind:'permit_pdf'|'permit_dxf')=>void;
  /** Saves the lot entered for the site plan; without it the lot is not editable here. */
  onSiteChange?:(site:PermitSite|undefined)=>void;
}){
  const dialog=useRef<HTMLDialogElement>(null),opener=useRef(document.activeElement as HTMLElement|null);
  const set=useMemo(()=>buildPermitSet({data,model,reviewItems:[...reviewItems],materialName,railingName,date,priceBook:PRICE_BOOK.version}),[data,model,reviewItems,materialName,railingName,date]);
  const [current,setCurrent]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(''),[zoom,setZoom]=useState(false);
  useEffect(()=>{dialog.current?.showModal();return ()=>{dialog.current?.close();opener.current?.focus();};},[]);
  async function pdf(){
    setBusy(true);setError('');
    try{const [{jsPDF},{buildPermitPdf}]=await Promise.all([import('jspdf'),import('./renderPdf')]);downloadFile(buildPermitPdf(jsPDF,set),'application/pdf',PERMIT_PDF_NAME);onOutput?.('permit_pdf');}
    catch{setError('The PDF could not be made on this device. Download the DXF, or contact us and we will send the drawings.');}
    finally{setBusy(false);}
  }
  function dxf(){downloadFile(buildPermitDxf(set),'application/dxf',PERMIT_DXF_NAME);onOutput?.('permit_dxf');}
  const sheet=set.sheets[current];
  const siteItems=set.reviewItems.filter(i=>i.startsWith('Site plan:')),codeItems=set.reviewItems.filter(i=>i.startsWith('Code reference:'));
  const designItems=set.reviewItems.length-siteItems.length-codeItems.length;
  const house=useMemo(()=>{const pts=houseOutline(data).flat(),xs=pts.map(p=>p.x);return {widthIn:Math.max(...xs)-Math.min(...xs),depthIn:-Math.min(...pts.map(p=>p.y))};},[data]);
  return <dialog ref={dialog} className="dd-easy-dialog dd-permit-dialog" aria-labelledby="dd-permit-title" onCancel={e=>{e.preventDefault();onClose();}} style={{width:'min(1100px,96vw)',maxWidth:'96vw'}}>
    <header><div><small>PERMIT DRAWINGS · PLANNING SET</small><h2 id="dd-permit-title">Permit drawing set</h2></div><button type="button" aria-label="Close permit drawings" onClick={onClose}>×</button></header>
    <div className="dd-easy-dialog-body">
      <p>Nine 11 × 17 planning sheets: G-0 code references, a site plan, elevations, three plans, a section, details and schedules. Confirm the references marked on G-0 and the site conditions with the municipality before building.</p>
      {set.reviewItems.length>0&&<p role="status">These sheets are stamped DRAFT while {set.reviewItems.length} review item{set.reviewItems.length===1?'':'s'} {set.reviewItems.length===1?'is':'are'} open. {siteItems.length>0?`${siteItems.length} for the site plan, on sheet A-0. `:''}{codeItems.length>0?`${codeItems.length} code references need confirmation on G-0. `:''}{designItems>0?`Resolve ${designItems} design review issue${designItems===1?'':'s'}.`:''}</p>}
      {set.reviewItems.length>0&&<details><summary>Review all {set.reviewItems.length} open items</summary><ol>
        {set.reviewItems.map((item,i)=><li key={`${i}-${item}`} style={{margin:'.45rem 0'}}>
          <strong>{item.startsWith('Code reference:')?'Code':item.startsWith('Site plan:')?'Site':'Design'} · </strong>{item}
          <div>{item.startsWith('Code reference:')?'Check the exact clause, current edition and local applicability on G-0.':item.startsWith('Site plan:')?'Enter surveyed lot information and confirm setbacks with the municipality.':'Resolve this condition in the design, then review the affected sheets.'}</div>
        </li>)}
      </ol></details>}
      <div role="tablist" aria-label="Sheets" style={{display:'flex',gap:'.5rem',flexWrap:'wrap',margin:'.5rem 0'}}>
        {set.sheets.map((s,i)=><button key={s.id} type="button" role="tab" aria-selected={i===current} className={i===current?'dd-primary':'dd-secondary'} onClick={()=>setCurrent(i)}>{s.id} · {s.title}</button>)}
        <button type="button" className="dd-secondary" aria-pressed={zoom} onClick={()=>setZoom(z=>!z)}>{zoom?'Fit the sheet':'Zoom in'}</button>
      </div>
      {sheet.id==='A-0'&&onSiteChange&&<PermitSiteEditor site={data.permitSite} house={house} issues={siteItems} onChange={onSiteChange}/>}
      <div role="tabpanel" aria-label={`${sheet.id} ${sheet.title}`} style={{border:'1px solid #d8d3c7',overflow:'auto',maxHeight:'70vh'}}><div style={{width:zoom?'250%':'100%'}}><PermitSheetSvg set={set} sheet={sheet} index={current}/></div></div>
      {error&&<p className="dd-error" role="alert">{error}</p>}
    </div>
    <footer style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
      <button type="button" className="dd-primary" onClick={pdf} disabled={busy}>{busy?'Making the PDF…':'Download permit PDF'}</button>
      <button type="button" className="dd-secondary" onClick={dxf}>Download DXF (all sheets)</button>
      <button type="button" onClick={onClose}>Back to design</button>
    </footer>
  </dialog>;
}
