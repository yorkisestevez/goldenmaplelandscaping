import {useState} from 'react';
import {accentCollections,colourRef,deckColourRef} from '../boardFinishes';
import type {DeckTakeoff} from '../deckTakeoff';
import {fitInlay,INLAY_KIND_NAMES,INLAY_LIMITS,levelInlayContext,type InlayPlan} from '../lib/inlayGeometry';
import type {DeckData,DeckInlay,InlayFill} from '../types';
import {NumberField,type Update} from './fields';

const FILLS:[InlayFill,string][]=[['Straight','Front to back'],['Diagonal','At 45°'],['Herringbone','Herringbone']];

/**
 * Decorative inlays (loaded on demand, on the finish step): a framed rectangle or a diamond set into the decking,
 * with its own blocking underneath (inlayFraming.ts) and labour at existing rates. Each inlay shows whether it is
 * built; one that does not fit says why and can be fitted to the deck (moved toward the middle or to the nearest free
 * spot, then made smaller). A new inlay starts in the middle, or beside the inlays already there.
 */
export default function InlayEditor({data,update,model}:{data:DeckData;update:Update;model:DeckTakeoff}){
  const inlays=data.inlays??[],[message,setMessage]=useState('');
  const save=(next:DeckInlay[])=>{setMessage('');update({inlays:next.length?next:undefined});};
  const patch=(id:string,p:Partial<DeckInlay>)=>save(inlays.map(i=>i.id===id?{...i,...p}:i));
  const deckLevel=(n:number)=>model.levels.find(l=>(l.kind??'deck')==='deck'&&(l.index??0)+1===n);
  const planOf=(inlay:DeckInlay):InlayPlan|undefined=>deckLevel(inlay.level??1)?.inlays?.find(p=>p.id===inlay.id);
  const wrapped=!!model.levels[0]?.wrapZones;
  const main=deckColourRef(data),own=accentCollections(data)[0];
  const colours=accentCollections(data).flatMap(m=>m.colors.map(c=>({ref:colourRef(m.id,c.name),label:`${c.name} (${m.name})`}))).filter(c=>c.ref!==main);
  const add=(kind:DeckInlay['kind'])=>{
    if(inlays.length>=INLAY_LIMITS.max){setMessage(`A design holds up to ${INLAY_LIMITS.max} inlays.`);return;}
    let n=inlays.length+1;while(inlays.some(i=>i.id===`inlay-${n}`))n++;
    // A frame in another colour of the deck's own collection shows the inlay off; the inside matches the deck.
    const contrast=own.colors.find(c=>colourRef(own.id,c.name)!==main);
    const fresh:DeckInlay={id:`inlay-${n}`,kind,widthFt:kind==='rug'?6:4,depthFt:4,...(kind==='rug'?{pattern:'Herringbone' as const}:{}),...(contrast?{frame:colourRef(own.id,contrast.name)}:{})};
    // A new inlay goes in the middle, or the nearest free spot beside the inlays already there.
    const level=deckLevel(1),others=inlays.filter(i=>(i.level??1)===1&&planOf(i)?.status==='ok');
    save([...inlays,(level&&!wrapped&&!data.hasInlay?fitInlay(fresh,others,levelInlayContext(data,level)):null)??fresh]);
  };
  const fit=(inlay:DeckInlay)=>{
    const level=deckLevel(inlay.level??1);if(!level){setMessage('That inlay’s deck level is not in the design.');return;}
    const others=inlays.filter(i=>i.id!==inlay.id&&(i.level??1)===(inlay.level??1)&&planOf(i)?.status==='ok');
    const fitted=fitInlay(inlay,others,levelInlayContext(data,level));
    if(fitted)patch(inlay.id,fitted);else setMessage('There is no room for that inlay on its deck level, even at its smallest. Remove it or another inlay.');
  };
  const status=(inlay:DeckInlay)=>{
    if(wrapped&&(inlay.level??1)===1)return {ok:false,text:'Not built: inlays are not built on a wrap-around deck.',fixable:false};
    const plan=planOf(inlay);
    if(!plan)return {ok:false,text:'Not built: its deck level is not in the design.',fixable:false};
    if(plan.status==='ok')return {ok:true,text:`Built: ${plan.edgeFt.toFixed(1)} ft of fitted frame edge, ${plan.fillSqft.toFixed(1)} sq ft inside.`,fixable:false};
    return {ok:false,text:`Not built: ${plan.message}`,fixable:plan.status!=='blocked'};
  };
  return <section className="dd-inlays" aria-labelledby="dd-inlays-title">
    <h3 id="dd-inlays-title">Inlays</h3>
    <p className="dd-note">A framed rectangle or a diamond set into the decking, with its own blocking underneath. Labour uses existing rates: the frame’s fitted edge at the breaker-board rate, and a diagonal or herringbone inside at its pattern’s labour factor.</p>
    {data.hasInlay&&<p className="dd-quote-notice">Turn off the centre inlay stripe above to build inlays on the main deck.</p>}
    {wrapped&&<p className="dd-quote-notice">Inlays are not built on a wrap-around deck.</p>}
    <div className="dd-inlay-add"><button type="button" className="dd-secondary" onClick={()=>add('rug')}>Add a framed rectangle</button><button type="button" className="dd-secondary" onClick={()=>add('diamond')}>Add a diamond</button></div>
    {message&&<p className="dd-note" role="alert">{message}</p>}
    {inlays.map((inlay,k)=>{const n=k+1,s=status(inlay),[lo,hi]=inlay.kind==='rug'?INLAY_LIMITS.rugFt:INLAY_LIMITS.diamondFt,[olo,ohi]=INLAY_LIMITS.offsetFt;
      return <fieldset key={inlay.id} className="dd-inlay-card"><legend>Inlay {n}: {INLAY_KIND_NAMES[inlay.kind]}</legend>
        <div className="dd-fields">
          {inlay.kind==='rug'?<><NumberField label={`Inlay ${n} width`} value={inlay.widthFt} min={lo} max={hi} unit="ft" increment={.5} onValue={widthFt=>patch(inlay.id,{widthFt})}/><NumberField label={`Inlay ${n} depth`} value={inlay.depthFt} min={lo} max={hi} unit="ft" increment={.5} onValue={depthFt=>patch(inlay.id,{depthFt})}/></>
            :<NumberField label={`Inlay ${n} size`} value={inlay.widthFt} min={lo} max={hi} unit="ft" increment={.5} hint="Length of each side." onValue={v=>patch(inlay.id,{widthFt:v,depthFt:v})}/>}
          <NumberField label={`Inlay ${n} across from the middle`} value={inlay.dxFt??0} min={olo} max={ohi} unit="ft" increment={.5} hint="Positive is to the right." onValue={dxFt=>patch(inlay.id,{dxFt:dxFt||undefined})}/>
          <NumberField label={`Inlay ${n} out from the middle`} value={inlay.dyFt??0} min={olo} max={ohi} unit="ft" increment={.5} hint="Positive is toward the yard." onValue={dyFt=>patch(inlay.id,{dyFt:dyFt||undefined})}/>
          <label className="dd-field"><span>Frame rows</span><select aria-label={`Inlay ${n} frame rows`} value={inlay.frameRows??1} onChange={e=>patch(inlay.id,{frameRows:e.target.value==='2'?2:undefined})}><option value="1">1</option><option value="2">2</option></select></label>
          <label className="dd-field"><span>Inside boards</span><select aria-label={`Inlay ${n} inside boards`} value={inlay.pattern??'Straight'} onChange={e=>patch(inlay.id,{pattern:e.target.value==='Straight'?undefined:e.target.value as InlayFill})}>{FILLS.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
          {data.levels>1&&<label className="dd-field"><span>Deck level</span><select aria-label={`Inlay ${n} deck level`} value={inlay.level??1} onChange={e=>patch(inlay.id,{level:e.target.value==='1'?undefined:Number(e.target.value) as 2|3})}>{Array.from({length:data.levels},(_,i)=><option key={i} value={i+1}>{i===0?'Main deck':`Level ${i+1}`}</option>)}</select></label>}
          <label className="dd-field"><span>Frame colour</span><select aria-label={`Inlay ${n} frame colour`} value={inlay.frame??''} onChange={e=>patch(inlay.id,{frame:e.target.value||undefined})}><option value="">The deck colour</option>{colours.map(c=><option key={c.ref} value={c.ref}>{c.label}</option>)}</select></label>
          <label className="dd-field"><span>Inside colour</span><select aria-label={`Inlay ${n} inside colour`} value={inlay.fill??''} onChange={e=>patch(inlay.id,{fill:e.target.value||undefined})}><option value="">The deck colour</option>{colours.map(c=><option key={c.ref} value={c.ref}>{c.label}</option>)}</select></label>
        </div>
        <p className={s.ok?'dd-inlay-status':'dd-inlay-status dd-inlay-status-off'} role="status">{s.text}</p>
        <div className="dd-inlay-actions">{s.fixable&&<button type="button" className="dd-secondary" onClick={()=>fit(inlay)}>Fit to deck</button>}<button type="button" className="dd-secondary" aria-label={`Remove inlay ${n}`} onClick={()=>save(inlays.filter(i=>i.id!==inlay.id))}>Remove</button></div>
      </fieldset>;})}
  </section>;
}
