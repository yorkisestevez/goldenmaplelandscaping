import {MATERIAL_TIERS,type MaterialColor,type RailingType} from './types';

export interface CatalogueDecking {
  id:string;name:string;tier:string;priceRange:string;costPerSqft:number|null;isComposite:boolean;isHidden:boolean;
  colors:MaterialColor[];sourceUrl:string;note?:string;availabilityNote?:string;
}
const timberSource='https://www.timbertech.com/products/decking-overview/deck-collections/';
const deckoratorsSource='https://www.deckorators.com/collections/decking-collections';
const colors=(prefix:string,names:string[])=>names.map(name=>({name,swatch:`${prefix}-${name.toLowerCase().replace(/\s+/g,'-')}.jpg`}));
const addition=(id:string,name:string,tier:string,prefix:string,names:string[],sourceUrl:string,availabilityNote?:string):CatalogueDecking=>({id,name,tier,priceRange:'Supplier quote required',costPerSqft:null,isComposite:true,isHidden:false,colors:colors(prefix,names),sourceUrl,availabilityNote,note:'Manufacturer collection verified; supplier price and local availability need confirmation.'});

/** Presentation/catalogue layer. The original commercial constants are never mutated. */
export const DECKING_CATALOGUE:CatalogueDecking[]=[
  ...MATERIAL_TIERS.map((m):CatalogueDecking=>({...m,colors:m.colors.map(c=>({...c})),sourceUrl:m.id.startsWith('tt_')?timberSource:m.id.startsWith('deck_')?deckoratorsSource:'',
    ...(m.id==='tt_terrain'?{name:'TimberTech Terrain',availabilityNote:'Brown Oak and Silver Maple are Terrain colours. The legacy price-book entry was labelled Terrain+; the existing rate is retained pending supplier confirmation.'}:{}),
    ...(m.id==='tt_vintage'?{colors:[...m.colors.map(c=>({...c})),...colors('tt-vintage',['English Walnut','Dark Hickory'])]}:{}),
  })),
  addition('tt_harvest_plus','TimberTech Advanced PVC Harvest+','Advanced PVC','tt-harvestplus',['Toasted Wheat','Timber Gray'],timberSource),
  addition('tt_terrain_plus','TimberTech Composite Terrain+','Composite','tt-terrainplus',['Dark Oak','Natural White Oak','Weathered Oak'],timberSource),
  addition('tt_premier_plus','TimberTech Composite Premier+','Composite','tt-premierplus',['Natural Oak'],timberSource),
  addition('tt_prime','TimberTech Composite Prime','Composite · scalloped profile','tt-prime',['Maritime Gray','Dark Teak'],timberSource),
  addition('tt_premier','TimberTech Composite Premier','Composite · full profile','tt-prime',['Maritime Gray','Dark Teak'],timberSource),
  addition('deck_summit','Deckorators Summit (Surestone)','Mineral-based composite','dk-summit',['Glacier','Boulder','Cliffside'],deckoratorsSource),
  addition('deck_venture','Deckorators Venture','Composite','dk-venture',['Saltwater','Sandbar','Shoreline'],deckoratorsSource),
  addition('deck_altitude','Deckorators Altitude','Composite · regional availability','dk-altitude',['Sequoia','Highland','Trailstone'],deckoratorsSource,'Manufacturer lists selected western markets. Ontario availability must be confirmed.'),
];

