import InlayPresetPreview from './InlayPresetPreview';
import './inlayPlanEditor.css';
import {lazy,Suspense,useState} from 'react';
import {INLAY_PRESETS,createInlayPreset} from '../lib/inlayPresets';
const InlaySketchEditor=lazy(()=>import('../sketch/InlaySketchEditor'));
import {accentCollections,colourRef,contrastColour,deckColourRef} from '../boardFinishes';
import type {DeckTakeoff} from '../deckTakeoff';
import {fitInlay,INLAY_KIND_NAMES,INLAY_LIMITS,levelInlayContext,nextInlayId,type InlayPlan} from '../lib/inlayGeometry';
import type {DeckData,DeckInlay,InlayFill} from '../types';
import {NumberField,type Update} from './fields';

const FILLS:[InlayFill,string][]=[['Straight','Front to back'],['Diagonal','At 45°'],['Herringbone','Herringbone']];

/**
 * Decorative inlays (loaded on demand, on the finish step): a framed rectangle, a diamond, a band or a medallion set
 * into the decking, with its own framing underneath (inlayFraming.ts). Each inlay shows whether it is built; one
 * that does not fit says why and can be fitted to the deck (moved toward the middle or to the nearest free spot, then
 * made smaller) only when Fit to deck is explicitly chosen. Add arms placement on the plan without changing the design.
 */
