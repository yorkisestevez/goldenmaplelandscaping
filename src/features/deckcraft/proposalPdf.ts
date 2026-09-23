import {PRICE_BOOK} from './priceBook';
import type {jsPDF as JsPDF} from 'jspdf';
import {BUSINESS,publicContact} from '../../data/business';
import {dollars,type DeckEstimate} from './designFacts';
import type {DeckData} from './types';

/**
 * The downloadable deck proposal as a real PDF: the one-page proposal (same content and wording as the
 * printable sheet), the construction plan, and the material and hardware list. Business name and contact
 * details come only from src/data/business.ts. Unpriced items read "Supplier quote required", never $0.
 *
 * jsPDF is passed in so the page can load it only when someone asks for a PDF, and the checks can run
 * this in Node. Images arrive as data URLs made by the page (3D snapshot, rasterised plan, logo).
 */
export interface ProposalPdfInput{
  data:DeckData;estimate:DeckEstimate;facts:string[];reviewItems:string[];date:string;
  snapshot?:string|null;plan?:string|null;logo?:string|null;
}
export const PROPOSAL_PDF_NAME='golden-maple-deck-proposal.pdf';
/** Letter size in points, with the page margin and the footer band. */
const W=612,H=792,M=46,FOOT=40,CW=W-2*M;
const INK:[number,number,number]=[41,40,36],MUTED:[number,number,number]=[101,94,83],RULE:[number,number,number]=[210,201,186];

/** Text jsPDF's built-in fonts can draw (Latin-1): typographic punctuation becomes its plain equivalent. */
export function pdfText(text:string):string{
  return text.replace(/[\u2018\u2019\u2032]/g,"'").replace(/[\u201C\u201D\u2033]/g,'"').replace(/[\u2013\u2014\u2212]/g,'-')
    .replace(/\u2026/g,'...').replace(/\u2264/g,'<=').replace(/\u2265/g,'>=').replace(/[\u2192\u2197]/g,'->')
    .replace(/[\u00A0\u2009\u202F]/g,' ').replace(/[^\x20-\x7E\xA1-\xFF\n]/g,'?');
}

