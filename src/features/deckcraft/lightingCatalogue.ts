import {INLITE_PRODUCTS,type LightingProduct} from './types';

/** Official North American manufacturer facts. Never a replacement price book.
 * New products have null prices; missing VA/dimensions are deliberately undefined.
 * Coverage is broad but not an exhaustive inventory of every finish/SKU. See
 * LIGHTING_CATALOGUE_COVERAGE for unresolved source/configuration gaps.
 */
export type LightingGeometry='recessed'|'wall'|'undercap'|'bollard'|'spot'|'pendant'|'ceiling'|'transformer'|'cable'|'accessory';
export type LightingCategory=LightingProduct['category']|'Pendant'|'Ceiling';
export type CableGauge='14/2'|'12/2'|'10/2';
export interface LightingCatalogueProduct {
  id:string;name:string;category:LightingCategory;description?:string;
  cost:number|null;laborCost:number|null;legacyRate:boolean;
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
export const LIGHTING_CATEGORIES:LightingCategory[]=['Transformer','Recessed','Surface','Bollard','Pendant','Ceiling','Accessory'];

const VERIFIED_ADDITIONS:LightingCatalogueProduct[]=[
  {
    "id": "evo_hyde_550",
    "name": "EVO HYDE 550",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "height": 0.8661,
      "width": 0.6299,
      "length": 21.8898
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-hyde-550-black",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10250150",
    "finish": "Black",
    "watts": 2.0,
    "va": 2.1,
    "colorTemperatureK": 2950.0,
    "voltage": "12 volt"
  },
  {
    "id": "evo_hyde_180c_black",
    "name": "EVO HYDE 180C \u2014 Black",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "height": 0.8661,
      "width": 0.6299,
      "length": 7.0866
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-hyde-180c-black",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10250105",
    "finish": "Black",
    "watts": 0.5,
    "va": 0.6,
    "colorTemperatureK": 2950.0,
    "voltage": "12 volt"
  },
  {
    "id": "evo_hyde_180c_rosesilver",
    "name": "EVO HYDE 180C \u2014 RoseSilver",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "height": 0.8661,
      "width": 0.6299,
      "length": 7.0866
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-hyde-180c-rose-silver",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10250100",
    "finish": "RoseSilver",
    "watts": 0.5,
    "va": 0.6,
    "colorTemperatureK": 2850.0,
    "voltage": "12 volt"
  },
  {
    "id": "hyve_22",
    "name": "HYVE 22",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "height": 1.2598,
      "diameter": 0.8661,
      "mountingDepth": 1.9685
    },
    "sourceUrl": "https://in-lite.com/en-US/hyve-22",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Not compatible with SMART HUB-300."
    ],
    "specWarnings": [],
    "articleNumber": "10104050",
    "watts": 0.2,
    "va": 0.2,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt",
    "incompatibleTransformerIds": [
      "smart_hub300"
    ]
  },
  {
    "id": "fusion_22",
    "name": "FUSION 22",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "height": 1.2598,
      "diameter": 0.8661,
      "mountingDepth": 1.9685
    },
    "sourceUrl": "https://in-lite.com/en-US/fusion-22",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Not compatible with SMART HUB-300."
    ],
    "specWarnings": [],
    "articleNumber": "10104100",
    "watts": 0.2,
    "va": 0.2,
    "colorTemperatureK": 2750.0,
    "voltage": "12 volt",
    "incompatibleTransformerIds": [
      "smart_hub300"
    ]
  },
  {
    "id": "wedge_slim",
    "name": "WEDGE SLIM",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {
      "height": 1.9685,
      "width": 7.874,
      "length": 1.378
    },
    "sourceUrl": "https://in-lite.com/en-US/wedge-slim-dark-grey",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10301770",
    "finish": "DarkGrey",
    "watts": 1.0,
    "va": 1.0,
    "colorTemperatureK": 2800.0,
    "voltage": "12 volt"
  },
  {
    "id": "mini_wedge",
    "name": "MINI WEDGE",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {
      "height": 1.9685,
      "width": 2.3622,
      "length": 1.378
    },
    "sourceUrl": "https://in-lite.com/en-US/mini-wedge-dark-grey",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10301780",
    "finish": "DarkGrey",
    "watts": 0.6,
    "va": 0.6,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  {
    "id": "dot_22",
    "name": "DOT 22",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "height": 1.2598,
      "diameter": 0.8661,
      "mountingDepth": 1.9685
    },
    "sourceUrl": "https://in-lite.com/en-US/dot-22",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10101710",
    "watts": 0.36,
    "va": 0.5,
    "colorTemperatureK": 2850.0,
    "voltage": "12 volt"
  },
  {
    "id": "disc_pendant_100_230v",
    "name": "DISC PENDANT 100-230V",
    "category": "Pendant",
    "cost": null,
    "laborCost": null,
    "geometry": "pendant",
    "dimensionsIn": {
      "height": 1.4173,
      "diameter": 7.874
    },
    "sourceUrl": "https://in-lite.com/en-US/disc-pendant-100-230v",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "specWarnings": [],
    "articleNumber": "99080000",
    "finish": "Black",
    "watts": 4.5,
    "va": 11.8,
    "colorTemperatureK": 2900.0,
    "voltage": "120 volt"
  },
  {
    "id": "disc_pendant",
    "name": "DISC PENDANT",
    "category": "Pendant",
    "cost": null,
    "laborCost": null,
    "geometry": "pendant",
    "dimensionsIn": {
      "height": 1.4173,
      "diameter": 7.874
    },
    "sourceUrl": "https://in-lite.com/en-US/disc-pendant-black",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10202650",
    "finish": "Black",
    "watts": 3.0,
    "va": 4.9,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  {
    "id": "disc_wall_100_230v",
    "name": "DISC WALL 100-230V",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {
      "height": 3.1496,
      "diameter": 7.874
    },
    "sourceUrl": "https://in-lite.com/en-US/disc-wall-100-230v",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "specWarnings": [],
    "articleNumber": "99090010",
    "finish": "Black",
    "watts": 4.5,
    "va": 4.7,
    "colorTemperatureK": 2900.0,
    "voltage": "120 volt"
  },
  {
    "id": "disc_pendant_100_230v_duo",
    "name": "DISC PENDANT 100-230V DUO",
    "category": "Pendant",
    "cost": null,
    "laborCost": null,
    "geometry": "pendant",
    "dimensionsIn": {
      "height": 1.4173,
      "diameter": 7.874
    },
    "sourceUrl": "https://in-lite.com/en-US/disc-pendant-100-230v-duo",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "specWarnings": [],
    "articleNumber": "99080020",
    "finish": "Black",
    "watts": 4.5,
    "va": 11.8,
    "colorTemperatureK": 2900.0,
    "voltage": "120 volt"
  },
  {
    "id": "puck",
    "name": "PUCK",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/puck-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true
  },
  {
    "id": "plate_75",
    "name": "PLATE 75",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {
      "height": 0.1181,
      "width": 2.9528,
      "length": 2.9528
    },
    "sourceUrl": "https://in-lite.com/en-US/plate-75",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10702101",
    "finish": "StainlessSteel"
  },
  {
    "id": "smart_hub300",
    "name": "SMART HUB-300 120V",
    "category": "Transformer",
    "cost": null,
    "laborCost": null,
    "geometry": "transformer",
    "dimensionsIn": {
      "height": 2.3622,
      "width": 7.4803,
      "length": 12.9921
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-hub-300-120v-black",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "10/2 cable only, maximum 160 m and 130 VA per output. Do not connect DB-LED, HYVE/HYVE 22 or FUSION/FUSION 22."
    ],
    "specWarnings": [],
    "articleNumber": "10500625",
    "finish": "Black",
    "watts": 300.0,
    "voltage": "120 volt",
    "va": 300,
    "transformer": {
      "capacityVa": 300,
      "lineCapacityVa": 130,
      "lines": 3,
      "outputVoltage": 12,
      "smart": true,
      "maxCableLengthFt": {
        "10/2": 524.9344
      }
    },
    "incompatibleProductIds": [
      "fusion",
      "fusion_22",
      "hyve",
      "hyve_22",
      "db_led",
      "db_led_cw"
    ]
  },
  {
    "id": "ring_28_shield",
    "name": "RING 28 SHIELD",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {
      "height": 0.3937,
      "width": 1.1024,
      "length": 1.1024,
      "diameter": 1.1024
    },
    "sourceUrl": "https://in-lite.com/en-US/ring-28-shield-stainless-steel",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10702211",
    "finish": "StainlessSteel"
  },
  {
    "id": "box_100",
    "name": "BOX 100",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {
      "height": 2.3622,
      "width": 3.937,
      "length": 3.937
    },
    "sourceUrl": "https://in-lite.com/en-US/box-100-stainless-steel",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10703800",
    "finish": "StainlessSteel"
  },
  {
    "id": "mini_scope",
    "name": "MINI SCOPE",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "spot",
    "dimensionsIn": {
      "height": 1.7717,
      "diameter": 1.8504
    },
    "sourceUrl": "https://in-lite.com/en-US/mini-scope",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10400601",
    "watts": 1.0,
    "va": 2.0,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  {
    "id": "scope",
    "name": "SCOPE",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "spot",
    "dimensionsIn": {
      "height": 2.5591,
      "diameter": 2.5984
    },
    "sourceUrl": "https://in-lite.com/en-US/scope",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10400503",
    "watts": 3.0,
    "va": 5.2,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  {
    "id": "big_scope_narrow",
    "name": "BIG SCOPE NARROW",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "spot",
    "dimensionsIn": {
      "height": 2.9921,
      "diameter": 2.5984
    },
    "sourceUrl": "https://in-lite.com/en-US/big-scope-narrow",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10400902",
    "watts": 5.0,
    "va": 7.9,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  {
    "id": "micro_scope",
    "name": "MICRO SCOPE",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "spot",
    "dimensionsIn": {
      "height": 1.9685,
      "diameter": 1.063
    },
    "sourceUrl": "https://in-lite.com/en-US/micro-scope",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10400625",
    "watts": 0.6,
    "va": 1.1,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  {
    "id": "smart_scope_tone",
    "name": "SMART SCOPE TONE",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "spot",
    "dimensionsIn": {
      "height": 4.0551,
      "width": 2.5984,
      "length": 2.5984,
      "diameter": 2.5984
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-scope-tone",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "A SMART HUB is needed for app-based colour/dimming control."
    ],
    "specWarnings": [],
    "articleNumber": "10401050",
    "watts": 6.0,
    "va": 9.5,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt",
    "requiresSmartHub": true
  },
  {
    "id": "sway_pendant_100_230v_triple_black",
    "name": "SWAY PENDANT 100-230V TRIPLE Black",
    "category": "Pendant",
    "cost": null,
    "laborCost": null,
    "geometry": "pendant",
    "dimensionsIn": {
      "height": 2.5591,
      "width": 4.8031,
      "length": 4.8031,
      "diameter": 3.3465
    },
    "sourceUrl": "https://in-lite.com/en-US/sway-pendant-100-230v-triple-black",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "specWarnings": [],
    "articleNumber": "99250000",
    "finish": "Black",
    "watts": 7.5,
    "va": 21.3,
    "colorTemperatureK": 2900.0,
    "voltage": "120 volt"
  },
  {
    "id": "sway_table",
    "name": "SWAY TABLE",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {
      "height": 13.5827,
      "diameter": 5.315
    },
    "sourceUrl": "https://in-lite.com/en-US/sway-table-black",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "specWarnings": [],
    "articleNumber": "10202461",
    "finish": "Black",
    "watts": 0.6,
    "va": 2.0,
    "colorTemperatureK": 2900.0,
    "voltage": "5.0V-1A"
  },
  {
    "id": "evo_low",
    "name": "EVO LOW",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "height": 14.4094,
      "width": 1.9685,
      "length": 4.7244
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-low-black",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10202510",
    "finish": "Black",
    "watts": 2.0,
    "va": 2.1,
    "colorTemperatureK": 2950.0,
    "voltage": "12 volt"
  },
  {
    "id": "evo",
    "name": "EVO",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "height": 23.8583,
      "width": 1.9685,
      "length": 4.7244
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-black",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10202500",
    "finish": "Black",
    "watts": 2.0,
    "va": 2.1,
    "colorTemperatureK": 2950.0,
    "voltage": "12 volt"
  },
  {
    "id": "liv",
    "name": "LIV",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/liv-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true
  },
  {
    "id": "disc_low",
    "name": "DISC LOW",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "height": 13.7795,
      "length": 13.8,
      "diameter": 7.874
    },
    "sourceUrl": "https://in-lite.com/en-US/disc-low",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Manufacturer lists 12 V and 21 V configurations. Use the matching 12 V system driver/assembly, never a bare 21 V component directly."
    ],
    "specWarnings": [
      "Height inch/mm fields conflict on manufacturer page; metric specification converted to inches."
    ],
    "articleNumber": "99070000",
    "finish": "Black",
    "watts": 2.9,
    "va": 4.9,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt, 21V"
  },
  {
    "id": "disc",
    "name": "DISC",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "height": 23.622,
      "length": 23.6,
      "diameter": 7.874
    },
    "sourceUrl": "https://in-lite.com/en-US/disc",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Manufacturer lists 12 V and 21 V configurations. Use the matching 12 V system driver/assembly, never a bare 21 V component directly."
    ],
    "specWarnings": [
      "Height inch/mm fields conflict on manufacturer page; metric specification converted to inches."
    ],
    "articleNumber": "99060000",
    "finish": "Black",
    "watts": 2.9,
    "va": 4.9,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt, 21V"
  },
  {
    "id": "halo_down",
    "name": "HALO DOWN",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {
      "height": 3.937,
      "width": 3.937,
      "length": 4.5276,
      "diameter": 3.937
    },
    "sourceUrl": "https://in-lite.com/en-US/halo-down-black",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10302600",
    "finish": "Black",
    "watts": 3.0,
    "va": 5.0,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt"
  },
  {
    "id": "halo_down_100_230v",
    "name": "HALO DOWN 100-230V",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {
      "height": 3.937,
      "width": 5.1181,
      "length": 5.1181,
      "diameter": 5.1181
    },
    "sourceUrl": "https://in-lite.com/en-US/halo-down-100-230v-black",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "specWarnings": [],
    "articleNumber": "10302615",
    "finish": "Black",
    "watts": 4.5,
    "va": 11.5,
    "colorTemperatureK": 3000.0,
    "voltage": "120 volt"
  },
  {
    "id": "evo_ground_300",
    "name": "EVO GROUND 300",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "height": 1.6929,
      "width": 1.1811,
      "length": 11.811
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-ground-300-black",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10104500",
    "finish": "Black",
    "watts": 1.0,
    "va": 1.0,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt"
  },
  {
    "id": "big_nero",
    "name": "BIG NERO",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "height": 4.8425,
      "diameter": 6.6929,
      "mountingDepth": 5.1181
    },
    "sourceUrl": "https://in-lite.com/en-US/big-nero",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Use 10/2 cable, maximum 40 m. Manufacturer limits per transformer: HUB-50 four, HUB-100 seven, SMART HUB-150 nine; divide over outputs."
    ],
    "specWarnings": [],
    "watts": 7.5,
    "va": 11.9,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt",
    "requiredCableGauge": "10/2",
    "maxCableRunFt": 131.2336
  },
  {
    "id": "nero",
    "name": "NERO",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "height": 4.4094,
      "diameter": 5.1181,
      "mountingDepth": 4.7244
    },
    "sourceUrl": "https://in-lite.com/en-CA/nero",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10103401",
    "watts": 3.0,
    "va": 4.7,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  {
    "id": "smart_flux_tone",
    "name": "SMART FLUX TONE",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/smart-flux-tone-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true,
    "requiresSmartHub": true
  },
  {
    "id": "evo_flex",
    "name": "EVO FLEX",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true
  },
  {
    "id": "scope_ceiling",
    "name": "SCOPE CEILING",
    "category": "Ceiling",
    "cost": null,
    "laborCost": null,
    "geometry": "ceiling",
    "dimensionsIn": {
      "height": 3.4252,
      "diameter": 2.5984
    },
    "sourceUrl": "https://in-lite.com/en-US/scope-ceiling",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10400510",
    "watts": 3.0,
    "va": 4.8,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  {
    "id": "evo_flex_profile_single",
    "name": "EVO FLEX PROFILE SINGLE",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {
      "height": 0.7087,
      "width": 0.4331,
      "length": 39.7638
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-profile-single",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10250352"
  },
  {
    "id": "smart_evo_flex",
    "name": "SMART EVO FLEX",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant.",
      "Complete configured kits include the matching smart driver; a bare strip cannot connect directly to EASY-LOCK."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true,
    "requiresSmartHub": true,
    "requiredCableGauge": "10/2",
    "compatibleTransformerIds": [
      "smart_hub150"
    ],
    "maxCableRunFt": 131.2336
  },
  {
    "id": "evo_flex_profile",
    "name": "EVO FLEX PROFILE",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {
      "height": 0.7087,
      "width": 1.0236,
      "length": 39.7638
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-profile",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10250351"
  },
  {
    "id": "evo_flex_profile_4",
    "name": "EVO FLEX PROFILE 4",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {
      "height": 0.4331,
      "width": 0.3937,
      "length": 19.685
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-profile-4-stainless-steel",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10250385",
    "finish": "StainlessSteel"
  },
  {
    "id": "evo_flex_1_bare",
    "name": "EVO FLEX 1",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "height": 0.4724,
      "width": 0.2756,
      "length": 39.3701
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-1-99120010",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Manufacturer lists 12 V and 21 V configurations. Use the matching 12 V system driver/assembly, never a bare 21 V component directly.",
      "This article is the bare strip without DRIVER. Add DRIVER 1 and connection/mounting accessories. Recommended 10/2 circuit, maximum 40 m."
    ],
    "specWarnings": [],
    "articleNumber": "99120010",
    "watts": 6.5,
    "va": 9.9,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt, 21V",
    "requiredAccessoryIds": [
      "driver_1"
    ],
    "requiredCableGauge": "10/2",
    "maxCableRunFt": 131.2336
  },
  {
    "id": "smart_evo_flex_tone",
    "name": "SMART EVO FLEX TONE",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant.",
      "Complete configured kits include the matching smart driver; a bare strip cannot connect directly to EASY-LOCK."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true,
    "requiresSmartHub": true,
    "requiredCableGauge": "10/2"
  },
  {
    "id": "mini_scope_ceiling",
    "name": "MINI SCOPE CEILING",
    "category": "Ceiling",
    "cost": null,
    "laborCost": null,
    "geometry": "ceiling",
    "dimensionsIn": {
      "height": 2.6378,
      "diameter": 1.8504
    },
    "sourceUrl": "https://in-lite.com/en-US/mini-scope-ceiling",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10400610",
    "watts": 1.0,
    "va": 2.0,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  {
    "id": "smart_evo_flex_2_bare",
    "name": "SMART EVO FLEX 2",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "height": 0.4724,
      "width": 0.2756,
      "length": 78.7402
    },
    "sourceUrl": "https://in-lite.com/en-CA/smart-evo-flex-2",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Manufacturer lists 12 V and 21 V configurations. Use the matching 12 V system driver/assembly, never a bare 21 V component directly.",
      "This article is the bare strip without DRIVER. Matching smart driver and waterproof connections are required. Supplier availability must be confirmed."
    ],
    "specWarnings": [],
    "articleNumber": "99180020",
    "watts": 11.0,
    "va": 15.7,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt, 21V",
    "requiredAccessoryIds": [
      "smart_driver_1"
    ],
    "requiresSmartHub": true
  },
  {
    "id": "cbl_160_10_2",
    "name": "CBL-160 10/2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 6299.2126
    },
    "sourceUrl": "https://in-lite.com/en-US/cbl-160-102",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10600400",
    "cable": {
      "gauge": "10/2",
      "lengthFt": 524.9344
    }
  },
  {
    "id": "cbl_40_10_2",
    "name": "CBL-40 10/2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 1574.8031
    },
    "sourceUrl": "https://in-lite.com/en-US/cbl-40-102",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10600210",
    "cable": {
      "gauge": "10/2",
      "lengthFt": 131.2336
    }
  },
  {
    "id": "cable_cap_medium",
    "name": "CABLE CAP MEDIUM",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/cable-cap-medium",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10600905"
  },
  {
    "id": "cc_2_new",
    "name": "CC-2 (NEW)",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "height": 1.5748,
      "width": 1.1811,
      "length": 2.4409
    },
    "sourceUrl": "https://in-lite.com/en-US/cc-2-new",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10600705"
  },
  {
    "id": "smart_hub_75_120v",
    "name": "SMART HUB-75 120V",
    "category": "Transformer",
    "cost": null,
    "laborCost": null,
    "geometry": "transformer",
    "dimensionsIn": {
      "height": 2.9528,
      "width": 4.9213,
      "length": 8.4646
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-hub-75-120v",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10500645",
    "watts": 75.0,
    "va": 75.0,
    "voltage": "120 volt"
  },
  {
    "id": "smart_move",
    "name": "SMART MOVE",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {
      "height": 1.7717,
      "width": 3.1496,
      "length": 3.1496
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-move",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10500706"
  },
  {
    "id": "evo_flex_ext_cord_1",
    "name": "EVO FLEX-EXT CORD 1",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 39.3701
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-ext-cord-1",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10600610"
  },
  {
    "id": "smart_ext_cord_tone_1",
    "name": "SMART EXT CORD TONE 1",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 39.3701
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-ext-cord-tone-1",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10600615"
  },
  {
    "id": "mini_sway",
    "name": "MINI SWAY",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-CA/mini-sway-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true
  },
  {
    "id": "sway",
    "name": "SWAY",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-CA/sway-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true
  },
  {
    "id": "sway_pendant_cap",
    "name": "SWAY PENDANT CAP",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {
      "height": 0.9843,
      "width": 4.2913,
      "length": 4.2913,
      "diameter": 4.2913
    },
    "sourceUrl": "https://in-lite.com/en-CA/sway-pendant-cap-black",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "specWarnings": [],
    "articleNumber": "10704560",
    "finish": "Black"
  },
  {
    "id": "sway_pendant_duo_100_230v",
    "name": "SWAY PENDANT DUO 100-230V",
    "category": "Pendant",
    "cost": null,
    "laborCost": null,
    "geometry": "pendant",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-CA/sway-pendant-duo-100-230v-config",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "specWarnings": [],
    "configurationRequired": true
  },
  {
    "id": "sway_pendant",
    "name": "SWAY PENDANT",
    "category": "Pendant",
    "cost": null,
    "laborCost": null,
    "geometry": "pendant",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/sway-pendant-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true
  },
  {
    "id": "sway_wall",
    "name": "SWAY WALL",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-CA/sway-wall-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true
  },
  {
    "id": "sway_pendant_100v_230v",
    "name": "SWAY PENDANT 100V-230V",
    "category": "Pendant",
    "cost": null,
    "laborCost": null,
    "geometry": "pendant",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/sway-pendant-100v-230v-config",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "specWarnings": [],
    "configurationRequired": true
  },
  {
    "id": "mini_sway_wall",
    "name": "MINI SWAY WALL",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-CA/mini-sway-wall-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ],
    "specWarnings": [
      "Fixture VA not verified; do not treat its electrical load as zero."
    ],
    "configurationRequired": true
  },
  {
    "id": "big_scope",
    "name": "BIG SCOPE",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "spot",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/outdoor-spotlights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "mini_scope_duo",
    "name": "MINI SCOPE DUO",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "spot",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/outdoor-spotlights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "evo_down",
    "name": "EVO DOWN",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {
      "width": 12.598425196850394
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "halo_up_down",
    "name": "HALO UP-DOWN",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {
      "height": 4.724409448818898
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "disc_wall",
    "name": "DISC WALL",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {
      "diameter": 7.874015748031496
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "liv_wall",
    "name": "LIV WALL",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "wall",
    "dimensionsIn": {
      "height": 12.795275590551181
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "voque",
    "name": "VOQUE",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "diameter": 11.811023622047244
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "big_voque",
    "name": "BIG VOQUE",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "diameter": 17.716535433070867
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "big_nero_narrow",
    "name": "BIG NERO NARROW",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-CA/big-nero-narrow",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ],
    "va": 11.9,
    "voltage": "12 volt",
    "requiredCableGauge": "10/2",
    "maxCableRunFt": 131.2336
  },
  {
    "id": "db_led",
    "name": "DB-LED",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "diameter": 0.8661417322834646
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/recessed-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ],
    "incompatibleTransformerIds": [
      "smart_hub300"
    ]
  },
  {
    "id": "db_led_cw",
    "name": "DB-LED (CW)",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "diameter": 0.8661417322834646
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/recessed-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ],
    "incompatibleTransformerIds": [
      "smart_hub300"
    ]
  },
  {
    "id": "evo_flood",
    "name": "EVO FLOOD",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "length": 17
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/recessed-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "dot",
    "name": "DOT",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {
      "diameter": 2.362204724409449
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/recessed-lights",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "aim",
    "name": "AIM",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "spot",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/outdoor-spotlights",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "aim_ceiling",
    "name": "AIM CEILING",
    "category": "Ceiling",
    "cost": null,
    "laborCost": null,
    "geometry": "ceiling",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/outdoor-ceiling-lights",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "nail",
    "name": "NAIL",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "height": 24.015748031496063
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "nail_low",
    "name": "NAIL LOW",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "height": 17.913385826771655
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "breeze",
    "name": "BREEZE",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "height": 39
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "breeze_low",
    "name": "BREEZE LOW",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {
      "height": 24
    },
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "supported": false,
    "legacyRate": false,
    "specificationStatus": "unsupported",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "hub75",
    "name": "HUB-75 120V",
    "category": "Transformer",
    "cost": null,
    "laborCost": null,
    "geometry": "transformer",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/hub-75-120v",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Mount protected from precipitation, at least 50 cm above grade; use the matching HUB PROTECTOR outdoors."
    ],
    "specWarnings": [
      "Enclosure dimensions require verification."
    ],
    "va": 75,
    "voltage": "120 volt input; 12 volt output",
    "transformer": {
      "capacityVa": 75,
      "lineCapacityVa": 75,
      "lines": 2,
      "outputVoltage": 12,
      "smart": false,
      "maxCableLengthFt": {
        "14/2": 131.2336,
        "12/2": 262.4672,
        "10/2": 262.4672
      }
    }
  },
  {
    "id": "smart_hub75",
    "name": "SMART HUB-75 120V",
    "category": "Transformer",
    "cost": null,
    "laborCost": null,
    "geometry": "transformer",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/smart-hub-75-120v",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-specs",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Mount protected from precipitation, at least 50 cm above grade; use the matching HUB PROTECTOR outdoors."
    ],
    "specWarnings": [
      "Enclosure dimensions require verification."
    ],
    "va": 75,
    "voltage": "120 volt input; 12 volt output",
    "transformer": {
      "capacityVa": 75,
      "lineCapacityVa": 75,
      "lines": 2,
      "outputVoltage": 12,
      "smart": true,
      "maxCableLengthFt": {
        "14/2": 131.2336,
        "12/2": 262.4672,
        "10/2": 262.4672
      }
    }
  },
  {
    "id": "cbl_25_14_2",
    "name": "CBL-25 14/2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 984.252
    },
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ],
    "specWarnings": [],
    "cable": {
      "gauge": "14/2",
      "lengthFt": 82.021
    }
  },
  {
    "id": "cbl_200_14_2",
    "name": "CBL-200 14/2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 7874.0157
    },
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ],
    "specWarnings": [],
    "cable": {
      "gauge": "14/2",
      "lengthFt": 656.168
    }
  },
  {
    "id": "cbl_40_14_2",
    "name": "CBL-40 14/2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 1574.8031
    },
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ],
    "specWarnings": [],
    "cable": {
      "gauge": "14/2",
      "lengthFt": 131.2336
    }
  },
  {
    "id": "cbl_80_12_2",
    "name": "CBL-80 12/2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 3149.6063
    },
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ],
    "specWarnings": [],
    "cable": {
      "gauge": "12/2",
      "lengthFt": 262.4672
    }
  },
  {
    "id": "cbl_160_12_2",
    "name": "CBL-160 12/2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 6299.2126
    },
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ],
    "specWarnings": [],
    "cable": {
      "gauge": "12/2",
      "lengthFt": 524.9344
    }
  },
  {
    "id": "cbl_120_10_2",
    "name": "CBL-120 10/2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 4724.4094
    },
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ],
    "specWarnings": [],
    "cable": {
      "gauge": "10/2",
      "lengthFt": 393.7008
    }
  },
  {
    "id": "cbl_ext_cord_1",
    "name": "CBL-EXT CORD 1",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 39.3701
    },
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Fixture-to-system extension; not a substitute for the main two-core circuit cable."
    ],
    "specWarnings": []
  },
  {
    "id": "cbl_ext_cord_2",
    "name": "CBL-EXT CORD 2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 78.7402
    },
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Fixture-to-system extension; not a substitute for the main two-core circuit cable."
    ],
    "specWarnings": []
  },
  {
    "id": "cbl_ext_cord_3",
    "name": "CBL-EXT CORD 3",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "cable",
    "dimensionsIn": {
      "length": 118.1102
    },
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Fixture-to-system extension; not a substitute for the main two-core circuit cable."
    ],
    "specWarnings": []
  },
  {
    "id": "riser_2",
    "name": "RISER 2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ],
    "specWarnings": [
      "Accessory dimensions/pack size require supplier confirmation."
    ]
  },
  {
    "id": "killflash_2",
    "name": "KILLFLASH 2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ],
    "specWarnings": [
      "Accessory dimensions/pack size require supplier confirmation."
    ]
  },
  {
    "id": "fix_3",
    "name": "FIX 3",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ],
    "specWarnings": [
      "Accessory dimensions/pack size require supplier confirmation."
    ]
  },
  {
    "id": "fit",
    "name": "FIT",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ],
    "specWarnings": [
      "Accessory dimensions/pack size require supplier confirmation."
    ]
  },
  {
    "id": "evo_flex_spike",
    "name": "EVO FLEX SPIKE",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ],
    "specWarnings": [
      "Accessory dimensions/pack size require supplier confirmation."
    ]
  },
  {
    "id": "mini_sway_cap",
    "name": "MINI SWAY CAP",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ],
    "specWarnings": [
      "Accessory dimensions/pack size require supplier confirmation."
    ]
  },
  {
    "id": "plate_1",
    "name": "PLATE 1",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ],
    "specWarnings": [
      "Accessory dimensions/pack size require supplier confirmation."
    ]
  },
  {
    "id": "splitter_triple",
    "name": "SPLITTER TRIPLE",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ],
    "specWarnings": [
      "Accessory dimensions/pack size require supplier confirmation."
    ]
  },
  {
    "id": "shield_2",
    "name": "SHIELD 2",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ],
    "specWarnings": [
      "Accessory dimensions/pack size require supplier confirmation."
    ]
  },
  {
    "id": "driver_1",
    "name": "DRIVER 1",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Matching driver for EVO FLEX; included in complete EVO FLEX kits, required separately for a bare strip."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "smart_driver_1",
    "name": "SMART DRIVER 1",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Confirm the exact matching smart driver SKU for the selected bare strip; do not double-order with a complete kit."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "smart_driver_tone_1",
    "name": "SMART DRIVER TONE 1",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": true,
    "compatibilityNotes": [
      "Matching colour driver included with complete SMART EVO FLEX TONE kits."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "easy_lock",
    "name": "EASY-LOCK",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Included with complete fixture kits; add only for a missing/replacement connection."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "mini_waterlock",
    "name": "MINI WATERLOCK",
    "category": "Accessory",
    "cost": null,
    "laborCost": null,
    "geometry": "accessory",
    "dimensionsIn": {},
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Included with EVO FLEX kits; used to seal the manufacturer-designated cut end."
    ],
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ]
  },
  {
    "id": "evo_flex_1_kit",
    "name": "EVO FLEX 1 m \u2014 complete kit",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "length": 39.3701
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Manufacturer recommends 10/2 cable no longer than 40 m."
    ],
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "voltage": "12 V system via included driver",
    "includedAccessoryIds": [
      "driver_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "maxCableRunFt": 131.2336
  },
  {
    "id": "evo_flex_2_kit",
    "name": "EVO FLEX 2 m \u2014 complete kit",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "length": 78.7402
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Manufacturer recommends 10/2 cable no longer than 40 m."
    ],
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "voltage": "12 V system via included driver",
    "includedAccessoryIds": [
      "driver_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "maxCableRunFt": 131.2336
  },
  {
    "id": "evo_flex_3_kit",
    "name": "EVO FLEX 3 m \u2014 complete kit",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "length": 118.1102
    },
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Manufacturer recommends 10/2 cable no longer than 40 m."
    ],
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "voltage": "12 V system via included driver",
    "includedAccessoryIds": [
      "driver_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "maxCableRunFt": 131.2336
  },
  {
    "id": "smart_evo_flex_1_kit",
    "name": "SMART EVO FLEX 1 m \u2014 complete kit",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "length": 39.3701
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies SMART HUB-150 and 10/2 cable no longer than 40 m."
    ],
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "voltage": "12 V system via included driver",
    "includedAccessoryIds": [
      "smart_driver_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "requiresSmartHub": true,
    "maxCableRunFt": 131.2336,
    "compatibleTransformerIds": [
      "smart_hub150"
    ]
  },
  {
    "id": "smart_evo_flex_2_kit",
    "name": "SMART EVO FLEX 2 m \u2014 complete kit",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "length": 78.7402
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies SMART HUB-150 and 10/2 cable no longer than 40 m."
    ],
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "voltage": "12 V system via included driver",
    "includedAccessoryIds": [
      "smart_driver_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "requiresSmartHub": true,
    "maxCableRunFt": 131.2336,
    "compatibleTransformerIds": [
      "smart_hub150"
    ]
  },
  {
    "id": "smart_evo_flex_3_kit",
    "name": "SMART EVO FLEX 3 m \u2014 complete kit",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "length": 118.1102
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies SMART HUB-150 and 10/2 cable no longer than 40 m."
    ],
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "voltage": "12 V system via included driver",
    "includedAccessoryIds": [
      "smart_driver_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "requiresSmartHub": true,
    "maxCableRunFt": 131.2336,
    "compatibleTransformerIds": [
      "smart_hub150"
    ]
  },
  {
    "id": "smart_evo_flex_tone_1_kit",
    "name": "SMART EVO FLEX TONE 1 m \u2014 complete kit",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "length": 39.3701
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies a SMART HUB and 10/2 cable."
    ],
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "voltage": "12 V system via included driver",
    "includedAccessoryIds": [
      "smart_driver_tone_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "requiresSmartHub": true
  },
  {
    "id": "smart_evo_flex_tone_2_kit",
    "name": "SMART EVO FLEX TONE 2 m \u2014 complete kit",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "length": 78.7402
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies a SMART HUB and 10/2 cable."
    ],
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "voltage": "12 V system via included driver",
    "includedAccessoryIds": [
      "smart_driver_tone_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "requiresSmartHub": true
  },
  {
    "id": "smart_evo_flex_tone_5_kit",
    "name": "SMART EVO FLEX TONE 5 m \u2014 complete kit",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {
      "length": 196.8504
    },
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "supported": true,
    "legacyRate": false,
    "specificationStatus": "verified-family",
    "configurationRequired": false,
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies a SMART HUB and 10/2 cable."
    ],
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "voltage": "12 V system via included driver",
    "includedAccessoryIds": [
      "smart_driver_tone_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "requiresSmartHub": true
  }
];

