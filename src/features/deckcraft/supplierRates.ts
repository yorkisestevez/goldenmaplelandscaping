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
  tt_reserve:{supplier:'DeckMart',basis:'published retail benchmark',checkedOn:'2026-09-26',currency:'CAD',boardPrice:103.54,lengthFt:12,engineWidthIn:5.5,sku:'RCGV5412AL',colour:'Antique Leather',url:'https://www.deckmart.com/products/timbertech-antique-leather'},
  tt_terrain:{supplier:'DeckMart',basis:'regular retail benchmark; clearance excluded',checkedOn:'2026-09-26',currency:'CAD',boardPrice:74.06,lengthFt:12,engineWidthIn:5.5,sku:'TCGV5412SM',colour:'Silver Maple',url:'https://www.deckmart.com/products/timbertech-silver-maple'},
} as const;
export const sourcedDeckingSqft=(id:keyof typeof DECKING_RATE_SOURCES)=>{const r=DECKING_RATE_SOURCES[id];return r.boardPrice/(r.lengthFt*r.engineWidthIn/12);};
/** Purchased benchmark boards retain their stock width when a custom narrower cut is drawn. */
export const deckingRateWidth=(id:string,drawnWidth:number)=>DECKING_RATE_SOURCES[id as keyof typeof DECKING_RATE_SOURCES]?.engineWidthIn??drawnWidth;
/** This pricing review adopts a 4 ft basis for the existing stair allowances. Scale actual
 * flights, including full-width level steps, rather than counting risers alone. */
export const STAIR_ALLOWANCE_WIDTH_IN=48;
export const FASCIA_RETAIL_RATES:Record<string,{boardPrice:number;stockIn:number;heightIn:number;sku:string;url:string}>={
  'tt_prime_plus:Coconut Husk':{boardPrice:153.09,stockIn:144,heightIn:11.95,sku:'TTFBE12CH',url:'https://www.deckmart.com/products/timbertech-prime-plus-fascia'},
  'tt_reserve:Antique Leather':{boardPrice:193.05,stockIn:144,heightIn:11.95,sku:'FBRC12AL',url:'https://www.deckmart.com/products/timbertech-reserve-fascia'},
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
