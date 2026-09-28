import {MATERIAL_TIERS,type MaterialColor,type RailingType} from './types';

export interface CatalogueDecking {
  id:string;name:string;tier:string;priceRange:string;costPerSqft:number|null;isComposite:boolean;isHidden:boolean;
  colors:MaterialColor[];note?:string;availabilityNote?:string;
}
const colors=(prefix:string,names:string[])=>names.map(name=>({name,swatch:`${prefix}-${name.toLowerCase().replace(/\s+/g,'-')}.jpg`}));
const addition=(id:string,name:string,tier:string,prefix:string,names:string[],availabilityNote?:string):CatalogueDecking=>({id,name,tier,priceRange:'Supplier quote required',costPerSqft:null,isComposite:true,isHidden:false,colors:colors(prefix,names),availabilityNote,note:'Manufacturer collection verified; supplier price and local availability need confirmation.'});

/** Runtime values for validation, geometry and pricing. Full manufacturer links and unsupported product descriptions load with the catalogue UI. */
export const DECKING_CATALOGUE:CatalogueDecking[]=[
  ...MATERIAL_TIERS.map((m):CatalogueDecking=>({...m,colors:m.colors.map(c=>({...c})),
    ...(m.id==='tt_terrain'?{name:'TimberTech Terrain',availabilityNote:'Brown Oak and Silver Maple are Terrain colours. Pricing uses a current DeckMart retail benchmark for Terrain, distinct from Terrain+. Confirm the ordered profile, colour, length and delivery.'}:{}),
    ...(m.id==='tt_vintage'?{colors:[...m.colors.map(c=>({...c})),...colors('tt-vintage',['English Walnut','Dark Hickory'])]}:{}),
  })),
  addition('tt_harvest_plus','TimberTech Advanced PVC Harvest+','Advanced PVC','tt-harvestplus',['Toasted Wheat','Timber Gray']),
  addition('tt_terrain_plus','TimberTech Composite Terrain+','Composite','tt-terrainplus',['Dark Oak','Natural White Oak','Weathered Oak']),
  addition('tt_premier_plus','TimberTech Composite Premier+','Composite','tt-premierplus',['Natural Oak']),
  addition('tt_prime','TimberTech Composite Prime','Composite · scalloped profile','tt-prime',['Maritime Gray','Dark Teak']),
  addition('tt_premier','TimberTech Composite Premier','Composite · full profile','tt-prime',['Maritime Gray','Dark Teak']),
  addition('deck_summit','Deckorators Summit (Surestone)','Mineral-based composite','dk-summit',['Glacier','Boulder','Cliffside']),
  addition('deck_venture','Deckorators Venture','Composite','dk-venture',['Saltwater','Sandbar','Shoreline']),
  addition('deck_altitude','Deckorators Altitude','Composite · regional availability','dk-altitude',['Sequoia','Highland','Trailstone'],'Manufacturer lists selected western markets. Ontario availability must be confirmed.'),
];

