import {priceBookLabel} from './priceBook';
import {FENCE_STYLES,FROST_FOOTING_NOTE,POOL_ENCLOSURE_NOTE,POOL_OPENING_LIMIT_IN,fencePostCounts,runLengthIn,type FenceRun} from './fenceTypes';

/** Same shape as a public yard section. Amounts stay null: the price book has no fence, post, gate or footing rate. */
export interface FenceQuoteSection {id:string;label:string;amountCents:null;quantity:number;unit:string;note:string}

const unpriced=()=>`No fence, post, gate or footing rate is in ${priceBookLabel()}. Supplier quote required.`;

/** Quote-required rows for enabled fence runs. An empty or absent list adds nothing. */
export function fenceQuoteSections(data:{fences?:FenceRun[]}|null|undefined):FenceQuoteSection[]{
  const runs=(data?.fences??[]).filter(r=>r.enabled);
  if(!runs.length)return [];
  const posts=fencePostCounts(runs),rows:FenceQuoteSection[]=[],book=unpriced();
  for(const run of runs){
    const style=FENCE_STYLES[run.style],linear=Math.round(runLengthIn(run.points)/12*100)/100,n=posts.get(run.id)??0;
    const gapNote=run.style==='aluminum-picket'&&run.slatGapIn>POOL_OPENING_LIMIT_IN-0.062?` Picket openings are over 100 mm, which many pool-fence by-laws do not allow. Confirm before relying on this as a pool enclosure.`:'';
    rows.push({id:`${run.id}-supply`,label:`${run.name} — ${style.name} supply and installation`,amountCents:null,quantity:linear,unit:'ft',note:`${book} Linear feet follow the fence line and include gate openings. Height ${run.heightFt} ft, posts at ${run.postSpacingFt} ft, finish ${run.finish}.${gapNote}`});
    rows.push({id:`${run.id}-posts`,label:`${run.name} — posts`,amountCents:null,quantity:n,unit:'ea',note:`${book} Posts shared by two runs are counted on the first run only.`});
    rows.push({id:`${run.id}-footings`,label:`${run.name} — concrete post footings`,amountCents:null,quantity:n,unit:'ea',note:`${book} ${FROST_FOOTING_NOTE}`});
    for(const gate of run.gates){
      const hardware=[gate.selfClosing&&'self-closing',gate.latching&&'self-latching'].filter(Boolean).join(', ');
      rows.push({id:`${run.id}-gate-${gate.id}`,label:`${run.name} — ${gate.kind} gate`,amountCents:null,quantity:1,unit:'ea',note:`${book} Clear opening ${gate.widthIn} in${hardware?`, ${hardware}`:''}.`});
    }
    if(run.poolEnclosure)rows.push({id:`${run.id}-pool`,label:`${run.name} — pool enclosure review`,amountCents:null,quantity:1,unit:'planning flag',note:POOL_ENCLOSURE_NOTE});
  }
  return rows;
}
