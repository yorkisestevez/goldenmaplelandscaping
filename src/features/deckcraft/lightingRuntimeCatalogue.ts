import {INLITE_PRODUCTS} from './types';
import {LIGHTING_TRADE_RATES,LIGHTING_TRADE_SOURCE} from './supplierRates';
import type {LightingCatalogueProduct,LightingGeometry} from './lightingCatalogueTypes';

/** Cost, physical placement and electrical checks share this single synchronous source.
 * Manufacturer display facts live in lightingCatalogue and stay out of initial pricing.
 * No sourced dimensions, rates, accessory requirements or specification warnings are removed. */
export type LightingRuntimeProduct=Omit<LightingCatalogueProduct,'articleNumber'|'colorTemperatureK'|'compatibilityNotes'|'description'|'finish'|'sourceUrl'|'sourceVerified'|'specificationStatus'|'voltage'|'watts'>;

const VERIFIED_ADDITIONS:LightingRuntimeProduct[]=[
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 2.1
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 0.6
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 0.6
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 0.2,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 0.2,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 1.0
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 0.6
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 0.5
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
    "supported": false,
    "legacyRate": false,
    "specWarnings": [],
    "va": 11.8
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 4.9
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
    "supported": false,
    "legacyRate": false,
    "specWarnings": [],
    "va": 4.7
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
    "supported": false,
    "legacyRate": false,
    "specWarnings": [],
    "va": 11.8
  },
  {
    "id": "puck",
    "name": "PUCK",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {},
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 2.0
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 5.2
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 7.9
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 1.1
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 9.5,
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
    "supported": false,
    "legacyRate": false,
    "specWarnings": [],
    "va": 21.3
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
    "supported": false,
    "legacyRate": false,
    "specWarnings": [],
    "va": 2.0
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 2.1
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 2.1
  },
  {
    "id": "liv",
    "name": "LIV",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {},
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [
      "Height inch/mm fields conflict on manufacturer page; metric specification converted to inches."
    ],
    "va": 4.9
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [
      "Height inch/mm fields conflict on manufacturer page; metric specification converted to inches."
    ],
    "va": 4.9
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 5.0
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
    "supported": false,
    "legacyRate": false,
    "specWarnings": [],
    "va": 11.5
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 1.0
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 11.9,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 4.7
  },
  {
    "id": "smart_flux_tone",
    "name": "SMART FLUX TONE",
    "category": "Recessed",
    "cost": null,
    "laborCost": null,
    "geometry": "recessed",
    "dimensionsIn": {},
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 4.8
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
  },
  {
    "id": "smart_evo_flex",
    "name": "SMART EVO FLEX",
    "category": "Surface",
    "cost": null,
    "laborCost": null,
    "geometry": "undercap",
    "dimensionsIn": {},
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 9.9,
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
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 2.0
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 15.7,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": [],
    "va": 75.0
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
  },
  {
    "id": "mini_sway",
    "name": "MINI SWAY",
    "category": "Bollard",
    "cost": null,
    "laborCost": null,
    "geometry": "bollard",
    "dimensionsIn": {},
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
    "specWarnings": []
  },
  {
    "id": "sway_pendant_duo_100_230v",
    "name": "SWAY PENDANT DUO 100-230V",
    "category": "Pendant",
    "cost": null,
    "laborCost": null,
    "geometry": "pendant",
    "dimensionsIn": {},
    "supported": false,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
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
    "supported": false,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
    "specWarnings": [
      "Variant VA and complete dimensions are not verified."
    ],
    "va": 11.9,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": false,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": false,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": false,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": false,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": false,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": false,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Enclosure dimensions require verification."
    ],
    "va": 75,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Enclosure dimensions require verification."
    ],
    "va": 75,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": true,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
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
    "supported": true,
    "legacyRate": false,
    "configurationRequired": false,
    "specWarnings": [
      "Complete-kit VA must be confirmed; do not treat unknown load as zero."
    ],
    "includedAccessoryIds": [
      "smart_driver_tone_1",
      "easy_lock",
      "mini_waterlock"
    ],
    "requiredCableGauge": "10/2",
    "requiresSmartHub": true
  }
];
const LEGACY_METADATA:Record<string,Partial<LightingRuntimeProduct>>={
  "hub50": {
    "geometry": "transformer",
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
    }
  },
  "hub100": {
    "geometry": "transformer",
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
    "geometry": "recessed"
  },
  "fusion": {
    "geometry": "recessed",
    "incompatibleTransformerIds": [
      "smart_hub300"
    ]
  },
  "hyve": {
    "geometry": "recessed",
    "incompatibleTransformerIds": [
      "smart_hub300"
    ]
  },
  "evo_hyde": {
    "geometry": "undercap"
  },
  "wedge": {
    "geometry": "wall"
  },
  "blink": {
    "geometry": "wall",
    "dimensionsIn": {
      "diameter": 3.937007874015748
    }
  },
  "ace": {
    "geometry": "bollard"
  },
  "liv": {
    "geometry": "bollard",
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
    "geometry": "accessory"
  },
  "smart_extender": {
    "geometry": "accessory"
  },
  "cable_14_2": {
    "geometry": "cable",
    "cable": {
      "gauge": "14/2",
      "lengthFt": 100
    },
    "dimensionsIn": {
      "length": 1200
    }
  },
  "cable_12_2": {
    "geometry": "cable",
    "cable": {
      "gauge": "12/2",
      "lengthFt": 100
    },
    "dimensionsIn": {
      "length": 1200
    }
  }
};
const originalIds=new Set(INLITE_PRODUCTS.map(p=>p.id));
export const LIGHTING_RUNTIME_CATALOGUE:LightingRuntimeProduct[]=[
  ...INLITE_PRODUCTS.map(original=>{
    const {id,name,category,cost,laborCost}=original;
    return {dimensionsIn:{},supported:true,geometry:'accessory' as LightingGeometry,specWarnings:[],
      ...VERIFIED_ADDITIONS.find(p=>p.id===id),...LEGACY_METADATA[id],id,name,category,cost,laborCost,legacyRate:true};
  }),
  ...VERIFIED_ADDITIONS.filter(p=>!originalIds.has(p.id)),
].map(p=>LIGHTING_TRADE_RATES[p.id]===undefined?p:{...p,cost:LIGHTING_TRADE_RATES[p.id],rateSource:LIGHTING_TRADE_SOURCE});
export function getLightingRuntimeProduct(id:string){return LIGHTING_RUNTIME_CATALOGUE.find(p=>p.id===id);}
