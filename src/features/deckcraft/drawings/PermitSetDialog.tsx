import {useEffect,useMemo,useRef,useState} from 'react';
import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {PRICE_BOOK} from '../priceBook';
import {downloadFile} from '../designer/fields';
import {buildPermitSet} from './permitSheets';
import {buildPermitDxf} from './renderDxf';
import PermitSheetSvg from './PermitSheetSvg';
import '../designer/easyEditTools.css';

export const PERMIT_PDF_NAME='golden-maple-deck-permit-drawings.pdf',PERMIT_DXF_NAME='golden-maple-deck-permit-plans.dxf';

/** The permit drawing set: a preview of each 11 × 17 sheet (elevations, three plans and a typical section), and the
 * vector PDF and layered DXF of the same sheets. */
export default function PermitSetDialog({data,model,reviewItems,materialName,railingName,date,onClose,onOutput}:{
  data:DeckData;model:DeckTakeoff;reviewItems:readonly string[];materialName:string;railingName:string;date:string;
  onClose:()=>void;onOutput?:(kind:'permit_pdf'|'permit_dxf')=>void;
}){
  const dialog=useRef<HTMLDialogElement>(null),opener=useRef(document.activeElement as HTMLElement|null);
  const set=useMemo(()=>buildPermitSet({data,model,reviewItems:[...reviewItems],materialName,railingName,date,priceBook:PRICE_BOOK.version}),[data,model,reviewItems,materialName,railingName,date]);
  const [current,setCurrent]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[zoom,setZoom]=useState(false);
  useEffect(()=>{dialog.current?.showModal();return ()=>{dialog.current?.close();opener.current?.focus();};},[]);
  async function pdf(){
    setBusy(true);setError('');
    try{const [{jsPDF},{buildPermitPdf}]=await Promise.all([import('jspdf'),import('./renderPdf')]);downloadFile(buildPermitPdf(jsPDF,set),'application/pdf',PERMIT_PDF_NAME);onOutput?.('permit_pdf');}
    catch{setError('The PDF could not be made on this device. Download the DXF, or contact us and we will send the drawings.');}
    finally{setBusy(false);}
  }
  function dxf(){downloadFile(buildPermitDxf(set),'application/dxf',PERMIT_DXF_NAME);onOutput?.('permit_dxf');}
  const sheet=set.sheets[current];
  return <dialog ref={dialog} className="dd-easy-dialog dd-permit-dialog" aria-labelledby="dd-permit-title" onCancel={e=>{e.preventDefault();onClose();}} style={{width:'min(1100px,96vw)',maxWidth:'96vw'}}>
    <header><div><small>PERMIT DRAWINGS · PLANNING SET</small><h2 id="dd-permit-title">Plans, elevations and section</h2></div><button type="button" aria-label="Close permit drawings" onClick={onClose}>×</button></header>
    <div className="dd-easy-dialog-body">
      <p>Five 11 × 17 sheets drawn to scale from this design: the front and side elevations; the footings and posts, the framing with its sizes, and the decking, guard and stairs in plan; and a typical section through the framing. Bring them to your permit application; the municipality’s review decides what may be built.</p>
      {set.reviewItems.length>0&&<p role="status">These sheets are stamped DRAFT while {set.reviewItems.length} review item{set.reviewItems.length===1?'':'s'} {set.reviewItems.length===1?'is':'are'} open. Resolve them in “Review issues” first.</p>}
      <div role="tablist" aria-label="Sheets" style={{display:'flex',gap:'.5rem',flexWrap:'wrap',margin:'.5rem 0'}}>
        {set.sheets.map((s,i)=><button key={s.id} type="button" role="tab" aria-selected={i===current} className={i===current?'dd-primary':'dd-secondary'} onClick={()=>setCurrent(i)}>{s.id} · {s.title}</button>)}
        <button type="button" className="dd-secondary" aria-pressed={zoom} onClick={()=>setZoom(z=>!z)}>{zoom?'Fit the sheet':'Zoom in'}</button>
      </div>
      <div role="tabpanel" aria-label={`${sheet.id} ${sheet.title}`} style={{border:'1px solid #d8d3c7',overflow:'auto',maxHeight:'70vh'}}><div style={{width:zoom?'250%':'100%'}}><PermitSheetSvg set={set} sheet={sheet} index={current}/></div></div>
      {error&&<p className="dd-error" role="alert">{error}</p>}
    </div>
    <footer style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
      <button type="button" className="dd-primary" onClick={pdf} disabled={busy}>{busy?'Making the PDF…':'Download permit PDF'}</button>
      <button type="button" className="dd-secondary" onClick={dxf}>Download DXF (plans, elevations, section)</button>
      <button type="button" onClick={onClose}>Back to design</button>
    </footer>
  </dialog>;
}
