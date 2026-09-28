import type {PergolaProduct,PergolaVariant,PergolaAccessory,PergolaSelection,PergolaFinish,PergolaSource} from './pergolaTypes';
export const PERGOLA_CATALOG_VERSION='2026-09-26';
type CostSource=Pick<PergolaSource,'checkedAt'>;
export type PergolaCostVariant=Pick<PergolaVariant,'id'|'label'|'nominalFt'|'dimensions'|'priceCad'|'availability'>&{source:CostSource};
type CostAccessory=Pick<PergolaAccessory,'id'|'name'|'priceCad'|'kind'|'side'>&{source:CostSource};
export type PergolaCostProduct=Pick<PergolaProduct,'id'|'name'|'custom'|'postIn'>&{
 variants:PergolaCostVariant[];accessories:CostAccessory[];
 installedBudget?:Omit<NonNullable<PergolaProduct['installedBudget']>,'source'>&{source:CostSource};
};
/** One sourced set of prices, dimensions and validation IDs; display evidence loads with catalog/proposals. */
const source={checkedAt:PERGOLA_CATALOG_VERSION};
const mm=(width:number,depth:number,height:number)=>({widthIn:width/25.4,depthIn:depth/25.4,heightIn:height/25.4});
const variant=(id:string,label:string,nominalFt:[number,number]|null,priceCad:number|null,dimensions:PergolaCostVariant['dimensions']=null,availability:PergolaCostVariant['availability']=priceCad===null?'quote-required':'listed'):PergolaCostVariant=>({id,label,nominalFt,dimensions,priceCad,availability,source});
export const PERGOLA_COST_PRODUCTS:PergolaCostProduct[]=[
{"id":"lousol-junior","name":"LOUSOL Junior","custom":false,"postIn":null,"accessories":[{"id":"motor","name":"Louver motor","kind":"motor","priceCad":2200,"source":source},{"id":"led","name":"Warm white LED lighting","kind":"led","priceCad":1850,"source":source},{"id":"screen-front","name":"Manual ZIP screen · front · 10 × 9 ft","kind":"screen","side":"front","priceCad":2350,"source":source},{"id":"screen-right","name":"Manual ZIP screen · right · 12 × 9 ft","kind":"screen","side":"right","priceCad":2550,"source":source},{"id":"screen-back","name":"Manual ZIP screen · back · 10 × 9 ft","kind":"screen","side":"back","priceCad":2350,"source":source},{"id":"screen-left","name":"Manual ZIP screen · left · 12 × 9 ft","kind":"screen","side":"left","priceCad":2550,"source":source}],variants:[variant("10x12","10 × 12 ft",[10,12],9950)]},
{"id":"lousol-custom","name":"LOUSOL Custom","custom":true,"postIn":null,"accessories":[],"installedBudget":{"lowPerSqft":130,"highPerSqft":200,"openEnded":true,"source":source},variants:[variant("custom","Custom configuration",null,null)]},
{"id":"kimbel-custom","name":"Kimbel Louvered","custom":true,"postIn":null,"accessories":[],variants:[variant("custom","Custom configuration",null,null)]},
{"id":"stobag-bavona","name":"STOBAG BAVONA Hard-Top","custom":true,"postIn":null,"accessories":[],variants:[variant("custom","Custom configuration",null,null)]},
{"id":"costco-mirador","name":"Mirador","custom":false,"postIn":null,"accessories":[],variants:[variant("8-8x14-4","8.8 × 14.4 ft",[8.8,14.4],2999.99,mm(2650,4380,2510))]},
{"id":"costco-yardistry","name":"Yardistry Aluminum","custom":false,"postIn":6,"accessories":[],variants:[variant("12x10","12 × 10 ft",[12,10],null,mm(3700,3100,2500),"unverified"),variant("12x12","12 × 12 ft",[12,12],null,mm(3700,3700,2500),"unverified"),variant("12x14","12 × 14 ft",[12,14],null,mm(3700,4200,2500),"unverified")]},
{"id":"melia","name":"F. Corriveau Mélia","custom":false,"postIn":null,"accessories":[],variants:[variant("10x13","10 × 13 ft",[10,13],3198),variant("10x19","10 × 19 ft",[10,19],5098,{"widthIn":118,"depthIn":228,"heightIn":94.5})]},
{"id":"domi-louvered","name":"Domi Louvered","custom":false,"postIn":null,"accessories":[],variants:[variant("10x10","10 × 10 ft",[10,10],2199.99,null,"sold-out"),variant("10x12","10 × 12 ft",[10,12],null,null,"unverified")]},
{"id":"purple-leaf","name":"Purple Leaf Louvered","custom":false,"postIn":null,"accessories":[],variants:[variant("13x15","13 × 15 ft",[13,15],4189),variant("10x12","10 × 12 ft",[10,12],null,null,"unverified"),variant("10x16","10 × 16 ft",[10,16],null,null,"unverified")]}];
export const pergolaProduct=(s:Pick<PergolaSelection,'productId'>)=>PERGOLA_COST_PRODUCTS.find(p=>p.id===s.productId);
export const pergolaVariant=(s:Pick<PergolaSelection,'productId'|'variantId'>)=>pergolaProduct(s)?.variants.find(v=>v.id===s.variantId);
