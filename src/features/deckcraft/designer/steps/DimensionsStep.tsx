import {Suspense,lazy} from 'react';
import {defaultLevel3} from '../../designPersistence';
import {wrapBlockers,wrapHips,type activeWrap,WRAP_PORCH_DEPTH_FT,WRAP_PORCH_RUN_FT,WRAP_RUN_FT,WRAP_WING_WIDTH_FT} from '../../lib/wrapGeometry';
import {activeCornerChamfers,chamferFaceFt,CORNER_CHAMFER_FT,describeChamfers} from '../../lib/cornerChamfers';
import type {DeckData,DeckShape,HouseConfig} from '../../types';
import {Field,NumberField,controlsFor,type Update} from '../fields';
import {chooseShape,porchKey,setPorch,setPorchSize,setWing,setWingSize,splitLevel,wrapFix,wrapFixNames,wrapFixStatus} from '../deckShapeActions';

export type StairEdge={id:string;name:string;ft:string};

// Only a custom outline needs the editor, so it loads when one is chosen.
const OutlineEditor=lazy(()=>import('../OutlineEditor'));
const SHAPES:[DeckShape,string][]=[['Rectangle','Rectangle'],['L-Shape','L-Shape'],['Multi-corner','Multi-corner'],['Curved','Curved'],['Custom','Custom outline']];

