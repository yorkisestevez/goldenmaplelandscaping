import {useMemo,useState} from 'react';
import type {DeckData,LightingZone} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {LIGHTING_CATALOGUE,getLightingProduct} from './lightingCatalogue';
import {activeLightingItems,defaultLightingZone,isSystemProduct,lightingSystemCheck} from './lightingSystem';
import {allowedLightingMounts,LIGHTING_MOUNT_ZONES,lightingTargets,lightingMountNotes,lightingEnvelope,type LightingPlacementOverride} from './lightingPlacement';
import {extrasLayout} from './extrasLayout';
import PrivacyScreenEditor from './PrivacyScreenEditor';
import {ONTARIO_COMPONENT_FAMILIES} from './ontarioComponentLibrary';
import {MANUFACTURER_ACCESSORIES} from './manufacturerCatalog';

type Props={data:DeckData;model:DeckTakeoff;onChange:(patch:Partial<DeckData>)=>void};
function LightingEditor({data,model,onChange}:Props){
  const [search,setSearch]=useState(''),[browseZone,setBrowseZone]=useState<LightingZone|'all'|'system'>('posts'),[showAll,setShowAll]=useState(false);
  const [selectedId,setSelectedId]=useState(''),[instance,setInstance]=useState(0);
  const [placementError,setPlacementError]=useState('');
  const selected=data.lightingSystem.selectedItems;
  const selectedItem=selected.find(p=>p.productId===selectedId)??selected[0];
  const product=selectedItem?getLightingProduct(selectedItem.productId):undefined;
  const zone=product?selectedItem?.zone??defaultLightingZone(product):'deck';
  const instanceIndex=Math.min(instance,Math.max(0,(selectedItem?.qty??1)-1));
  const override=data.lightingPlacements?.find(p=>p.productId===product?.id&&p.index===instanceIndex);
  const targets=useMemo(()=>lightingTargets(data,model,zone),[data,model,zone]);
  const layout=useMemo(()=>extrasLayout(data,model),[data,model]);
  const check=lightingSystemCheck(data);
  const filtered=LIGHTING_CATALOGUE.filter(p=>p.supported&&(!search||`${p.name} ${p.description??''}`.toLowerCase().includes(search.toLowerCase()))&&(browseZone==='all'||browseZone==='system'?browseZone==='all'||isSystemProduct(p):!isSystemProduct(p)&&allowedLightingMounts(p.geometry).includes(browseZone)));
  const available=showAll||search?filtered:filtered.slice(0,8);
  function setQty(id:string,qty:number){
    const p=getLightingProduct(id)!;qty=Math.min(30,Math.max(0,Math.round(qty)||0));
    const old=selected.find(x=>x.productId===id),suggested=browseZone!=='all'&&browseZone!=='system'&&allowedLightingMounts(p.geometry).includes(browseZone)?browseZone:defaultLightingZone(p);
    onChange({lightingSystem:{...data.lightingSystem,selectedItems:[...selected.filter(x=>x.productId!==id),...(qty?[{productId:id,qty,zone:old?.zone??suggested}]:[])]},lightingPlacements:data.lightingPlacements?.filter(x=>x.productId!==id||x.index<qty)});
    setSelectedId(id);setInstance(0);
  }
  function setZone(next:LightingZone){if(!product)return;onChange({lightingSystem:{...data.lightingSystem,selectedItems:selected.map(x=>x.productId===product.id?{...x,zone:next}:x)},lightingPlacements:data.lightingPlacements?.filter(p=>p.productId!==product.id)});}
  function place(targetId:string,patch:Partial<LightingPlacementOverride>={}){
    if(!product)return;
    const kept=(data.lightingPlacements??[]).filter(x=>x.productId!==product.id||x.index!==instanceIndex);
    if(targetId&&kept.length>=256){setPlacementError('Up to 256 individual placements are supported. Return another fixture to Automatic layout first.');return;}
    setPlacementError('');
    onChange({lightingPlacements:[...kept,...(targetId?[{productId:product.id,index:instanceIndex,targetId,positionPct:override?.positionPct??50,face:override?.face??'inside',...patch} as LightingPlacementOverride]:[])]});
  }
  const points=model.levels.flatMap(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,z:p.y+l.offset.z}))).concat(targets.flatMap(t=>[t.a,t.b]));
  const minX=Math.min(...points.map(p=>p.x))-20,minZ=Math.min(...points.map(p=>p.z))-20,maxX=Math.max(...points.map(p=>p.x))+20,maxZ=Math.max(...points.map(p=>p.z))+20;
  const active=activeLightingItems(data),fixtures=layout.fixtures.filter(p=>!isSystemProduct(getLightingProduct(p.productId)!));
  const selectedCount=active.filter(p=>!isSystemProduct(p)).reduce((n,p)=>n+p.qty,0);
  return <section aria-label="Lighting component editor">
    <p className="dd-note">Choose an in-lite fixture, set its installation zone, then click a mounting point. Product housings and light spread are illustrative—not photometric or installation drawings. Canadian availability and exact variants need dealer confirmation.</p>
    <div className="dd-component-status"><strong>{selectedCount} active lights · {fixtures.length} drawn</strong><button className="dd-secondary" onClick={()=>onChange({sceneLighting:data.sceneLighting==='Evening'?'Daylight':'Evening',lightingPreviewOn:true})}>{data.sceneLighting==='Evening'?'Preview in daylight':'Preview at night'}</button></div>
    <p className="dd-note">Turning preview lights off does not remove installed products or change quantities.</p>
    <h3>Your lighting</h3>
    {!selected.length&&<p>No lights selected. Add a fixture below to begin.</p>}
    {!!selected.length&&<label className="dd-field"><span>Edit selected product</span><select aria-label="Edit lighting product" value={selectedItem?.productId} onChange={e=>{setSelectedId(e.target.value);setInstance(0);}}>{selected.map(x=><option key={x.productId} value={x.productId}>{getLightingProduct(x.productId)?.name} · {x.qty}</option>)}</select></label>}
    {product&&selectedItem&&<div className="dd-component-edit">
      <h4>{product.name}</h4>
      {placementError&&<p role="alert" className="dd-error">{placementError}</p>}
      <div className="dd-fields"><label className="dd-field"><span>Quantity</span><input type="number" aria-label="Selected light quantity" min={0} max={30} value={selectedItem.qty} onChange={e=>setQty(product.id,Number(e.target.value))}/></label>
        {!isSystemProduct(product)&&<label className="dd-field"><span>Mounting zone</span><select aria-label="Light mounting zone" value={zone} onChange={e=>setZone(e.target.value as LightingZone)}>{LIGHTING_MOUNT_ZONES.filter(([z])=>allowedLightingMounts(product.geometry).includes(z)||z===zone).map(([z,label])=><option key={z} value={z}>{label}</option>)}</select></label>}
      </div>
      {!isSystemProduct(product)&&<label className="dd-check"><input type="checkbox" checked={data.lightingZoneEnabled?.[zone]!==false} onChange={e=>onChange({lightingZoneEnabled:{...data.lightingZoneEnabled,[zone]:e.target.checked}})}/>Include this zone in installation and quantities</label>}
      {!isSystemProduct(product)&&['deck','posts','rails','stairs'].includes(zone)&&<>
        {!!targets.length&&<button className="dd-secondary" disabled={!targets.some(t=>lightingEnvelope(product).length+(zone==='posts'?0:4)<=t.length)} onClick={()=>{const fitting=targets.filter(t=>lightingEnvelope(product).length+(zone==='posts'?0:4)<=t.length).slice(0,30),kept=(data.lightingPlacements??[]).filter(x=>x.productId!==product.id);if(kept.length+fitting.length>256){setPlacementError('This would exceed 256 individual placements. Return other fixtures to Automatic layout first.');return;}setPlacementError('');onChange({lightingSystem:{...data.lightingSystem,selectedItems:selected.map(x=>x.productId===product.id?{...x,qty:fitting.length}:x)},lightingPlacements:[...kept,...fitting.map((t,index)=>({productId:product.id,index,targetId:t.id,positionPct:50,face:'inside' as const}))]});}}>Fit one to each available {zone==='posts'?'post':zone==='stairs'?'tread':zone==='rails'?'level rail':'edge'}</button>}
        <label className="dd-field"><span>Individual fixture</span><select aria-label="Individual light" value={instanceIndex} onChange={e=>setInstance(Number(e.target.value))}>{Array.from({length:selectedItem.qty},(_,i)=><option key={i} value={i}>Light {i+1}</option>)}</select></label>
        <svg className="dd-component-map" viewBox={`${minX} ${minZ} ${maxX-minX} ${maxZ-minZ}`} role="img" aria-label="Choose a lighting mounting point">
          {model.levels.map((l,i)=><polygon key={i} points={l.footprint.outline.map(p=>`${p.x+l.offset.x},${p.y+l.offset.z}`).join(' ')} fill="#e6d8bb" stroke="#9b917e" strokeWidth="1"/>)}
          {fixtures.map((p,i)=><circle key={i} cx={p.x} cy={p.z} r={p.productId===product.id&&p.instanceIndex===instanceIndex?5:2.5} fill="#d67d28" stroke="white" strokeWidth="1"/>)}
          {targets.map((t,i)=>{const x=(t.a.x+t.b.x)/2,z=(t.a.z+t.b.z)/2;return <g key={t.id} role="button" tabIndex={0} aria-label={`Place light ${instanceIndex+1} on ${t.label}`} onClick={()=>place(t.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();place(t.id);}}}><circle cx={x} cy={z} r={7} fill={override?.targetId===t.id?'#153e38':'#fff'} stroke="#28685d" strokeWidth="1.5"/><text x={x} y={z+2.2} fontSize="6" textAnchor="middle" fill={override?.targetId===t.id?'#fff':'#153e38'}>{i+1}</text><title>{t.label}</title></g>;})}
        </svg>
        <label className="dd-field"><span>Mounting point for light {instanceIndex+1}</span><select aria-label="Light mounting point" value={override?.targetId??''} onChange={e=>place(e.target.value)}><option value="">Automatic layout</option>{override&&!targets.some(t=>t.id===override.targetId)&&<option value={override.targetId}>Previous location no longer exists—choose again</option>}{targets.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        {override&&zone!=='posts'&&<label className="dd-field"><span>Position along mounting point · {override.positionPct}%</span><input type="range" aria-label="Light position along mount" min={0} max={100} step={5} value={override.positionPct} onChange={e=>place(override.targetId,{positionPct:Number(e.target.value)})}/></label>}
        {override&&(zone==='posts'||zone==='rails')&&product.geometry!=='recessed'&&<label className="dd-field"><span>Fixture facing</span><select aria-label="Fixture facing" value={override.face} onChange={e=>place(override.targetId,{face:e.target.value as 'inside'|'outside'})}><option value="inside">Toward deck</option><option value="outside">Away from deck</option></select></label>}
        {!targets.length&&<p className="dd-error">No supported mounting points in this zone. Add the supporting structure or choose another zone.</p>}
      </>}
      <button className="dd-secondary" onClick={()=>setQty(product.id,0)}>Remove selected lighting product</button>
      <p className="dd-quote-badge">{product.cost===null||product.laborCost===null?'Supplier / installation quote required':'Existing price-book allowance; confirm current price'}</p>
      <details className="dd-advanced"><summary>Mounting, size &amp; compatibility</summary><p>{Object.entries(product.dimensionsIn).map(([k,n])=>`${k}: ${n?.toFixed(2)} in`).join(' · ')}</p><p>{product.va===undefined?'VA unverified':`${product.va} VA`} · {product.voltage??'Electrical details need confirmation'}</p>{[...lightingMountNotes(product,zone),...product.compatibilityNotes,...product.specWarnings].map(n=><p className="dd-note" key={n}>{n}</p>)}<a href={product.sourceUrl} target="_blank" rel="noreferrer">Manufacturer details ↗</a></details>
    </div>}
    <h3>Add lighting</h3>
    <div className="dd-fields"><label className="dd-field"><span>Show components for</span><select aria-label="Browse light mounting type" value={browseZone} onChange={e=>{setBrowseZone(e.target.value as typeof browseZone);setShowAll(false);}}>{LIGHTING_MOUNT_ZONES.map(([z,label])=><option key={z} value={z}>{label}</option>)}<option value="system">Transformers, cables &amp; accessories</option><option value="all">All supported lighting</option></select></label><label className="dd-field"><span>Find a product</span><input type="search" aria-label="Find component lighting" placeholder="MINI WEDGE, HYVE, EVO…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    <p className="dd-note">{filtered.length} matches · in-lite catalogue families and variants. Presence here does not mean local stock or compatible installation.</p>
    <div className="dd-component-products">{available.map(p=><article key={p.id}><strong>{p.name}</strong><small>{p.geometry} · {p.configurationRequired?'variant confirmation needed':p.specificationStatus.replaceAll('-',' ')}</small><button className="dd-secondary" onClick={()=>setQty(p.id,(selected.find(x=>x.productId===p.id)?.qty??0)+1)}>Add {p.name}</button></article>)}</div>
    {!filtered.length&&<p>No matching products. Try another mounting type or search.</p>}
    {!showAll&&!search&&filtered.length>8&&<button className="dd-secondary" onClick={()=>setShowAll(true)}>Show all {filtered.length} matches</button>}
    <label className="dd-field"><span>Installed cable length (ft)</span><input type="number" aria-label="Component lighting wire distance" min={0} max={500} value={data.lightingSystem.wireDistance} onChange={e=>onChange({lightingSystem:{...data.lightingSystem,wireDistance:Math.max(0,Math.min(500,Number(e.target.value)||0))}})}/></label>
    {!!(check.warnings.length+layout.warnings.length)&&<details className="dd-advanced"><summary>Placement &amp; electrical review · {check.warnings.length+layout.warnings.length} checks</summary><p>Known load {check.knownLoadVa.toFixed(1)} VA / {check.capacityVa.toFixed(1)} VA total transformer capacity. This does not verify individual circuits or voltage drop.</p><ul>{[...check.warnings,...layout.warnings].map(w=><li key={w}>{w}</li>)}</ul></details>}
    <a href="https://in-lite.com/en-CA/landscape-lighting/deck-lights" target="_blank" rel="noreferrer">in-lite Canadian deck lighting catalogue ↗</a>
  </section>;
}

