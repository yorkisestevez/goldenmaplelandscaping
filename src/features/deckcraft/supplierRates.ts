/** Sourced cost bases for the local pricing review, checked 2026-09-26.
 * Published prices are purchasing benchmarks, not a job-specific supply quote.
 * Do not map families, bare fixtures, kits or finishes to an unrelated SKU. */
export const LIGHTING_TRADE_SOURCE={supplier:'Islington Nurseries Stone Yard',year:2026,currency:'CAD',basis:'published trade',checkedOn:'2026-09-26',confirmOnOrder:true,url:'https://islingtonstoneyard.com/wp-content/uploads/INL-Stone-Yard-Trade-Price-List-2026.pdf'} as const;
// Exact, unambiguous catalogue identities only. Bare/kit duplicates and finish-dependent
// families remain unpriced until the configuration is known. Installation stays separate.
export const LIGHTING_TRADE_RATES:Record<string,number>={
  evo_hyde_550:132,evo_hyde_180c_black:97,evo_hyde_180c_rosesilver:97,
  wedge_slim:120,ring_28_shield:14,mini_scope:91,big_scope_narrow:148,micro_scope:78,
  smart_scope_tone:211,evo_low:255,evo:296,disc_low:202,disc:224,halo_down:171,
  evo_ground_300:159,big_nero:260,nero:168,scope_ceiling:119,
  evo_flex_profile_4:11,cbl_160_10_2:848,cbl_40_10_2:213,cable_cap_medium:7,
  smart_hub_75_120v:243,evo_flex_ext_cord_1:14,smart_ext_cord_tone_1:17,
  mini_sway:141,sway:151,sway_pendant_cap:17,sway_pendant:146,sway_wall:128,
  mini_sway_wall:118,big_scope:148,mini_scope_duo:210,evo_down:214,halo_up_down:206,
  disc_wall:198,big_voque:701,big_nero_narrow:260,db_led:44,db_led_cw:44,
  evo_flood:204,aim:191,aim_ceiling:136,nail:177,nail_low:159,breeze:112,breeze_low:93,
  hub75:182,smart_hub75:243,cbl_25_14_2:71,cbl_200_14_2:533,cbl_40_14_2:107,
  cbl_80_12_2:234,cbl_160_12_2:452,cbl_120_10_2:635,cbl_ext_cord_1:11,
  cbl_ext_cord_2:15,cbl_ext_cord_3:20,riser_2:43,killflash_2:19,fix_3:13,fit:17,
  evo_flex_spike:12,mini_sway_cap:13,plate_1:19,splitter_triple:14,shield_2:16,
  driver_1:71,smart_driver_1:108,smart_driver_tone_1:114,easy_lock:12,
};
export const DECKING_RATE_SOURCES={
  tt_reserve:{supplier:'DeckMart',basis:'published retail benchmark',checkedOn:'2026-10-08',currency:'CAD',boardPrice:103.54,lengthFt:12,engineWidthIn:5.5,sku:'RCGV5412AL',colour:'Antique Leather',url:'https://www.deckmart.com/products/timbertech-antique-leather'},
  // Live sale $59.25 on 2026-10-08; compare-at $74.06 kept (clearance/sale excluded).
  tt_terrain:{supplier:'DeckMart',basis:'regular retail benchmark; clearance excluded',checkedOn:'2026-10-08',currency:'CAD',boardPrice:74.06,lengthFt:12,engineWidthIn:5.5,sku:'TCGV5412SM',colour:'Silver Maple',url:'https://www.deckmart.com/products/timbertech-silver-maple'},
} as const;
export const sourcedDeckingSqft=(id:keyof typeof DECKING_RATE_SOURCES)=>{const r=DECKING_RATE_SOURCES[id];return r.boardPrice/(r.lengthFt*r.engineWidthIn/12);};
/** Purchased benchmark boards retain their stock width when a custom narrower cut is drawn. */
export const deckingRateWidth=(id:string,drawnWidth:number)=>DECKING_RATE_SOURCES[id as keyof typeof DECKING_RATE_SOURCES]?.engineWidthIn??drawnWidth;
/** This pricing review adopts a 4 ft basis for the existing stair allowances. Scale actual
 * flights, including full-width level steps, rather than counting risers alone. */
