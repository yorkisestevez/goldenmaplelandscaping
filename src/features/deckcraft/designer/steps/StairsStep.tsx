import {availableStairSides} from '../../houseContact';
import {porchStairForDoor} from '../../lib/wrapGeometry';
import {RAILING_CATALOGUE} from '../../manufacturerCatalog';
import type {DeckData,GlassFinish,GlassMount} from '../../types';
import {GLASS_FINISHES,GLASS_FINISH_NAMES,GLASS_MOUNTS,glassFinishOf,glassMountOf} from '../../framelessGlass';
import {Suspense,lazy} from 'react';
import {Field,controlsFor,type Update} from '../fields';
import {loadDeckFinishesPanel} from '../sections';
import {isChamferEdgeId} from '../../lib/cornerChamfers';
import type {StairEdge} from './DimensionsStep';
import {RAILING_STYLES,STAIR_FLIGHTS,STAIR_LAYOUTS,catalogueRailingPatch} from '../optionGroups';
import {DeltaToggle,useOptionDeltas,type DeltaProps} from '../useOptionDeltas';

// The railing colour picker loads with the deck-part finishes panel, never with the page.
const RailingColourField=lazy(()=>loadDeckFinishesPanel().then(m=>({default:m.RailingColourField})));

/**
 * The Stairs & railings section: railing style, manufacturer railing and its colour, stair flights and layout, each
 * choice with its price effect (R6). The post and step lights are in the Lighting section, which the link at the end of
 * this section opens.
 */
export default function StairsStep({data,update,stairEdges,deltas}:{data:DeckData;update:Update;stairEdges:StairEdge[];deltas:DeltaProps}){
  const {number,select}=controlsFor(data,update);
  const effect=useOptionDeltas('stairs',data,deltas),railingEffect=effect.effect('catalogueRailing');
  const catalogueRail=RAILING_CATALOGUE.find(r=>r.id===data.catalogueRailingId);
  // Front entry: a street-side door facing a porch can take the primary stair straight off the porch.
  const doorStair=porchStairForDoor(data);
  return <><p>Stair dimensions and railing runs affect the materials and installation—not just the deck area.</p><DeltaToggle deltas={effect}/><div className="dd-fields">{select('railingType','Railing style',RAILING_STYLES,undefined,effect.effect('railingType'))}{data.railingType==='Frameless Glass'&&<><Field label="Glass railing mount" hint="Stairs always take a raked shoe or standoffs on the stringer, with a handrail on the glass."><select aria-label="Glass railing mount" value={glassMountOf(data)} onChange={e=>update({glassMount:e.target.value as GlassMount})}>{GLASS_MOUNTS.map(m=><option key={m} value={m}>{m}</option>)}</select></Field><Field label="Glass hardware finish"><select aria-label="Glass hardware finish" value={glassFinishOf(data)} onChange={e=>update({glassFinish:e.target.value as GlassFinish})}>{GLASS_FINISHES.map(f=><option key={f} value={f}>{GLASS_FINISH_NAMES[f]}</option>)}</select></Field><p className="dd-quote-notice">Supplier quote: the glass, shoe or spigots and handrail are listed, not priced. Installation is priced as for glass panels.</p></>}<Field label="Manufacturer railing system" hint="Brand-specific selections require a supplier quote." after={railingEffect?.line}><select aria-label="Manufacturer railing system" aria-describedby={railingEffect?.id} value={data.catalogueRailingId??''} onChange={e=>update(catalogueRailingPatch(e.target.value))}><option value="">Generic style / existing price-book allowance</option>{RAILING_CATALOGUE.map(r=><option key={r.id} value={r.id}>{r.name} — supplier quote</option>)}</select></Field>{catalogueRail&&<p className="dd-quote-notice">{catalogueRail.notes} <a href={catalogueRail.sourceUrl} target="_blank" rel="noreferrer">Manufacturer details ↗</a></p>}{catalogueRail&&<Suspense fallback={null}><RailingColourField data={data} update={update}/></Suspense>}<p className="dd-note">Railing quantities come from the modeled edges and stair flights.</p>{select('stairFlights','Number of stair flights',STAIR_FLIGHTS,undefined,effect.effect('stairFlights'))}{number('stairWidth','Stair width',36,120,'in')}{select('stairType','Stair layout',STAIR_LAYOUTS,undefined,effect.effect('stairType'))}{select('stairPosition','Primary stair location',availableStairSides(data))}{stairEdges.length>0&&<Field label="Stair edge" hint={data.shape==='Custom'?'Pick an edge of your outline (a 45° edge takes one straight flight), or follow the stair location':stairEdges.some(e=>isChamferEdgeId(e.id))?'Open the stair on an angled corner as one straight flight, or follow the stair location':'Pick a wing end or side, or follow the stair location'}><select aria-label="Stair edge" value={stairEdges.some(e=>e.id===data.stairEdgeId)?data.stairEdgeId:''} onChange={e=>update({stairEdgeId:e.target.value||undefined})}><option value="">Follow the stair location</option>{stairEdges.map(e=><option key={e.id} value={e.id}>{e.name} · {e.ft} ft</option>)}</select></Field>}{doorStair&&<div className="dd-summary-actions"><button type="button" className="dd-secondary" onClick={()=>update({stairEdgeId:doorStair.edgeId,stairOffset:Math.round(doorStair.offsetPct*10)/10})}>Line the stairs up with the street-side door</button></div>}{number('stairOffset','Position along the edge',0,100,'%')}{data.stairType!=='Straight'&&select('stairTurn','Stair turning direction',['Left','Right'])}{data.stairType==='Landing'&&number('landingDepthIn','Landing depth',36,120,'in',6)}</div>{data.stairFlights>1&&<p className="dd-note">All flights are included in pricing. The primary flight uses your chosen location; additional flights use the other deck edges.</p>}{data.stairType==='Winder'&&<p className="dd-note">Winder treads turn through the selected direction. Review the tread and connection notes in your estimate before construction.</p>}</>;
}
