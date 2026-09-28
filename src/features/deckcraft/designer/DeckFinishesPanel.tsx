import {colourRef,parseColourRef,partCollections} from '../boardFinishes';
import {railingColours,UNCONFIRMED_RAILING_LINES,type DeckPart} from '../deckPartFinishes';
import type {DeckTakeoff} from '../deckTakeoff';
import {RAILING_CATALOGUE} from '../manufacturerCatalog';
import {railingScreenHex} from '../railingScreenColours';
import type {DeckData,DeckFinishes} from '../types';
import {Field,MaterialSwatch,type Update} from './fields';

/** Saves part and railing colours; a part left at "match the decking" is left out, and nothing set saves nothing
 * (pruneDeckFinishes tidies the rest). A border colour replaces a Dark Slate border. */
function saveFinishes(data:DeckData,update:Update,patch:Partial<DeckFinishes>){
  update({deckFinishes:{...data.deckFinishes,...patch},...(patch.border&&data.borderFinish==='Dark Slate'?{borderFinish:'Matching' as const}:{})});
}
const PARTS:Record<DeckPart,{label:string;hint:string}>={
  border:{label:'Border boards colour',hint:'Ordered as their own boards at their collection’s price, in place of a Dark Slate border.'},
  fascia:{label:'Fascia colour',hint:'Fascia boards over the exposed rim, listed for a supplier quote: the price book has no fascia rate.'},
  treads:{label:'Stair tread colour',hint:'The stair allowance follows the dearer of the tread and riser choices; a line without a price makes the stairs a supplier quote.'},
  risers:{label:'Stair riser colour',hint:'The closed riser faces of every flight.'},
};

/**
 * Deck-part finishes (loaded on demand, on the finish step): the border boards, the fascia and the stair treads and
 * risers, each in a real product colour of the deck's own kind (composite with composite; a wood deck keeps its
 * species), supplier-quote lines included. Prices follow deckPartFinishes.ts; nothing is ever priced at $0.
 */
export default function DeckFinishesPanel({data,update,model}:{data:DeckData;update:Update;model:DeckTakeoff}){
  const collections=partCollections(data),own=collections[0];
  const border=data.pictureFrameRows>0||data.pattern==='Picture Frame',stairs=model.treads.length>0;
  const parts:DeckPart[]=[...(border?['border' as const]:[]),'fascia',...(stairs?['treads' as const,'risers' as const]:[])];
  const brand=(id:string)=>id.split('_')[0],mixed=parts.some(p=>{const r=data.deckFinishes?.[p],m=r&&parseColourRef(r)?.material;return m?brand(m.id)!==brand(own.id):false;});
  return <section className="dd-part-finishes" aria-labelledby="dd-part-finishes-title">
    <h3 id="dd-part-finishes-title">Deck-part finishes</h3>
    <p className="dd-note">{own.isComposite?'Give a part its own real product colour: any colour of your decking’s collection, or of another composite collection.':'A wood deck keeps its own species for every part.'} Colours vary by screen; confirm with samples.</p>
    <div className="dd-fields">{parts.map(part=>{
      const value=data.deckFinishes?.[part]??'',chosen=value?parseColourRef(value):null,{label,hint}=PARTS[part];
      return <div key={part} className="dd-part-finish">
        <Field label={label} hint={hint}><select aria-label={label} value={value} onChange={e=>saveFinishes(data,update,{[part]:e.target.value||undefined} as Partial<DeckFinishes>)}>
          <option value="">{part==='fascia'?'Not chosen (shown in the deck colour)':`Match the decking (${data.deckingColor})`}</option>
          {collections.map((m,i)=><optgroup key={m.id} label={`${m.name}${i===0?' · your decking':''}${m.costPerSqft===null?' · supplier quote':''}`}>{m.colors.map(c=><option key={c.name} value={colourRef(m.id,c.name)}>{c.name}</option>)}</optgroup>)}
        </select></Field>
        {chosen&&<span className="dd-part-swatch"><MaterialSwatch file={chosen.color.swatch} alt=""/>{chosen.color.name} · {chosen.material.name}{chosen.material.costPerSqft===null?' · supplier quote':''}</span>}
      </div>;
    })}</div>
    {mixed&&<p className="dd-quote-notice">A part from a different manufacturer than your decking: fastener compatibility, the board gap and the warranty are confirmed with the supplier before ordering.</p>}
  </section>;
}

/** The manufacturer railing system's own colours (on the stairs step). The rate is unchanged; the colour on screen is an
 * approximation. Lines not confirmed in Canada say so: the supplier confirms availability and any colour premium. */
export function RailingColourField({data,update}:{data:DeckData;update:Update}){
  const system=RAILING_CATALOGUE.find(r=>r.id===data.catalogueRailingId),colours=railingColours(system?.id);
  if(!system||!colours.length)return null;
  const chosen=colours.find(c=>c===data.deckFinishes?.railingColor),unconfirmed=UNCONFIRMED_RAILING_LINES.includes(system.id);
  return <>
    <Field label="Railing colour" hint="The manufacturer’s colours for this system. The railing rate is unchanged; the supplier confirms availability and any colour premium."><select aria-label="Railing colour" value={chosen??''} onChange={e=>saveFinishes(data,update,{railingColor:e.target.value||undefined})}>
      <option value="">Not chosen</option>{colours.map(c=><option key={c} value={c}>{c}</option>)}
    </select></Field>
    {chosen&&<p className="dd-railing-colour" role="status"><span className="dd-railing-chip" style={{background:railingScreenHex(system.id,chosen)}} aria-hidden="true"/><span>{chosen}: the colour on screen is illustrative; confirm with a sample.{unconfirmed?' This line is not confirmed as sold in Canada, so the supplier confirms availability and any colour premium.':''}</span></p>}
  </>;
}
