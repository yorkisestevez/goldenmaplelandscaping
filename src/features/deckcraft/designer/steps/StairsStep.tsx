import {availableStairSides} from '../../houseContact';
import {porchStairForDoor} from '../../lib/wrapGeometry';
import {RAILING_CATALOGUE} from '../../manufacturerCatalog';
import type {DeckData} from '../../types';
import {Suspense,lazy} from 'react';
import {Field,controlsFor,type Update} from '../fields';
import {loadDeckFinishesPanel} from '../sections';
import {isChamferEdgeId} from '../../lib/cornerChamfers';
import type {StairEdge} from './DimensionsStep';

// The railing colour picker loads with the deck-part finishes panel, never with the page.
const RailingColourField=lazy(()=>loadDeckFinishesPanel().then(m=>({default:m.RailingColourField})));

/**
 * The Stairs & railings section: railing style, manufacturer railing and its colour, stair flights and layout. The
 * post and step lights are in the Lighting section, which the link at the end of this section opens.
 */
export default function StairsStep({data,update,stairEdges}:{data:DeckData;update:Update;stairEdges:StairEdge[]}){
  const {number,select}=controlsFor(data,update);
  const catalogueRail=RAILING_CATALOGUE.find(r=>r.id===data.catalogueRailingId);
  // Front entry: a street-side door facing a porch can take the primary stair straight off the porch.
  const doorStair=porchStairForDoor(data);
  return <><p>Stair dimensions and railing runs affect the materials and installation—not just the deck area.</p><div className="dd-fields">{select('railingType','Railing style',['None','Wood Picket','Aluminum','Cable','Glass Panels','Fortress AL13','TT Classic','TT Impression'])}<Field label="Manufacturer railing system" hint="Brand-specific selections require a supplier quote."><select aria-label="Manufacturer railing system" value={data.catalogueRailingId??''} onChange={e=>{const rail=RAILING_CATALOGUE.find(r=>r.id===e.target.value);update(rail?{catalogueRailingId:rail.id,railingType:rail.baseType}:{catalogueRailingId:undefined});}}><option value="">Generic style / existing price-book allowance</option>{RAILING_CATALOGUE.map(r=><option key={r.id} value={r.id}>{r.name} — supplier quote</option>)}</select></Field>{catalogueRail&&<p className="dd-quote-notice">{catalogueRail.notes} <a href={catalogueRail.sourceUrl} target="_blank" rel="noreferrer">Manufacturer details ↗</a></p>}{catalogueRail&&<Suspense fallback={null}><RailingColourField data={data} update={update}/></Suspense>}<p className="dd-note">Railing quantities come from the modeled edges and stair flights.</p>{select('stairFlights','Number of stair flights',[0,1,2,3])}{number('stairWidth','Stair width',36,120,'in')}{select('stairType','Stair layout',['Straight','Landing','Winder'])}{select('stairPosition','Primary stair location',availableStairSides(data))}{stairEdges.length>0&&<Field label="Stair edge" hint={data.shape==='Custom'?'Pick an edge of your outline (a 45° edge takes one straight flight), or follow the stair location':stairEdges.some(e=>isChamferEdgeId(e.id))?'Open the stair on an angled corner as one straight flight, or follow the stair location':'Pick a wing end or side, or follow the stair location'}><select aria-label="Stair edge" value={stairEdges.some(e=>e.id===data.stairEdgeId)?data.stairEdgeId:''} onChange={e=>update({stairEdgeId:e.target.value||undefined})}><option value="">Follow the stair location</option>{stairEdges.map(e=><option key={e.id} value={e.id}>{e.name} · {e.ft} ft</option>)}</select></Field>}{doorStair&&<div className="dd-summary-actions"><button type="button" className="dd-secondary" onClick={()=>update({stairEdgeId:doorStair.edgeId,stairOffset:Math.round(doorStair.offsetPct*10)/10})}>Line the stairs up with the street-side door</button></div>}{number('stairOffset','Position along the edge',0,100,'%')}{data.stairType!=='Straight'&&select('stairTurn','Stair turning direction',['Left','Right'])}{data.stairType==='Landing'&&number('landingDepthIn','Landing depth',36,120,'in',6)}</div>{data.stairFlights>1&&<p className="dd-note">All flights are included in pricing. The primary flight uses your chosen location; additional flights use the other deck edges.</p>}{data.stairType==='Winder'&&<p className="dd-note">Winder treads turn through the selected direction. Review the tread and connection notes in your estimate before construction.</p>}</>;
}
