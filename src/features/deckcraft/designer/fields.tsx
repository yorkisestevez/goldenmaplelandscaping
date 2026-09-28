import {Component,useEffect,useRef,useState,type ReactNode} from 'react';
import {swatchUrl} from '../lib/swatches';
import type {DeckData} from '../types';
import {selectPatch} from './selectPatch';

export type Update=(patch:Partial<DeckData>)=>void;

export class ViewerBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? this.props.fallback : this.props.children;}
}
export function Field({label,children,hint,after}:{label:string;children:ReactNode;hint?:string;after?:ReactNode}){
  return <label className="dd-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}{after}</label>;
}
/** A select's price effect (the option deltas): the line under it, and its id for the select's description. */
export interface SelectEffect{id:string;line:ReactNode}
export function MaterialSwatch({file,alt}:{file?:string;alt:string}){
  const url=swatchUrl(file);const [failedUrl,setFailedUrl]=useState('');
  return url&&failedUrl!==url?<img src={url} alt={alt} onError={()=>setFailedUrl(url)}/>:<span className="dd-swatch-unavailable" role="img" aria-label={`${alt}: manufacturer sample unavailable`}>Manufacturer sample unavailable</span>;
}
export function NumberField({label,value,min,max,unit,increment,hint,onValue,disabled,displayDecimals}:{label:string;value:number;min:number;max:number;unit:string;increment:number;hint?:string;onValue:(n:number)=>void;disabled?:boolean;displayDecimals?:number}){
  const display=(n:number)=>displayDecimals===undefined?String(n):String(Number(n.toFixed(displayDecimals)));
  const [draft,setDraft]=useState(()=>display(value));
  const pending=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(pending.current),[]);
  useEffect(()=>setDraft(display(value)),[value,displayDecimals]);
  const commit=()=>{clearTimeout(pending.current);if(displayDecimals!==undefined&&draft===display(value))return;const n=Number(draft);if(draft.trim()===''||!Number.isFinite(n)){setDraft(display(value));return;}const next=Math.min(max,Math.max(min,n));setDraft(display(next));onValue(next);};
  return <Field label={label} hint={hint}><span className="dd-number"><input aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={increment} value={draft} disabled={disabled} onChange={e=>{clearTimeout(pending.current);setDraft(e.target.value);const n=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(n)&&n>=min&&n<=max)pending.current=setTimeout(()=>onValue(n),150);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>{unit}</span></span></Field>;
}
export function downloadFile(body:BlobPart,type:string,name:string){
  const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/** The number, select and checkbox controls bound to one design field, with the same markup on every step. */
export function controlsFor(data:DeckData,update:Update){
  const number=(key:keyof DeckData,label:string,min=0,max=100,unit='',increment=1,hint?:string)=><NumberField key={key} label={label} value={Number(data[key]??48)} min={min} max={max} unit={unit} increment={increment} hint={hint} onValue={n=>update({[key]:n})}/>;
  const select=(key:keyof DeckData,label:string,choices:readonly (string|number)[],hint?:string,effect?:SelectEffect)=><Field label={label} hint={hint} after={effect?.line}><select aria-label={label} aria-describedby={effect?.id} value={String(data[key])} onChange={e=>update(selectPatch(key,typeof choices[0]==='number'?Number(e.target.value):e.target.value))}>{choices.map(v=><option key={v} value={v}>{v}</option>)}</select></Field>;
  const toggle=(key:keyof DeckData,label:string)=><label className="dd-check"><input type="checkbox" checked={Boolean(data[key])} onChange={e=>update({[key]:e.target.checked})}/><span>{label}</span></label>;
  return {number,select,toggle};
}
