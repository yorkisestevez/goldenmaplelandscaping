import type {DrawItem} from './drawingTypes';

/** Verification records an exact clause and its applicability, not a link to a code landing page. */
export interface CodeReference{
  id:string;
  subject:string;
  citation:string;
  sourceUrl:string;
  status:'verified'|'confirm';
  verification?:{edition:string;clauseEvidenceUrl:string;checkedBy:string;checkedOn:string;applicability:string};
}

const OBC='https://www.ontario.ca/page/ontarios-building-code';

/** Public source locations; exact clauses and local applicability remain open for review. */
export const CODE_REFERENCES:readonly CodeReference[]=[
  {id:'joists',subject:'Joist spans',citation:'OBC 2024, Table 9.23.4.2.-A (Article 9.23.4.2.)',sourceUrl:OBC,status:'confirm'},
  {id:'beams',subject:'Three-ply beam spans',citation:'OBC 2024, Table 9.23.4.2.-H (Article 9.23.4.2.)',sourceUrl:OBC,status:'confirm'},
  {id:'blocking',subject:'Joist bridging',citation:'OBC 2024, Article 9.23.9.4.',sourceUrl:OBC,status:'confirm'},
  {id:'posts',subject:'Wood post size',citation:'OBC 2024, Article 9.17.4.1.',sourceUrl:OBC,status:'confirm'},
  {id:'guards',subject:'Guard height',citation:'OBC 2024, Articles 9.8.8.1. and 9.8.8.3.',sourceUrl:OBC,status:'confirm'},
  {id:'stairs',subject:'Private stair geometry',citation:'OBC 2024, Table 9.8.4.1. and Article 9.8.7.1.',sourceUrl:OBC,status:'confirm'},
  {id:'barrie',subject:'Local deck details',citation:'City of Barrie, Deck Specs (cites OBC 9.8.8.1.(1), 9.8.8.3., SB-7, 9.8.4.2.)',sourceUrl:'https://www.barrie.ca/media/4040',status:'confirm'},
  {id:'springwater',subject:'Two-ply beam spans',citation:'Township of Springwater, Building Guide - Decks, March 2026',sourceUrl:'https://www.springwater.ca/media/qkdb5m4z/deck-guide-march-2026.pdf',status:'confirm'},
];

export function validateCodeReferences(refs:readonly CodeReference[]=CODE_REFERENCES):void{
  const ids=new Set<string>();
  for(const ref of refs){
    if(ids.has(ref.id))throw new Error(`Duplicate code reference: ${ref.id}`);
    ids.add(ref.id);
    if(ref.status==='verified'&&(!ref.verification?.edition||!ref.verification.clauseEvidenceUrl||!ref.verification.checkedBy||!/^\d{4}-\d{2}-\d{2}$/.test(ref.verification.checkedOn)||!ref.verification.applicability)){
      throw new Error(`Code reference ${ref.id} cannot be verified without clause evidence, edition, reviewer, date and applicability.`);
    }
  }
}

export const unverifiedCodeReferences=()=>CODE_REFERENCES.filter(ref=>ref.status!=='verified');

/** A readable G-0 index and itemized register. Coordinates are converted from paper inches to drawing inches. */
export function codeNoteItems(origin:{x:number;y:number},reviewItems:readonly string[],ratio=48):DrawItem[]{
  const items:DrawItem[]=[],at=(x:number,y:number)=>({x:origin.x+x*ratio,y:origin.y+y*ratio});
  const line=(x:number,y:number,value:string,height=.125):void=>{items.push({kind:'text',layer:'A-ANNO-TEXT',at:at(x,y),text:value,height,anchor:'start'});};
  const rule=(x0:number,y:number,x1:number)=>items.push({kind:'line',layer:'A-ANNO-TEXT',a:at(x0,y),b:at(x1,y)});
  const wrap=(value:string,max:number):string[]=>{
    const result:string[]=[];let current='';
    for(const word of value.split(/\s+/)){if(current&&`${current} ${word}`.length>max){result.push(current);current=word;}else current=current?`${current} ${word}`:word;}
    if(current)result.push(current);return result;
  };
  line(0,.2,'GENERAL NOTES  /  CODE REFERENCE AND REVIEW REGISTER',.19);
  line(0,.46,'Planning set. Confirm every open item before using these drawings for a permit or construction.',.125);
  rule(0,.57,11.6);
  line(0,.83,'CODE REFERENCES  ·  exact clause review open',.15);
  line(6.15,.83,`OTHER REVIEW ITEMS  ·  ${reviewItems.filter(i=>!i.startsWith('Code reference:')).length} open`,.15);
  rule(0,.94,11.6);
  let y=1.18;
  CODE_REFERENCES.forEach((ref,i)=>{
    line(0,y,`C-${String(i+1).padStart(2,'0')}  ${ref.subject} — ${ref.citation}${ref.status==='confirm'?' (confirm)':''}`,.125);y+=.19;
    line(.42,y,ref.status==='verified'?'Verified; see recorded evidence.':'ACTION  Check exact clause, edition and local applicability.',.115);y+=.38;
  });
  y+=.06;rule(0,y,5.85);y+=.24;
  line(0,y,'SOURCE DOCUMENTS',.13);y+=.19;
  for(const source of [
    ['Ontario Building Code',OBC],
    ['Barrie Deck Specs','https://www.barrie.ca/media/4040'],
    ['Springwater deck guide','https://www.springwater.ca/media/qkdb5m4z/deck-guide-march-2026.pdf'],
  ]){
    line(0,y,source[0],.115);y+=.16;
    for(const part of wrap(source[1],78)){line(.18,y,part,.105);y+=.16;}
    y+=.09;
  }
  const other=reviewItems.filter(i=>!i.startsWith('Code reference:'));
  y=1.14;
  line(6.15,y,'ACTION  Site: enter survey and confirm setbacks. Design: resolve the condition.',.105);y+=.26;
  other.forEach((item,i)=>{
    const id=`R-${String(i+1).padStart(2,'0')}`;
    const printable=item.replace(/\bapproved\b/gi,'specified').replace(/\bengineered\b/gi,'designed');
    for(const [j,part] of wrap(`${id}  ${printable}`,78).entries()){line(j?6.42:6.15,y,part,.115);y+=.16;}
    y+=.09;
  });
  if(!other.length)line(6.15,y,'No additional design or site review items.',.12);
  const bottom=Math.max(y,7.95);rule(0,bottom,11.6);
  line(0,bottom+.22,'Authority review: zoning, loads, soil, frost depth, connections and site dimensions.',.12);
  line(6.15,bottom+.22,'Status remains DRAFT until every C- and R-item is resolved.',.12);
  return items;
}
