/**
 * Pull live DeckMart Shopify product.js prices and compare them to the book.
 * Regular retail only: when compare_at > sale price, compare_at wins (clearance excluded).
 * Does not write the price book — print the delta; owner approval updates supplierRates.ts.
 *
 *   npm run deck:fetch-rates
 */
import {DECKING_RATE_SOURCES,FASCIA_RETAIL_RATES} from '../src/features/deckcraft/supplierRates';

const UA='GoldenMaplePriceCheck/1.0 (+https://goldenmaplelandscaping.ca)';
const FASCIA_HANDLES=[
  'timbertech-prime-plus-fascia','timbertech-reserve-fascia','timbertech-terrain-fascia',
  'timbertech-terrain-plus-fascia','timbertech-prime-fascia','timbertech-legacy-fascia',
  'timbertech-landmark-fascia','timbertech-vintage-fascia','timbertech-harvest-fascia',
  'timbertech-harvest-plus-fascia',
] as const;

type Variant={sku?:string;title?:string;option1?:string|null;option2?:string|null;option3?:string|null;price:number;compare_at_price?:number|null;available?:boolean};
type Product={handle:string;title:string;variants:Variant[]};

async function fetchProduct(handle:string):Promise<Product>{
  // currency=CAD: without it Shopify may return USD list prices for this host.
  const res=await fetch(`https://www.deckmart.com/products/${handle}.js?currency=CAD`,{headers:{'User-Agent':UA,'Accept-Language':'en-CA,en;q=0.9'}});
  if(!res.ok)throw new Error(`${handle}: HTTP ${res.status}`);
  const d=await res.json() as {title:string;variants:Variant[]};
  return {handle,title:d.title,variants:d.variants??[]};
}

const money=(cents:number)=>Math.round(cents)/100;
const regular=(v:Variant)=>{
  const price=money(v.price),compare=v.compare_at_price?money(v.compare_at_price):0;
  return compare>price?compare:price;
};
const opts=(v:Variant)=>[v.option1,v.option2,v.option3].filter(Boolean).join(' / ');
const is12ftFascia=(v:Variant)=>{
  const t=opts(v).toLowerCase();
  return t.includes('fascia')&&!t.includes('riser')&&(t.includes("12'")||t.includes('12 ft')||/\b12\b/.test(t)||(v.sku??'').includes('12'));
};

const colourFrom=(title:string)=>{
  // "Coconut Husk (TimberTech)" or "Brown Oak"
  const bare=title.replace(/\s*\(TimberTech\)\s*/i,'').trim();
  return bare.split(' / ')[0]?.trim()??bare;
};

let drifts=0,matches=0,liveFascia=0;
console.log('DeckMart live check (regular retail; sale prices ignored when compare-at is higher)\n');

// Decking benchmarks
for(const [id,book] of Object.entries(DECKING_RATE_SOURCES)){
  const handle=book.url.replace(/^https:\/\/www\.deckmart\.com\/products\//,'');
  const product=await fetchProduct(handle);
  const v=product.variants.find(x=>(x.sku??'')===book.sku);
  if(!v){console.log(`[missing] ${id} SKU ${book.sku} not on ${handle}`);drifts++;continue;}
  const live=regular(v),sale=money(v.price);
  if(Math.abs(live-book.boardPrice)<0.005){console.log(`[ok] ${id} ${book.sku}: $${book.boardPrice.toFixed(2)} (live sale $${sale.toFixed(2)}${sale<live?`; compare-at $${live.toFixed(2)}`:''})`);matches++;}
  else{console.log(`[drift] ${id} ${book.sku}: book $${book.boardPrice.toFixed(2)} → regular $${live.toFixed(2)} (sale $${sale.toFixed(2)})`);drifts++;}
}

// Fascia by SKU
const bySku=new Map<string,{price:number;sale:number;available:boolean;handle:string;title:string}>();
for(const handle of FASCIA_HANDLES){
  const product=await fetchProduct(handle);
  for(const v of product.variants){
    if(!v.sku||!is12ftFascia(v))continue;
    liveFascia++;
    bySku.set(v.sku,{price:regular(v),sale:money(v.price),available:!!v.available,handle,title:opts(v)});
  }
}

console.log(`\nFascia: ${Object.keys(FASCIA_RETAIL_RATES).length} in book, ${liveFascia} live 12 ft fascia variants\n`);
for(const [colour,book] of Object.entries(FASCIA_RETAIL_RATES)){
  const live=bySku.get(book.sku);
  if(!live){console.log(`[missing] ${colour} SKU ${book.sku}`);drifts++;continue;}
  if(Math.abs(live.price-book.boardPrice)<0.005){console.log(`[ok] ${colour}: $${book.boardPrice.toFixed(2)} (${live.available?'in stock':'listed unavailable'})`);matches++;}
  else{console.log(`[drift] ${colour}: book $${book.boardPrice.toFixed(2)} → regular $${live.price.toFixed(2)} (sale $${live.sale.toFixed(2)})`);drifts++;}
  bySku.delete(book.sku);
}

const leftover=[...bySku.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
if(leftover.length){
  console.log(`\nLive fascia SKUs not in the book (${leftover.length}):`);
  for(const [sku,v] of leftover)console.log(`  ${sku}|${colourFrom(v.title)}|$${v.price.toFixed(2)}|${v.handle}`);
}

console.log(`\n${matches} matched, ${drifts} drifts/missing. Update supplierRates.ts only with owner approval.`);
if(drifts)process.exitCode=1;
