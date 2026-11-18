import type {LightingProduct} from './types';
import type {LIGHTING_TRADE_SOURCE} from './supplierRates';

export type LightingGeometry='recessed'|'wall'|'undercap'|'bollard'|'spot'|'pendant'|'ceiling'|'transformer'|'cable'|'accessory';
export type LightingCategory=LightingProduct['category']|'Pendant'|'Ceiling';
export type CableGauge='14/2'|'12/2'|'10/2';
export interface LightingCatalogueProduct {
  id:string;name:string;category:LightingCategory;description?:string;
  cost:number|null;laborCost:number|null;legacyRate:boolean;
  rateSource?:typeof LIGHTING_TRADE_SOURCE;
  geometry:LightingGeometry;
  dimensionsIn:{height?:number;width?:number;length?:number;diameter?:number;mountingDepth?:number};
  sourceUrl:string;sourceVerified:boolean;supported:boolean;
  specificationStatus:'verified-specs'|'verified-family'|'legacy-allowance'|'unsupported';
  articleNumber?:string;finish?:string;voltage?:string;watts?:number;va?:number;colorTemperatureK?:number;
  configurationRequired?:boolean;requiresSmartHub?:boolean;
  compatibilityNotes:string[];specWarnings:string[];
  requiredAccessoryIds?:string[];includedAccessoryIds?:string[];requiredCableGauge?:CableGauge;maxCableRunFt?:number;
  compatibleTransformerIds?:string[];incompatibleTransformerIds?:string[];incompatibleProductIds?:string[];
  transformer?:{capacityVa:number;lineCapacityVa:number;lines:number;outputVoltage:12;smart:boolean;maxCableLengthFt:Partial<Record<CableGauge,number>>};
  cable?:{gauge:CableGauge;lengthFt:number};
}
