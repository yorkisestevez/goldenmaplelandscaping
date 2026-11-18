import type {jsPDF as JsPDF} from 'jspdf';
import {dollars,type DeckEstimate} from './designFacts';
import {isBuilderQuote,lineBasis,priceLedger,quoteLabel,quoteTag,type QuoteKind} from './designer/priceLedgerModel';
import {PRICE_BOOK,priceBookLabel} from './priceBook';
import {eyebrowNumber,proposalAddress,proposalContact,proposalCoverTitle,proposalFeatures,proposalFinishes,proposalRunningTitle,proposalSummary,proposalTitle,PROPOSAL_WORDS,SHEET_EYEBROWS,type ProposalShot} from './proposalModel';
import {PROPOSAL_PDF_NAME} from './sendDesignConstants';
import type {DeckData} from './types';
import {underDeckCostSplit} from './proposalModel';

export {PROPOSAL_PDF_NAME};

/**
 * The downloadable proposal as a real PDF (R8), in the Golden Maple estimate branding (R9): the same sheets, words and
 * figures as the printable proposal (ProposalSheet.tsx, both built from proposalModel.ts and the price schedule), set
 * as the estimate PDF Golden Maple sends its customers is (the CRM's ReportLab engine, theme GM_LANDSCAPING): a forest
 * masthead with the mark and gold wordmark above a spacious project introduction and the actual 3D hero; warm paper inner pages with the
 * running head, gold eyebrows, forest-headed tables, gold callouts and the contact footer with its page number. jsPDF
 * cannot use web fonts (and the proposal ships no font files), so its built-in Times sets the display lines and
 * Helvetica the rest; nothing is set in italics. Business name and contact details come only from src/data/business.ts.
 * An unpriced line carries a supplier or builder quote tag, never $0; the totals are the priced portion, labelled so.
 *
 * jsPDF is passed in, so the page loads it (and this builder) only when someone asks for a PDF and the checks can run
 * it in Node. Pictures arrive as data URLs made by the page: the 3D views, the rasterised plans, the logo and the
 * swatch photos (pdfAssets.ts).
 */
export interface ProposalPdfInput{
  data:DeckData;estimate:DeckEstimate;facts:string[];reviewItems:string[];date:string;
  /** The 3D views, the cover first. `snapshot` is a single cover picture, for callers that have only one. */
  shots?:ProposalShot[];snapshot?:string|null;
  /** The site plan (the drawing-set plan) and the builder's construction plan, rasterised. */
  sitePlan?:string|null;plan?:string|null;logo?:string|null;
  /** Swatch photos as data URLs, by swatch file name. */
  swatches?:Record<string,string>;
}
type RGB=readonly [number,number,number];
/** The estimate PDF's palette (brands.py GM_LANDSCAPING); GOLD_INK is the gold for small text on light ground (AA). */
const FOREST:RGB=[18,32,25],GOLD:RGB=[212,175,99],GOLD_DK:RGB=[184,147,46],GOLD_INK:RGB=[122,90,20],BONE:RGB=[238,242,236],ROW_A:RGB=[251,248,242],ROW_B:RGB=[236,229,216],
  TINT:RGB=[244,233,206],TEXT:RGB=[44,44,44],MUTED:RGB=[95,95,95],QUIET:RGB=[74,87,80],LINE:RGB=[216,207,190],LIGHT:RGB=[244,240,233],WARM:RGB=[217,195,179],WARM2:RGB=[203,182,166],
  WARM3:RGB=[183,154,138],WARM4:RGB=[217,203,189],SHEET:RGB=[251,251,248],SAGE:RGB=[222,227,219];
/** Letter in points, with the estimate PDF's margins: 54 pt sides, the running head above 92 pt, the footer below 722. */
const W=612,H=792,M=54,CW=W-2*M,TOP=92,BOTTOM=722;

/** Text jsPDF's built-in fonts can draw (Latin-1): typographic punctuation becomes its plain equivalent. */
export function pdfText(text:string):string{
  return text.replace(/[\u2018\u2019\u2032]/g,"'").replace(/[\u201C\u201D\u2033]/g,'"').replace(/[\u2013\u2014\u2212]/g,'-')
    .replace(/\u2026/g,'...').replace(/\u2264/g,'<=').replace(/\u2265/g,'>=').replace(/[\u2192\u2197]/g,'->')
    .replace(/[\u00A0\u2009\u202F]/g,' ').replace(/[^\x20-\x7E\xA1-\xFF\n]/g,'?');
}
const rgbOf=(hex:string):RGB|null=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex);if(!m)return null;const n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255];};