function ComponentLibrary({data,onChange,onNavigate}:{data:DeckData;onChange:Props['onChange'];onNavigate:(step:number)=>void}){
  const [search,setSearch]=useState(''),[category,setCategory]=useState('all');
  const families=ONTARIO_COMPONENT_FAMILIES.filter(p=>(category==='all'||p.category===category)&&`${p.brand} ${p.name} ${p.components}`.toLowerCase().includes(search.toLowerCase()));
  function toggleAccessory(id:string,checked:boolean){const a=MANUFACTURER_ACCESSORIES.find(a=>a.id===id)!;onChange({catalogueAccessories:checked?[...(data.catalogueAccessories??[]).filter(other=>a.kind==='fastener'||MANUFACTURER_ACCESSORIES.find(x=>x.id===other)?.kind!==a.kind),id]:(data.catalogueAccessories??[]).filter(x=>x!==id),...(checked&&['tt_concealoc','dk_stealthlock'].includes(id)?{fasteningSystem:'Hidden' as const}:{})});}
  return <section aria-label="Ontario component library"><p>This is a sourced discovery library—not an exhaustive SKU list, live stock feed, engineering approval or a promise that Golden Maple supplies every brand. Existing modeled choices are separate from reference-only families.</p>
    <div className="dd-summary-actions"><button className="dd-secondary" onClick={()=>onNavigate(1)}>Customize modeled decking</button><button className="dd-secondary" onClick={()=>onNavigate(2)}>Customize modeled railing</button><button className="dd-secondary" onClick={()=>onNavigate(3)}>Framing &amp; finishing options</button></div>
    <h3>Modeled finishing accessories</h3><p className="dd-note">Selection adds a component to the existing model/quantity workflow, not a compatibility approval. Supplier quote required.</p>
    {MANUFACTURER_ACCESSORIES.filter(a=>a.previewSupported).map(a=><label key={a.id} className="dd-check"><input type="checkbox" checked={data.catalogueAccessories?.includes(a.id)??false} onChange={e=>toggleAccessory(a.id,e.target.checked)}/><span>{a.name}<small>{a.notes}</small></span></label>)}
    <h3>Manufacturer discovery</h3><div className="dd-fields"><label className="dd-field"><span>Search manufacturers / parts</span><input aria-label="Search Ontario components" type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="dd-field"><span>Component category</span><select aria-label="Component category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{[...new Set(ONTARIO_COMPONENT_FAMILIES.map(p=>p.category))].map(c=><option key={c}>{c}</option>)}</select></label></div><p className="dd-note">{families.length} sourced families · researched 21 September 2026</p>
    {families.map(p=><details className="dd-advanced" key={p.id}><summary>{p.brand} · {p.name}</summary><p>{p.components}</p><p className="dd-note">Availability evidence: {p.availability}</p><p className="dd-note">{p.caution}</p><p className="dd-quote-badge">Reference only · no product-specific 3D or price added</p><a href={p.sourceUrl} target="_blank" rel="noreferrer">Manufacturer ↗</a>{p.availabilityUrl&&<> · <a href={p.availabilityUrl} target="_blank" rel="noreferrer">Availability evidence ↗</a></>}</details>)}
  </section>;
}

