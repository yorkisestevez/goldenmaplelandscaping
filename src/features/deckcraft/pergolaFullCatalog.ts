/** Complete typed records, loaded with the catalog UI. The pricing core stays small. */
import {PERGOLA_PRODUCTS as CORE_PRODUCTS,PERGOLA_CATALOG_VERSION,type PergolaProduct} from './pergolaCatalog';
import {PERGOLA_DETAILS,PERGOLA_DETAILS_VERSION} from './pergolaCatalogDetails';
export {PERGOLA_SUPPLIERS} from './pergolaSuppliers';
if(PERGOLA_CATALOG_VERSION!==PERGOLA_DETAILS_VERSION)throw new Error('Pergola catalog and specifications must be updated together.');
export const PERGOLA_PRODUCTS:PergolaProduct[]=CORE_PRODUCTS.map(p=>{
 const details=PERGOLA_DETAILS[p.id as keyof typeof PERGOLA_DETAILS];
 return {...p,warranty:details.warranty,notes:details.notes,variants:p.variants.map(v=>({...v,
  dimensionNote:(details.dimensionNotes as Record<string,string>)[v.id],
  manualUrls:(details.manualUrls as Record<string,string[]>)[v.id],
 }))};
});
