import {lazy,Suspense,useId,useState} from 'react';
import type {YardFeature} from './types';
import {hardscapeName,hardscapeProduct} from './hardscapeCatalogue';
import {PATIO_PRODUCTS,WALL_PRODUCTS} from './yardSettings';
import {withoutStaleStone} from './WallStoneEditor';
import './YardMaterialEditor.css';
const HardscapePicker=lazy(()=>import('./HardscapePicker'));
const FlagstoneChooser=lazy(()=>import('./FlagstoneChooser'));

/** Mounted per feature so switching the plan selection never edits a different area's material. */
export default function YardMaterialEditor({feature,onChange,disabled=false}:{feature:YardFeature;onChange:(patch:Partial<YardFeature>)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),id=useId(),wall=feature.kind==='retaining-wall';
 // Choosing a manufactured product leaves natural flagstone (a flagstone spec only belongs with its own product id).
 const change=(patch:Partial<YardFeature>)=>onChange(feature.flagstone&&patch.productId&&patch.productId!==feature.productId?{...patch,flagstone:undefined}:patch);
 const legacy=wall?WALL_PRODUCTS.find(p=>p.id===feature.productId)?.name:PATIO_PRODUCTS.find(p=>p.id===feature.productId);
 const material=feature.flagstone?`Natural ${feature.flagstone.stone} flagstone, ${feature.flagstone.jointIn} in ${feature.flagstone.jointColour} chip joints`:hardscapeProduct(feature.productId)?hardscapeName(feature):typeof legacy==='string'?legacy:legacy&&'brand' in legacy?`${legacy.brand} ${legacy.product}`:feature.productId.replaceAll('-',' ');
 return <section className="dd-yard-material" aria-label={wall?'Wall material':'Patio material'}>
  <button type="button" className="dd-yard-material-button" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}><span aria-hidden="true" className="dd-yard-material-swatch" style={{backgroundColor:feature.color}}/><span>{wall?'Choose wall material':'Choose patio material'}</span><span aria-hidden="true">{open?'−':'+'}</span></button>
  <p className="dd-yard-material-current">{material}</p>
  {!open&&<p className="dd-yard-material-hint">Techo-Bloc · Unilock · Permacon · Oaks<br/>Products, colours, finishes, sizes and patterns</p>}
  <div id={id} hidden={!open}>{open&&<Suspense fallback={<p role="status">Loading material choices…</p>}>{!wall&&<FlagstoneChooser feature={feature} onChange={change}/>}<HardscapePicker feature={feature} onChange={patch=>change(withoutStaleStone(feature,patch))}/></Suspense>}</div>
 </section>;
}