/** The Deck shape & size section: the footprint, shape, angled corners, levels and wrap-around. The house has its own section. */
export default function DimensionsStep({data,update,houseConfig,wrap,wrapStatus,setWrapStatus,stairEdges}:{data:DeckData;update:Update;houseConfig:HouseConfig;wrap:ReturnType<typeof activeWrap>;wrapStatus:string;setWrapStatus:(status:string)=>void;stairEdges:StairEdge[]}){
  const {number,select}=controlsFor(data,update);
  // The shape, wrap, porch and split-level changes are pure patches in deckShapeActions.ts; these apply them.
  const custom=data.shape==='Custom';
  // Wrap-around: side wings around one or both house corners, mitred on corner-to-corner hips.
  const wrapPaused=wrapBlockers(data),attachedDeck=data.deckType==='Attached'||data.deckType==='Add-on';
  const toggleWing=(side:'left'|'right',on:boolean)=>{const {patch,status}=setWing(data,houseConfig,side,on);setWrapStatus(status);update(patch);};
  const sizeWing=(side:'left'|'right',patch:Partial<{widthFt:number;runFt:number}>)=>{const next=setWingSize(data,side,patch);if(next)update(next);};
  const wrapHipNotes=wrap?wrapHips(wrap):[];
  const togglePorch=(side:'left'|'right',on:boolean)=>update(setPorch(data,houseConfig,side,on));
  const sizePorch=(side:'left'|'right',patch:Partial<{depthFt:number;runFt:number}>)=>{const next=setPorchSize(data,side,patch);if(next)update(next);};
  const hipNote=(h:{angleDeg:number;corner:'front'|'far'},want:string)=>Math.abs(h.angleDeg-45)<.5?`Mitred at 45°: the hip runs from the house corner to the outside corner.`:`Corner-to-corner hip at ${h.angleDeg.toFixed(0)}° to the ${h.corner==='front'?'back':'street-side'} wall. A true 45° mitre needs ${want}.`;
  const trimFt=(inches:number)=>(inches/12).toFixed(1).replace(/\.0$/,'');
  const wrapSection=<fieldset className="dd-wrap"><legend>Wrap around the house</legend>
    <p className="dd-note">Continue the deck around one or both house corners. A side wing is fastened to the house side wall with its own ledger, and each corner is mitred on a doubled hip from the house corner to the deck&apos;s outside corner.</p>
    {!attachedDeck&&<p className="dd-note">Attach the deck to the house (Attached or Add-on) to wrap it around a corner.</p>}
    {(['left','right'] as const).map(side=>{const wing=data.wrap?.[side],label=side==='left'?'Left':'Right',hip=wrapHipNotes.find(h=>h.side===side&&h.corner==='front'),farHip=wrapHipNotes.find(h=>h.side===side&&h.corner==='far'),porch=data.wrap?.[porchKey(side)],otherPorch=data.wrap?.[porchKey(side==='left'?'right':'left')];
      return <div key={side} className="dd-wrap-wing">
        <label className="dd-check"><input type="checkbox" checked={!!wing} disabled={!attachedDeck&&!wing} onChange={e=>toggleWing(side,e.target.checked)}/><span>Around the {side} corner</span></label>
        {wing&&<><div className="dd-fields">
          <NumberField label={`${label} wing width`} value={wing.widthFt} min={WRAP_WING_WIDTH_FT[0]} max={WRAP_WING_WIDTH_FT[1]} unit="ft" increment={0.5} hint="Out from the house side wall" onValue={widthFt=>sizeWing(side,{widthFt})}/>
          <NumberField label={`${label} wing run along the house`} value={porch?houseConfig.depthFt:wing.runFt} min={WRAP_RUN_FT[0]} max={houseConfig.depthFt} unit="ft" increment={0.5} disabled={!!porch} hint={porch?'Runs the full house depth to reach the porch':`Back from the deck-facing wall, up to the ${houseConfig.depthFt} ft house depth`} onValue={runFt=>sizeWing(side,{runFt})}/>
        </div>
        {hip&&<p className="dd-note" role="status">{hipNote(hip,`a ${data.length} ft wing (the deck depth)`)}</p>}
        <label className="dd-check"><input type="checkbox" checked={!!porch} disabled={!wrap} onChange={e=>togglePorch(side,e.target.checked)}/><span>Continue round the far corner as a porch<small>Along the street side of the house, with its own ledger on that wall.</small></span></label>
        {porch&&<><div className="dd-fields">
          <NumberField label={`${label} porch depth`} value={porch.depthFt} min={WRAP_PORCH_DEPTH_FT[0]} max={WRAP_PORCH_DEPTH_FT[1]} unit="ft" increment={0.5} hint="Out from the street-side wall" onValue={depthFt=>sizePorch(side,{depthFt})}/>
          <NumberField label={`${label} porch run along the street side`} value={porch.runFt} min={WRAP_PORCH_RUN_FT[0]} max={Math.max(WRAP_PORCH_RUN_FT[0],houseConfig.widthFt-3-(otherPorch?.runFt??0))} unit="ft" increment={0.5} hint={otherPorch?'The two porches stop at least 3 ft apart':`Up to ${houseConfig.widthFt-3} ft of the ${houseConfig.widthFt} ft house front`} onValue={runFt=>sizePorch(side,{runFt})}/>
        </div>
        {farHip&&<p className="dd-note" role="status">{hipNote(farHip,`a ${wing.widthFt} ft deep porch (the wing width)`)}</p>}</>}</>}
      </div>;})}
    {wrap?.left&&wrap.right&&<p className="dd-note" role="status">Deck width is set by the house: {trimFt(wrap.left.widthIn)} ft left wing + {houseConfig.widthFt} ft house + {trimFt(wrap.right.widthIn)} ft right wing = {trimFt(wrap.W)} ft.</p>}
    {(data.wrap?.porchLeft||data.wrap?.porchRight)&&<p className="dd-note">Porch wraps price labour at the two-corner wrap factor. The extra porch-wrap labour is listed for a builder quote until Golden Maple sets its rate.</p>}
    {wrapStatus&&<p className="dd-note" role="status">{wrapStatus}</p>}
    {data.wrap&&wrapPaused.length>0&&<div className="dd-quote-notice" role="status"><strong>The wrap-around is paused</strong><ul>{wrapPaused.map(r=><li key={r}>{r}</li>)}</ul>{attachedDeck&&<button type="button" className="dd-secondary" onClick={()=>{setWrapStatus(wrapFixStatus(wrapFixNames(data)));update(wrapFix(data));}}>Use a rectangle with straight boards</button>}</div>}
  </fieldset>;
  // Angled front corners: a 45° cut across either front corner, the same distance along the front and the side.
  const chamfers=activeCornerChamfers(data),wrapWanted=!!(data.wrap?.left||data.wrap?.right);
  const setCorner=(key:'frontLeftFt'|'frontRightFt',ft:number|undefined)=>{const next={...data.cornerChamfers};if(ft)next[key]=ft;else delete next[key];update({cornerChamfers:next.frontLeftFt||next.frontRightFt?next:undefined});};
  const faces=chamfers?[chamfers.leftIn>0&&`${chamferFaceFt(chamfers.leftIn)} ft front left`,chamfers.rightIn>0&&`${chamferFaceFt(chamfers.rightIn)} ft front right`].filter(Boolean) as string[]:[];
  const cornersSection=<fieldset className="dd-wrap dd-corners"><legend>Angled front corners (45°)</legend>
    <p className="dd-note">Cut either front corner at 45°. The cut runs the same distance along the front and along the side, and an angled beam carries the corner.</p>
    {wrapWanted&&<p className="dd-note">A wrap-around needs square front corners. Remove the wrap-around to angle them.</p>}
    <div className="dd-fields">{([['frontLeftFt','Front left'],['frontRightFt','Front right']] as const).map(([key,label])=>{const ft=data.cornerChamfers?.[key];return <div key={key}>
      <label className="dd-check"><input type="checkbox" checked={!!ft} disabled={wrapWanted&&!ft} onChange={e=>setCorner(key,e.target.checked?4:undefined)}/><span>Angle the {label.toLowerCase()} corner</span></label>
      {!!ft&&<NumberField label={`${label} corner cut`} value={ft} min={CORNER_CHAMFER_FT[0]} max={CORNER_CHAMFER_FT[1]} unit="ft" increment={0.5} hint="Along the front and along the side" onValue={v=>setCorner(key,v)}/>}
    </div>;})}</div>
    {chamfers&&<p className="dd-note" role="status">{describeChamfers(chamfers)}. Angled face{faces.length>1?'s':''}: {faces.join(', ')}.</p>}
    {!chamfers&&(data.cornerChamfers?.frontLeftFt||data.cornerChamfers?.frontRightFt)?<p className="dd-note" role="status">This deck is too small for angled corners, so they stay square.</p>:null}
  </fieldset>;
  const l3=data.levels>2?data.level3:undefined,setL3=(patch:Partial<NonNullable<DeckData['level3']>>)=>{if(l3)update({level3:{...l3,...patch}});};
  const levelsSection=<>
    <div className="dd-summary-actions"><button type="button" className="dd-secondary" onClick={()=>update(splitLevel(data))}>Make it a split level</button></div>
    <p className="dd-note">A split level adds a lower section one step down across the front, joined by a full-width step. You can adjust it below.</p>
    {data.levels>1&&<><h3>Second level</h3>
      <div className="dd-fields three">{number('width2','Second level width',4,40,'ft',0.5)}{number('length2','Second level depth',4,40,'ft',0.5)}{number('height2','Second level height',8,144,'in')}</div>
      <div className="dd-fields">{select('level2Position','Connect second level to',['Front','Left','Right'])}{stairEdges.length>0&&<Field label="Second level wrap edge" hint="Join it to a wing end or side"><select aria-label="Second level wrap edge" value={data.level2EdgeId??''} onChange={e=>update({level2EdgeId:e.target.value||undefined})}><option value="">Use the side above</option>{stairEdges.map(e=><option key={e.id} value={e.id}>{e.name} · {e.ft} ft</option>)}</select></Field>}{number('level2Offset','Second level alignment',0,100,'%')}</div>
      <label className="dd-check"><input type="checkbox" checked={!!data.level2FullStep} onChange={e=>update({level2FullStep:e.target.checked||undefined})}/><span>Full-width step between the main deck and the second level<small>The step or stair runs the whole shared edge. Up to three steps need no railing.</small></span></label>
      <p className="dd-note">The connection follows the height difference between the two sections. Move the section along its chosen edge with the alignment control. A section never runs into the house: it slides along the edge until it clears the wall.</p></>}
    {l3&&<><h3>Third level</h3>
      <div className="dd-fields three">
        <NumberField label="Third level width" value={l3.widthFt} min={4} max={40} unit="ft" increment={0.5} onValue={widthFt=>setL3({widthFt})}/>
        <NumberField label="Third level depth" value={l3.lengthFt} min={4} max={40} unit="ft" increment={0.5} onValue={lengthFt=>setL3({lengthFt})}/>
        <NumberField label="Third level height" value={l3.heightIn} min={8} max={144} unit="in" increment={1} onValue={heightIn=>setL3({heightIn})}/>
      </div>
      <div className="dd-fields">
        <Field label="Join the third level to"><select aria-label="Join the third level to" value={l3.parent} onChange={e=>setL3({parent:Number(e.target.value) as 1|2,edgeId:undefined})}><option value={1}>Main deck</option><option value={2}>Second level</option></select></Field>
        <Field label="Third level side"><select aria-label="Third level side" value={l3.position} onChange={e=>setL3({position:e.target.value as 'Front'|'Left'|'Right',edgeId:undefined})}>{(['Front','Left','Right'] as const).map(v=><option key={v} value={v}>{v}</option>)}</select></Field>
        {l3.parent===1&&stairEdges.length>0&&<Field label="Third level wrap edge" hint="Join it to a wing end or side"><select aria-label="Third level wrap edge" value={l3.edgeId??''} onChange={e=>setL3({edgeId:e.target.value||undefined})}><option value="">Use the side above</option>{stairEdges.map(e=><option key={e.id} value={e.id}>{e.name} · {e.ft} ft</option>)}</select></Field>}
        <NumberField label="Third level alignment" value={l3.offsetPct} min={0} max={100} unit="%" increment={1} onValue={offsetPct=>setL3({offsetPct})}/>
      </div>
      <label className="dd-check"><input type="checkbox" checked={!!l3.fullStep} onChange={e=>setL3({fullStep:e.target.checked||undefined})}/><span>Full-width step to the third level<small>The step or stair runs the whole shared edge.</small></span></label></>}
  </>;
  return <><p>Width and depth describe the structural framing footprint. Picture-framed decking uses your outer-frame overhang setting beyond the finished fascia (default 1½ in). Measure height up from grade.</p><div className="dd-fields three">{wrap?.left&&wrap.right?<NumberField label="Deck width" value={data.width} min={4} max={200} unit="ft" increment={0.5} disabled hint="Set by the wrap-around" onValue={()=>{}}/>:custom?<NumberField label="Deck width" value={data.width} min={4} max={60} unit="ft" increment={0.5} disabled hint="Set by the outline" onValue={()=>{}}/>:number('width','Deck width',4,60,'ft',0.5)}{custom?<NumberField label="Deck depth" value={data.length} min={4} max={60} unit="ft" increment={0.5} disabled hint="Set by the outline" onValue={()=>{}}/>:number('length','Deck depth',4,60,'ft',0.5)}{number('height','Height above ground',8,144,'in')}</div><div className="dd-fields">{select('deckType','How the deck connects',['Attached','Freestanding','Floating','Add-on'])}<Field label="Deck shape"><select aria-label="Deck shape" value={data.shape} onChange={e=>update(chooseShape(data,e.target.value as DeckShape))}>{SHAPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field></div>{['L-Shape','Multi-corner'].includes(data.shape)&&<div className="dd-fields">{number('cutoutWidth','Corner cutout width',0,data.width*0.8,'ft',0.5)}{number('cutoutLength','Corner cutout depth',0,data.length*0.8,'ft',0.5)}</div>}{data.shape==='Multi-corner'&&<div className="dd-fields">{number('cutoutWidth2','Second cutout width',0,(data.width-data.cutoutWidth)*0.8,'ft',0.5)}{number('cutoutLength2','Second cutout depth',0,data.length*0.8,'ft',0.5)}</div>}{data.shape==='Rectangle'&&cornersSection}{custom&&<Suspense fallback={<p className="dd-note" role="status">Loading the outline editor…</p>}><OutlineEditor data={data} update={update}/></Suspense>}<div className="dd-fields"><Field label="Number of levels" hint={custom?'A custom outline is one level':undefined}><select aria-label="Number of levels" value={data.levels} disabled={custom} onChange={e=>{const levels=Number(e.target.value);update({levels,...(levels===3&&!data.level3?{level3:defaultLevel3(data)}:{})});}}>{[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></Field></div>{wrapSection}{!custom&&levelsSection}</>;
}
