import {readProjectValue,updateProjectValue} from './projectStorage';
/** Prices are quoted CAD before HST: supply per pack, delivery per order,
 * labour and equipment per installed unit. Zero must be explicitly supplied. */
export const SUPPLIER_UNITS=['ea','sqft','lf','m2','m','yd3','m3','tonne','hour','day','load','bin','roll'] as const;
export type SupplierUnit=(typeof SUPPLIER_UNITS)[number];
export interface SupplierRate {sku:string;manufacturer:string;unit:SupplierUnit;packQuantity:number;price:number;currency:'CAD';effectiveDate:string;delivery:number;labour:number;equipment:number}
export interface SupplierRateBook {version:1;revision:number;updatedAt:string;rates:SupplierRate[]}
export interface SupplierRatePreview {expectedRevision:number;incoming:SupplierRate[];additions:number;replacements:number;total:number}
const KEY='supplier-ratebook',HEADERS=['sku','manufacturer','unit','packquantity','price','currency','effectivedate','delivery','labour','equipment'],MAX_RATES=5000;
export const emptySupplierRateBook=():SupplierRateBook=>({version:1,revision:0,updatedAt:'',rates:[]});
const identity=(r:SupplierRate)=>`${r.manufacturer.toLocaleLowerCase()}\u0000${r.sku.toLocaleLowerCase()}`;
const issue=(text:string):never=>{throw Error(text);};
function text(value:unknown,label:string):string {if(typeof value!=='string'||!value.trim()||value.length>120||/[\u0000-\u001f]/.test(value))issue(`Enter a ${label} up to 120 characters.`);return (value as string).trim();}
function amount(value:unknown,label:string,positive=false):number {if(typeof value!=='number'||!Number.isFinite(value)||value<(positive?0.000001:0)||value>1_000_000)issue(`Invalid ${label}.`);return value as number;}
export function validateSupplierRates(value:unknown):SupplierRate[]{
 if(!Array.isArray(value)||value.length>MAX_RATES)issue('Keep at most 5,000 supplier rates.');const seen=new Set<string>();
 return (value as unknown[]).map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).sort().join(',')!=='currency,delivery,effectiveDate,equipment,labour,manufacturer,packQuantity,price,sku,unit')issue('A supplier rate has missing or unsupported fields.');const r=raw as SupplierRate;
  const sku=text(r.sku,'SKU'),manufacturer=text(r.manufacturer,'manufacturer');if(!(SUPPLIER_UNITS as readonly string[]).includes(r.unit)||r.currency!=='CAD')issue('Use a supported unit and CAD currency.');if(typeof r.effectiveDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveDate)||!Number.isFinite(Date.parse(r.effectiveDate))||new Date(`${r.effectiveDate}T00:00:00Z`).toISOString().slice(0,10)!==r.effectiveDate)issue('Use a valid effective date in YYYY-MM-DD format.');
  const clean={sku,manufacturer,unit:r.unit,packQuantity:amount(r.packQuantity,'pack quantity',true),price:amount(r.price,'price'),currency:'CAD' as const,effectiveDate:r.effectiveDate,delivery:amount(r.delivery,'delivery'),labour:amount(r.labour,'labour'),equipment:amount(r.equipment,'equipment')};
  for(const k of ['price','delivery','labour','equipment'] as const)if(Math.abs(clean[k]*100-Math.round(clean[k]*100))>1e-7)issue(`${k} must use no more than two decimal places.`);
  const key=identity(clean);if(seen.has(key))issue(`Duplicate supplier SKU: ${manufacturer} / ${sku}.`);seen.add(key);return clean;
 });
}
function validateBook(raw:unknown):SupplierRateBook {if(raw===undefined)return emptySupplierRateBook();if(!raw||typeof raw!=='object'||Array.isArray(raw))issue('The private ratebook could not be restored.');const r=raw as SupplierRateBook;if(Object.keys(r).sort().join(',')!=='rates,revision,updatedAt,version'||r.version!==1||!Number.isSafeInteger(r.revision)||r.revision<0||typeof r.updatedAt!=='string'||r.revision>0&&!Number.isFinite(Date.parse(r.updatedAt)))issue('The private ratebook could not be restored.');return {...r,rates:validateSupplierRates(r.rates)};}
function csvRows(source:string):string[][] {
 if(typeof source!=='string'||new TextEncoder().encode(source).length>1_000_000)issue('Choose a rate CSV smaller than 1 MB.');source=source.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 const push=()=>{row.push(field);field='';closed=false;};
 for(let i=0;i<source.length;i++){const ch=source[i];if(quoted){if(ch==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
  if(ch==='"'){if(field||closed)issue('Invalid CSV quoting.');quoted=true;}
  else if(ch===',')push();else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&source[i+1]==='\n')i++;push();if(row.some(x=>x.trim()))rows.push(row);row=[];if(rows.length>MAX_RATES+1)issue('Keep at most 5,000 supplier rates.');}
  else {if(closed)issue('Unexpected text after a quoted CSV value.');field+=ch;}
 }
 if(quoted)issue('The CSV has an unclosed quoted value.');if(field||row.length||closed){push();if(row.some(x=>x.trim()))rows.push(row);}return rows;
}
export function parseSupplierRateCsv(source:string):SupplierRate[]{
 const [header,...rows]=csvRows(source);if(!header||!rows.length)issue('The CSV needs a header and at least one rate.');const names=header.map(s=>s.trim().toLocaleLowerCase());if(names.length!==HEADERS.length||new Set(names).size!==names.length||HEADERS.some(h=>!names.includes(h)))issue(`CSV columns: ${HEADERS.join(', ')}.`);
 const rates=rows.map((row,index)=>{if(row.length!==names.length||row.some(v=>!v.trim()))issue(`Row ${index+2} has missing fields. Use an explicit 0 for a quoted fee of zero.`);const raw=Object.fromEntries(names.map((key,i)=>[key,row[i].trim()]));
  const numeric=(key:string)=>{if(!/^(?:\d+\.?\d*|\.\d+)$/.test(raw[key]))issue(`Row ${index+2}: ${key} must be a nonnegative number.`);return Number(raw[key]);};
  return {sku:raw.sku,manufacturer:raw.manufacturer,unit:raw.unit,packQuantity:numeric('packquantity'),price:numeric('price'),currency:raw.currency,effectiveDate:raw.effectivedate,delivery:numeric('delivery'),labour:numeric('labour'),equipment:numeric('equipment')};
 });return validateSupplierRates(rates);
}
export async function readSupplierRateBook():Promise<SupplierRateBook>{return validateBook(await readProjectValue('privateRates',KEY));}
export function previewSupplierRateImport(source:string,current:SupplierRateBook):SupplierRatePreview {const incoming=parseSupplierRateCsv(source),existing=validateBook(current),keys=new Set(existing.rates.map(identity)),replacements=incoming.filter(r=>keys.has(identity(r))).length,total=existing.rates.length+incoming.length-replacements;if(total>MAX_RATES)issue('The merged ratebook would exceed 5,000 entries.');return {expectedRevision:existing.revision,incoming,additions:incoming.length-replacements,replacements,total};}
export async function applySupplierRateImport(preview:SupplierRatePreview):Promise<SupplierRateBook>{
 const incoming=validateSupplierRates(preview.incoming);return updateProjectValue<SupplierRateBook>('privateRates',KEY,raw=>{const current=validateBook(raw);if(current.revision!==preview.expectedRevision)issue('The ratebook changed after the preview. Load it again and preview this CSV again.');const replacing=new Set(incoming.map(identity)),rates=validateSupplierRates([...current.rates.filter(r=>!replacing.has(identity(r))),...incoming]);return {version:1,revision:current.revision+1,updatedAt:new Date().toISOString(),rates};});
}
export async function saveSupplierRateBook(rates:SupplierRate[],expectedRevision:number):Promise<SupplierRateBook>{const clean=validateSupplierRates(rates);return updateProjectValue<SupplierRateBook>('privateRates',KEY,raw=>{const current=validateBook(raw);if(current.revision!==expectedRevision)issue('The ratebook changed in another tab. Reload it before saving.');return {version:1,revision:current.revision+1,updatedAt:new Date().toISOString(),rates:clean};});}
export function findSupplierRate(book:SupplierRateBook,manufacturer:string,sku:string):SupplierRate|undefined{return book.rates.find(r=>r.manufacturer.toLocaleLowerCase()===manufacturer.trim().toLocaleLowerCase()&&r.sku.toLocaleLowerCase()===sku.trim().toLocaleLowerCase());}
/** No currency conversion or HST is applied here. Unmatched/mismatched scope
 * remains unresolved; callers must never substitute an invented unit rate. */