export function buildProposalPdf(PDF:typeof JsPDF,input:ProposalPdfInput,{compress=true}:{compress?:boolean}={}):ArrayBuffer{
  const {data,estimate,facts,reviewItems,date}=input,quotes=estimate.quoteRequired??[];
  const doc=new PDF({unit:'pt',format:'letter',compress});
  const name=BUSINESS.publicName.value,site=BUSINESS.canonicalUrl.replace(/^https?:\/\//,'');
  const area=`${BUSINESS.addressPolicy.value.publicLocality}, ${BUSINESS.addressPolicy.value.region}`;
  doc.setProperties({title:`Deck proposal - ${name}`,subject:'Deck planning estimate',creator:`${name} deck designer`});
  let y=M;
  const color=(c:[number,number,number])=>doc.setTextColor(c[0],c[1],c[2]);
  const font=(size:number,style:'normal'|'bold'='normal',c=INK)=>{doc.setFont('helvetica',style);doc.setFontSize(size);color(c);};
  const room=(h:number)=>{if(y+h>H-M-FOOT){doc.addPage();y=M;}};
  const rule=()=>{doc.setDrawColor(RULE[0],RULE[1],RULE[2]);doc.setLineWidth(.6);doc.line(M,y,W-M,y);};
  const lines=(text:string,width:number):string[]=>doc.splitTextToSize(pdfText(text),width) as string[];
  const para=(text:string,size=9.5,opts:{x?:number;width?:number;style?:'normal'|'bold';c?:[number,number,number];gap?:number}={})=>{
    font(size,opts.style,opts.c);const lh=size*1.35,x=opts.x??M;
    for(const line of lines(text,opts.width??CW-(x-M))){room(lh);doc.text(line,x,y+size);y+=lh;}
    y+=opts.gap??0;
  };
  const heading=(text:string)=>{room(40);y+=10;font(12.5,'bold');doc.text(pdfText(text),M,y+12.5);y+=20;};
  // Bullets are drawn dots: the built-in fonts have no bullet character.
  const bullets=(items:string[],size=9.5)=>{for(const item of items){room(size*1.35);doc.setFillColor(INK[0],INK[1],INK[2]);doc.circle(M+4,y+size*.62,1.25,'F');para(item,size,{x:M+14,gap:2});}};
  const row=(label:string,amount:string,style:'normal'|'bold'='normal')=>{
    font(10,style);const labelLines=lines(label,CW-120);
    room(labelLines.length*13.5+3);labelLines.forEach((l,i)=>doc.text(l,M,y+10+i*13.5));doc.text(pdfText(amount),W-M,y+10,{align:'right'});
    y+=labelLines.length*13.5+3;
  };
  const picture=(url:string|null|undefined,maxH:number,fallback:string)=>{
    if(url){
      try{
        const p=doc.getImageProperties(url),scale=Math.min(CW/p.width,maxH/p.height),w=p.width*scale,h=p.height*scale;
        room(h+8);doc.addImage(url,p.fileType,M+(CW-w)/2,y,w,h);y+=h+8;return;
      }catch{/* An unreadable image falls back to the note below. */}
    }
    room(40);doc.setFillColor(245,242,236);doc.rect(M,y,CW,34,'F');para(fallback,9,{x:M+10,c:MUTED});y+=16;
  };

  // Page 1: the proposal.
  if(input.logo){try{doc.addImage(input.logo,'PNG',M,y,30,30);}catch{/* Without the logo the name still leads. */}}
  const tx=input.logo?M+40:M;
  font(15,'bold');doc.text(pdfText(name),tx,y+14);
  font(7.5,'normal',MUTED);doc.text(pdfText('DECK PROPOSAL  ·  PLANNING ESTIMATE'),tx,y+27);
  font(8.5,'normal',MUTED);
  [[`Date`,`${date} · price book ${PRICE_BOOK.version}`],['Prepared for',data.customerName.trim()||'Not provided'],['Project address',data.projectAddress.trim()||'Not provided']].forEach(([k,v],i)=>{
    doc.text(pdfText(`${k}: ${v}`).slice(0,70),W-M,y+9+i*11,{align:'right'});
  });
  y+=44;rule();y+=12;
  picture(input.snapshot,250,'3D view unavailable on this device. The construction plan on page 2 shows the layout.');
  heading('Your deck');bullets(facts);
  heading(quotes.length?'Planning estimate - priced portion':'Planning estimate');
  for(const s of estimate.sections.filter(s=>!/^HST/.test(s.title)))row(s.title,s.quoteRequired&&s.total===0?'Supplier quote required':dollars(s.total));
  y+=3;rule();y+=5;
  row('Subtotal before HST',dollars(estimate.subtotal),'bold');row('HST',dollars(estimate.hst));
  row(quotes.length?'Priced portion including HST':'Total including HST',dollars(estimate.total),'bold');
  if(quotes.length){y+=6;para(`Not a complete project price. Supplier quotes are still needed for: ${quotes.join('; ')}.`,9.5,{style:'bold'});}
  if(reviewItems.length){heading('Confirm before construction');bullets(reviewItems,9);}
  y+=10;para(`This is a planning estimate based on the selected design and ${name}'s current price book. Final measurements, site conditions, permits, engineering and product availability are confirmed in your written quote.`,8.5,{c:MUTED});

  // Page 2: the construction plan.
  doc.addPage();y=M;heading('Construction plan');
  para('Drawn from the same design model as the estimate. Dimensions and connections need site confirmation before construction.',9,{c:MUTED,gap:6});
  picture(input.plan,H-2*M-FOOT-70,'The plan could not be drawn on this device. Reopen the design to see it.');

  // Page 3 onward: the material and hardware list.
  doc.addPage();y=M;heading('Material and hardware list');
  para('Quantities follow the modelled parts. Items without a confirmed rate are listed for a supplier quote and are not in the estimate.',9,{c:MUTED,gap:4});
  for(const s of estimate.sections){
    const items=s.items.filter(i=>Number(i.qty)>0);if(!items.length)continue;
    room(30);y+=6;font(10.5,'bold');doc.text(pdfText(s.title),M,y+10.5);y+=16;
    for(const i of items){
      const label=`${i.name}${i.spec?` - ${i.spec}`:''}`,qty=`${i.qty} ${i.unit}${i.cost===null?'  (supplier quote required)':''}`;
      font(8.5);const labelLines=lines(label,CW-170);room(labelLines.length*11.5+2);
      labelLines.forEach((l,k)=>doc.text(l,M+8,y+8.5+k*11.5));doc.text(pdfText(qty),W-M,y+8.5,{align:'right'});
      y+=labelLines.length*11.5+2;
    }
  }

  // Every page: contact line and page number.
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);doc.setDrawColor(RULE[0],RULE[1],RULE[2]);doc.setLineWidth(.6);doc.line(M,H-M-FOOT+14,W-M,H-M-FOOT+14);
    font(8,'normal',MUTED);doc.text(pdfText(`${name}  ·  ${publicContact.phoneDisplay}  ·  ${publicContact.email}  ·  ${site}  ·  ${area}`),M,H-M-FOOT+28);
    doc.text(`Page ${p} of ${pages}`,W-M,H-M-FOOT+28,{align:'right'});
  }
  return doc.output('arraybuffer');
}
