import {useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import {ArrowLeft,Minus,Plus} from 'lucide-react';
import EstimateLeadCapture,{type EstimatePayload} from '../../components/EstimateLeadCapture';
import {designFromHash,designHash,readDeckArea,type EstimatorDeck} from '../deckcraft/estimatorHandoff';
import {cn} from '../../utils/cn';
import {QUICK_DECK_FT,QUICK_HEIGHTS,QUICK_MATERIALS,QUICK_RAILINGS,normalizeQuickDeck,quickDeckForArea,railingAllowed,type QuickDeck} from './quickDeck';
import type * as PriceEngine from './quickDeckPrice';

type Engine=typeof PriceEngine;

/**
 * The cost estimator's deck: a short form priced live by the deck designer's own engine, without the 3D designer (the
 * owner's private tool since 2026-11-11). The form draws at once; the engine loads beside it. `deck`: a deck on its own,
 * which the visitor can send as a written estimate or carry into a full backyard. `full`: a full backyard's deck, handed
 * back to the estimate with "Use this deck".
 */
export default function DeckQuickEstimator({mode,initialDesign,onBack,onUse}:{
  mode:'deck'|'full';
  /** The deck link (`#d=` payload) to open on: the backyard's own deck, else the address's shared deck. */
  initialDesign?:string;
  onBack:()=>void;
  onUse:(deck:EstimatorDeck)=>void;
}){
  const [engine,setEngine]=useState<Engine|null>(null),[engineFailed,setEngineFailed]=useState(false);
  // A shared or saved deck opens once the engine can read it; until then the form waits rather than show another deck.
  const [design]=useState(()=>initialDesign??(typeof window==='undefined'?null:designFromHash(window.location.hash)));
  const [deck,setDeck]=useState<QuickDeck>(()=>quickDeckForArea(typeof window==='undefined'?null:readDeckArea(window.location.search)));
  const [opening,setOpening]=useState(!!design);
  /** Said above the form when a linked deck could not be read, or holds more than the form can show. */
  const [notice,setNotice]=useState('');
  /** Whether the visitor changed anything here (an untouched backyard deck is handed back as it was). */
  const [edited,setEdited]=useState(false);
  const [busy,setBusy]=useState(false),[handOffError,setHandOffError]=useState('');
  const live=useRef(true);

  useEffect(()=>{
    live.current=true;window.scrollTo(0,0);
    import('./quickDeckPrice').then(m=>{if(live.current)setEngine(m);}).catch(()=>{if(live.current)setEngineFailed(true);});
    return()=>{live.current=false;};
  },[]);
  useEffect(()=>{
    if(!engine||!design)return;
    engine.openDesign(design)
      .then(({deck:opened,exact})=>{if(!live.current)return;setDeck(opened);if(!exact)setNotice(APPROXIMATED);})
      .catch(()=>{if(live.current)setNotice(UNREADABLE);})
      .finally(()=>{if(live.current)setOpening(false);});
  },[engine,design]);

  const price=useMemo(()=>engine&&!opening?engine.priceQuickDeck(deck):null,[engine,opening,deck]);
  const change=(patch:Partial<QuickDeck>)=>{setEdited(true);setDeck(prev=>normalizeQuickDeck({...prev,...patch}));};

  async function handOff(){
    if(!engine)return;
    // A backyard's own deck, opened and left as it was, stays exactly as the estimate had it (it may be a drawn design
    // the form can only approximate).
    if(mode==='full'&&initialDesign&&!edited){onBack();return;}
    setBusy(true);setHandOffError('');
    try{const linked=await engine.quickDeckWithLink(deck);if(live.current)onUse(linked);}
    catch{if(live.current)setHandOffError('Your deck could not be added just now. Please try again.');}
    finally{if(live.current)setBusy(false);}
  }

  const area=deck.width*deck.length;
  const disabled=!engine||opening;
  // A button, not a #link: a hash would add a history entry, and Back must close the deck estimator.
  const toSend=()=>document.getElementById(SEND_ID)?.scrollIntoView({behavior:'smooth',block:'start'});
  return <div className="pt-28 pb-40 lg:pb-32 bg-brand-nearblack min-h-screen text-brand-bonewhite" data-deck-estimator={price?'ready':'loading'}>
    <div className="max-w-[1180px] mx-auto px-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 font-sans text-[13px] text-brand-muted hover:text-brand-gold-dark mb-6">
        <ArrowLeft size={15} aria-hidden="true"/>{mode==='full'?'Back to your estimate':'Project types'}
      </button>
      <h1 className="font-display text-4xl md:text-5xl text-brand-bone tracking-tight mb-3">Price your deck</h1>
      <p className="font-sans font-light text-[16px] text-brand-muted max-w-2xl leading-relaxed mb-10">
        A few questions, and the price updates as you answer, from the same price book we quote from. No signup to see it.
      </p>
      {notice&&<p role="status" className="max-w-2xl -mt-4 mb-10 rounded-2xl border border-brand-gold-dark/40 bg-brand-gold/10 px-4 py-3 font-sans text-[14px] text-brand-ink leading-relaxed">{notice}</p>}
      {/* Phones read questions, price, then the send form; wide screens keep the price beside both, in view. */}
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <form className="min-w-0 space-y-9 lg:col-start-1" onSubmit={e=>e.preventDefault()} aria-busy={opening}>
          <Section title="Size" hint={`${area.toLocaleString('en-CA')} sq ft`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FeetStepper label="Width, along the house" value={deck.width} limits={QUICK_DECK_FT.width} disabled={opening} onValue={width=>change({width})}/>
              <FeetStepper label="Depth, out from the house" value={deck.length} limits={QUICK_DECK_FT.length} disabled={opening} onValue={length=>change({length})}/>
            </div>
          </Section>
          <Section title="Height above the ground">
            <Choices name="height" columns="grid-cols-2 sm:grid-cols-4" value={String(deck.height)} disabled={opening}
              options={QUICK_HEIGHTS.map(h=>({value:String(h.inches),label:h.label,hint:h.hint}))} onPick={v=>change({height:Number(v)})}/>
          </Section>
          <Section title="How it stands">
            <Choices name="deckType" columns="grid-cols-2" value={deck.deckType} disabled={opening}
              options={[{value:'Attached',label:'Attached',hint:'Fastened to the house'},{value:'Freestanding',label:'Freestanding',hint:'On its own posts'}]}
              onPick={v=>change({deckType:v as QuickDeck['deckType']})}/>
          </Section>
          <Section title="Decking">
            <Choices name="material" columns="grid-cols-1 sm:grid-cols-2" value={deck.material} disabled={opening}
              options={QUICK_MATERIALS.map(m=>({value:m.id,label:m.name,hint:m.tier}))} onPick={material=>change({material})}/>
          </Section>
          <Section title="Railing" hint={railingAllowed('None',deck.height)?undefined:'Required above 2 ft'}>
            <Choices name="railing" columns="grid-cols-2 sm:grid-cols-4" value={deck.railing} disabled={opening}
              options={QUICK_RAILINGS.map(r=>({value:r.value,label:r.label,disabled:!railingAllowed(r.value,deck.height)}))}
              onPick={v=>change({railing:v as QuickDeck['railing']})}/>
          </Section>
          <Section title="Stairs">
            <Choices name="stairs" columns="grid-cols-3" value={String(deck.stairs)} disabled={opening}
              options={[{value:'0',label:'None'},{value:'1',label:'One set'},{value:'2',label:'Two sets'}]} onPick={v=>change({stairs:Number(v) as QuickDeck['stairs']})}/>
          </Section>
          <Section title="Extras">
            <div className="grid gap-3 sm:grid-cols-3">
              <Toggle label="Picture-frame border" checked={deck.border} disabled={opening} onChange={border=>change({border})}/>
              <Toggle label="Skirting under the deck" checked={deck.skirting} disabled={opening} onChange={skirting=>change({skirting})}/>
              <Toggle label="Remove an old deck" checked={deck.removeOld} disabled={opening} onChange={removeOld=>change({removeOld})}/>
            </div>
          </Section>
        </form>

        <aside className="lg:sticky lg:top-28 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <PriceCard price={price} failed={engineFailed}>
            {mode==='full'
              ?<button type="button" disabled={disabled||busy} onClick={()=>void handOff()} className="btn-primary w-full disabled:opacity-60">{busy?'Adding…':'Use this deck in my estimate'}</button>
              :<>
                <button type="button" disabled={!price} onClick={toSend} className="btn-primary w-full disabled:opacity-60">Email me this estimate</button>
                <button type="button" disabled={disabled||busy} onClick={()=>void handOff()} className="w-full font-sans text-[13px] text-brand-gold-dark underline underline-offset-4 disabled:opacity-60">
                  {busy?'Adding…':'Add a patio, walls & more to this deck'}
                </button>
              </>}
            {handOffError&&<p role="alert" className="font-sans text-[13px] text-red-700">{handOffError}</p>}
          </PriceCard>
        </aside>
        {mode==='deck'&&engine&&price&&<SendEstimate engine={engine} deck={deck} price={price}/>}
      </div>
    </div>

    {/* Phones: the price stays in sight while the form scrolls. */}
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-brand-dim bg-brand-surface/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-4">
      <p className="font-sans text-[12px] text-brand-muted leading-tight">Your deck, with HST<br/>
        <strong className="font-display text-[22px] text-brand-ink tabular-nums">{price?money(price.totalCents,0):engineFailed?'—':'Pricing…'}</strong>
      </p>
      {mode==='full'
        ?<button type="button" disabled={disabled||busy} onClick={()=>void handOff()} className="btn-primary py-3 px-5 disabled:opacity-60">Use this deck</button>
        :<button type="button" disabled={!price} onClick={toSend} className="btn-primary py-3 px-5 disabled:opacity-60">Email it to me</button>}
    </div>
  </div>;
}

const SEND_ID='deck-estimate-send';
const APPROXIMATED='Your saved deck has details this form does not cover (such as its shape, levels, height, railing or materials), so this is the closest deck it can price. The price shown is for the deck as set here.';
const UNREADABLE='We could not open that deck link, so this is a starting deck. Set it to match yours.';
const money=(cents:number,digits:0|2=2)=>(cents/100).toLocaleString('en-CA',{style:'currency',currency:'CAD',minimumFractionDigits:digits,maximumFractionDigits:digits});

function PriceCard({price,failed,children}:{price:PriceEngine.QuickDeckPrice|null;failed:boolean;children:ReactNode}){
  const quote=price?.deck.quoteRequired??[];
  return <section aria-label="Your deck price" className="rounded-3xl border border-brand-dim bg-brand-surface p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.35)] space-y-4">
    <p className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark">Your deck</p>
    <div aria-live="polite" className="space-y-4">
      {price?<>
        <p className="font-sans text-[14px] text-brand-ink leading-relaxed">{price.deck.label}</p>
        <dl className="font-sans text-[14px] space-y-1.5 tabular-nums">
          <div className="flex justify-between gap-4 text-brand-muted"><dt>Subtotal</dt><dd>{money(price.deck.subtotalCents)}</dd></div>
          <div className="flex justify-between gap-4 text-brand-muted"><dt>HST (13%)</dt><dd>{money(price.hstCents)}</dd></div>
          <div className="flex justify-between gap-4 border-t border-brand-dim pt-2 text-brand-ink"><dt className="font-medium">Total</dt><dd className="font-display text-[26px] leading-none">{money(price.totalCents)}</dd></div>
        </dl>
        {quote.length>0&&<p className="font-sans text-[12px] text-brand-muted leading-relaxed">Not in this price, confirmed with your quote: {quote.join('; ')}.</p>}
      </>:<p role="status" className="font-sans text-[14px] text-brand-muted">{failed?'The price could not load. Check your connection and reopen the deck estimator.':'Pricing your deck…'}</p>}
    </div>
    <p className="font-sans text-[12px] text-brand-muted leading-relaxed">A planning price for the deck described, from our price book. Not a quote for your property: we confirm it after a site visit.</p>
    <div className="space-y-3">{children}</div>
  </section>;
}

/** A deck on its own goes out through the cost estimator's own lead form, with the link that reopens this deck. */
function SendEstimate({engine,deck,price}:{engine:Engine;deck:QuickDeck;price:PriceEngine.QuickDeckPrice}){
  const [linked,setLinked]=useState<{for:QuickDeck;deck:EstimatorDeck}|null>(null),[linkFailed,setLinkFailed]=useState(false);
  // The link is encoded as soon as the deck changes. The first one also loads the link's encoder, so the form waits for
  // it (or for its failure, which still lets the estimate go out, without a link); later ones take milliseconds.
  useEffect(()=>{
    let current=true;
    engine.quickDeckWithLink(deck).then(d=>{if(current)setLinked({for:deck,deck:d});}).catch(()=>{if(current)setLinkFailed(true);});
    return()=>{current=false;};
  },[engine,deck]);
  if(!linked&&!linkFailed)return <div id={SEND_ID} className="min-w-0 scroll-mt-28 lg:col-start-1"><p role="status" className="font-sans text-[14px] text-brand-muted">Preparing your estimate…</p></div>;
  const ready=linked?.for===deck?linked.deck:null;
  const material=QUICK_MATERIALS.find(m=>m.id===deck.material)!;
  const dollars=Math.round(price.deck.subtotalCents/100);
  const estimate:EstimatePayload={
    projectType:'deck',selectedElements:['deck'],totalLow:dollars,totalHigh:dollars,displayedLow:dollars,displayedHigh:dollars,
    brandName:material.name,city:'',sqft:deck.width*deck.length,hasPhotos:false,conditions:[],
    addOns:[deck.border&&'picture-frame border',deck.skirting&&'skirting',deck.removeOld&&'old deck removal'].filter((a):a is string=>!!a),
    details:{'deck.size':`${deck.width} x ${deck.length} ft`,'deck.height':`${deck.height} in`,'deck.type':deck.deckType,'deck.railing':deck.railing,'deck.stairs':String(deck.stairs)},
    preciseSubtotalCents:price.deck.subtotalCents,preciseHstCents:price.hstCents,preciseGrandTotalCents:price.totalCents,
    deck:ready??price.deck,
  };
  const permalink=ready?.design?`${window.location.origin}/cost-estimator?type=deck${designHash(ready.design)}`:undefined;
  return <div id={SEND_ID} className="min-w-0 scroll-mt-28 lg:col-start-1">
    <EstimateLeadCapture estimate={estimate} permalink={permalink}/>
  </div>;
}

function Section({title,hint,children}:{title:string;hint?:string;children:ReactNode}){
  const id=useId();
  return <fieldset aria-labelledby={id} className="min-w-0">
    <legend id={id} className="w-full flex items-baseline justify-between gap-4 mb-3">
      <span className="font-display text-[22px] text-brand-bone">{title}</span>
      {hint&&<span className="font-sans text-[13px] text-brand-muted tabular-nums">{hint}</span>}
    </legend>
    {children}
  </fieldset>;
}

interface Option{value:string;label:string;hint?:string;disabled?:boolean}
/** One choice among several, as native radio buttons styled as cards. */
function Choices({name,options,value,columns,disabled,onPick}:{name:string;options:readonly Option[];value:string;columns:string;disabled?:boolean;onPick:(value:string)=>void}){
  return <div className={cn('grid gap-3',columns)}>
    {options.map(o=><label key={o.value} className={cn(
      'relative flex flex-col gap-0.5 rounded-2xl border px-4 py-3 cursor-pointer transition-colors',
      'has-checked:bg-brand-gold/10 has-checked:border-brand-gold-dark has-checked:ring-1 has-checked:ring-brand-gold-dark',
      'border-brand-dim bg-brand-surface hover:border-brand-gold-dark has-focus-visible:ring-2 has-focus-visible:ring-brand-gold-dark',
      'has-disabled:opacity-45 has-disabled:cursor-not-allowed has-disabled:hover:border-brand-dim',
    )}>
      <input type="radio" name={name} value={o.value} checked={value===o.value} disabled={disabled||o.disabled} onChange={()=>onPick(o.value)} className="sr-only"/>
      <span className="font-sans text-[14px] font-medium text-brand-ink leading-snug">{o.label}</span>
      {o.hint&&<span className="font-sans text-[12px] text-brand-muted leading-snug">{o.hint}</span>}
    </label>)}
  </div>;
}

function Toggle({label,checked,disabled,onChange}:{label:string;checked:boolean;disabled?:boolean;onChange:(checked:boolean)=>void}){
  return <label className={cn(
    'flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-colors',
    'border-brand-dim bg-brand-surface hover:border-brand-gold-dark has-checked:bg-brand-gold/10 has-checked:border-brand-gold-dark has-focus-visible:ring-2 has-focus-visible:ring-brand-gold-dark',
  )}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)} className="w-4 h-4 accent-brand-gold-dark"/>
    <span className="font-sans text-[14px] text-brand-ink">{label}</span>
  </label>;
}

