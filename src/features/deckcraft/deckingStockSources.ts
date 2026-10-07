/** Where each manufacturer-listed length in deckingStock.ts was read, for the materials panel and the stock checks.
 * Kept out of the pricing worker: only ids and inches ship there. Re-check a source before trusting it after a year. */
export interface DeckingStockSource{product:string;sourceUrl:string;verifiedOn:string;boardIn:string;listed:string;note?:string}
const TT='https://www.timbertech.com/product/',DK='https://www.deckorators.com/';
const TT_COMPOSITE='5.36 × 0.94 in actual (5.5 in nominal)',BOTH='Square-shoulder 16 and 20 ft; grooved 12, 16 and 20 ft';
export const DECKING_STOCK_SOURCES:Record<string,DeckingStockSource>={
 tt_prime_plus:{product:'TimberTech EDGE Prime+',sourceUrl:TT+'edge-prime-plus-collection/',verifiedOn:'2026-10-04',boardIn:TT_COMPOSITE,listed:BOTH},
 tt_terrain:{product:'TimberTech PRO Terrain',sourceUrl:TT+'pro-terrain-collection/',verifiedOn:'2026-10-04',boardIn:TT_COMPOSITE,listed:BOTH},
 tt_reserve:{product:'TimberTech PRO Reserve',sourceUrl:TT+'pro-reserve-collection/',verifiedOn:'2026-10-04',boardIn:TT_COMPOSITE,listed:BOTH},
 tt_legacy:{product:'TimberTech PRO Legacy',sourceUrl:TT+'pro-legacy-collection/',verifiedOn:'2026-10-04',boardIn:TT_COMPOSITE,listed:BOTH},
 tt_harvest:{product:'TimberTech Advanced PVC Harvest',sourceUrl:TT+'azek-harvest-collection/',verifiedOn:'2026-10-04',boardIn:'5.5 × 1 in actual',listed:'Square-shoulder 12, 16 and 20 ft (12 ft in Brownstone and Slate Gray only); grooved 12, 16 and 20 ft',note:'Grooved boards are not listed in Kona.'},
 tt_landmark:{product:'TimberTech Advanced PVC Landmark',sourceUrl:TT+'azek-landmark-collection/',verifiedOn:'2026-10-04',boardIn:'5.5 × 1 in actual',listed:BOTH},
 tt_vintage:{product:'TimberTech Advanced PVC Vintage',sourceUrl:TT+'azek-vintage-collection/',verifiedOn:'2026-10-04',boardIn:'5.5 × 1 in actual',listed:BOTH},
 deck_voyage:{product:'Deckorators Voyage',sourceUrl:DK+'en-ca/collections/decking/products/voyage-decking',verifiedOn:'2026-10-04',boardIn:'7/8 × 5-1/2 in',listed:'Grooved 12, 16 and 20 ft; solid edge 16 and 20 ft'},
 deck_vista:{product:'Deckorators Vista',sourceUrl:DK+'collections/decking-collections/products/vista-decking',verifiedOn:'2026-10-04',boardIn:'7/8 × 5-1/2 in',listed:'Grooved and solid edge 12, 16 and 20 ft'},
 'dark-slate':{product:'Deckorators Picture Frame Deck Board, Dark Slate',sourceUrl:DK+'collections/decking-collections/products/picture-frame-board',verifiedOn:'2026-10-04',boardIn:'7/8 × 5-1/2 in',listed:'21 ft'},
};