export interface CatalogueRailing {id:string;name:string;sourceUrl:string;baseType:RailingType;quoteRequired:true;notes:string}
export interface ManufacturerAccessory {id:string;name:string;brand:'TimberTech'|'Deckorators';kind:'fascia'|'joist-tape'|'flashing'|'fastener'|'sleeper'|'handrail'|'gate'|'cladding'|'tread'|'border';sourceUrl:string;notes:string;previewSupported:boolean;swatch?:string}
export const MANUFACTURER_ACCESSORIES:ManufacturerAccessory[]=[
  {id:'tt_fascia',name:'TimberTech fascia boards',brand:'TimberTech',kind:'fascia',sourceUrl:'https://www.timbertech.com/resources/deck-building/deck-fascia-board-installation/',notes:'Collection-matched perimeter fascia. Confirm profile and colour availability; fascia-specific fasteners required.',previewSupported:true},
  {id:'tt_protac_joist',name:'TimberTech PRO-Tac joist tape',brand:'TimberTech',kind:'joist-tape',sourceUrl:'https://www.timbertech.com/product/pro-tac-flashing-and-joist-tape/',notes:'Butyl tape over joists and beams. Select roll width for the actual member width.',previewSupported:true},
  {id:'tt_protac_flashing',name:'TimberTech PRO-Tac ledger flashing',brand:'TimberTech',kind:'flashing',sourceUrl:'https://www.timbertech.com/product/pro-tac-flashing-and-joist-tape/',notes:'General flashing widths 4 and 12 inches. Wall integration and waterproofing details require site review.',previewSupported:true},
  {id:'tt_concealoc',name:'TimberTech CONCEALoc hidden clips',brand:'TimberTech',kind:'fastener',sourceUrl:'https://www.timbertech.com/resources/deck-building/timbertech-pro-edge-decking-with-concealoc/',notes:'For compatible grooved TimberTech boards. Preview uses representative clips; confirm the selected board and edge detail.',previewSupported:true},
  {id:'tt_toploc_fascia',name:'TimberTech TOPLoc fascia screws',brand:'TimberTech',kind:'fastener',sourceUrl:'https://www.timbertech.com/product/toploc-fascia-pro-edge/',notes:'Composite fascia fastening system; separate drill bit required. Colour and board compatibility need confirmation.',previewSupported:true},
  {id:'dk_fascia',name:'Deckorators fascia boards',brand:'Deckorators',kind:'fascia',sourceUrl:'https://www.deckorators.com/collections/decking/products/fascia',notes:'Collection-matched fascia. Final profile, thickness and trim colour need supplier confirmation.',previewSupported:true},
  {id:'dk_joist_tape',name:'Deckorators joist and flashing tape',brand:'Deckorators',kind:'joist-tape',sourceUrl:'https://www.deckorators.com/products/joist-and-flashing-tape',notes:'Single-joist and double-joist/beam rolls. Applied over framing; actual roll count depends on selected width.',previewSupported:true},
  {id:'dk_stealthlock',name:'Deckorators StealthLock universal deck clips',brand:'Deckorators',kind:'fastener',sourceUrl:'https://www.deckorators.com/fr/collections/fasteners/products/stealthlock-universal-deck-clips',notes:'Hidden clips for compatible grooved boards on wood joists. Confirm edge-board and joint fastening details.',previewSupported:true},
  {id:'dk_pro_fascia',name:'Deckorators Pro fascia fastening system',brand:'Deckorators',kind:'fastener',sourceUrl:'https://www.deckorators.com/products/pro-fastening-systems',notes:'Fascia screws and installation tool. Final compatible fastener colour and pack quantities need confirmation.',previewSupported:true},
  {id:'dk_sleeper',name:'Deckorators Surestone sleeper system',brand:'Deckorators',kind:'sleeper',sourceUrl:'https://www.deckorators.com/collections/decking/products/sleeper-system',notes:'Only for compatible Surestone decking or porch flooring. Requires a slab/roof drainage and sleeper layout; not modeled by the post-and-joist deck.',previewSupported:false},
  {id:'dk_dark_slate_border',name:'Deckorators Dark Slate picture-frame board',brand:'Deckorators',kind:'border',sourceUrl:'https://www.deckorators.com/products/picture-frame-board',notes:'Dedicated 21-foot border boards in several widths. Select through the independent Border finish control in Materials; supplier quote required.',previewSupported:false,swatch:'dk-border-dark-slate.jpg'},
  {id:'dk_step_treads',name:'Deckorators Surestone step treads',brand:'Deckorators',kind:'tread',sourceUrl:'https://www.deckorators.com/products/picture-frame-board',notes:'Dedicated 11¼-inch-wide tread boards require their own stair cut layout. Current stairs use individual decking planks.',previewSupported:false},
  {id:'dk_gate',name:'Deckorators deck gates',brand:'Deckorators',kind:'gate',sourceUrl:'https://www.deckorators.com/pages/installation-instructions',notes:'Requires a selected opening, gate system, hinges and latch. Gate motion and opening are not modeled.',previewSupported:false},
  {id:'dk_handrail',name:'Deckorators ADA-compliant handrail system',brand:'Deckorators',kind:'handrail',sourceUrl:'https://www.deckorators.com/pages/installation-instructions',notes:'Requires a continuous graspable rail, returns and mounting design. Current guardrail preview does not represent this separate system.',previewSupported:false},
];
const rail=(id:string,name:string,baseType:RailingType,sourceUrl:string,notes='Manufacturer system selection. The preview illustrates its railing family; final profiles, components and supplier rates require confirmation.'):CatalogueRailing=>({id,name,baseType,sourceUrl,quoteRequired:true,notes});
const timberRail='https://www.timbertech.com/products/railing/railing-overview/';
const deckoratorsRail='https://www.deckorators.com/collections/railing';
export const RAILING_CATALOGUE:CatalogueRailing[]=[
  rail('tt_classic_composite','TimberTech Classic Composite · balusters','TT Classic','https://www.timbertech.com/product/classic-composite-series/'),
  rail('tt_classic_cable','TimberTech Classic Composite · CableRail','Cable','https://www.timbertech.com/product/classic-composite-series/','Custom rail pack required. Cable components and brand-specific supplier rate require confirmation.'),
  rail('tt_classic_glass','TimberTech Classic Composite · glass','Glass Panels','https://www.timbertech.com/product/classic-composite-series/','Custom rail pack and glass channel required. Glass is sold separately; glass is incompatible with the drink rail.'),
  rail('tt_impression_express','TimberTech Impression Rail Express · balusters','TT Impression','https://www.timbertech.com/product/impressionrail-express/'),
  rail('tt_impression_cable','TimberTech Impression Rail Express · horizontal cable','Cable','https://www.timbertech.com/product/impressionrail-express/'),
  rail('tt_impression_glass','TimberTech Impression Rail Express · glass','Glass Panels','https://www.timbertech.com/product/impressionrail-express/','Glass channel kit required; glass sold separately. Incompatible with drink rail.'),
  rail('tt_pinnacle','TimberTech Pinnacle Rail','TT Classic',timberRail),
  rail('tt_statement','TimberTech Statement Rail','TT Classic',timberRail),
  rail('tt_fulton','TimberTech Fulton Rail','Aluminum',timberRail,'Steel railing system. Preview shows the metal baluster layout; final steel profiles and supplier rate require confirmation.'),
  rail('tt_reliance','TimberTech Reliance Rail','TT Classic',timberRail),
  rail('tt_advantage','TimberTech Advantage Rail','TT Classic','https://www.timbertech.com/product/advantage-rail/'),
  rail('dk_contemporary','Deckorators Aluminum Contemporary','Aluminum',deckoratorsRail),
  rail('dk_rapid','Deckorators Aluminum Rapid Rail','Aluminum',deckoratorsRail),
  rail('dk_preassembled','Deckorators Pre-assembled Aluminum','Aluminum',deckoratorsRail),
  rail('dk_composite','Deckorators Composite Rail','TT Classic',deckoratorsRail),
  rail('dk_classic_composite','Deckorators Classic Composite Rail','TT Classic',deckoratorsRail),
  rail('dk_contemporary_composite','Deckorators Contemporary Composite Rail','TT Classic',deckoratorsRail),
  rail('dk_cable','Deckorators Contemporary Cable Rail','Cable',deckoratorsRail,'Aluminum posts, rail and stainless cable kits are separate components. A brand-specific supplier quote is required.'),
  rail('dk_glass','Deckorators Glass Rail Post Kit','Glass Panels',deckoratorsRail,'Glass panels are sold separately. Confirm glass specification and compatible top-rail configuration for the project.'),
];
