import './proWorkspace.css';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {DeckData,DeckShape,DeckType,HouseConfig} from '../../types';
import {getHouseConfig,clampHouseOpening,HOUSE_CLADDINGS,ROOF_FINISHES,ROOF_FINISH_LABELS} from '../../houseSettings';
import {newYardFeature} from '../../yardSettings';
import {applyYardStarter,type YardStarterPreset} from '../../yardDesignTools';
import {applyPoolCommand} from '../../poolEdits';
import type {PoolFeature} from '../../poolTypes';
import {optionGroups,type OptionGroupId} from '../optionGroups';
import {planShortcut} from '../planEditMath';
import type {SectionId} from '../sections';
import type {ProPage} from './proTypes';

export type WizardKind='deck'|'house'|'patio'|'pool';
const TITLES:Record<WizardKind,string>={deck:'Deck wizard',house:'House wizard',patio:'Patio wizard',pool:'Pool wizard'};

/** One step: its title and fields. The last step of every wizard reviews what will change. */
interface Step{title:string;body:ReactNode}
/** What a wizard builds: its steps, the review lines, and the change it makes (one undo step) or why it cannot. */
interface Plan{steps:Step[];review:[string,string][];patch:(data:DeckData)=>Partial<DeckData>;section:SectionId}

const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n));
function NumberInput({label,value,min,max,step=1,unit,onValue}:{label:string;value:number;min:number;max:number;step?:number;unit:string;onValue:(n:number)=>void}){
  return <label className="dd-pro-wizard-field"><span>{label} <small>({min}–{max} {unit})</small></span>
    <input type="number" inputMode="decimal" value={value} min={min} max={max} step={step} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))onValue(n);}} onBlur={()=>onValue(clamp(value,min,max))}/></label>;
}
function Choice<T extends string|number>({label,value,choices,onValue}:{label:string;value:T;choices:readonly {value:T;label:string}[];onValue:(v:T)=>void}){
  return <label className="dd-pro-wizard-field"><span>{label}</span>
    <select value={String(value)} onChange={e=>onValue(choices.find(c=>String(c.value)===e.target.value)!.value)}>{choices.map(c=><option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}</select></label>;
}
const plain=<T extends string|number>(values:readonly T[],label:(v:T)=>string=String)=>values.map(value=>({value,label:label(value)}));

/** The deck's choices come from the designer's own option groups, so picking one here makes the same change (and the
 * same price) as picking it in the section. */
function groupChoices(data:DeckData,section:SectionId,id:OptionGroupId){const g=optionGroups(section,data).find(o=>o.id===id)!;return g.choices;}
function useDeckPlan(data:DeckData):Plan{
  const [d,setD]=useState(()=>({shape:(data.shape==='Custom'?'Rectangle':data.shape) as Exclude<DeckShape,'Custom'>,width:data.width,length:data.length,height:data.height,deckType:data.deckType,
    foundation:data.foundation as string,collection:data.deckingMaterial,pattern:data.pattern as string,railingType:data.railingType as string,stairFlights:String(data.stairFlights)}));
  const set=(p:Partial<typeof d>)=>setD(o=>({...o,...p}));
  const pick=(section:SectionId,id:OptionGroupId,value:string)=>groupChoices(data,section,id).find(c=>c.value===value);
  const shapes:readonly Exclude<DeckShape,'Custom'>[]=['Rectangle','L-Shape','Multi-corner','Curved'];
  return {section:'deck',
    steps:[
      {title:'Shape and size',body:<>
        <Choice label="Deck shape" value={d.shape} choices={plain(shapes)} onValue={shape=>set({shape})}/>
        <NumberInput label="Deck width" value={d.width} min={4} max={60} step={0.5} unit="ft" onValue={width=>set({width})}/>
        <NumberInput label="Deck depth" value={d.length} min={4} max={60} step={0.5} unit="ft" onValue={length=>set({length})}/>
        <NumberInput label="Height above ground" value={d.height} min={8} max={144} unit="in" onValue={height=>set({height})}/></>},
      {title:'Connection and footings',body:<>
        <Choice label="How the deck connects" value={d.deckType} choices={plain<DeckType>(['Attached','Freestanding','Floating','Add-on'])} onValue={deckType=>set({deckType})}/>
        <Choice label="Foundation" value={d.foundation} choices={groupChoices(data,'site','foundation')} onValue={foundation=>set({foundation})}/></>},
      {title:'Boards',body:<>
        <Choice label="Decking collection" value={d.collection} choices={groupChoices(data,'boards','collection')} onValue={collection=>set({collection})}/>
        <Choice label="Board layout" value={d.pattern} choices={groupChoices(data,'boards','pattern')} onValue={pattern=>set({pattern})}/></>},
      {title:'Stairs and railings',body:<>
        <Choice label="Stair flights" value={d.stairFlights} choices={groupChoices(data,'stairs','stairFlights')} onValue={stairFlights=>set({stairFlights})}/>
        <Choice label="Railing style" value={d.railingType} choices={groupChoices(data,'stairs','railingType')} onValue={railingType=>set({railingType})}/></>},
    ],
    review:[['Shape',d.shape],['Size',`${d.width} × ${d.length} ft, ${d.height} in high`],['Connection',`${d.deckType} on ${d.foundation}`],
      ['Decking',`${pick('boards','collection',d.collection)?.label??d.collection}, ${d.pattern}`],['Stairs',pick('stairs','stairFlights',d.stairFlights)?.label??d.stairFlights],['Railing',d.railingType]],
    patch:current=>{
      const shape=d.shape===current.shape?{}:planShortcut(current,d.shape).patch??{};
      return {...shape,width:clamp(d.width,4,60),length:clamp(d.length,4,60),height:clamp(d.height,8,144),deckType:d.deckType,
        ...pick('site','foundation',d.foundation)?.patch,...pick('boards','collection',d.collection)?.patch,...pick('boards','pattern',d.pattern)?.patch,
        ...pick('stairs','stairFlights',d.stairFlights)?.patch,...pick('stairs','railingType',d.railingType)?.patch};
    }};
}
function useHousePlan(data:DeckData):Plan{
  const house=getHouseConfig(data);
  const [d,setD]=useState({widthFt:house.widthFt,depthFt:house.depthFt,storeys:house.storeys,roofShape:house.roofShape,roofFinish:house.roofFinish,cladding:house.cladding});
  const set=(p:Partial<typeof d>)=>setD(o=>({...o,...p}));
  return {section:'house',
    steps:[
      {title:'Size',body:<>
        <NumberInput label="House width" value={d.widthFt} min={12} max={100} unit="ft" onValue={widthFt=>set({widthFt})}/>
        <NumberInput label="House depth" value={d.depthFt} min={12} max={100} unit="ft" onValue={depthFt=>set({depthFt})}/>
        <Choice label="Storeys" value={d.storeys} choices={plain<1|2|3>([1,2,3])} onValue={storeys=>set({storeys})}/></>},
      {title:'Roof and walls',body:<>
        <Choice label="Roof shape" value={d.roofShape} choices={plain<HouseConfig['roofShape']>(['Gable','Hip','Flat'])} onValue={roofShape=>set({roofShape})}/>
        <Choice label="Roof finish" value={d.roofFinish} choices={plain(ROOF_FINISHES,f=>ROOF_FINISH_LABELS[f])} onValue={roofFinish=>set({roofFinish})}/>
        <Choice label="Wall cladding" value={d.cladding} choices={plain(HOUSE_CLADDINGS)} onValue={cladding=>set({cladding})}/>
        <p className="dd-note">The house's look is for the drawing and the proposal only; it never changes the price.</p></>},
    ],
    review:[['Size',`${d.widthFt} × ${d.depthFt} ft, ${d.storeys} storey${d.storeys===1?'':'s'}`],['Roof',`${d.roofShape}, ${ROOF_FINISH_LABELS[d.roofFinish]}`],['Walls',d.cladding]],
    // As the House section does: doors and windows stay inside the walls they are on.
    patch:current=>{const next:HouseConfig={...getHouseConfig(current),...d,widthFt:clamp(d.widthFt,12,100),depthFt:clamp(d.depthFt,12,100)};next.openings=next.openings.map(o=>clampHouseOpening(o,next));return {houseConfig:next};}};
}
function usePatioPlan():Plan{
  const [d,setD]=useState<{preset:YardStarterPreset;widthFt:number;depthFt:number}>({preset:'rectangle',widthFt:16,depthFt:12});
  const set=(p:Partial<typeof d>)=>setD(o=>({...o,...p}));
  const presets:{value:YardStarterPreset;label:string}[]=[{value:'rectangle',label:'Rectangle'},{value:'chamfered',label:'Clipped corners'},{value:'l-shape',label:'L-shape'},{value:'rounded',label:'Rounded corners'}];
  return {section:'backyard',
    steps:[{title:'Shape and size',body:<>
      <Choice label="Patio shape" value={d.preset} choices={presets} onValue={preset=>set({preset})}/>
      <NumberInput label="Patio width" value={d.widthFt} min={4} max={60} step={0.5} unit="ft" onValue={widthFt=>set({widthFt})}/>
      <NumberInput label="Patio depth" value={d.depthFt} min={4} max={60} step={0.5} unit="ft" onValue={depthFt=>set({depthFt})}/>
      <p className="dd-note">It goes on the lawn in front of the deck. Move it, reshape it and pick its pavers on the plan with Patios &amp; walls.</p></>}],
    review:[['Shape',presets.find(p=>p.value===d.preset)!.label],['Size',`${d.widthFt} × ${d.depthFt} ft`]],
    patch:current=>{
      if((current.yardFeatures?.length??0)>=20)throw Error('This design supports up to 20 yard features.');
      const patio=applyYardStarter({...newYardFeature('patio',current),widthFt:clamp(d.widthFt,4,60),depthFt:clamp(d.depthFt,4,60)},d.preset);
      return {yardFeatures:[...(current.yardFeatures??[]),patio]};
    }};
}
function usePoolPlan(data:DeckData):Plan{
  const patios=(data.yardFeatures??[]).filter(f=>f.kind==='patio'&&f.enabled);
  const [d,setD]=useState<{poolType:PoolFeature['type'];shape:'rectangle'|'rounded-rectangle';patioId:string}>({poolType:'fiberglass',shape:'rectangle',patioId:''});
  const set=(p:Partial<typeof d>)=>setD(o=>({...o,...p}));
  const types:{value:PoolFeature['type'];label:string}[]=[{value:'fiberglass',label:'Fiberglass'},{value:'vinyl-liner',label:'Vinyl liner'},{value:'concrete',label:'Concrete'}];
  const places=[{value:'',label:'On the lawn behind the deck'},...patios.map(p=>({value:p.id,label:`In ${p.name}`}))];
  return {section:'backyard',
    steps:[{title:'Pool',body:<>
      <Choice label="Pool type" value={d.poolType} choices={types} onValue={poolType=>set({poolType})}/>
      <Choice label="Pool shape" value={d.shape} choices={[{value:'rectangle' as const,label:'Rectangle'},{value:'rounded-rectangle' as const,label:'Rounded rectangle'}]} onValue={shape=>set({shape})}/>
      <Choice label="Where it goes" value={d.patioId} choices={places} onValue={patioId=>set({patioId})}/>
      <p className="dd-note">A 16 × 32 ft planning pool. Size, depth and coping are set in Pools &amp; backyard; the pool itself is quoted.</p></>}],
    review:[['Pool',`${types.find(t=>t.value===d.poolType)!.label}, ${d.shape==='rectangle'?'rectangle':'rounded rectangle'}`],['Placed',places.find(p=>p.value===d.patioId)!.label]],
    patch:current=>applyPoolCommand(current,{type:'pool.create',id:`pool-${crypto.randomUUID()}`,poolType:d.poolType,shape:d.shape,patioId:d.patioId||undefined})};
}

/**
 * The Pro workspace's Tools → Wizards: a few guided steps that build a deck, house, patio or pool from the designer's
 * own choices, then apply it as one change (one undo step) and open it in the properties panel to refine.
 */
export default function ProWizards({kind,page,onClose}:{kind:WizardKind;page:ProPage;onClose:()=>void}){
  const plans:Record<WizardKind,Plan>={deck:useDeckPlan(page.data),house:useHousePlan(page.data),patio:usePatioPlan(),pool:usePoolPlan(page.data)};
  const plan=plans[kind],last=plan.steps.length,dialog=useRef<HTMLDialogElement>(null);
  const [step,setStep]=useState(0),[error,setError]=useState('');
  // Modal while open; closed (so the page is usable again) before it leaves the page.
  useEffect(()=>{const el=dialog.current;if(el&&!el.open)el.showModal();return ()=>el?.close();},[]);
  useEffect(()=>{dialog.current?.querySelector<HTMLElement>('.dd-pro-wizard-body input,.dd-pro-wizard-body select,.dd-pro-wizard-actions button:last-child')?.focus();},[step]);
  const apply=()=>{try{page.apply(plan.patch(page.data));page.openSection(plan.section);onClose();}catch(e){setError(e instanceof Error?e.message:'This change could not be made.');}};
  const title=TITLES[kind],stepTitle=step<last?plan.steps[step].title:'Review';
  return <dialog ref={dialog} className="dd-pro-wizard" aria-labelledby="dd-pro-wizard-title" aria-describedby="dd-pro-wizard-step" onCancel={e=>{e.preventDefault();onClose();}}>
    <header><h2 id="dd-pro-wizard-title">{title}</h2><p id="dd-pro-wizard-step">Step {step+1} of {last+1} · {stepTitle}</p>
      <ol className="dd-pro-wizard-steps" aria-hidden="true">{[...plan.steps.map(s=>s.title),'Review'].map((t,i)=><li key={t} data-state={i<step?'done':i===step?'now':undefined}>{t}</li>)}</ol></header>
    <div className="dd-pro-wizard-body">
      {step<last?plan.steps[step].body:<>
        <dl className="dd-pro-wizard-review" aria-label="What will change">{plan.review.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <p className="dd-note">Applied as one change: Undo takes it all back. You can refine everything in the properties panel.</p></>}
      {error&&<p className="dd-pro-wizard-error" role="alert">{error}</p>}
    </div>
    <footer className="dd-pro-wizard-actions">
      <button type="button" onClick={onClose}>Cancel</button>
      <button type="button" disabled={step===0} onClick={()=>{setError('');setStep(s=>s-1);}}>Back</button>
      {step<last?<button type="button" className="dd-pro-wizard-primary" onClick={()=>setStep(s=>s+1)}>Next</button>
        :<button type="button" className="dd-pro-wizard-primary" onClick={apply}>{kind==='deck'||kind==='house'?'Apply to design':`Add ${kind}`}</button>}
    </footer>
  </dialog>;
}