/** Whole feet between − and +; typing a number commits on blur or Enter, held to the limits. */
function FeetStepper({label,value,limits,disabled,onValue}:{label:string;value:number;limits:{min:number;max:number};disabled?:boolean;onValue:(feet:number)=>void}){
  const id=useId(),[draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  const commit=()=>{const n=Number(draft.trim());if(draft.trim()&&Number.isFinite(n))onValue(n);else setDraft(String(value));};
  const name=label.split(',')[0].toLowerCase();
  return <div className="rounded-2xl border border-brand-dim bg-brand-surface px-4 py-3">
    <label htmlFor={id} className="block font-sans text-[13px] text-brand-muted mb-2">{label}</label>
    <div className="flex items-center gap-3">
      <button type="button" aria-label={`Decrease ${name}`} disabled={disabled||value<=limits.min} onClick={()=>onValue(value-1)} className="w-10 h-10 rounded-full border border-brand-dim flex items-center justify-center text-brand-ink hover:border-brand-gold-dark disabled:opacity-40"><Minus size={16} aria-hidden="true"/></button>
      <input id={id} type="text" inputMode="numeric" value={draft} disabled={disabled} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}}}
        className="w-16 text-center font-display text-[24px] text-brand-ink bg-transparent border-b border-brand-dim focus:border-brand-gold-dark outline-none tabular-nums"/>
      <span className="font-sans text-[14px] text-brand-muted">ft</span>
      <button type="button" aria-label={`Increase ${name}`} disabled={disabled||value>=limits.max} onClick={()=>onValue(value+1)} className="w-10 h-10 rounded-full border border-brand-dim flex items-center justify-center text-brand-ink hover:border-brand-gold-dark disabled:opacity-40"><Plus size={16} aria-hidden="true"/></button>
    </div>
  </div>;
}
