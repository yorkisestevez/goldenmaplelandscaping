import {useEffect} from 'react';
import {createPortal} from 'react-dom';
import {swatchUrl} from './lib/swatches';
import {ProposalSheet,type ProposalProps} from './ProposalSheet';
import './proposal.css';

/**
 * The proposal on screen, with its print controls: the sheets on a dark ground, and when printed only the sheets
 * (Letter, one sheet a page; proposal.css). Loaded on demand with its styles, so neither is part of the page's first
 * load. The swatch photos are the same bundled files the 3D view and the colour pickers use.
 */
export default function ProposalDialog({onClose,onDownloadPdf,pdfBusy=false,...props}:ProposalProps&{onClose:()=>void;onDownloadPdf?:()=>void;pdfBusy?:boolean}){
  useEffect(()=>{
    document.body.classList.add('dd-proposal-open');
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',key);
    return ()=>{document.body.classList.remove('dd-proposal-open');window.removeEventListener('keydown',key);};
  },[onClose]);
  return createPortal(<div className="dd-proposal-root" role="dialog" aria-modal="true" aria-label="Deck proposal preview">
    <div className="dd-proposal-toolbar dd-no-print">
      <div><strong>Your proposal</strong><span>Print it, or choose “Save as PDF” in the print window. Nothing is sent to us.</span></div>
      <button type="button" className="dd-primary" onClick={()=>window.print()} autoFocus>Print / save as PDF</button>
      {onDownloadPdf&&<button type="button" className="dd-secondary" onClick={onDownloadPdf} disabled={pdfBusy}>{pdfBusy?'Making your PDF…':'Download PDF'}</button>}
      <button type="button" className="dd-secondary" onClick={onClose}>Close</button>
    </div>
    <ProposalSheet swatchSrc={swatchUrl} {...props}/>
  </div>,document.body);
}