const LEGACY_METADATA:Record<string,Partial<LightingCatalogueProduct>>={
  "hub50": {
    "geometry": "transformer",
    "sourceUrl": "https://in-lite.com/en-US/faq",
    "sourceVerified": true,
    "va": 50,
    "transformer": {
      "capacityVa": 50,
      "lineCapacityVa": 50,
      "lines": 2,
      "outputVoltage": 12,
      "smart": false,
      "maxCableLengthFt": {
        "14/2": 131.2336,
        "12/2": 262.4672,
        "10/2": 262.4672
      }
    },
    "compatibilityNotes": [
      "Retained HUB-50 allowance and identity. HUB-75 is a separate product, not a replacement mapping."
    ]
  },
  "hub100": {
    "geometry": "transformer",
    "sourceUrl": "https://in-lite.com/en-US/system/transformers",
    "sourceVerified": true,
    "va": 100,
    "transformer": {
      "capacityVa": 100,
      "lineCapacityVa": 100,
      "lines": 2,
      "outputVoltage": 12,
      "smart": false,
      "maxCableLengthFt": {
        "14/2": 131.2336,
        "12/2": 262.4672,
        "10/2": 262.4672
      }
    }
  },
  "smart_hub150": {
    "geometry": "transformer",
    "sourceUrl": "https://in-lite.com/en-US/system/transformers",
    "sourceVerified": true,
    "va": 150,
    "transformer": {
      "capacityVa": 150,
      "lineCapacityVa": 100,
      "lines": 3,
      "outputVoltage": 12,
      "smart": true,
      "maxCableLengthFt": {
        "14/2": 131.2336,
        "12/2": 262.4672,
        "10/2": 262.4672
      }
    }
  },
  "puck": {
    "geometry": "recessed",
    "sourceUrl": "https://in-lite.com/en-US/puck-config",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Original allowance says PUCK Dark with a 22 mm description. Exact PUCK versus PUCK 22 article identity is unresolved; confirm before drilling or transformer sizing."
    ]
  },
  "fusion": {
    "geometry": "recessed",
    "sourceUrl": "https://in-lite.com/en-US/faq",
    "sourceVerified": true,
    "incompatibleTransformerIds": [
      "smart_hub300"
    ],
    "compatibilityNotes": [
      "Retains original 60 mm FUSION allowance; do not substitute FUSION 22 specifications. Not compatible with SMART HUB-300."
    ]
  },
  "hyve": {
    "geometry": "recessed",
    "sourceUrl": "https://in-lite.com/en-US/faq",
    "sourceVerified": true,
    "incompatibleTransformerIds": [
      "smart_hub300"
    ],
    "compatibilityNotes": [
      "Retains original 60 mm HYVE allowance; do not substitute HYVE 22 specifications. Not compatible with SMART HUB-300."
    ]
  },
  "evo_hyde": {
    "geometry": "undercap",
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/undercap-lights",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Original unspecified-length EVO HYDE allowance preserved; select 180C or 550 separately for verified physical dimensions."
    ]
  },
  "wedge": {
    "geometry": "wall",
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true
  },
  "blink": {
    "geometry": "wall",
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true,
    "dimensionsIn": {
      "diameter": 3.937007874015748
    }
  },
  "ace": {
    "geometry": "bollard",
    "sourceUrl": "https://in-lite.com/en-US/ace-config",
    "sourceVerified": true
  },
  "liv": {
    "geometry": "bollard",
    "sourceUrl": "https://in-lite.com/en-US/liv-config",
    "sourceVerified": true,
    "dimensionsIn": {
      "height": 24.094488188976378
    }
  },
  "scope": {
    "geometry": "spot"
  },
  "smart_move": {
    "geometry": "accessory"
  },
  "smart_bridge": {
    "geometry": "accessory",
    "sourceUrl": "https://in-lite.com/en-US/smart-lighting",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Smart-home integration accessory; verify the installed SMART HUB firmware and bridge configuration."
    ]
  },
  "smart_extender": {
    "geometry": "accessory",
    "sourceUrl": "https://in-lite.com/en-US/smart-lighting",
    "sourceVerified": false,
    "compatibilityNotes": [
      "Existing range-extender allowance retained; current NA part specification must be confirmed."
    ]
  },
  "cable_14_2": {
    "geometry": "cable",
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "cable": {
      "gauge": "14/2",
      "lengthFt": 100
    },
    "dimensionsIn": {
      "length": 1200
    },
    "compatibilityNotes": [
      "Original generic 100 ft cable allowance retained; not identified as a current CBL coil SKU."
    ]
  },
  "cable_12_2": {
    "geometry": "cable",
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "cable": {
      "gauge": "12/2",
      "lengthFt": 100
    },
    "dimensionsIn": {
      "length": 1200
    },
    "compatibilityNotes": [
      "Original generic 100 ft cable allowance retained; not identified as a current CBL coil SKU."
    ]
  }
};