export default function InlayEditor({data,update,model,onPlaceInlay,onlyId,hideAdd=false,pending=false}:{data:DeckData;update:Update;model:DeckTakeoff;onPlaceInlay?:(inlay:DeckInlay)=>void;onlyId?:string;hideAdd?:boolean;pending?:boolean}){
  const inlays=data.inlays??[],[message,setMessage]=useState(''),[drawing,setDrawing]=useState(false);
  const save=(next:DeckInlay[])=>{setMessage('');update({inlays:next.length?next:undefined});};
  const patch=(id:string,p:Record<string,unknown>)=>save(inlays.map(i=>i.id===id?{...i,...p} as DeckInlay:i));
  const deckLevel=(n:number)=>model.levels.find(l=>(l.kind??'deck')==='deck'&&(l.index??0)+1===n);
  const planOf=(inlay:DeckInlay):InlayPlan|undefined=>deckLevel(inlay.level??1)?.inlays?.find(p=>p.id===inlay.id);
  const wrapped=!!model.levels[0]?.wrapZones;
  const main=deckColourRef(data);
  const colours=accentCollections(data).flatMap(m=>m.colors.map(c=>({ref:colourRef(m.id,c.name),label:`${c.name} (${m.name})`}))).filter(c=>c.ref!==main);
  const add=(presetId:string)=>{
    if(inlays.length>=INLAY_LIMITS.max){setMessage(`A design holds up to ${INLAY_LIMITS.max} inlays.`);return;}
    if(!onPlaceInlay){setMessage('Open Inlays in the plan toolbar to choose a placement.');return;}
    onPlaceInlay(createInlayPreset(presetId,nextInlayId(inlays),contrastColour(data)));
  };
  const fit=(inlay:DeckInlay)=>{
    const level=deckLevel(inlay.level??1);if(!level){setMessage('That inlay’s deck level is not in the design.');return;}
    const others=inlays.filter(i=>i.id!==inlay.id&&(i.level??1)===(inlay.level??1)&&planOf(i)?.status==='ok');
    const fitted=fitInlay(inlay,others,levelInlayContext(data,level));
    if(fitted)save(inlays.map(i=>i.id===inlay.id?fitted:i));else setMessage('There is no room for that inlay on its deck level, even at its smallest. Remove it or another inlay.');
  };
  const status=(inlay:DeckInlay)=>{
    const plan=planOf(inlay);
    if(!plan)return {ok:false,text:'Not built: its deck level is not in the design.',fixable:false};
    if(plan.status!=='ok')return {ok:false,text:`Not built: ${plan.message}`,fixable:plan.status!=='blocked'};
    if(plan.band)return {ok:true,text:plan.band.rows?`Built: ${plan.band.boards} row${plan.band.boards===1?'':'s'} of the deck in the band’s colour, with no cutting.`:`Built: ${plan.edgeFt.toFixed(1)} ft of band, cut in like a breaker board.`,fixable:false};
    if(plan.quote)return {ok:true,text:`Built: ${plan.fillSqft.toFixed(1)} sq ft inside the frame, on solid blocking. Its labour is a builder quote.`,fixable:false};
    return {ok:true,text:`Built: ${plan.edgeFt.toFixed(1)} ft of fitted frame edge, ${plan.fillSqft.toFixed(1)} sq ft inside.`,fixable:false};
  };
  const colourSelect=(n:number,inlay:DeckInlay,key:'frame'|'fill',label:string)=><label className="dd-field"><span>{label}</span><select aria-label={`Inlay ${n} ${label.toLowerCase()}`} value={(key==='frame'?(inlay.kind==='band'?undefined:inlay.frame):inlay.fill)??''} onChange={e=>patch(inlay.id,{[key]:e.target.value||undefined})}><option value="">The deck colour</option>{colours.map(c=><option key={c.ref} value={c.ref}>{c.label}</option>)}</select></label>;
  const position=(n:number,inlay:Exclude<DeckInlay,{kind:'band'}>)=>{const [olo,ohi]=INLAY_LIMITS.offsetFt;return <>
    <NumberField label={`Inlay ${n} rotation`} value={inlay.rotationDeg??0} min={-360} max={360} unit="°" increment={15} onValue={rotationDeg=>patch(inlay.id,{rotationDeg:rotationDeg||undefined})}/>
    <NumberField label={`Inlay ${n} across from the middle`} value={inlay.dxFt??0} displayDecimals={5} min={olo} max={ohi} unit="ft" increment={.5} hint="Positive is to the right." onValue={dxFt=>patch(inlay.id,{dxFt:dxFt||undefined})}/>
    <NumberField label={`Inlay ${n} out from the middle`} value={inlay.dyFt??0} displayDecimals={5} min={olo} max={ohi} unit="ft" increment={.5} hint="Positive is toward the yard." onValue={dyFt=>patch(inlay.id,{dyFt:dyFt||undefined})}/></>;};
  const levelSelect=(n:number,inlay:DeckInlay)=>data.levels>1&&<label className="dd-field"><span>Deck level</span><select aria-label={`Inlay ${n} deck level`} value={inlay.level??1} onChange={e=>patch(inlay.id,{level:e.target.value==='1'?undefined:Number(e.target.value) as 2|3})}>{Array.from({length:data.levels},(_,i)=><option key={i} value={i+1}>{i===0?'Main deck':`Level ${i+1}`}</option>)}</select></label>;
  const fields=(n:number,inlay:DeckInlay)=>{
    if(inlay.kind==='band'){const [olo,ohi]=INLAY_LIMITS.offsetFt,[fewest,most]=INLAY_LIMITS.bandBoards;return <>
      <label className="dd-field"><span>Runs</span><select aria-label={`Inlay ${n} runs`} value={inlay.direction} onChange={e=>patch(inlay.id,{direction:e.target.value})}><option value="along">Front to back</option><option value="across">Across the deck</option></select></label>
      <label className="dd-field"><span>Boards wide</span><select aria-label={`Inlay ${n} boards wide`} value={inlay.boards} onChange={e=>patch(inlay.id,{boards:Number(e.target.value)})}>{Array.from({length:most-fewest+1},(_,i)=><option key={i} value={fewest+i}>{fewest+i}</option>)}</select></label>
      <NumberField label={`Inlay ${n} position from the middle`} value={inlay.atFt??0} displayDecimals={5} min={olo} max={ohi} unit="ft" increment={.5} hint={inlay.direction==='across'?'Positive is toward the yard.':'Positive is to the right.'} onValue={atFt=>patch(inlay.id,{atFt:atFt||undefined})}/>
      {levelSelect(n,inlay)}{colourSelect(n,inlay,'fill','Band colour')}</>;}
    if(inlay.kind==='medallion'){const [lo,hi]=INLAY_LIMITS.medallionFt;return <>
      <label className="dd-field"><span>Style</span><select aria-label={`Inlay ${n} style`} value={inlay.style} onChange={e=>patch(inlay.id,{style:e.target.value})}><option value="compass">Compass: eight wedges</option><option value="compass-rose">Compass rose</option><option value="sunburst">Sunburst</option><option value="round">Round: boards front to back</option></select></label>
      <NumberField label={`Inlay ${n} size`} value={inlay.diameterFt} min={lo} max={hi} unit="ft" increment={.5} hint="Across the medallion." onValue={diameterFt=>patch(inlay.id,{diameterFt})}/>
      {position(n,inlay)}{levelSelect(n,inlay)}{colourSelect(n,inlay,'frame','Frame colour')}{colourSelect(n,inlay,'fill','Inside colour')}
      {inlay.style==='compass'&&<p className="dd-note">Alternate wedges take the frame colour.</p>}</>;}
    if(inlay.kind==='custom'){
      const w=Math.max(...inlay.points.map(p=>p.x))-Math.min(...inlay.points.map(p=>p.x)),d=Math.max(...inlay.points.map(p=>p.y))-Math.min(...inlay.points.map(p=>p.y));
      return <><NumberField label={`Inlay ${n} width`} value={w/12} min={2} max={20} unit="ft" increment={.5} onValue={v=>patch(inlay.id,{points:inlay.points.map(p=>({...p,x:p.x*v*12/w}))})}/><NumberField label={`Inlay ${n} depth`} value={d/12} min={2} max={20} unit="ft" increment={.5} onValue={v=>patch(inlay.id,{points:inlay.points.map(p=>({...p,y:p.y*v*12/d}))})}/>{position(n,inlay)}{levelSelect(n,inlay)}<label className="dd-field"><span>Frame rows</span><select aria-label={`Inlay ${n} frame rows`} value={inlay.frameRows??1} onChange={e=>patch(inlay.id,{frameRows:Number(e.target.value)})}><option value="1">1</option><option value="2">2</option></select></label><label className="dd-field"><span>Inside boards</span><select aria-label={`Inlay ${n} inside boards`} value={inlay.pattern??'Straight'} onChange={e=>patch(inlay.id,{pattern:e.target.value})}>{FILLS.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>{colourSelect(n,inlay,'frame','Frame colour')}{colourSelect(n,inlay,'fill','Inside colour')}<p className="dd-note">Custom inlay · {inlay.points.length} corners. Fabrication and installation require a builder quote.</p></>;
    }
    const [lo,hi]=inlay.kind==='rug'?INLAY_LIMITS.rugFt:INLAY_LIMITS.diamondFt;return <>
      {inlay.kind==='rug'?<><NumberField label={`Inlay ${n} width`} value={inlay.widthFt} min={lo} max={hi} unit="ft" increment={.5} onValue={widthFt=>patch(inlay.id,{widthFt})}/><NumberField label={`Inlay ${n} depth`} value={inlay.depthFt} min={lo} max={hi} unit="ft" increment={.5} onValue={depthFt=>patch(inlay.id,{depthFt})}/></>
        :<NumberField label={`Inlay ${n} size`} value={inlay.widthFt} min={lo} max={hi} unit="ft" increment={.5} hint="Length of each side." onValue={v=>patch(inlay.id,{widthFt:v,depthFt:v})}/>}
      {position(n,inlay)}
      <label className="dd-field"><span>Frame rows</span><select aria-label={`Inlay ${n} frame rows`} value={inlay.frameRows??1} onChange={e=>patch(inlay.id,{frameRows:e.target.value==='2'?2:undefined})}><option value="1">1</option><option value="2">2</option></select></label>
      <label className="dd-field"><span>Inside boards</span><select aria-label={`Inlay ${n} inside boards`} value={inlay.pattern??'Straight'} onChange={e=>patch(inlay.id,{pattern:e.target.value==='Straight'?undefined:e.target.value as InlayFill})}>{FILLS.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
      {levelSelect(n,inlay)}{colourSelect(n,inlay,'frame','Frame colour')}{colourSelect(n,inlay,'fill','Inside colour')}</>;
  };
  return <section className="dd-inlays" aria-labelledby="dd-inlays-title">
    <h3 id="dd-inlays-title">Inlays</h3>
    <p className="dd-note">Choose a preset or sketch your own shape, then place it on the deck. Adjust its position, size, rotation and colours here. Board materials and support are included; medallions, custom shapes and rotated fabrication need a builder’s installation quote.</p>
    {data.hasInlay&&<p className="dd-quote-notice">Replace the centre inlay stripe above with a band to build inlays on the main deck.</p>}
    {wrapped&&<p className="dd-note">On a wrap-around, inlays sit on the main field; the wings keep their zone board runs.</p>}
    {!hideAdd&&<><div className="dd-inlay-add">{INLAY_PRESETS.map(p=><button key={p.id} type="button" className="dd-secondary" onClick={()=>add(p.id)}><InlayPresetPreview presetId={p.id}/><span>{p.id==='rectangle'?'Add a framed rectangle':p.id==='diamond'?'Add a diamond':p.id==='band'?'Add a band':p.id==='compass'?'Add a medallion':`Add ${p.label.toLowerCase()}`}</span></button>)}<button type="button" className="dd-secondary" onClick={()=>setDrawing(true)}>Draw a custom inlay</button></div><p className="dd-note">Choose a shape, then tap anywhere on a deck level to place it. Escape cancels without changing your design.</p></>}
    {drawing&&<Suspense fallback={<p role="status">Loading custom inlay drawing…</p>}><InlaySketchEditor open onClose={()=>setDrawing(false)} onComplete={(points,name)=>{setDrawing(false);onPlaceInlay?.({id:nextInlayId(inlays),kind:'custom',points,...(name?{name}:{}),...(contrastColour(data)?{frame:contrastColour(data)}:{})});}}/></Suspense>}
    {message&&<p className="dd-note" role="alert">{message}</p>}
    {inlays.filter(i=>!onlyId||i.id===onlyId).map(inlay=>{const n=inlays.findIndex(i=>i.id===inlay.id)+1,s=status(inlay);
      return <fieldset key={inlay.id} className="dd-inlay-card"><legend>Inlay {n}: {inlay.kind==='medallion'?`${inlay.style} medallion`:INLAY_KIND_NAMES[inlay.kind]}</legend>
        <div className="dd-fields">{fields(n,inlay)}</div>
        <p className={s.ok?'dd-inlay-status':'dd-inlay-status dd-inlay-status-off'} role="status">{pending?'Choose its size and finish, then tap the deck to place it.':s.text}</p>
        <div className="dd-inlay-actions">{!pending&&s.fixable&&<button type="button" className="dd-secondary" onClick={()=>fit(inlay)}>Fit to deck</button>}{!pending&&<button type="button" className="dd-secondary" aria-label={`Remove inlay ${n}`} onClick={()=>save(inlays.filter(i=>i.id!==inlay.id))}>Remove</button>}</div>
      </fieldset>;})}
  </section>;
}