export const STAIR_ALLOWANCE_WIDTH_IN=48;
/**
 * DeckMart 12 ft fascia boards only (risers excluded). Prices are regular retail: when Shopify
 * lists a compare-at above the sale price, the compare-at is kept (same rule as Terrain decking).
 * Checked 2026-10-08 via product.js; Deckorators fascia not listed on DeckMart.
 */
const fascia=(boardPrice:number,sku:string,url:string)=>({boardPrice,stockIn:144,heightIn:11.95,sku,url});
export const FASCIA_RETAIL_RATES:Record<string,{boardPrice:number;stockIn:number;heightIn:number;sku:string;url:string}>={
  'tt_prime_plus:Coconut Husk':fascia(153.09,'TTFBE12CH','https://www.deckmart.com/products/timbertech-prime-plus-fascia'),
  'tt_prime_plus:Sea Salt Gray':fascia(153.09,'TTFBE12ST','https://www.deckmart.com/products/timbertech-prime-plus-fascia'),
  'tt_prime_plus:Dark Cocoa':fascia(153.09,'TT12EDFDC','https://www.deckmart.com/products/timbertech-prime-plus-fascia'),
  // Antique Leather live sale $154.44; compare-at $193.05 kept.
  'tt_reserve:Antique Leather':fascia(193.05,'FBRC12AL','https://www.deckmart.com/products/timbertech-reserve-fascia'),
  'tt_reserve:Dark Roast':fascia(193.05,'FBRC12DR','https://www.deckmart.com/products/timbertech-reserve-fascia'),
  'tt_reserve:Driftwood':fascia(193.05,'FBRC12DW','https://www.deckmart.com/products/timbertech-reserve-fascia'),
  'tt_reserve:Reclaimed Chestnut':fascia(193.05,'FBRC12RC','https://www.deckmart.com/products/timbertech-reserve-fascia'),
  'tt_terrain:Brown Oak':fascia(161.79,'FBTC12BO','https://www.deckmart.com/products/timbertech-terrain-fascia'),
  'tt_terrain:Silver Maple':fascia(152.56,'FBTC12SM','https://www.deckmart.com/products/timbertech-terrain-fascia'),
  'tt_terrain_plus:Dark Oak':fascia(152.56,'FBTC12DO','https://www.deckmart.com/products/timbertech-terrain-plus-fascia'),
  'tt_terrain_plus:Weathered Oak':fascia(152.56,'FBTC12WO','https://www.deckmart.com/products/timbertech-terrain-plus-fascia'),
  'tt_terrain_plus:Natural White Oak':fascia(152.56,'FBTC12NW','https://www.deckmart.com/products/timbertech-terrain-plus-fascia'),
  'tt_prime:Maritime Gray':fascia(153.09,'FBE12MG','https://www.deckmart.com/products/timbertech-prime-fascia'),
  'tt_prime:Dark Teak':fascia(153.09,'FBE12DT','https://www.deckmart.com/products/timbertech-prime-fascia'),
  'tt_legacy:Ashwood':fascia(226.62,'FBLC12AW','https://www.deckmart.com/products/timbertech-legacy-fascia'),
  'tt_legacy:Espresso':fascia(220.22,'FBLC12E','https://www.deckmart.com/products/timbertech-legacy-fascia'),
  'tt_legacy:Mocha':fascia(226.62,'FBLC12M','https://www.deckmart.com/products/timbertech-legacy-fascia'),
  'tt_legacy:Pecan':fascia(226.62,'FBLC12P','https://www.deckmart.com/products/timbertech-legacy-fascia'),
  'tt_legacy:Tigerwood':fascia(226.62,'FBLC12TW','https://www.deckmart.com/products/timbertech-legacy-fascia'),
  // Whitewash Cedar live sale $176.18; compare-at $220.22 kept.
  'tt_legacy:Whitewash Cedar':fascia(220.22,'FBLC12WC','https://www.deckmart.com/products/timbertech-legacy-fascia'),
  'tt_landmark:American Walnut':fascia(165.88,'ADR5117512AW','https://www.deckmart.com/products/timbertech-landmark-fascia'),
  'tt_landmark:Boardwalk':fascia(165.88,'ADR5117512BD','https://www.deckmart.com/products/timbertech-landmark-fascia'),
  'tt_landmark:Castle Gate':fascia(165.88,'ADR5117512CG','https://www.deckmart.com/products/timbertech-landmark-fascia'),
  // French White Oak live sale $132.70; compare-at $165.88 kept.
  'tt_landmark:French White Oak':fascia(165.88,'ADR5117512FWO','https://www.deckmart.com/products/timbertech-landmark-fascia'),
  'tt_vintage:Coastline':fascia(250.24,'ADR5117512CS','https://www.deckmart.com/products/timbertech-vintage-fascia'),
  'tt_vintage:English Walnut':fascia(250.24,'ADR5117512EW','https://www.deckmart.com/products/timbertech-vintage-fascia'),
  'tt_vintage:Mahogany':fascia(250.24,'ADR5117512MH','https://www.deckmart.com/products/timbertech-vintage-fascia'),
  'tt_vintage:Weathered Teak':fascia(250.24,'ADR5117512WT','https://www.deckmart.com/products/timbertech-vintage-fascia'),
  'tt_vintage:Dark Hickory':fascia(250.24,'ADR5117512DH','https://www.deckmart.com/products/timbertech-vintage-fascia'),
  'tt_harvest:Slate Gray':fascia(125.03,'ADCR5117512SG','https://www.deckmart.com/products/timbertech-harvest-fascia'),
  'tt_harvest:Brownstone':fascia(125.03,'ADCR5117512BS','https://www.deckmart.com/products/timbertech-harvest-fascia'),
  // Harvest+ live sale $137.96; compare-at $172.45 kept.
  'tt_harvest_plus:Toasted Wheat':fascia(172.45,'ADR5117512TWH','https://www.deckmart.com/products/timbertech-harvest-plus-fascia'),
  'tt_harvest_plus:Timber Gray':fascia(172.45,'ADR5117512TBG','https://www.deckmart.com/products/timbertech-harvest-plus-fascia'),
};
/** Carr 2026, printed trade pages 1-2 of Permacon (PDF pages 7-8).
 * Standard colour, named slab/paver profile, full-bundle basis. Visual hex colour
 * does not identify a purchased manufacturer colour or authorize a prestige premium. */
