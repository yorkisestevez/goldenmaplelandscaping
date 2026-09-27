import {PERGOLA_OPTIONS} from './pergolaOptions';
import {PERGOLA_COST_PRODUCTS,PERGOLA_CATALOG_VERSION} from './pergolaCostCatalog';
import {PERGOLA_DISPLAY,PERGOLA_DISPLAY_VERSION} from './pergolaCatalogDisplay';
import type {PergolaProduct,PergolaSelection} from './pergolaTypes';
export type * from './pergolaTypes';
export {PERGOLA_CATALOG_VERSION} from './pergolaCostCatalog';
export {newPergola,pergolaSize,validatePergola} from './pergolaValidation';
if(PERGOLA_CATALOG_VERSION!==PERGOLA_DISPLAY_VERSION)throw Error('Update pergola costing and display evidence together.');
export const PERGOLA_PRODUCTS:PergolaProduct[]=PERGOLA_COST_PRODUCTS.map(p=>{
 const details=PERGOLA_DISPLAY[p.id as keyof typeof PERGOLA_DISPLAY];
 const {variants,accessorySources,...display}=details;
 delete (display as Record<string,unknown>).installedBudgetSource;
 const installedBudgetSource='installedBudgetSource' in details?details.installedBudgetSource:undefined;
 return {...p,...PERGOLA_OPTIONS[p.id],...display,variants:p.variants.map(v=>({...v,...(variants as Record<string,object>)[v.id]})),accessories:p.accessories.map(a=>({...a,source:(accessorySources as Record<string,object>)[a.id]})),...(p.installedBudget?{installedBudget:{...p.installedBudget,source:installedBudgetSource}}:{})} as PergolaProduct;
});
export const pergolaProduct=(s:Pick<PergolaSelection,'productId'>)=>PERGOLA_PRODUCTS.find(p=>p.id===s.productId);
export const pergolaVariant=(s:Pick<PergolaSelection,'productId'|'variantId'>)=>pergolaProduct(s)?.variants.find(v=>v.id===s.variantId);