export interface CatalogueRailing {id:string;name:string;baseType:RailingType;quoteRequired:true;notes:string}
export interface ManufacturerAccessory {id:string;name:string;brand:'TimberTech'|'Deckorators';kind:'fascia'|'joist-tape'|'flashing'|'fastener'|'sleeper'|'handrail'|'gate'|'cladding'|'tread'|'border';notes:string;previewSupported:boolean;swatch?:string}
export const MANUFACTURER_ACCESSORIES:ManufacturerAccessory[]=[{"id":"tt_fascia","name":"TimberTech fascia boards","brand":"TimberTech","kind":"fascia","notes":"Collection-matched perimeter fascia. Confirm profile and colour availability; fascia-specific fasteners required.","previewSupported":true},{"id":"tt_protac_joist","name":"TimberTech PRO-Tac joist tape","brand":"TimberTech","kind":"joist-tape","notes":"Butyl tape over joists and beams. Select roll width for the actual member width.","previewSupported":true},{"id":"tt_protac_flashing","name":"TimberTech PRO-Tac ledger flashing","brand":"TimberTech","kind":"flashing","notes":"General flashing widths 4 and 12 inches. Wall integration and waterproofing details require site review.","previewSupported":true},{"id":"tt_concealoc","name":"TimberTech CONCEALoc hidden clips","brand":"TimberTech","kind":"fastener","notes":"For compatible grooved TimberTech boards. Preview uses representative clips; confirm the selected board and edge detail.","previewSupported":true},{"id":"tt_toploc_fascia","name":"TimberTech TOPLoc fascia screws","brand":"TimberTech","kind":"fastener","notes":"Composite fascia fastening system; separate drill bit required. Colour and board compatibility need confirmation.","previewSupported":true},{"id":"dk_fascia","name":"Deckorators fascia boards","brand":"Deckorators","kind":"fascia","notes":"Collection-matched fascia. Final profile, thickness and trim colour need supplier confirmation.","previewSupported":true},{"id":"dk_joist_tape","name":"Deckorators joist and flashing tape","brand":"Deckorators","kind":"joist-tape","notes":"Single-joist and double-joist/beam rolls. Applied over framing; actual roll count depends on selected width.","previewSupported":true},{"id":"dk_stealthlock","name":"Deckorators StealthLock universal deck clips","brand":"Deckorators","kind":"fastener","notes":"Hidden clips for compatible grooved boards on wood joists. Confirm edge-board and joint fastening details.","previewSupported":true},{"id":"dk_pro_fascia","name":"Deckorators Pro fascia fastening system","brand":"Deckorators","kind":"fastener","notes":"Fascia screws and installation tool. Final compatible fastener colour and pack quantities need confirmation.","previewSupported":true}];
const rail=(id:string,name:string,baseType:RailingType,notes='Manufacturer system selection. The preview illustrates its railing family; final profiles, components and supplier rates require confirmation.'):CatalogueRailing=>({id,name,baseType,quoteRequired:true,notes});
export const RAILING_CATALOGUE:CatalogueRailing[]=[
  rail('tt_classic_composite','TimberTech Classic Composite · balusters','TT Classic'),
  rail('tt_classic_cable','TimberTech Classic Composite · CableRail','Cable','Custom rail pack required. Cable components and brand-specific supplier rate require confirmation.'),
  rail('tt_classic_glass','TimberTech Classic Composite · glass','Glass Panels','Custom rail pack and glass channel required. Glass is sold separately; glass is incompatible with the drink rail.'),
  rail('tt_impression_express','TimberTech Impression Rail Express · balusters','TT Impression'),
  rail('tt_impression_cable','TimberTech Impression Rail Express · horizontal cable','Cable'),
  rail('tt_impression_glass','TimberTech Impression Rail Express · glass','Glass Panels','Glass channel kit required; glass sold separately. Incompatible with drink rail.'),
  rail('tt_pinnacle','TimberTech Pinnacle Rail','TT Classic'),
  rail('tt_statement','TimberTech Statement Rail','TT Classic'),
  rail('tt_fulton','TimberTech Fulton Rail','Aluminum','Steel railing system. Preview shows the metal baluster layout; final steel profiles and supplier rate require confirmation.'),
  rail('tt_reliance','TimberTech Reliance Rail','TT Classic'),
  rail('tt_advantage','TimberTech Advantage Rail','TT Classic'),
  rail('dk_contemporary','Deckorators Aluminum Contemporary','Aluminum'),
  rail('dk_rapid','Deckorators Aluminum Rapid Rail','Aluminum'),
  rail('dk_preassembled','Deckorators Pre-assembled Aluminum','Aluminum'),
  rail('dk_composite','Deckorators Composite Rail','TT Classic'),
  rail('dk_classic_composite','Deckorators Classic Composite Rail','TT Classic'),
  rail('dk_contemporary_composite','Deckorators Contemporary Composite Rail','TT Classic'),
  rail('dk_cable','Deckorators Contemporary Cable Rail','Cable','Aluminum posts, rail and stainless cable kits are separate components. A brand-specific supplier quote is required.'),
  rail('dk_glass','Deckorators Glass Rail Post Kit','Glass Panels','Glass panels are sold separately. Confirm glass specification and compatible top-rail configuration for the project.'),
];