export const CARR_PAVER_TRADE_2026:Record<string,{rate:number;deliveryPerSqft:number;profile:string}>={
  'permacon-melville':{rate:5.22,deliveryPerSqft:.30,profile:'Melville 60 slab, standard colours'},
  'permacon-cassara':{rate:5.78,deliveryPerSqft:.30,profile:'Cassara slab, standard colours'},
  'permacon-vendome':{rate:5.64,deliveryPerSqft:.30,profile:'Vendome 60, standard colours'},
  'permacon-mondrian-plus':{rate:5.22,deliveryPerSqft:.30,profile:'Mondrian Plus 60, standard colours'},
  'permacon-wilfred':{rate:6.84,deliveryPerSqft:.30,profile:'Wilfrid slab, standard colours'},
  'permacon-rosebel':{rate:6.78,deliveryPerSqft:.30,profile:'Rosebel slab, standard colours'},
  'permacon-mega-melville':{rate:8.58,deliveryPerSqft:.39,profile:'Mega Melville paver, standard colours'},
  'permacon-brooklyn':{rate:10.98,deliveryPerSqft:.30,profile:'Brooklyn paver'},
  'permacon-metrik':{rate:6.04,deliveryPerSqft:.30,profile:'Metrik slab'},
};
/** Published minimum and bracket discounts. Fuel and precise delivery zone remain
 * order-specific. Zone 1 is the local Barrie benchmark, not a promise for every address. */
export function carrPaverFreight2026(unitAmount:number){return unitAmount<600?Math.max(189,unitAmount):unitAmount<=1200?650:unitAmount*.5;}
