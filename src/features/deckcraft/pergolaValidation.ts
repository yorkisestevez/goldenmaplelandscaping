import {PERGOLA_OPTIONS} from './pergolaOptions';
import type {PergolaSelection,PergolaDimensions} from './pergolaTypes';
import {PERGOLA_COST_PRODUCTS,pergolaProduct,pergolaVariant} from './pergolaCostCatalog';
export function pergolaSize(s:PergolaSelection):PergolaDimensions{
  const p=pergolaProduct(s),v=pergolaVariant(s);
  if(p?.custom&&s.customSize)return {widthIn:s.customSize.widthFt*12,depthIn:s.customSize.depthFt*12,heightIn:s.customSize.heightFt*12};
  return v?.dimensions??{widthIn:(v?.nominalFt?.[0]??12)*12,depthIn:(v?.nominalFt?.[1]??12)*12,heightIn:p?.id==='lousol-junior'?108:96};
}
export function newPergola(productId:string,variantId?:string):PergolaSelection{
  const p=PERGOLA_COST_PRODUCTS.find(p=>p.id===productId);if(!p)throw new Error('Unknown pergola product.');
  const v=p.variants.find(v=>v.id===variantId)??p.variants[0];
  const s:PergolaSelection={productId:p.id,variantId:v.id,frameFinish:PERGOLA_OPTIONS[p.id].frameFinishes[0].id,roofFinish:PERGOLA_OPTIONS[p.id].roofFinishes[0].id,accessories:[],supplyMode:'supply-install',target:{kind:'deck',level:0},xFt:8,zFt:7,rotationDeg:0,louverDeg:0,...(p.custom?{customSize:{widthFt:12,depthFt:12,heightFt:9}}:{})};return s;
}
/** Explicit public allowlist. A design file cannot supply prices, confirmations or arbitrary source URLs. */
export function validatePergola(value:unknown):PergolaSelection{
  const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid pergola configuration.');return v as Record<string,unknown>;};
  const v=obj(value),p=PERGOLA_COST_PRODUCTS.find(p=>p.id===v.productId),variant=p?.variants.find(x=>x.id===v.variantId);
  if(!p||!variant)throw new Error('This pergola product or variant is unavailable.');
  const n=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Pergola dimension or placement is out of range.');return v;};
  const t=obj(v.target);let target:PergolaSelection['target'];
  if(t.kind==='deck'&&Number.isInteger(t.level))target={kind:'deck',level:n(t.level,0,2)};
  else if(t.kind==='patio'&&typeof t.featureId==='string'&&t.featureId.length<=100)target={kind:'patio',featureId:t.featureId};
  else throw new Error('Invalid pergola support surface.');
  if(!PERGOLA_OPTIONS[p.id].frameFinishes.some(f=>f.id===v.frameFinish)||!PERGOLA_OPTIONS[p.id].roofFinishes.some(f=>f.id===v.roofFinish))throw new Error('Unsupported pergola finish.');
  if(v.supplyMode!=='supply-install'&&v.supplyMode!=='install-only')throw new Error('Invalid pergola supply mode.');
  if(!Array.isArray(v.accessories)||v.accessories.length>8||!v.accessories.every(id=>typeof id==='string'&&p.accessories.some(a=>a.id===id)))throw new Error('Unsupported pergola accessory.');
  const clean:PergolaSelection={productId:p.id,variantId:variant.id,frameFinish:v.frameFinish as string,roofFinish:v.roofFinish as string,accessories:[...new Set(v.accessories as string[])],supplyMode:v.supplyMode,target,xFt:n(v.xFt,-200,200),zFt:n(v.zFt,-200,200),rotationDeg:n(v.rotationDeg,-180,180),louverDeg:n(v.louverDeg,0,PERGOLA_OPTIONS[p.id].maxLouverDeg??90)};
  if(v.lighting!==undefined&&v.lighting!=='perimeter-led')throw new Error('Invalid pergola lighting.');
  if(v.lighting==='perimeter-led'&&!clean.accessories.includes('led'))clean.lighting='perimeter-led';
  if(p.custom){const c=obj(v.customSize);clean.customSize={widthFt:n(c.widthFt,...(PERGOLA_OPTIONS[p.id].sizeLimits?.widthFt??[4,30])),depthFt:n(c.depthFt,...(PERGOLA_OPTIONS[p.id].sizeLimits?.depthFt??[4,30])),heightFt:n(c.heightFt,...(PERGOLA_OPTIONS[p.id].sizeLimits?.heightFt??[7,14]))};}
  return clean;
}