const undoKeys=['lightingSystem','lightingPlacements','lightingZoneEnabled','privacyScreens','catalogueAccessories','fasteningSystem','sceneLighting','lightingPreviewOn'] as const;
export default function ComponentEditor({data,model,onChange,onNavigate}:Props&{onNavigate:(step:number)=>void}){
  const [tab,setTab]=useState<'lighting'|'privacy'|'library'>('lighting'),[history,setHistory]=useState<Partial<DeckData>[]>([]);
  const change=(patch:Partial<DeckData>)=>{setHistory(h=>[...h.slice(-19),structuredClone(Object.fromEntries(undoKeys.map(k=>[k,data[k]])) as Partial<DeckData>)]);onChange(patch);};
  return <section aria-label="Deck components customization"><div className="dd-component-tabs" role="group" aria-label="Component type">{(['lighting','privacy','library'] as const).map(t=><button className="dd-secondary" aria-pressed={tab===t} key={t} onClick={()=>setTab(t)}>{t==='lighting'?'Lighting':t==='privacy'?'Privacy screens':'Component library'}</button>)}</div>
    {tab==='lighting'?<LightingEditor data={data} model={model} onChange={change}/>:tab==='privacy'?<PrivacyScreenEditor data={data} model={model} onChange={change}/>:<ComponentLibrary data={data} onChange={change} onNavigate={onNavigate}/>}
    <button className="dd-secondary dd-component-undo" disabled={!history.length} onClick={()=>{onChange(history[history.length-1]);setHistory(h=>h.slice(0,-1));}}>Undo component change</button>
  </section>;
}
