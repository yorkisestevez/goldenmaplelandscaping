'use client';
import {useEffect,useState} from 'react';
import type {QuoteScope} from '../quoteResolutions';
import {quoteUnitBasis} from './quoteQuantityPricing';
import {readSupplierRateBook,emptySupplierRateBook,priceSupplierScope,SUPPLIER_UNITS,type SupplierUnit,type SupplierRateBook} from '../supplierRateBook';
/** These aliases describe the same physical measurement. Compacted/loose
 * volume and mass conversions intentionally require a separate measured quote. */
export function supplierScopeUnit(unit:string):SupplierUnit|null {
 if((SUPPLIER_UNITS as readonly string[]).includes(unit))return unit as SupplierUnit;
 if(/^(sq ft|sq ft (order|installed|exposed face|envelope))$/.test(unit))return 'sqft';
 if(/^(ft|linear ft|linear ft (main run|outlet run|cap bond))$/.test(unit))return 'lf';
 return unit==='stock units'?'ea':unit==='cu yd'?'yd3':null;
}
export default function SupplierScopePicker({scope,onChoose,refreshKey=0}:{scope:QuoteScope;refreshKey?:number;onChoose:(cost:{supplyCost:number;installationCost:number;note:string})=>void}){
 const [book,setBook]=useState<SupplierRateBook>(emptySupplierRateBook),[selected,setSelected]=useState(''),[delivery,setDelivery]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;setSelected('');setDelivery(false);void readSupplierRateBook().then(value=>{if(active)setBook(value);},e=>{if(active)setError(e instanceof Error?e.message:'The private ratebook could not be loaded.');});return ()=>{active=false;};},[refreshKey]);
 useEffect(()=>{setSelected('');setDelivery(false);},[scope.key,scope.fingerprint]);
 const basis=quoteUnitBasis(scope),unit=basis?supplierScopeUnit(basis.unit):null,candidates=unit?book.rates.filter(r=>r.unit===unit):[],rate=selected?candidates[Number(selected)-1]:undefined;
 let price:ReturnType<typeof priceSupplierScope>|undefined,previewError='';try{if(rate&&basis&&unit)price=priceSupplierScope(rate,basis.quantity,unit,{includeDelivery:delivery});}catch(e){previewError=e instanceof Error?e.message:'This scope cannot use the selected rate.';}
 return <details><summary>Use private supplier rate</summary>
  {error&&<p role="alert">{error}</p>}
  {!basis||!unit?<p>This measurement needs a total quote or an explicit unit conversion. Supplier rates cannot confirm site or assembly requirements.</p>:<>
   <p>Measured scope: {basis.quantity.toFixed(3)} {basis.unit}. Only quotes in {unit} are shown. Supply uses whole packs; installation uses the actual measured quantity. Review that this SKU covers the selected additional scope.</p>
   <label>Quoted SKU<select aria-label="Quoted SKU" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a saved rate</option>{candidates.map((r,i)=><option value={i+1} key={`${r.manufacturer}/${r.sku}`}>{r.manufacturer} / {r.sku} · ${r.price.toFixed(2)} per {r.packQuantity} {r.unit} · {r.effectiveDate}</option>)}</select></label>
   {!candidates.length&&<p>No matching private quote. Import the supplier CSV in Private supplier ratebook.</p>}
   <label style={{display:'block'}}><input type="checkbox" checked={delivery} onChange={e=>setDelivery(e.target.checked)}/>Include this order's quoted delivery once</label>
   {price&&rate&&<><p>{price.packs} packs · {price.orderedQuantity.toFixed(3)} {unit} ordered. Supply ${price.supplyCost.toFixed(2)}{delivery?` + delivery $${price.deliveryCost.toFixed(2)}`:''}; installation ${price.installationCost.toFixed(2)}. CAD before HST.</p><button type="button" onClick={()=>onChoose({supplyCost:Math.round((price!.supplyCost+price!.deliveryCost)*100)/100,installationCost:price!.installationCost,note:`Private rate ${rate.manufacturer} / ${rate.sku}, effective ${rate.effectiveDate}. Measured ${basis.quantity} ${basis.unit}; ${price!.packs} packs of ${rate.packQuantity} ${unit}; labour/equipment per installed unit.${delivery?' Order delivery included once.':' Delivery excluded.'} CAD before HST; review additional scope before confirming.`})}>Fill quote fields from rate</button></>}
   {previewError&&<p role="alert">{previewError}</p>}
  </>}
 </details>;
}
