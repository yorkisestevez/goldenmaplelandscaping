import {Link} from 'react-router-dom';
import {publicContact} from '../../../../data/business';
import ShareDesignLink from '../../ShareDesignLink';
import {dollars,shapeWords,type DeckEstimate,type DeckMaterial} from '../../designFacts';
import type {DeckData} from '../../types';
import {Field,type Update} from '../fields';
import PriceLedger from '../PriceLedger';
import {isBuilderQuote,type Ledger} from '../priceLedgerModel';

export interface EstimateStepProps{
  data:DeckData;update:Update;estimate:DeckEstimate;ledger:Ledger;material:DeckMaterial;railingName:string;
  designFacts:string[];wrapped:boolean;reviewFlags:string[];saved:boolean;preparing:boolean;pdfBusy:boolean;crewBusy?:boolean;
  customer?:boolean;
  onSend:()=>void;onOpenProposal:()=>void;onDownloadPdf:()=>void;onSaveJSON:()=>void;onDownloadSummary:()=>void;
  onExport:(kind:'dxf'|'obj'|'dae'|'glb'|'materials'|'cuts'|'connectors')=>void;onOpenPermit:()=>void;
  onCrewPack?:()=>void;onOpenJobs?:()=>void;onWarmShare?:()=>void;
}

