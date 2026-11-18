import {INLITE_PRODUCTS} from './types';
import {LIGHTING_RUNTIME_CATALOGUE} from './lightingRuntimeCatalogue';
import type {LightingCatalogueProduct,LightingCategory} from './lightingCatalogueTypes';
export type {LightingCatalogueProduct,LightingGeometry,LightingCategory,CableGauge} from './lightingCatalogueTypes';

/** Full manufacturer presentation catalogue. Physical facts and prices are owned once
 * by lightingRuntimeCatalogue; these lazy display facts never replace the price book. */
export const LIGHTING_CATEGORIES:LightingCategory[]=['Transformer','Recessed','Surface','Bollard','Pendant','Ceiling','Accessory'];
const VERIFIED_DISPLAY:Record<string,Partial<LightingCatalogueProduct>>={
  "evo_hyde_550": {
    "sourceUrl": "https://in-lite.com/en-US/evo-hyde-550-black",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10250150",
    "finish": "Black",
    "watts": 2.0,
    "colorTemperatureK": 2950.0,
    "voltage": "12 volt"
  },
  "evo_hyde_180c_black": {
    "sourceUrl": "https://in-lite.com/en-US/evo-hyde-180c-black",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10250105",
    "finish": "Black",
    "watts": 0.5,
    "colorTemperatureK": 2950.0,
    "voltage": "12 volt"
  },
  "evo_hyde_180c_rosesilver": {
    "sourceUrl": "https://in-lite.com/en-US/evo-hyde-180c-rose-silver",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10250100",
    "finish": "RoseSilver",
    "watts": 0.5,
    "colorTemperatureK": 2850.0,
    "voltage": "12 volt"
  },
  "hyve_22": {
    "sourceUrl": "https://in-lite.com/en-US/hyve-22",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Not compatible with SMART HUB-300."
    ],
    "articleNumber": "10104050",
    "watts": 0.2,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt"
  },
  "fusion_22": {
    "sourceUrl": "https://in-lite.com/en-US/fusion-22",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Not compatible with SMART HUB-300."
    ],
    "articleNumber": "10104100",
    "watts": 0.2,
    "colorTemperatureK": 2750.0,
    "voltage": "12 volt"
  },
  "wedge_slim": {
    "sourceUrl": "https://in-lite.com/en-US/wedge-slim-dark-grey",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10301770",
    "finish": "DarkGrey",
    "watts": 1.0,
    "colorTemperatureK": 2800.0,
    "voltage": "12 volt"
  },
  "mini_wedge": {
    "sourceUrl": "https://in-lite.com/en-US/mini-wedge-dark-grey",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10301780",
    "finish": "DarkGrey",
    "watts": 0.6,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  "dot_22": {
    "sourceUrl": "https://in-lite.com/en-US/dot-22",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10101710",
    "watts": 0.36,
    "colorTemperatureK": 2850.0,
    "voltage": "12 volt"
  },
  "disc_pendant_100_230v": {
    "sourceUrl": "https://in-lite.com/en-US/disc-pendant-100-230v",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "articleNumber": "99080000",
    "finish": "Black",
    "watts": 4.5,
    "colorTemperatureK": 2900.0,
    "voltage": "120 volt"
  },
  "disc_pendant": {
    "sourceUrl": "https://in-lite.com/en-US/disc-pendant-black",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10202650",
    "finish": "Black",
    "watts": 3.0,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  "disc_wall_100_230v": {
    "sourceUrl": "https://in-lite.com/en-US/disc-wall-100-230v",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "articleNumber": "99090010",
    "finish": "Black",
    "watts": 4.5,
    "colorTemperatureK": 2900.0,
    "voltage": "120 volt"
  },
  "disc_pendant_100_230v_duo": {
    "sourceUrl": "https://in-lite.com/en-US/disc-pendant-100-230v-duo",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "articleNumber": "99080020",
    "finish": "Black",
    "watts": 4.5,
    "colorTemperatureK": 2900.0,
    "voltage": "120 volt"
  },
  "puck": {
    "sourceUrl": "https://in-lite.com/en-US/puck-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ]
  },
  "plate_75": {
    "sourceUrl": "https://in-lite.com/en-US/plate-75",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10702101",
    "finish": "StainlessSteel"
  },
  "smart_hub300": {
    "sourceUrl": "https://in-lite.com/en-US/smart-hub-300-120v-black",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "10/2 cable only, maximum 160 m and 130 VA per output. Do not connect DB-LED, HYVE/HYVE 22 or FUSION/FUSION 22."
    ],
    "articleNumber": "10500625",
    "finish": "Black",
    "watts": 300.0,
    "voltage": "120 volt"
  },
  "ring_28_shield": {
    "sourceUrl": "https://in-lite.com/en-US/ring-28-shield-stainless-steel",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10702211",
    "finish": "StainlessSteel"
  },
  "box_100": {
    "sourceUrl": "https://in-lite.com/en-US/box-100-stainless-steel",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10703800",
    "finish": "StainlessSteel"
  },
  "mini_scope": {
    "sourceUrl": "https://in-lite.com/en-US/mini-scope",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10400601",
    "watts": 1.0,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  "scope": {
    "sourceUrl": "https://in-lite.com/en-US/scope",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10400503",
    "watts": 3.0,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  "big_scope_narrow": {
    "sourceUrl": "https://in-lite.com/en-US/big-scope-narrow",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10400902",
    "watts": 5.0,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  "micro_scope": {
    "sourceUrl": "https://in-lite.com/en-US/micro-scope",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10400625",
    "watts": 0.6,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  "smart_scope_tone": {
    "sourceUrl": "https://in-lite.com/en-US/smart-scope-tone",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "A SMART HUB is needed for app-based colour/dimming control."
    ],
    "articleNumber": "10401050",
    "watts": 6.0,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  "sway_pendant_100_230v_triple_black": {
    "sourceUrl": "https://in-lite.com/en-US/sway-pendant-100-230v-triple-black",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "articleNumber": "99250000",
    "finish": "Black",
    "watts": 7.5,
    "colorTemperatureK": 2900.0,
    "voltage": "120 volt"
  },
  "sway_table": {
    "sourceUrl": "https://in-lite.com/en-US/sway-table-black",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "articleNumber": "10202461",
    "finish": "Black",
    "watts": 0.6,
    "colorTemperatureK": 2900.0,
    "voltage": "5.0V-1A"
  },
  "evo_low": {
    "sourceUrl": "https://in-lite.com/en-US/evo-low-black",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10202510",
    "finish": "Black",
    "watts": 2.0,
    "colorTemperatureK": 2950.0,
    "voltage": "12 volt"
  },
  "evo": {
    "sourceUrl": "https://in-lite.com/en-US/evo-black",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10202500",
    "finish": "Black",
    "watts": 2.0,
    "colorTemperatureK": 2950.0,
    "voltage": "12 volt"
  },
  "liv": {
    "sourceUrl": "https://in-lite.com/en-US/liv-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ]
  },
  "disc_low": {
    "sourceUrl": "https://in-lite.com/en-US/disc-low",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Manufacturer lists 12 V and 21 V configurations. Use the matching 12 V system driver/assembly, never a bare 21 V component directly."
    ],
    "articleNumber": "99070000",
    "finish": "Black",
    "watts": 2.9,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt, 21V"
  },
  "disc": {
    "sourceUrl": "https://in-lite.com/en-US/disc",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Manufacturer lists 12 V and 21 V configurations. Use the matching 12 V system driver/assembly, never a bare 21 V component directly."
    ],
    "articleNumber": "99060000",
    "finish": "Black",
    "watts": 2.9,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt, 21V"
  },
  "halo_down": {
    "sourceUrl": "https://in-lite.com/en-US/halo-down-black",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10302600",
    "finish": "Black",
    "watts": 3.0,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt"
  },
  "halo_down_100_230v": {
    "sourceUrl": "https://in-lite.com/en-US/halo-down-100-230v-black",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ],
    "articleNumber": "10302615",
    "finish": "Black",
    "watts": 4.5,
    "colorTemperatureK": 3000.0,
    "voltage": "120 volt"
  },
  "evo_ground_300": {
    "sourceUrl": "https://in-lite.com/en-US/evo-ground-300-black",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10104500",
    "finish": "Black",
    "watts": 1.0,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt"
  },
  "big_nero": {
    "sourceUrl": "https://in-lite.com/en-US/big-nero",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Use 10/2 cable, maximum 40 m. Manufacturer limits per transformer: HUB-50 four, HUB-100 seven, SMART HUB-150 nine; divide over outputs."
    ],
    "watts": 7.5,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  "nero": {
    "sourceUrl": "https://in-lite.com/en-CA/nero",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10103401",
    "watts": 3.0,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  "smart_flux_tone": {
    "sourceUrl": "https://in-lite.com/en-US/smart-flux-tone-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ]
  },
  "evo_flex": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ]
  },
  "scope_ceiling": {
    "sourceUrl": "https://in-lite.com/en-US/scope-ceiling",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10400510",
    "watts": 3.0,
    "colorTemperatureK": 3100.0,
    "voltage": "12 volt"
  },
  "evo_flex_profile_single": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-profile-single",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10250352"
  },
  "smart_evo_flex": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant.",
      "Complete configured kits include the matching smart driver; a bare strip cannot connect directly to EASY-LOCK."
    ]
  },
  "evo_flex_profile": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-profile",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10250351"
  },
  "evo_flex_profile_4": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-profile-4-stainless-steel",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10250385",
    "finish": "StainlessSteel"
  },
  "evo_flex_1_bare": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-1-99120010",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Manufacturer lists 12 V and 21 V configurations. Use the matching 12 V system driver/assembly, never a bare 21 V component directly.",
      "This article is the bare strip without DRIVER. Add DRIVER 1 and connection/mounting accessories. Recommended 10/2 circuit, maximum 40 m."
    ],
    "articleNumber": "99120010",
    "watts": 6.5,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt, 21V"
  },
  "smart_evo_flex_tone": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant.",
      "Complete configured kits include the matching smart driver; a bare strip cannot connect directly to EASY-LOCK."
    ]
  },
  "mini_scope_ceiling": {
    "sourceUrl": "https://in-lite.com/en-US/mini-scope-ceiling",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10400610",
    "watts": 1.0,
    "colorTemperatureK": 2900.0,
    "voltage": "12 volt"
  },
  "smart_evo_flex_2_bare": {
    "sourceUrl": "https://in-lite.com/en-CA/smart-evo-flex-2",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Manufacturer lists 12 V and 21 V configurations. Use the matching 12 V system driver/assembly, never a bare 21 V component directly.",
      "This article is the bare strip without DRIVER. Matching smart driver and waterproof connections are required. Supplier availability must be confirmed."
    ],
    "articleNumber": "99180020",
    "watts": 11.0,
    "colorTemperatureK": 3000.0,
    "voltage": "12 volt, 21V"
  },
  "cbl_160_10_2": {
    "sourceUrl": "https://in-lite.com/en-US/cbl-160-102",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10600400"
  },
  "cbl_40_10_2": {
    "sourceUrl": "https://in-lite.com/en-US/cbl-40-102",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10600210"
  },
  "cable_cap_medium": {
    "sourceUrl": "https://in-lite.com/en-US/cable-cap-medium",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [],
    "articleNumber": "10600905"
  },
  "cc_2_new": {
    "sourceUrl": "https://in-lite.com/en-US/cc-2-new",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10600705"
  },
  "smart_hub_75_120v": {
    "sourceUrl": "https://in-lite.com/en-US/smart-hub-75-120v",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10500645",
    "watts": 75.0,
    "voltage": "120 volt"
  },
  "smart_move": {
    "sourceUrl": "https://in-lite.com/en-US/smart-move",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10500706"
  },
  "evo_flex_ext_cord_1": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-ext-cord-1",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10600610"
  },
  "smart_ext_cord_tone_1": {
    "sourceUrl": "https://in-lite.com/en-US/smart-ext-cord-tone-1",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10600615"
  },
  "mini_sway": {
    "sourceUrl": "https://in-lite.com/en-CA/mini-sway-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ]
  },
  "sway": {
    "sourceUrl": "https://in-lite.com/en-CA/sway-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ]
  },
  "sway_pendant_cap": {
    "sourceUrl": "https://in-lite.com/en-CA/sway-pendant-cap-black",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [],
    "articleNumber": "10704560",
    "finish": "Black"
  },
  "sway_pendant_duo_100_230v": {
    "sourceUrl": "https://in-lite.com/en-CA/sway-pendant-duo-100-230v-config",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ]
  },
  "sway_pendant": {
    "sourceUrl": "https://in-lite.com/en-US/sway-pendant-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ]
  },
  "sway_wall": {
    "sourceUrl": "https://in-lite.com/en-CA/sway-wall-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ]
  },
  "sway_pendant_100v_230v": {
    "sourceUrl": "https://in-lite.com/en-US/sway-pendant-100v-230v-config",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Separate mains, portable, or non-12 V power configuration; excluded from this 12 V deck circuit."
    ]
  },
  "mini_sway_wall": {
    "sourceUrl": "https://in-lite.com/en-CA/mini-sway-wall-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Family listing verified; exact voltage, VA, finish and dimensions must be confirmed for the configured variant."
    ]
  },
  "big_scope": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/outdoor-spotlights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "mini_scope_duo": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/outdoor-spotlights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "evo_down": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "halo_up_down": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "disc_wall": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "liv_wall": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "voque": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "big_voque": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "big_nero_narrow": {
    "sourceUrl": "https://in-lite.com/en-CA/big-nero-narrow",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ],
    "voltage": "12 volt"
  },
  "db_led": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/recessed-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "db_led_cw": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/recessed-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "evo_flood": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/recessed-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "dot": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/recessed-lights",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Select and verify the exact configuration with the supplier."
    ]
  },
  "aim": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/outdoor-spotlights",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ]
  },
  "aim_ceiling": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/outdoor-ceiling-lights",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ]
  },
  "nail": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ]
  },
  "nail_low": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ]
  },
  "breeze": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ]
  },
  "breeze_low": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/path-lights",
    "sourceVerified": true,
    "specificationStatus": "unsupported",
    "compatibilityNotes": [
      "Current family listing includes a newer power-system configuration; individual 12 V compatibility has not been verified. Excluded pending verification."
    ]
  },
  "hub75": {
    "sourceUrl": "https://in-lite.com/en-US/hub-75-120v",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Mount protected from precipitation, at least 50 cm above grade; use the matching HUB PROTECTOR outdoors."
    ],
    "voltage": "120 volt input; 12 volt output"
  },
  "smart_hub75": {
    "sourceUrl": "https://in-lite.com/en-US/smart-hub-75-120v",
    "sourceVerified": true,
    "specificationStatus": "verified-specs",
    "compatibilityNotes": [
      "Mount protected from precipitation, at least 50 cm above grade; use the matching HUB PROTECTOR outdoors."
    ],
    "voltage": "120 volt input; 12 volt output"
  },
  "cbl_25_14_2": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ]
  },
  "cbl_200_14_2": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ]
  },
  "cbl_40_14_2": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ]
  },
  "cbl_80_12_2": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ]
  },
  "cbl_160_12_2": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ]
  },
  "cbl_120_10_2": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Coil purchase length is not the maximum allowed circuit run; follow the selected transformer/gauge limits."
    ]
  },
  "cbl_ext_cord_1": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Fixture-to-system extension; not a substitute for the main two-core circuit cable."
    ]
  },
  "cbl_ext_cord_2": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Fixture-to-system extension; not a substitute for the main two-core circuit cable."
    ]
  },
  "cbl_ext_cord_3": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Fixture-to-system extension; not a substitute for the main two-core circuit cable."
    ]
  },
  "riser_2": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ]
  },
  "killflash_2": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ]
  },
  "fix_3": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ]
  },
  "fit": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ]
  },
  "evo_flex_spike": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ]
  },
  "mini_sway_cap": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ]
  },
  "plate_1": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ]
  },
  "splitter_triple": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ]
  },
  "shield_2": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/accessories",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Match this mounting/optical accessory to the exact fixture; no fixture load is assumed."
    ]
  },
  "driver_1": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Matching driver for EVO FLEX; included in complete EVO FLEX kits, required separately for a bare strip."
    ]
  },
  "smart_driver_1": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Confirm the exact matching smart driver SKU for the selected bare strip; do not double-order with a complete kit."
    ]
  },
  "smart_driver_tone_1": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Matching colour driver included with complete SMART EVO FLEX TONE kits."
    ]
  },
  "easy_lock": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Included with complete fixture kits; add only for a missing/replacement connection."
    ]
  },
  "mini_waterlock": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Included with EVO FLEX kits; used to seal the manufacturer-designated cut end."
    ]
  },
  "evo_flex_1_kit": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Manufacturer recommends 10/2 cable no longer than 40 m."
    ],
    "voltage": "12 V system via included driver"
  },
  "evo_flex_2_kit": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Manufacturer recommends 10/2 cable no longer than 40 m."
    ],
    "voltage": "12 V system via included driver"
  },
  "evo_flex_3_kit": {
    "sourceUrl": "https://in-lite.com/en-US/evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Manufacturer recommends 10/2 cable no longer than 40 m."
    ],
    "voltage": "12 V system via included driver"
  },
  "smart_evo_flex_1_kit": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies SMART HUB-150 and 10/2 cable no longer than 40 m."
    ],
    "voltage": "12 V system via included driver"
  },
  "smart_evo_flex_2_kit": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies SMART HUB-150 and 10/2 cable no longer than 40 m."
    ],
    "voltage": "12 V system via included driver"
  },
  "smart_evo_flex_3_kit": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies SMART HUB-150 and 10/2 cable no longer than 40 m."
    ],
    "voltage": "12 V system via included driver"
  },
  "smart_evo_flex_tone_1_kit": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies a SMART HUB and 10/2 cable."
    ],
    "voltage": "12 V system via included driver"
  },
  "smart_evo_flex_tone_2_kit": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies a SMART HUB and 10/2 cable."
    ],
    "voltage": "12 V system via included driver"
  },
  "smart_evo_flex_tone_5_kit": {
    "sourceUrl": "https://in-lite.com/en-US/smart-evo-flex-tone-config",
    "sourceVerified": true,
    "specificationStatus": "verified-family",
    "compatibilityNotes": [
      "Complete configured kit includes matching driver, EASY-LOCK and MINI WATERLOCK. Cut only at designated markings; seal the cut end.",
      "Use matching profile/clips for mounting; mounting accessories are separate.",
      "Official installation specifies a SMART HUB and 10/2 cable."
    ],
    "voltage": "12 V system via included driver"
  }
};
const LEGACY_DISPLAY:Record<string,Partial<LightingCatalogueProduct>>={
  "hub50": {
    "sourceUrl": "https://in-lite.com/en-US/faq",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Retained HUB-50 allowance and identity. HUB-75 is a separate product, not a replacement mapping."
    ]
  },
  "hub100": {
    "sourceUrl": "https://in-lite.com/en-US/system/transformers",
    "sourceVerified": true
  },
  "smart_hub150": {
    "sourceUrl": "https://in-lite.com/en-US/system/transformers",
    "sourceVerified": true
  },
  "puck": {
    "sourceUrl": "https://in-lite.com/en-US/puck-config",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Original allowance says PUCK Dark with a 22 mm description. Exact PUCK versus PUCK 22 article identity is unresolved; confirm before drilling or transformer sizing."
    ]
  },
  "fusion": {
    "sourceUrl": "https://in-lite.com/en-US/faq",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Retains original 60 mm FUSION allowance; do not substitute FUSION 22 specifications. Not compatible with SMART HUB-300."
    ]
  },
  "hyve": {
    "sourceUrl": "https://in-lite.com/en-US/faq",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Retains original 60 mm HYVE allowance; do not substitute HYVE 22 specifications. Not compatible with SMART HUB-300."
    ]
  },
  "evo_hyde": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/undercap-lights",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Original unspecified-length EVO HYDE allowance preserved; select 180C or 550 separately for verified physical dimensions."
    ]
  },
  "wedge": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true
  },
  "blink": {
    "sourceUrl": "https://in-lite.com/en-US/outdoor-lighting/wall-lights",
    "sourceVerified": true
  },
  "ace": {
    "sourceUrl": "https://in-lite.com/en-US/ace-config",
    "sourceVerified": true
  },
  "liv": {
    "sourceUrl": "https://in-lite.com/en-US/liv-config",
    "sourceVerified": true
  },
  "scope": {},
  "smart_move": {},
  "smart_bridge": {
    "sourceUrl": "https://in-lite.com/en-US/smart-lighting",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Smart-home integration accessory; verify the installed SMART HUB firmware and bridge configuration."
    ]
  },
  "smart_extender": {
    "sourceUrl": "https://in-lite.com/en-US/smart-lighting",
    "sourceVerified": false,
    "compatibilityNotes": [
      "Existing range-extender allowance retained; current NA part specification must be confirmed."
    ]
  },
  "cable_14_2": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Original generic 100 ft cable allowance retained; not identified as a current CBL coil SKU."
    ]
  },
  "cable_12_2": {
    "sourceUrl": "https://in-lite.com/en-US/system/cables",
    "sourceVerified": true,
    "compatibilityNotes": [
      "Original generic 100 ft cable allowance retained; not identified as a current CBL coil SKU."
    ]
  }
};
export const LIGHTING_CATALOGUE:LightingCatalogueProduct[]=LIGHTING_RUNTIME_CATALOGUE.map(product=>{
  const original=INLITE_PRODUCTS.find(p=>p.id===product.id);
  const full={...(original?{sourceUrl:'https://in-lite.com/en-US/system',sourceVerified:false,specificationStatus:'legacy-allowance' as const,compatibilityNotes:[]}:{}),
    ...VERIFIED_DISPLAY[product.id],...(original?LEGACY_DISPLAY[product.id]:{}),
    ...(original?.description===undefined?{}:{description:original.description}),...product} as LightingCatalogueProduct;
  // Preserve the original numeric-field insertion order used by the price-book
  // fingerprint. Display separation changes neither the rate book nor its stamp.
  const ordered:Record<string,unknown>=original?{dimensionsIn:full.dimensionsIn,sourceUrl:full.sourceUrl,sourceVerified:full.sourceVerified,supported:full.supported,specificationStatus:full.specificationStatus,geometry:full.geometry,compatibilityNotes:full.compatibilityNotes,specWarnings:full.specWarnings}:{};
  for(const [key,value] of Object.entries(product)){
    if(key==='supported'){ordered.sourceUrl=full.sourceUrl;ordered.sourceVerified=full.sourceVerified;}
    if(key==='specWarnings')ordered.compatibilityNotes=full.compatibilityNotes;
    if(key==='va'&&full.watts!==undefined)ordered.watts=full.watts;
    ordered[key]=value;
    if(key==='va'&&full.colorTemperatureK!==undefined)ordered.colorTemperatureK=full.colorTemperatureK;
  }
  return Object.assign(ordered,full) as unknown as LightingCatalogueProduct;
});
export function getLightingProduct(id:string){return LIGHTING_CATALOGUE.find(p=>p.id===id);}
export const LIGHTING_CATALOGUE_COVERAGE={
  checkedOn:'2026-09-07',market:'North America',exhaustive:false,
  categoriesCovered:['recessed','wall','undercap','bollard','spot','pendant','ceiling','transformer','cable','accessory'],
  gaps:[
    'Manufacturer category pagination returned HTTP429/403; all 60 optical/mounting accessories and every finish SKU have not been individually verified.',
    'Configurable family pages omit child-variant VA and dimensions; these fields remain unknown and require confirmation.',
    'Original PUCK, FUSION, HYVE, EVO HYDE and generic cable allowances retain their original identity and rates; unverified identities are not silently mapped to new SKUs.',
    'Exact products use documented 2026 supply benchmarks where available. Installation and unmatched supply stay null: quote required, never free.',
    'Line-voltage, portable and unverified newer power-system products remain explicitly unsupported on the 12 V circuit.',
  ],
  electricalSourceUrl:'https://in-lite.com/en-US/system/transformers',
  cableSourceUrl:'https://in-lite.com/en-US/cbl-160-102',
} as const;