export function priceSupplierScope(rate:SupplierRate,quantity:number,unit:SupplierUnit,{includeDelivery=true,includeLabour=true,includeEquipment=true}:{includeDelivery?:boolean;includeLabour?:boolean;includeEquipment?:boolean}={}){
 const r=validateSupplierRates([rate])[0];amount(quantity,'measured scope');if(unit!==r.unit)issue(`This quote is for ${r.unit}; convert the measured ${unit} scope explicitly before applying it.`);const ratio=quantity/r.packQuantity,packs=quantity===0?0:Math.ceil(ratio-Number.EPSILON*Math.max(1,ratio)*4),orderedQuantity=packs*r.packQuantity,round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
 const supplyCost=round(packs*r.price),deliveryCost=round(packs&&includeDelivery?r.delivery:0),labourCost=round(includeLabour?quantity*r.labour:0),equipmentCost=round(includeEquipment?quantity*r.equipment:0),installationCost=round(labourCost+equipmentCost);
 return {currency:'CAD' as const,taxIncluded:false as const,packs,orderedQuantity,installedQuantity:quantity,supplyCost,deliveryCost,labourCost,equipmentCost,installationCost,totalBeforeHst:round(supplyCost+deliveryCost+installationCost),effectiveDate:r.effectiveDate};
}