const originalIds=new Set(INLITE_PRODUCTS.map(p=>p.id));
export const LIGHTING_CATALOGUE:LightingCatalogueProduct[]=[
  ...INLITE_PRODUCTS.map(original=>{
    const exact=VERIFIED_ADDITIONS.find(p=>p.id===original.id);
    const metadata=LEGACY_METADATA[original.id]||{};
    return {
      dimensionsIn:{},sourceUrl:'https://in-lite.com/en-US/system',sourceVerified:false,
      supported:true,specificationStatus:'legacy-allowance' as const,geometry:'accessory' as LightingGeometry,
      compatibilityNotes:[],specWarnings:[],...exact,...metadata,...original,legacyRate:true,
    };
  }),
  ...VERIFIED_ADDITIONS.filter(p=>!originalIds.has(p.id)),
];
export function getLightingProduct(id:string){return LIGHTING_CATALOGUE.find(p=>p.id===id);}
export const LIGHTING_CATALOGUE_COVERAGE={
  checkedOn:'2026-09-07',market:'North America',exhaustive:false,
  categoriesCovered:['recessed','wall','undercap','bollard','spot','pendant','ceiling','transformer','cable','accessory'],
  gaps:[
    'Manufacturer category pagination returned HTTP429/403; all 60 optical/mounting accessories and every finish SKU have not been individually verified.',
    'Configurable family pages omit child-variant VA and dimensions; these fields remain unknown and require confirmation.',
    'Original PUCK, FUSION, HYVE, EVO HYDE and generic cable allowances retain their original identity and rates; unverified identities are not silently mapped to new SKUs.',
    'New products have no verified Deck Craft Pro supplier/labor rate. Null means quote required, never free.',
    'Line-voltage, portable and unverified newer power-system products remain explicitly unsupported on the 12 V circuit.',
  ],
  electricalSourceUrl:'https://in-lite.com/en-US/system/transformers',
  cableSourceUrl:'https://in-lite.com/en-US/cbl-160-102',
} as const;