export function buildProposalPdf(PDF:typeof JsPDF,input:ProposalPdfInput,{compress=true}:{compress?:boolean}={}):ArrayBuffer{
  const {data,estimate,facts,reviewItems,date}=input;
  const doc=new PDF({unit:'pt',format:'letter',compress});
  const contact=proposalContact(),project=proposalTitle(data),address=proposalAddress(data),name=data.customerName.trim(),ledger=priceLedger(estimate),backyard=!!ledger.split;
  const shots=input.shots?.length?input.shots:input.snapshot?[{label:'Corner view',src:input.snapshot}]:[];
  doc.setProperties({title:`Deck proposal - ${pdfText(project)} - ${contact.name}`,subject:'Deck design proposal and planning estimate',creator:`${contact.name} deck designer`});

  // Drawing helpers.
  const fill=(c:RGB)=>doc.setFillColor(c[0],c[1],c[2]),stroke=(c:RGB)=>doc.setDrawColor(c[0],c[1],c[2]);
  const font=(face:'times'|'helvetica',size:number,c:RGB,style:'normal'|'bold'='normal')=>{doc.setFont(face,style);doc.setFontSize(size);doc.setTextColor(c[0],c[1],c[2]);};
  const lines=(text:string,width:number):string[]=>doc.splitTextToSize(pdfText(text),width) as string[];
  const spacedWidth=(t:string,space:number)=>doc.getTextWidth(t)+space*(t.length-1);
  /** Letter-spaced capitals (the gold labels, the wordmark); returns the width drawn. */
  const spaced=(text:string,x:number,y:number,space:number,align:'left'|'right'|'center'='left')=>{
    const t=pdfText(text).toUpperCase(),w=spacedWidth(t,space);
    doc.text(t,align==='right'?x-w:align==='center'?x-w/2:x,y,{charSpace:space});return w;
  };
  /** Spaced capitals wrapped to a width (splitTextToSize does not count the letter spacing). */
  const spacedLines=(text:string,width:number,space:number):string[]=>{
    const out:string[]=[];let line='';
    for(const word of pdfText(text).toUpperCase().split(' ')){const next=line?`${line} ${word}`:word;if(line&&spacedWidth(next,space)>width){out.push(line);line=word;}else line=next;}
    return line?[...out,line]:out;
  };
  const rule=(x1:number,y:number,x2:number,c:RGB,width=.6)=>{stroke(c);doc.setLineWidth(width);doc.line(x1,y,x2,y);};
  /** The gold rule with a small diamond, as the estimate PDF sets it under its wordmark. */
  const ornament=(cx:number,y:number,c:RGB,half=70)=>{rule(cx-half,y,cx-10,c,.9);rule(cx+10,y,cx+half,c,.9);fill(c);const d=3.4;doc.lines([[d,-d],[d,d],[-d,d],[-d,-d]],cx-d,y,[1,1],'F',true);};
  const image=(url:string|null|undefined,x:number,y:number,w:number,h:number,mode:'cover'|'contain'):boolean=>{
    if(!url)return false;
    try{
      const p=doc.getImageProperties(url),scale=(mode==='cover'?Math.max:Math.min)(w/p.width,h/p.height),iw=p.width*scale,ih=p.height*scale;
      if(mode==='contain'){doc.addImage(url,p.fileType,x+(w-iw)/2,y+(h-ih)/2,iw,ih);return true;}
      doc.saveGraphicsState();doc.rect(x,y,w,h,null);doc.clip();doc.discardPath();
      doc.addImage(url,p.fileType,x+(w-iw)/2,y+(h-ih)/2,iw,ih);doc.restoreGraphicsState();return true;
    }catch{return false;}// An unreadable picture falls back to the caller's note.
  };
  const tag=(kinds:readonly QuoteKind[],right:number,base:number)=>{
    const c=kinds.length===1&&kinds[0]==='builder'?QUIET:GOLD_INK;
    font('helvetica',6.3,c,'bold');
    const t=quoteTag(kinds).toUpperCase(),w=doc.getTextWidth(t)+.4*(t.length-1)+8;
    stroke(c);doc.setLineWidth(.6);doc.rect(right-w,base-7.4,w,10);
    doc.text(t,right-w+4,base,{charSpace:.4});return w;
  };
  /** The mark in its thin gold ring (no disc behind it). */
  const emblem=(cx:number,cy:number,r:number,ring:RGB)=>{stroke(ring);doc.setLineWidth(.8);doc.circle(cx,cy,r,'S');if(input.logo)image(input.logo,cx-r*.76,cy-r*.61,r*1.52,r*1.22,'contain');};

  // Sheets: every page after the cover gets the running head and the contact footer once the pages are laid out.
  let y=TOP,label='',section=0;
  const sheet=(name:string)=>{doc.addPage();label=name;fill(ROW_A);doc.rect(0,0,W,H,'F');y=TOP;};
  const continued=()=>sheet(label.endsWith(', continued')?label:`${label}, continued`);
  const room=(h:number,onBreak?:()=>void)=>{if(y+h>BOTTOM){continued();onBreak?.();return true;}return false;};
  const text=(t:string,size:number,c:RGB,{x=M,width=CW,style='normal',face='helvetica',lh=1.38,gap=0}:{x?:number;width?:number;style?:'normal'|'bold';face?:'times'|'helvetica';lh?:number;gap?:number}={})=>{
    font(face,size,c,style);for(const line of lines(t,width)){room(size*lh);doc.text(line,x,y+size);y+=size*lh;}y+=gap;
  };
  /** A sheet's heading as the estimate sets a section: the numbered gold eyebrow, the serif title, the gold rule. */
  const heading=(title:string,eyebrow:string,lede?:string,number=++section)=>{
    font('helvetica',8,GOLD_INK,'bold');spaced(`${eyebrowNumber(number)} · ${eyebrow}`,M,y+8,.64);y+=14;
    font('times',32,FOREST);doc.text(pdfText(title),M,y+29);y+=38;
    rule(M,y,M+48,GOLD_DK,1.2);y+=12;
    if(lede)text(lede,12,TEXT,{face:'times',width:CW*.82,lh:1.25,gap:12});else y+=4;
  };
  /**
   * Two balanced columns, then onto a new sheet: each block says its height (and how much of the next it keeps with
   * it, so a heading never ends a column) and draws itself at (x, y), moving y down.
   */
  const columns=(blocks:{h:number;draw:(x:number,w:number)=>void;keep?:number}[],gutter=24)=>{
    const w=(CW-gutter)/2;let col=0,top=y,left=y,limit=BOTTOM;
    const balance=(from:number)=>{limit=Math.min(BOTTOM,top+blocks.slice(from).reduce((n,b)=>n+b.h,0)/2+18);};
    balance(0);
    blocks.forEach((b,i)=>{
      const need=b.h+(b.keep??0);
      if(col===0&&y>top&&y+need>limit){col=1;left=y;y=top;}
      else if(col===1&&y+need>BOTTOM){continued();col=0;top=y;left=y;balance(i);}
      b.draw(M+col*(w+gutter),w);
    });
    if(col===1)y=Math.max(y,left);
  };

  // 1. Editorial cover: a compact forest masthead, a generous project title, the actual design image and project facts.
  // Drawing order keeps the cover's reading order intact even though the image sits below the project introduction.
  fill(ROW_A);doc.rect(0,0,W,H,'F');fill(FOREST);doc.rect(0,0,W,138,'F');
  emblem(M+25,73,25,GOLD);
  font('helvetica',8,GOLD,'bold');spaced(PROPOSAL_WORDS.eyebrow,M,121,1.15);
  font('times',29,GOLD,'bold');spaced(contact.wordmark.top,W-M,75,2.7,'right');
  if(contact.wordmark.sub){font('helvetica',9,LIGHT);spaced(contact.wordmark.sub,W-M,96,4.4,'right');}
  rule(M,139,M+64,GOLD_DK,2);
  // Laid out from the foot up, so the hero takes what the words leave: the footer, the details row, then the words.
  const META_Y=650,textW=CW;
  font('times',36,FOREST);const titleLines=lines(proposalCoverTitle(data,backyard),textW).slice(0,2);
  // The summary, in one line or two balanced ones (never a lone word left on the second).
  font('helvetica',8.5,MUTED);const summary=proposalSummary(data,estimate.model.quantities.area,backyard);
  let summaryLines=spacedLines(summary,textW,.45);
  summaryLines=summaryLines.slice(0,2);
  const addressLines=address?spacedLines(address,textW,.45).slice(0,2):[];
  const introEnd=210+39*(titleLines.length-1)+19+12*(summaryLines.length-1)+(addressLines.length?16+12*(addressLines.length-1):0);
  const heroTop=introEnd+22,heroBottom=609;
  const cover=shots[0],hx=M,hw=CW,hh=heroBottom-heroTop;
  // The hero: the cover view; without one (no WebGL), the site plan on its sheet; without that, a note.
  const drawn=!!cover&&image(cover.src,hx,heroTop,hw,hh,'cover');
  let heroNote=drawn?`${cover.label} · ${PROPOSAL_WORDS.illustration}`:'';
  if(!drawn){
    fill(SAGE);doc.rect(hx,heroTop,hw,hh,'F');
    if(image(input.sitePlan,hx+12,heroTop+12,hw-24,hh-24,'contain'))heroNote='The 3D view is not available on this device: the site plan shows the layout.';
    else{font('times',15,FOREST);const note=lines('The 3D view is not available on this device. The plans in this proposal show the layout.',hw-56);note.forEach((l,i)=>doc.text(l,hx+28,heroTop+hh/2+i*19));}
  }
  y=heroBottom+13;
  if(heroNote){font('helvetica',7,MUTED);doc.text(pdfText(heroNote),M,y);}
  y=174;font('helvetica',8.5,GOLD_INK,'bold');spaced(PROPOSAL_WORDS.doctype,M,y,1.7);
  y=210;font('times',36,FOREST);titleLines.forEach((l,i)=>doc.text(l,M,y+i*39));y+=39*(titleLines.length-1);
  y+=19;font('helvetica',8.5,MUTED);summaryLines.forEach((l,i)=>doc.text(l,M,y+i*12,{charSpace:.45}));y+=12*(summaryLines.length-1);
  if(addressLines.length){y+=16;font('helvetica',8.5,MUTED);addressLines.forEach((l,i)=>doc.text(l,M,y+i*12,{charSpace:.45}));}
  const meta:[string,string][]=[...(name?[['Prepared for',name]] as [string,string][]:[]),['Proposal date',date],['Price book',PRICE_BOOK.version]];
  meta.forEach(([k,v],i)=>{
    const x=M+i*(CW/meta.length);
    font('helvetica',7,GOLD_INK,'bold');spaced(k,x,META_Y,1.2);
    font('times',14,FOREST);doc.text(lines(v,CW/meta.length-16)[0]??'',x,META_Y+20);
  });
  rule(M,700,W-M,LINE,.6);
  font('helvetica',8,FOREST,'bold');spaced(contact.name,M,719,1.1);
  font('helvetica',7.5,MUTED);doc.text(pdfText(`${contact.area} · ${contact.phone} · ${contact.email} · ${contact.site}`),M,737);

  // 2. Views: the other cameras, with quiet editorial captions on the paper ground.
  const views=shots.slice(1,4);
  if(views.length){
    sheet('Views');heading('Views',SHEET_EYEBROWS.views,`Your design from ${views.length===1?'another angle':`${views.length===2?'two':'three'} more angles`}.`);
    const put=(v:ProposalShot,x:number,w:number,h:number)=>{
      fill(ROW_A);doc.rect(x,y,w,h+18,'F');
      if(!image(v.src,x,y,w,h,'cover')){fill(SAGE);doc.rect(x,y,w,h,'F');}
      rule(x,y+h+18,x+w,LINE,.6);
      font('helvetica',6.8,GOLD_INK,'bold');spaced(v.label,x,y+h+11.5,1.1);
    };
    if(views.length===3){put(views[0],M,CW,262);y+=262+18+14;const w=(CW-12)/2;put(views[1],M,w,150);put(views[2],M+w+12,w,150);y+=150+18+14;}
    else for(const v of views){const h=views.length===2?214:380;put(v,M,CW,h);y+=h+18+14;}
    text(`${PROPOSAL_WORDS.illustration}s, drawn from your design in the 3D view.`,7.5,MUTED);
  }

  // 3. Lighting & features.
  sheet('Lighting & features');heading('Lighting & features',SHEET_EYEBROWS.features,'Everything in this design, as you built it.');
  const groups=proposalFeatures(data,facts);
  columns(groups.flatMap(g=>{
    font('helvetica',8.5,TEXT);
    const items=g.items.map(item=>({t:item,n:lines(item,(CW-24)/2).length}));
    return [{h:24,keep:items[0]?items[0].n*11.6+7:0,draw:(x:number,w:number)=>{
      fill(GOLD_DK);doc.rect(x,y+5,6,6,'F');font('times',13.5,FOREST);doc.text(pdfText(g.title),x+12,y+12);rule(x,y+18,x+w,GOLD,.9);y+=22;
    }},...items.map((item,k)=>({h:item.n*11.6+7,draw:(x:number,w:number)=>{
      font('helvetica',8.5,TEXT);lines(item.t,w).forEach((l,i)=>doc.text(l,x,y+10+i*11.6));y+=item.n*11.6+5;
      if(k<items.length-1)rule(x,y,x+w,LINE,.5);y+=2;
      if(k===items.length-1)y+=12;
    }}))];
  }));

  // 4. Materials & finishes: the swatch photos, framed in gold.
  sheet('Materials & finishes');heading('Materials & finishes',SHEET_EYEBROWS.finishes,'The manufacturer colours in your design, and where each one goes.');
  const tiles=proposalFinishes(data,estimate.model),per=tiles.length>12?5:tiles.length<=6?3:4,gap=16,tw=(CW-(per-1)*gap)/per;
  for(let i=0;i<tiles.length;i+=per){
    const row=tiles.slice(i,i+per),words=row.map(t=>{font('helvetica',7.8,TEXT);const c=lines(t.collection,tw);font('helvetica',7,MUTED);return {c,u:lines(`${t.uses.join(' · ')}${t.note?` · ${t.note}`:''}`,tw)};});
    const textH=Math.max(...words.map(w=>16+w.c.length*10+w.u.length*9));
    room(tw+8+textH);
    row.forEach((t,k)=>{
      const x=M+k*(tw+gap),file=t.swatch&&input.swatches?.[t.swatch],hex=t.hex?rgbOf(t.hex):null;
      fill(ROW_A);doc.rect(x,y,tw,tw,'F');
      if(!image(file,x+2,y+2,tw-4,tw-4,'cover')){fill(hex??SAGE);doc.rect(x+2,y+2,tw-4,tw-4,'F');}
      stroke(GOLD);doc.setLineWidth(.8);doc.rect(x,y,tw,tw);
      let ty=y+tw+15;font('times',12.5,FOREST);doc.text(lines(t.colour,tw)[0],x,ty);ty+=12;
      font('helvetica',7.8,TEXT);words[k].c.forEach(l=>{doc.text(l,x,ty);ty+=10;});
      font('helvetica',7,MUTED);words[k].u.forEach(l=>{doc.text(l,x,ty);ty+=9;});
    });
    y+=tw+8+textH+10;
  }
  text(PROPOSAL_WORDS.colours,7.5,MUTED,{gap:0});

  // 5. The site plan, on its sheet in a gold frame.
  sheet('Site plan');heading('Site plan',SHEET_EYEBROWS.site,`${data.width} × ${data.length} ft deck against your house, ${data.height} in above grade.`);
  const planH=BOTTOM-y-24;
  fill(SHEET);doc.rect(M,y,CW,planH,'F');stroke(GOLD);doc.setLineWidth(1);doc.rect(M,y,CW,planH);
  if(!image(input.sitePlan,M+10,y+10,CW-20,planH-20,'contain')){font('helvetica',9,MUTED);doc.text(pdfText('The site plan could not be drawn on this device. Reopen the design to see it.'),M+12,y+20);}
  y+=planH+8;text('Dimensions in feet. Measurements and connections are confirmed on site.',7.5,MUTED);

  // 6. The investment, from the price schedule, as the estimate's table: a forest header row, cream and linen rows with
  // gold rules, in the engine's order; the totals with the total on gold tint; the callout; what is still to be quoted.
  sheet('Investment');heading('Investment',SHEET_EYEBROWS.investment,`${PROPOSAL_WORDS.estimate} · ${priceBookLabel()} · CAD`);
  const investNo=section,againHeading=()=>heading('Investment, continued',SHEET_EYEBROWS.investment,undefined,investNo);
  let tableTop=y,band=0;
  const tableHead=()=>{
    tableTop=y;band=0;fill(FOREST);doc.rect(M,y,CW,18,'F');
    font('helvetica',7,LIGHT,'bold');spaced('Item',M+10,y+12,.8);spaced('Amount (CAD)',W-M-10,y+12,.8,'right');y+=18;rule(M,y,W-M,GOLD,1);
  };
  const box=(top:number)=>{stroke(GOLD);doc.setLineWidth(1.2);doc.rect(M,top,CW,y-top);};
  tableHead();
  for(const line of ledger.lines){
    const split=line.title==='Under-deck options'?underDeckCostSplit(estimate):[];
    const basis=lineBasis(line);font('helvetica',8.6,TEXT);const ls=lines(line.title,CW-170),h=ls.length*11.2+8+split.length*10+(basis?10:0);
    if(y+h>BOTTOM){box(tableTop);continued();againHeading();tableHead();}
    fill(band++%2?SHEET:ROW_A);doc.rect(M,y,CW,h,'F');
    font('helvetica',8.6,TEXT);ls.forEach((l,i)=>doc.text(l,M+10,y+11+i*11.2));
    font('helvetica',7.2,MUTED);split.forEach((g,i)=>doc.text(pdfText(`${g.label}: ${dollars(g.amount)}`),M+10,y+ls.length*11.2+11+i*10));
    if(line.quotes.length&&line.amount<.005)tag(line.quotes,W-M-10,y+11);
    else{font('helvetica',8.6,FOREST,'bold');doc.text(pdfText(line.text),W-M-10,y+11,{align:'right'});}
    // Drawn after the amount, so the line reads title, amount, then its basis.
    if(basis){font('helvetica',7.2,MUTED);doc.text(pdfText(basis),W-M-10,y+ls.length*11.2+11+split.length*10,{align:'right'});}
    y+=h;rule(M,y,W-M,LINE,.4);
  }
  box(tableTop);
  const sums:[string,number,string?][]=[...(ledger.split?[['Deck subtotal',ledger.split.deck],['Backyard subtotal',ledger.split.backyard]] as [string,number][]:[]),[ledger.quotes.length?'Priced subtotal':'Subtotal',ledger.subtotal,PROPOSAL_WORDS.estimate],[ledger.hstTitle,ledger.hst],[ledger.totalLabel,ledger.total]];
  const fine=`${PROPOSAL_WORDS.notFinal} ${priceBookLabel()} · CAD.`;font('helvetica',7.8,TEXT);const fineLines=lines(fine,CW-30),calloutH=fineLines.length*10.5+11;
  if(y+14+sums.length*20+18+10+calloutH>BOTTOM){continued();againHeading();}
  y+=14;const sumsTop=y;
  sums.forEach(([k,v,note],i)=>{
    const last=i===sums.length-1,sub=!!note,h=last?31:sub?29:20;
    fill(last?TINT:ROW_A);doc.rect(M,y,CW,h,'F');
    if(last){
      rule(M,y,W-M,GOLD,1.4);font('times',16,FOREST);doc.text(pdfText(k),M+12,y+20);doc.text(dollars(v),W-M-12,y+20,{align:'right'});
    }else{
      if(sub)rule(M,y,W-M,FOREST,.8);
      font('helvetica',9,sub?FOREST:TEXT,sub?'bold':'normal');doc.text(pdfText(k),M+12,y+13.5);
      font('helvetica',9,FOREST,'bold');doc.text(dollars(v),W-M-12,y+13.5,{align:'right'});
      if(note){font('helvetica',7.5,MUTED);doc.text(pdfText(note),M+12,y+23.5);}
      rule(M,y+h,W-M,LINE,.4);
    }
    y+=h;
  });
  box(sumsTop);
  // The estimate's callout: gold tint, a gold bar down its left, a hairline gold box.
  y+=10;fill(TINT);doc.rect(M,y,CW,calloutH,'F');stroke(GOLD);doc.setLineWidth(.5);doc.rect(M,y,CW,calloutH);fill(GOLD_DK);doc.rect(M,y,3.5,calloutH,'F');
  font('helvetica',7.8,TEXT);fineLines.forEach((l,i)=>doc.text(l,M+15,y+13+i*10.5));y+=calloutH;
  if(ledger.quotes.length){
    room(70,againHeading);y+=18;
    font('times',14,FOREST);doc.text('Still to be quoted',M,y+12);y+=17;rule(M,y,M+110,GOLD,1);y+=8;
    text(PROPOSAL_WORDS.quotesNote,7.5,MUTED,{gap:6});
    columns(ledger.quotes.map(q=>{
      const t=quoteTag([q.kind]).toUpperCase();font('helvetica',6.3,GOLD_INK,'bold');const tw=doc.getTextWidth(t)+.4*(t.length-1)+8;
      const words=(w:number)=>{font('helvetica',8,TEXT);return lines(quoteLabel(q.label),w-tw-8);},n=words((CW-24)/2).length;
      return {h:n*10.4+5,draw:(x:number,w:number)=>{
        tag([q.kind],x+w,y+9);
        font('helvetica',8,TEXT);words(w).forEach((l,k)=>doc.text(l,x,y+9+k*10.4));y+=n*10.4+5;
      }};
    }));
  }

  // 7. Next steps: numbered in gold, the contact on a forest summary box, and the mark to sign off.
  sheet('Next steps');heading('Next steps',SHEET_EYEBROWS.next,'From this design to your written quote.');
  const steps:[string,string][]=[
    ['Send us your design','Use "Send my design" in the deck designer. It reaches our team with a link that reopens exactly what you built, plus a summary and this estimate.'],
    ['Book a call',`Talk it through with us at ${contact.book}. Book from your design, and the link comes with you.`],
    ['Confirm it on site','Measurements, connections and engineering are confirmed on site before your written quote.'],
  ];
  steps.forEach(([title,body],i)=>{
    font('times',24,GOLD_INK);doc.text(`0${i+1}`,M,y+22);
    font('times',16,FOREST);doc.text(pdfText(title),M+46,y+17);
    font('times',12,TEXT);const ls=lines(body,CW-60);ls.forEach((l,k)=>doc.text(l,M+46,y+34+k*15));
    y+=34+ls.length*15+6;rule(M,y,W-M,LINE,.5);y+=14;
  });
  y+=10;
  font('times',17,GOLD);const callLines=lines(contact.call,CW-40),boxH=22+callLines.length*20+12;
  fill(FOREST);doc.rect(M,y,CW,boxH,'F');stroke(GOLD_DK);doc.setLineWidth(.6);doc.rect(M,y,CW,boxH);fill(GOLD);doc.rect(M,y,3.5,boxH,'F');
  font('times',17,GOLD);callLines.forEach((l,k)=>doc.text(l,M+18,y+24+k*20));
  font('helvetica',9,LIGHT);doc.text(pdfText(`${contact.email} · ${contact.site} · ${contact.area}`),M+18,y+22+callLines.length*20+4);
  y+=boxH;
  const signY=BOTTOM-92;
  emblem(W/2,signY+26,26,GOLD_DK);
  font('times',20,GOLD_INK,'bold');spaced(contact.wordmark.top,W/2,signY+76,3,'center');
  if(contact.wordmark.sub){font('helvetica',7.5,FOREST);spaced(contact.wordmark.sub,W/2,signY+89,4,'center');}

  // 8. The appendix, in smaller type: what to confirm, the construction plan and the material list.
  sheet('Appendix');heading('Appendix',SHEET_EYEBROWS.appendix,'For you and your builder: what to confirm before construction, the construction plan and the modelled material list.');
  const sub=(title:string)=>{room(40);y+=6;font('times',14,FOREST);doc.text(pdfText(title),M,y+12);y+=17;rule(M,y,W-M,GOLD,.8);y+=8;};
  if(reviewItems.length){
    sub('Confirm before construction');
    columns(reviewItems.map(item=>{font('helvetica',7.4,TEXT);const n=lines(item,(CW-24)/2-9).length;return {h:n*9.4+4,draw:(x:number,w:number)=>{
      fill(GOLD_DK);doc.rect(x,y+3.4,3.6,3.6,'F');font('helvetica',7.4,TEXT);lines(item,w-9).forEach((l,k)=>doc.text(l,x+9,y+7.5+k*9.4));y+=n*9.4+4;
    }};}));
  }
  sheet('Appendix · construction plan');sub('Construction plan');
  text('Drawn from the same design model as the estimate. Dimensions and connections need site confirmation before construction.',7.5,MUTED,{gap:6});
  const boxH2=BOTTOM-y-4;fill(SHEET);doc.rect(M,y,CW,boxH2,'F');stroke(GOLD);doc.setLineWidth(.8);doc.rect(M,y,CW,boxH2);
  if(!image(input.plan,M+6,y+6,CW-12,boxH2-12,'contain')){font('helvetica',9,MUTED);doc.text(pdfText('The construction plan could not be drawn on this device. Reopen the design to see it.'),M+12,y+20);}
  y+=boxH2;
  sheet('Appendix · material list');sub('Material and hardware list');
  text('Quantities follow the modelled parts. Priced lines are planning allowances from the price book unless marked confirmed; your written quote confirms them. Items without a rate are listed for a quote and are not in the estimate.',7.5,MUTED,{gap:6});
  const materialBlocks=estimate.sections.filter(s=>!/^HST/.test(s.title)).flatMap(s=>{
    const items=s.items.filter(i=>Number(i.qty)>0);if(!items.length)return [];
    font('times',10.5,FOREST);const titleN=lines(s.title,(CW-24)/2).length;
    const rows=items.map(item=>{
      const label=`${item.name}${item.spec?` - ${item.spec}`:''}`,qty=`${item.qty} ${item.unit}`,quote:QuoteKind|null=item.cost===null&&!item.quoteResolved?(isBuilderQuote(item)?'builder':'supplier'):null;
      font('helvetica',7.2,TEXT);const n=lines(label,(CW-24)/2-70).length+(quote?1:0);
      return {h:n*9+5,draw:(x:number,w:number)=>{
        font('helvetica',7.2,TEXT);const ls=lines(label,w-70);ls.forEach((l,k)=>doc.text(l,x,y+8+k*9));
        font('helvetica',7.2,FOREST,'bold');doc.text(pdfText(qty),x+w,y+8,{align:'right'});
        if(quote)tag([quote],x+w,y+8+ls.length*9+1);
        y+=n*9+3;rule(x,y,x+w,LINE,.3);y+=2;
      }};
    });
    // The section's title keeps its first item with it, so a title never ends a column.
    return [{h:titleN*12+6,keep:rows[0].h,draw:(x:number,w:number)=>{font('times',10.5,FOREST);lines(s.title,w).forEach((l,k)=>doc.text(l,x,y+12+k*12));y+=titleN*12+6;}},...rows];
  });
  columns(materialBlocks);
  y+=10;room(20);rule(M,y,W-M,GOLD,.6);y+=4;
  text(`${contact.name} · ${contact.phone} · ${contact.email} · ${contact.site} · ${contact.area}`,7.5,TEXT);

  // Every page after the cover: the running head (the mark, the spaced gold name, the document's title, a forest rule
  // over a gold one) and the footer (a gold rule, the published contact line and the page number).
  const pages=doc.getNumberOfPages(),head=proposalRunningTitle(data,backyard);
  for(let p=2;p<=pages;p++){
    doc.setPage(p);
    const logoOk=input.logo?image(input.logo,M,35,22,18,'contain'):false,bx=logoOk?M+28:M;
    font('helvetica',8.5,GOLD_INK,'bold');const bw=spaced(contact.name,bx,49,1.6);
    font('helvetica',6.8,MUTED);spaced(spacedLines(head,W-M-(bx+bw)-24,.6)[0]??'',W-M,49,.6,'right');
    rule(M,56,W-M,FOREST,.8);rule(M,58.6,W-M,GOLD,.5);
    rule(M,738,W-M,GOLD,.6);
    font('helvetica',7.6,FOREST);doc.text(pdfText(`${contact.site}  ·  ${contact.phone}  ·  ${contact.email}`),W/2,751,{align:'center'});
    font('helvetica',6.8,GOLD_INK);spaced(`Deck design proposal · ${contact.area}`,W/2,762,.8,'center');
    font('helvetica',7.6,FOREST,'bold');spaced(`Page ${eyebrowNumber(p)}`,W-M,762,.5,'right');
  }
  return doc.output('arraybuffer');
}
