import type {jsPDF as JsPDF} from 'jspdf';
import {SHEET,type DrawingSet} from './drawingTypes';
import {paperLayout} from './paperLayout';

/** The permit set as a vector PDF: one 11 × 17 landscape page per sheet, painted from the same paper layout as the
 * preview. jsPDF is passed in so it loads only when a PDF is asked for. */
export function buildPermitPdf(JsPdf:typeof JsPDF,set:DrawingSet):ArrayBuffer{
  const doc=new JsPdf({orientation:'landscape',unit:'in',format:[SHEET.h,SHEET.w],compress:true});
  doc.setProperties({title:`Permit drawings · ${set.project.title}`,author:set.firm.name,subject:'Deck permit drawing set (planning drawings)',creator:'DeckCraft'});
  set.sheets.forEach((sheet,index)=>{
    if(index)doc.addPage([SHEET.h,SHEET.w],'landscape');
    for(const p of paperLayout(set,sheet,index)){
      if(p.kind==='line'){
        doc.setDrawColor(p.grey?119:17,p.grey?119:17,p.grey?119:17);doc.setLineWidth(p.weight);doc.setLineDashPattern(p.dash?[...p.dash]:[],0);doc.line(p.a.x,p.a.y,p.b.x,p.b.y);
      }else if(p.kind==='circle'){
        doc.setDrawColor(17,17,17);doc.setFillColor(17,17,17);doc.setLineWidth(p.weight);doc.setLineDashPattern([],0);doc.circle(p.c.x,p.c.y,p.r,p.fill?'FD':'S');
      }else if(p.kind==='rect'){
        doc.setDrawColor(17,17,17);doc.setFillColor(17,17,17);doc.setLineWidth(p.weight);doc.setLineDashPattern([],0);doc.rect(p.x,p.y,p.w,p.h,p.fill?'FD':'S');
      }else{
        doc.setFont('helvetica',p.bold?'bold':'normal');doc.setFontSize(p.size*72);doc.setTextColor(17,17,17);
        doc.text(p.text,p.at.x,p.at.y,{align:p.anchor==='start'?'left':p.anchor==='middle'?'center':'right',...(p.rotate?{angle:-p.rotate}:{})});
      }
    }
  });
  return doc.output('arraybuffer');
}
