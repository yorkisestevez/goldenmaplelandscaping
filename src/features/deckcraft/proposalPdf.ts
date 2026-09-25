import type {jsPDF as JsPDF} from 'jspdf';
import {dollars,type DeckEstimate} from './designFacts';
import {isBuilderQuote,priceLedger,quoteLabel,quoteTag,type QuoteKind} from './designer/priceLedgerModel';
import {DECKING_CATALOGUE} from './manufacturerCatalog';
import {priceBookLabel} from './priceBook';
import {proposalAddress,proposalContact,proposalFeatures,proposalFinishes,proposalTitle,PROPOSAL_WORDS,type ProposalShot} from './proposalModel';
import {PROPOSAL_PDF_NAME} from './sendDesign';
import type {DeckData} from './types';

export {PROPOSAL_PDF_NAME};

/**
 * The downloadable proposal as a real PDF (R8): the same sheets, words and figures as the printable proposal
 * (ProposalSheet.tsx, both built from proposalModel.ts and the price schedule), in the same forest, gold, cream and
 * vellum. jsPDF cannot use web fonts, so its built-in Times sets the display lines and Helvetica the rest. Business
 * name and contact details come only from src/data/business.ts. An unpriced line carries a supplier or builder quote
 * tag, never $0; the totals are the priced portion, labelled so.
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
const FOREST:RGB=[20,38,28],GOLD:RGB=[192,138,46],GOLD_DEEP:RGB=[154,115,31],GOLD_INK:RGB=[122,90,20],CREAM:RGB=[246,240,223],VELLUM:RGB=[251,251,248],SAGE:RGB=[230,233,226],
  INK2:RGB=[62,77,67],MUTED:RGB=[91,102,94],RULE:RGB=[185,194,184],MIST:RGB=[214,218,205],LINE_DARK:RGB=[74,91,79];
/** The brand lockup's name, as the designer's header sets it. */
const WORDMARK='Golden Maple';
/** Letter in points: side margin (0.65 in), where the content starts under the running head, and the title strip. */
const W=612,H=792,M=47,CW=W-2*M,TOP=78,STRIP_H=26,STRIP_Y=H-36-STRIP_H,BOTTOM=STRIP_Y-16;

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
  const contact=proposalContact(),project=proposalTitle(data),address=proposalAddress(data),ledger=priceLedger(estimate);
  const shots=input.shots?.length?input.shots:input.snapshot?[{label:'Corner view',src:input.snapshot}]:[];
  doc.setProperties({title:`Deck proposal - ${pdfText(project)} - ${contact.name}`,subject:'Deck proposal and planning estimate',creator:`${contact.name} deck designer`});

  // Drawing helpers.
  const fill=(c:RGB)=>doc.setFillColor(c[0],c[1],c[2]),stroke=(c:RGB)=>doc.setDrawColor(c[0],c[1],c[2]);
  const font=(face:'times'|'helvetica',size:number,c:RGB,style:'normal'|'bold'='normal')=>{doc.setFont(face,style);doc.setFontSize(size);doc.setTextColor(c[0],c[1],c[2]);};
  const lines=(text:string,width:number):string[]=>doc.splitTextToSize(pdfText(text),width) as string[];
  /** Letter-spaced capitals (the gold labels); returns the width drawn. */
  const spaced=(text:string,x:number,y:number,space:number,align:'left'|'right'='left')=>{
    const t=pdfText(text).toUpperCase(),w=doc.getTextWidth(t)+space*(t.length-1);
    doc.text(t,align==='right'?x-w:x,y,{charSpace:space});return w;
  };
  const rule=(x1:number,y:number,x2:number,c:RGB,width=.6)=>{stroke(c);doc.setLineWidth(width);doc.line(x1,y,x2,y);};
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
    font('helvetica',6.3,kinds.length===1&&kinds[0]==='builder'?INK2:GOLD_INK,'bold');
    const t=quoteTag(kinds).toUpperCase(),w=doc.getTextWidth(t)+.4*(t.length-1)+8;
    stroke(kinds.length===1&&kinds[0]==='builder'?INK2:GOLD_INK);doc.setLineWidth(.6);doc.rect(right-w,base-7.4,w,10);
    doc.text(t,right-w+4,base,{charSpace:.4});return w;
  };

  // Sheets: every page after the cover gets the running head and the title strip once the page count is known.
  const sheets:{label:string;dark:boolean}[]=[{label:'Cover',dark:true}];
  let y=TOP,label='',dark=false;
  const sheet=(name:string,isDark=false)=>{
    doc.addPage();label=name;dark=isDark;sheets.push({label,dark});
    fill(dark?FOREST:VELLUM);doc.rect(0,0,W,H,'F');y=TOP;
  };
  const room=(h:number,onBreak?:()=>void)=>{if(y+h>BOTTOM){sheet(label.endsWith(', continued')?label:`${label}, continued`,dark);onBreak?.();return true;}return false;};
  const text=(t:string,size:number,c:RGB,{x=M,width=CW,style='normal',face='helvetica',lh=1.38,gap=0}:{x?:number;width?:number;style?:'normal'|'bold';face?:'times'|'helvetica';lh?:number;gap?:number}={})=>{
    font(face,size,c,style);for(const line of lines(t,width)){room(size*lh);doc.text(line,x,y+size);y+=size*lh;}y+=gap;
  };
  const heading=(title:string,lede?:string)=>{
    font('times',25,dark?CREAM:FOREST);doc.text(pdfText(title),M,y+22);y+=34;
    if(lede)text(lede,9.5,dark?MIST:INK2,{width:CW*.8,gap:14});else y+=8;
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
      else if(col===1&&y+need>BOTTOM){sheet(label.endsWith(', continued')?label:`${label}, continued`,dark);col=0;top=y;left=y;balance(i);}
      b.draw(M+col*(w+gutter),w);
    });
    if(col===1)y=Math.max(y,left);
  };

  // 1. The cover: forest, the 3D hero full-bleed, the wordmark and the project.
  fill(FOREST);doc.rect(0,0,W,H,'F');
  const logoOk=input.logo?image(input.logo,M,36,46,37,'contain'):false,wx=logoOk?M+58:M;
  font('times',27,CREAM);doc.text(WORDMARK,wx,62);
  font('helvetica',7,GOLD,'bold');spaced('Deck Studio',wx,76,2.3);
  font('helvetica',8.5,GOLD,'bold');spaced('Proposal',W-M,74,3.2,'right');
  const heroY=96,heroH=414;
  // The hero: the cover view; without one (no WebGL), the site plan on vellum; without that, a note.
  const cover=shots[0],drawn=!!cover&&image(cover.src,0,heroY,W,heroH,'cover');
  let heroNote=drawn?`${cover.label} · ${PROPOSAL_WORDS.illustration}`:'';
  if(!drawn){
    fill(VELLUM);doc.rect(0,heroY,W,heroH,'F');
    if(image(input.sitePlan,M,heroY+14,CW,heroH-28,'contain'))heroNote='The 3D view is not available on this device: the site plan shows the layout.';
    else{font('helvetica',10,MUTED);doc.text(pdfText('The 3D view is not available on this device. The plans in this proposal show the layout.'),W/2,heroY+heroH/2,{align:'center'});}
  }
  if(heroNote){font('helvetica',7,MIST);doc.text(pdfText(heroNote),M,heroY+heroH+14);}
  rule(M,heroY+heroH+30,W-M,GOLD,.7);
  y=heroY+heroH+64;
  font('times',32,CREAM);for(const line of lines(project,CW).slice(0,2)){doc.text(line,M,y);y+=34;}
  if(address){font('helvetica',10.5,CREAM);doc.text(lines(address,CW)[0],M,y);y+=17;}
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)??DECKING_CATALOGUE[0];
  font('helvetica',9,MIST);doc.text(lines([`${Math.round(estimate.model.quantities.area)} sq ft of deck`,data.levels>1?`${data.levels} levels`:'one level',`${material.name}, ${data.deckingColor}`,...(ledger.split?['with a backyard']:[])].join(' · '),CW)[0],M,y);
  rule(M,700,W-M,LINE_DARK,.6);
  [['Date',date],['Price book',priceBookLabel()],['Prepared by',contact.name]].forEach(([k,v],i)=>{
    const x=M+[0,.33,.7][i]*CW;font('helvetica',6.3,GOLD,'bold');spaced(k,x,714,1.6);font('helvetica',8.8,CREAM);doc.text(pdfText(v),x,728);
  });

  // 2. Views: the other cameras.
  const views=shots.slice(1,4);
  if(views.length){
    sheet('Views');heading('Views',`Your design from ${views.length===1?'another angle':`${views.length===2?'two':'three'} more angles`}.`);
    const caption=(t:string,x:number,top:number)=>{fill(GOLD_DEEP);doc.rect(x,top+4,4,4,'F');font('helvetica',7.5,INK2);doc.text(pdfText(t),x+10,top+9);};
    const put=(v:ProposalShot,x:number,w:number,h:number)=>{if(!image(v.src,x,y,w,h,'cover')){fill(SAGE);doc.rect(x,y,w,h,'F');}caption(v.label,x,y+h+2);};
    if(views.length===3){put(views[0],M,CW,285);y+=285+22;const w=(CW-14)/2;put(views[1],M,w,170);put(views[2],M+w+14,w,170);y+=170+22;}
    else for(const v of views){const h=views.length===2?235:380;put(v,M,CW,h);y+=h+22;}
    text(`${PROPOSAL_WORDS.illustration}s, drawn from your design in the 3D view.`,7.5,MUTED);
  }

  // 3. Lighting & features.
  sheet('Lighting & features');heading('Lighting & features','Everything in this design, as you built it.');
  const groups=proposalFeatures(data,facts);
  columns(groups.flatMap(g=>{
    font('helvetica',8.5,INK2);
    const items=g.items.map(item=>({t:item,n:lines(item,(CW-24)/2).length}));
    return [{h:24,keep:items[0]?items[0].n*11.6+7:0,draw:(x:number,w:number)=>{
      fill(GOLD_DEEP);doc.rect(x,y+5,6,6,'F');font('times',12.5,FOREST);doc.text(pdfText(g.title),x+12,y+12);rule(x,y+18,x+w,FOREST,.6);y+=22;
    }},...items.map((item,k)=>({h:item.n*11.6+7,draw:(x:number,w:number)=>{
      font('helvetica',8.5,INK2);lines(item.t,w).forEach((l,i)=>doc.text(l,x,y+10+i*11.6));y+=item.n*11.6+5;
      if(k<items.length-1)rule(x,y,x+w,RULE,.4);y+=2;
      if(k===items.length-1)y+=12;
    }}))];
  }));

  // 4. Materials & finishes: the swatch photos.
  sheet('Materials & finishes');heading('Materials & finishes','The manufacturer colours in your design, and where each one goes.');
  const tiles=proposalFinishes(data,estimate.model),per=tiles.length>12?5:tiles.length<=6?3:4,gap=16,tw=(CW-(per-1)*gap)/per;
  for(let i=0;i<tiles.length;i+=per){
    const row=tiles.slice(i,i+per),words=row.map(t=>{font('helvetica',7.8,INK2);const c=lines(t.collection,tw);font('helvetica',7,MUTED);return {c,u:lines(`${t.uses.join(' · ')}${t.note?` · ${t.note}`:''}`,tw)};});
    const textH=Math.max(...words.map(w=>14+w.c.length*10+w.u.length*9));
    room(tw+8+textH);
    row.forEach((t,k)=>{
      const x=M+k*(tw+gap),file=t.swatch&&input.swatches?.[t.swatch],hex=t.hex?rgbOf(t.hex):null;
      if(!image(file,x,y,tw,tw,'cover')){fill(hex??SAGE);doc.rect(x,y,tw,tw,'F');}
      stroke(FOREST);doc.setLineWidth(.6);doc.rect(x,y,tw,tw);
      let ty=y+tw+14;font('helvetica',9.2,FOREST,'bold');doc.text(lines(t.colour,tw)[0],x,ty);ty+=11;
      font('helvetica',7.8,INK2);words[k].c.forEach(l=>{doc.text(l,x,ty);ty+=10;});
      font('helvetica',7,MUTED);words[k].u.forEach(l=>{doc.text(l,x,ty);ty+=9;});
    });
    y+=tw+8+textH+10;
  }
  text(PROPOSAL_WORDS.colours,7.5,MUTED,{gap:0});

  // 5. The site plan, on vellum with its gold dimensions.
  sheet('Site plan');heading('Site plan',`${data.width} × ${data.length} ft deck against your house, ${data.height} in above grade.`);
  const planH=BOTTOM-y-24;
  stroke(FOREST);doc.setLineWidth(.6);doc.rect(M,y,CW,planH);
  if(!image(input.sitePlan,M+8,y+8,CW-16,planH-16,'contain')){font('helvetica',9,MUTED);doc.text(pdfText('The site plan could not be drawn on this device. Reopen the design to see it.'),M+12,y+20);}
  y+=planH+8;text('Dimensions in feet. Measurements and connections are confirmed on site.',7.5,MUTED);

  // 6. The investment, from the price schedule: lines in the engine's order, the totals, and what is still to be quoted.
  sheet('Investment');heading('Investment',`${PROPOSAL_WORDS.estimate} · ${priceBookLabel()} · CAD`);
  const head=()=>{font('helvetica',6.3,MUTED,'bold');spaced('Item',M,y+8,1.4);spaced('Amount',W-M,y+8,1.4,'right');y+=12;rule(M,y,W-M,FOREST,.6);y+=2;};
  head();
  for(const line of ledger.lines){
    font('helvetica',8.6,FOREST);const ls=lines(line.title,CW-150),h=ls.length*11.4+7;
    room(h,()=>{heading('Investment, continued');head();});
    font('helvetica',8.6,FOREST);ls.forEach((l,i)=>doc.text(l,M,y+10+i*11.4));
    if(line.quotes.length&&line.amount<.005)tag(line.quotes,W-M,y+10);
    else{font('helvetica',8.6,FOREST,'bold');doc.text(pdfText(line.text),W-M,y+10,{align:'right'});}
    y+=h;rule(M,y-2,W-M,RULE,.4);
  }
  const sums:[string,number,string?][]=[...(ledger.split?[['Deck subtotal',ledger.split.deck],['Backyard subtotal',ledger.split.backyard]] as [string,number][]:[]),[ledger.quotes.length?'Priced subtotal':'Subtotal',ledger.subtotal,PROPOSAL_WORDS.estimate],[ledger.hstTitle,ledger.hst],[ledger.totalLabel,ledger.total]];
  room(sums.length*17+62,()=>heading('Investment, continued'));y+=10;
  sums.forEach(([k,v,note],i)=>{
    const last=i===sums.length-1,sub=!!note;
    if(sub)rule(M,y,W-M,FOREST,.8);if(last)rule(M,y,W-M,GOLD_DEEP,1.6);
    if(last){font('times',13,FOREST);doc.text(pdfText(k),M,y+15);font('helvetica',12,FOREST,'bold');doc.text(dollars(v),W-M,y+15,{align:'right'});y+=24;return;}
    font('helvetica',9,FOREST,sub?'bold':'normal');doc.text(pdfText(k),M,y+12);doc.text(dollars(v),W-M,y+12,{align:'right'});
    if(note){font('helvetica',7.5,MUTED);doc.text(pdfText(note),M,y+22);y+=8;}
    y+=17;
  });
  text(`${PROPOSAL_WORDS.notFinal} ${priceBookLabel()} · CAD.`,7.5,MUTED,{gap:4});
  if(ledger.quotes.length){
    room(60,()=>heading('Investment, continued'));y+=12;
    font('times',12.5,FOREST);doc.text('Still to be quoted',M,y+12);y+=18;
    text(PROPOSAL_WORDS.quotesNote,7.5,MUTED,{gap:6});
    columns(ledger.quotes.map(q=>{
      const t=quoteTag([q.kind]).toUpperCase();font('helvetica',6.3,GOLD_INK,'bold');const tw=doc.getTextWidth(t)+.4*(t.length-1)+8;
      const words=(w:number)=>{font('helvetica',8,INK2);return lines(quoteLabel(q.label),w-tw-8);},n=words((CW-24)/2).length;
      return {h:n*10.4+5,draw:(x:number,w:number)=>{
        tag([q.kind],x+w,y+9);
        font('helvetica',8,INK2);words(w).forEach((l,k)=>doc.text(l,x,y+9+k*10.4));y+=n*10.4+5;
      }};
    }));
  }

  // 7. Next steps, on forest to close the presentation.
  sheet('Next steps',true);heading('Next steps');
  const steps:[string,string][]=[
    ['Send us your design','Use "Send my design" in the deck designer. It reaches our team with a link that reopens exactly what you built, plus a summary and this estimate.'],
    ['Book a call',`Talk it through with us at ${contact.book}. Book from your design, and the link comes with you.`],
    ['Confirm it on site','Measurements, connections and engineering are confirmed on site before your written quote.'],
  ];
  steps.forEach(([title,body],i)=>{
    font('helvetica',15,GOLD);doc.text(`0${i+1}`,M,y+16);
    font('times',14,CREAM);doc.text(pdfText(title),M+46,y+15);
    font('helvetica',9.5,MIST);const ls=lines(body,CW-60);ls.forEach((l,k)=>doc.text(l,M+46,y+31+k*13));
    y+=31+ls.length*13+12;rule(M,y,W-M,LINE_DARK,.6);y+=14;
  });
  y+=10;rule(M,y,W-M,GOLD,.7);y+=26;
  font('times',15,CREAM);doc.text(pdfText(contact.call),M,y);y+=17;
  font('helvetica',9,MIST);doc.text(pdfText(`${contact.email} · ${contact.site} · ${contact.area}`),M,y);
  const signY=BOTTOM-44;
  const markOk=input.logo?image(input.logo,M,signY,52,42,'contain'):false,sx=markOk?M+64:M;
  font('times',22,CREAM);doc.text(WORDMARK,sx,signY+22);
  font('helvetica',6.8,GOLD,'bold');spaced('Deck Studio',sx,signY+36,2.2);

  // 8. The appendix, in smaller type: what to confirm, the construction plan and the material list.
  sheet('Appendix');heading('Appendix','For you and your builder: what to confirm before construction, the construction plan and the modelled material list.');
  const sub=(title:string)=>{room(40);y+=6;font('times',12.5,FOREST);doc.text(pdfText(title),M,y+12);y+=17;rule(M,y,W-M,FOREST,.6);y+=8;};
  if(reviewItems.length){
    sub('Confirm before construction');
    columns(reviewItems.map(item=>{font('helvetica',7.4,INK2);const n=lines(item,(CW-24)/2-9).length;return {h:n*9.4+4,draw:(x:number,w:number)=>{
      fill(GOLD_DEEP);doc.rect(x,y+3.4,3.6,3.6,'F');font('helvetica',7.4,INK2);lines(item,w-9).forEach((l,k)=>doc.text(l,x+9,y+7.5+k*9.4));y+=n*9.4+4;
    }};}));
  }
  sheet('Appendix · construction plan');sub('Construction plan');
  text('Drawn from the same design model as the estimate. Dimensions and connections need site confirmation before construction.',7.5,MUTED,{gap:6});
  const boxH=BOTTOM-y-4;stroke(FOREST);doc.setLineWidth(.6);doc.rect(M,y,CW,boxH);
  if(!image(input.plan,M+6,y+6,CW-12,boxH-12,'contain')){font('helvetica',9,MUTED);doc.text(pdfText('The construction plan could not be drawn on this device. Reopen the design to see it.'),M+12,y+20);}
  y+=boxH;
  sheet('Appendix · material list');sub('Material and hardware list');
  text('Quantities follow the modelled parts. Items without a confirmed rate are listed for a quote and are not in the estimate.',7.5,MUTED,{gap:6});
  const materialBlocks=estimate.sections.filter(s=>!/^HST/.test(s.title)).flatMap(s=>{
    const items=s.items.filter(i=>Number(i.qty)>0);if(!items.length)return [];
    font('helvetica',8.2,FOREST,'bold');const titleN=lines(s.title,(CW-24)/2).length;
    const rows=items.map(item=>{
      const label=`${item.name}${item.spec?` - ${item.spec}`:''}`,qty=`${item.qty} ${item.unit}`,quote:QuoteKind|null=item.cost===null?(isBuilderQuote(item)?'builder':'supplier'):null;
      font('helvetica',7.2,INK2);const n=lines(label,(CW-24)/2-70).length+(quote?1:0);
      return {h:n*9+5,draw:(x:number,w:number)=>{
        font('helvetica',7.2,INK2);const ls=lines(label,w-70);ls.forEach((l,k)=>doc.text(l,x,y+8+k*9));
        font('helvetica',7.2,FOREST,'bold');doc.text(pdfText(qty),x+w,y+8,{align:'right'});
        if(quote)tag([quote],x+w,y+8+ls.length*9+1);
        y+=n*9+3;rule(x,y,x+w,RULE,.3);y+=2;
      }};
    });
    // The section's title keeps its first item with it, so a title never ends a column.
    return [{h:titleN*10+6,keep:rows[0].h,draw:(x:number,w:number)=>{font('helvetica',8.2,FOREST,'bold');lines(s.title,w).forEach((l,k)=>doc.text(l,x,y+11+k*10));y+=titleN*10+6;}},...rows];
  });
  columns(materialBlocks);
  y+=10;room(20);rule(M,y,W-M,FOREST,.6);y+=4;
  text(`${contact.name} · ${contact.phone} · ${contact.email} · ${contact.site} · ${contact.area}`,7.5,INK2);

  // Every sheet after the cover: the running head, and the title strip with its page number.
  const pages=doc.getNumberOfPages();
  for(let p=2;p<=pages;p++){
    const s=sheets[p-1];doc.setPage(p);
    const ink=s.dark?CREAM:FOREST,soft=s.dark?MIST:INK2,gold=s.dark?GOLD:GOLD_INK,line=s.dark?MIST:FOREST;
    font('times',12.5,ink);doc.text(WORDMARK,M,48);
    const mw=doc.getTextWidth(WORDMARK);
    font('helvetica',5.8,gold,'bold');spaced('Deck Studio',M+mw+8,47.5,1.7);
    font('helvetica',7.5,soft);doc.text(pdfText(project),W-M,48,{align:'right'});
    rule(M,54,W-M,line,.6);
    stroke(line);doc.setLineWidth(.6);doc.rect(M,STRIP_Y,CW,STRIP_H);
    const cells:[string,string][]=[['Project',project],['Sheet',s.label],['Date',date],['No.',`Page ${p} of ${pages}`]],weights=[2.2,2.2,1.6,.9],total=weights.reduce((a,b)=>a+b,0);
    let x=M;
    cells.forEach(([k,v],i)=>{
      const cw=CW*weights[i]/total;if(i)doc.line(x,STRIP_Y,x,STRIP_Y+STRIP_H);
      font('helvetica',5.4,s.dark?GOLD:MUTED,'bold');spaced(k,x+6,STRIP_Y+9,1);
      font('helvetica',7.2,ink);doc.text(lines(v,cw-12)[0]??'',x+6,STRIP_Y+20);x+=cw;
    });
  }
  return doc.output('arraybuffer');
}