/** The Proposal & files section: close pack (options → share → proposal → send), crew export, and contractor details. */
export default function EstimateStep({data,update,estimate,ledger,material,railingName,designFacts,wrapped,reviewFlags,saved,preparing,pdfBusy,crewBusy,customer,onSend,onOpenProposal,onDownloadPdf,onSaveJSON,onDownloadSummary,onExport,onOpenPermit,onCrewPack,onOpenJobs,onWarmShare}:EstimateStepProps){
  return <>
    <p>Your selected dimensions, materials, stairs, extras and backyard are priced using Golden Maple’s existing price book. Priced lines are planning allowances until a supplier or builder quote is recorded; products and work without a rate are listed for a quote.</p>
    <div className="dd-summary"><strong>{data.width} × {data.length} ft · {shapeWords(data,wrapped)}</strong><span>{material.name} · {data.deckingColor}</span><span>{data.stairFlights} stair flight(s) · {railingName} railing</span>{designFacts.map(fact=><span key={fact}>{fact}</span>)}</div>
    <PriceLedger ledger={ledger} variant="full"/>
    {!customer&&<p className="dd-note">Owners: use <strong>Review quote costs</strong> on the price bar to edit material markup, installation labour, and priced material lines.</p>}

    <section className="dd-close-pack" aria-labelledby="dd-close-pack-title">
      <h3 id="dd-close-pack-title">Close this design</h3>
      <p className="dd-note">Four steps from options to a sent lead. Skip any you do not need.</p>
      <ol className="dd-close-steps">
        <li>
          <strong>Options</strong>
          <p>Save Option A / Option B (or Essential / Premium / Complete) so you can compare before you share.</p>
          {onOpenJobs
            ?<button type="button" className="dd-secondary" onClick={onOpenJobs}>Open saved jobs &amp; options</button>
            :<p className="dd-note">In Designer mode (?designer=1), use Jobs to duplicate this design as Option A or Option B.</p>}
        </li>
        <li>
          <strong>Share</strong>
          <p>Copy a link that reopens this design. Name and address stay on this device.</p>
          <ShareDesignLink data={data} label="Copy design link" onWarm={onWarmShare}/>
        </li>
        <li>
          <strong>Proposal</strong>
          <p>Add your name and project address for the cover, then print or download the branded proposal.</p>
          <div className="dd-fields">
            <Field label="Your name"><input aria-label="Your name" type="text" maxLength={120} autoComplete="name" value={data.customerName} onChange={e=>update({customerName:e.target.value})}/></Field>
            <Field label="Project address"><input aria-label="Project address" type="text" maxLength={200} autoComplete="street-address" value={data.projectAddress} onChange={e=>update({projectAddress:e.target.value})}/></Field>
          </div>
          <div className="dd-summary-actions">
            <button className="dd-primary" onClick={onOpenProposal} disabled={preparing}>{preparing?'Preparing your proposal…':'Print proposal'}</button>
            <button className="dd-secondary" onClick={onDownloadPdf} disabled={pdfBusy}>{pdfBusy?'Making your PDF…':'Download PDF'}</button>
            <button className="dd-secondary" onClick={onSaveJSON}>Save design JSON</button>
            <button className="dd-secondary" onClick={onDownloadSummary}>{saved?'Download summary again':'Download summary'}</button>
          </div>
        </li>
        <li>
          <strong>Send</strong>
          <p>Your design, this estimate and a reopen link go straight to our team.</p>
          <div className="dd-summary-actions"><button type="button" className="dd-primary" onClick={onSend}>Send my design</button></div>
          <p className="dd-note">Prefer to talk? Call <a href={`tel:${publicContact.phoneTel}`}>{publicContact.phoneDisplay}</a> or <Link to="/contact">send us a message</Link>.</p>
        </li>
      </ol>
    </section>

    {reviewFlags.length>0&&<section aria-label="Construction review items"><h3>Confirm before construction</h3><ul className="dd-review-flags">{reviewFlags.map(flag=><li key={flag}>{flag}</li>)}</ul></section>}

    {!customer&&<>
      <h3>Crew &amp; contractor files</h3>
      <p className="dd-note">Download a build folder for the crew (cut list, connectors, materials, and the permit PDF/DXF), or open schedules and CAD exports below.</p>
      <div className="dd-summary-actions">
        {onCrewPack&&<button type="button" className="dd-secondary" onClick={onCrewPack} disabled={crewBusy}>{crewBusy?'Building crew pack…':'Download crew pack (ZIP)'}</button>}
        <button type="button" className="dd-secondary" onClick={onOpenPermit}>Open permit drawings</button>
      </div>
      <details className="dd-advanced"><summary>Connection schedule &amp; rate basis</summary><p>Quantities follow the modeled connections. Items needing a supplier quote are excluded from the estimate until their rate is confirmed.</p><div className="dd-takeoff-list"><section>{estimate.connectorSchedule.filter(row=>row.qty>0).map(row=><div key={row.name}><span>{row.name}<small>{row.basis}</small></span><strong className="dd-rate-note">{row.qty} {row.unit}<small>{row.rate===null?'Supplier quote required':dollars(row.rate)+' per '+row.unit}</small></strong></div>)}</section></div></details>
      {estimate.model.stairSupport&&<details className="dd-advanced"><summary>Stair support spacing &amp; manufacturer basis</summary><p className="dd-note">Modeled stringer spacing: {estimate.model.stairSupport.spacingIn} in on centre (requested {estimate.model.stairSupport.requestedSpacingIn} in). Status: {estimate.model.stairSupport.status.replaceAll('-',' ')}. This records the selected support basis; it does not certify the stair assembly.</p>{estimate.model.stairSupport.notes.map((note,i)=><p key={i} className="dd-note">{note}</p>)}{estimate.model.stairSupport.sourceUrl&&<a href={estimate.model.stairSupport.sourceUrl} target="_blank" rel="noreferrer">Manufacturer stair support reference ↗</a>}</details>}
      <details className="dd-advanced"><summary>Material stock &amp; cuts</summary><p>Cuts include saw kerf. Deck-board orders retain the existing waste allowance; other rows show their stated stock or per-riser allowance basis. Cut lengths are in inches; each group corresponds to one stock piece.</p>{estimate.stockSchedule.map((row,rowIndex)=><div key={row.section+row.name+rowIndex}><table className="dd-cut-table"><caption>{row.name} · {row.section}</caption><thead><tr><th>Stock length</th><th>Order quantity</th><th>Installed / ordered</th></tr></thead><tbody><tr><td>{row.stockLengthIn} in</td><td>{row.orderedPieces} pieces</td><td>{row.installedLf.toFixed(1)} / {row.orderedLf.toFixed(1)} ft</td></tr></tbody></table><details className="dd-cut-detail"><summary>Show {row.cutsIn.length} cutting groups</summary><p className="dd-note">{row.cutsIn.map((cuts,i)=>'#'+(i+1)+': '+cuts.map(n=>n.toFixed(2)).join(' + ')).join('; ')}</p></details>{row.unresolvedIn.length>0&&<p className="dd-error dd-note">Stock length needs confirmation: {row.unresolvedIn.map(n=>n.toFixed(1)+' in').join(', ')}</p>}</div>)}</details>
      <details className="dd-advanced"><summary>Permit drawings (planning set)</summary><p>G-0 code references, a site plan with the lot lines and setbacks, elevations, foundation, framing and guard plans, a typical section, construction details and schedules on 11 × 17 sheets, drawn to scale from this design with the sizes and code references a permit application asks for. As a PDF to print, or as a layered DXF for CAD. The municipality’s review decides what may be built.</p><div className="dd-summary-actions"><button type="button" className="dd-secondary" onClick={onOpenPermit}>Open permit drawings</button></div></details>
      <details className="dd-advanced"><summary>CAD &amp; 3D model exports</summary><p>3D DXF, OBJ and COLLADA use inches; GLB uses metres. The files use the current modeled parts. Hardware and lighting use schematic envelopes. These exports support design coordination and require engineering review before construction.</p><div className="dd-summary-actions"><button className="dd-secondary" onClick={()=>onExport('dxf')}>Download DXF</button><button className="dd-secondary" onClick={()=>onExport('obj')}>Download OBJ</button><button className="dd-secondary" onClick={()=>onExport('dae')}>Download COLLADA (.dae)</button><button className="dd-secondary" onClick={()=>onExport('glb')}>Download GLB</button><button className="dd-secondary" onClick={()=>onExport('materials')}>Materials CSV</button><button className="dd-secondary" onClick={()=>onExport('cuts')}>Cut list CSV</button><button className="dd-secondary" onClick={()=>onExport('connectors')}>Connectors CSV</button></div></details>
      <details className="dd-advanced"><summary>Full material and hardware list</summary><div className="dd-takeoff-list">{estimate.sections.map(s=><section key={s.title}><h3>{s.title}</h3>{s.items.filter(i=>Number(i.qty)>0).map((i,j)=><div key={j}><span>{i.name}<small>{i.spec}</small></span><strong>{i.qty} {i.unit}{i.cost===null&&!i.quoteResolved&&<small>{isBuilderQuote(i)?'Builder':'Supplier'} quote required</small>}</strong></div>)}</section>)}</div></details>
    </>}

    {saved&&<p role="status" className="dd-note">Your design summary has been downloaded. Save JSON preserves an importable design.</p>}
  </>;
}
