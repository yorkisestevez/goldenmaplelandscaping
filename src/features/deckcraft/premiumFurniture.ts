import type {LandscapeAssetId} from './landscapeTypes';

/**
 * The premium outdoor-room furniture DeckCraft draws (2026 trends: low, deep, curved seating, swivels, woven rope,
 * teak, cantilever shade, outdoor kitchens). Every mesh is original geometry built by scripts/build-premium-furniture.ts;
 * each is a visual proxy in the style named, not a manufacturer SKU, and none is priced: supply and install are a quote.
 * Sizes are inches, measured from the built mesh (throw pillows included), so a placement at these sizes is never
 * stretched; the curved sectional carries anchors on its exact plan envelope so its arc centre is known.
 * Seat fronts face local +Z, like the other seats (furnitureFacing.ts).
 */
export const CURVED_SECTIONAL={frontRadiusIn:60,depthIn:34,spanDeg:150,seatHeightIn:17,backHeightIn:29} as const;
const s=CURVED_SECTIONAL,half=s.spanDeg/2*Math.PI/180,outer=s.frontRadiusIn+s.depthIn;
/** The arc centre (where the fire goes) sits this far in front of the sectional's envelope centre. */
export const CURVED_SECTIONAL_ARC_OFFSET_IN=(outer+s.frontRadiusIn*Math.cos(half))/2;

export interface PremiumAsset {id:LandscapeAssetId;name:string;widthIn:number;depthIn:number;heightIn:number;visualNote:string}
const note=(style:string)=>`Original project-owned visual proxy in the ${style} style. Not a manufacturer SKU and not priced: supply and installation require a quote.`;
export const PREMIUM_FURNITURE:PremiumAsset[]=[
 {id:'curved-sectional',name:'Curved modular sectional',widthIn:Math.round(2*outer*Math.sin(half)*10)/10,depthIn:Math.round((outer-s.frontRadiusIn*Math.cos(half))*10)/10,heightIn:33.2,visualNote:note('low, deep curved modular sectional (five 30° modules)')},
 {id:'swivel-lounge-chair',name:'Swivel lounge chair',widthIn:35,depthIn:32.7,heightIn:30.2,visualNote:note('woven-rope barrel swivel lounge chair')},
 {id:'modular-sofa',name:'Low modular sofa',widthIn:120,depthIn:40,heightIn:32.2,visualNote:note('low, deep three-module outdoor sofa')},
 {id:'side-table',name:'Drum side table',widthIn:20,depthIn:20,heightIn:20,visualNote:note('cast-concrete drum side table with a teak top')},
 {id:'cantilever-umbrella',name:'Cantilever umbrella',widthIn:140,depthIn:132,heightIn:105.5,visualNote:note('11 ft octagonal cantilever umbrella (Tuuci Ocean Master MAX type) on a weighted plate')},
 {id:'outdoor-rug',name:'Outdoor rug 9×12',widthIn:144,depthIn:108,heightIn:0.5,visualNote:note('9×12 ft flat-weave outdoor rug with a bound border')},
 {id:'teak-dining-table',name:'Teak dining table',widthIn:96,depthIn:42,heightIn:30,visualNote:note('solid teak eight-seat dining table')},
 {id:'woven-dining-chair',name:'Woven dining armchair',widthIn:23.5,depthIn:24.8,heightIn:32.4,visualNote:note('woven-rope dining armchair on an aluminum frame with teak arms (Gloster Wrap / RH Brera type)')},
 {id:'kitchen-island',name:'Outdoor kitchen island',widthIn:132,depthIn:43.6,heightIn:44.7,visualNote:note('11 ft outdoor kitchen island: 36 in built-in stainless grill, side burner, fridge, stone veneer, leathered granite and a raised bar')},
 {id:'bar-stool',name:'Bar stool',widthIn:18.3,depthIn:19.2,heightIn:39.9,visualNote:note('30 in woven-back bar stool on an aluminum frame')},
 {id:'outdoor-lantern',name:'Floor lantern',widthIn:12,depthIn:12,heightIn:24.4,visualNote:note('teak and glass floor lantern with a warm LED candle (Gloster Compass type)')},
 {id:'infrared-heater',name:'Infrared heater',widthIn:40,depthIn:7,heightIn:119,visualNote:note('beam-mounted electric infrared patio heater (Bromic Tungsten type) on a drop rod; the envelope runs from the deck to the beam')},
];
export const PREMIUM_FURNITURE_IDS=PREMIUM_FURNITURE.map(a=>a.id);
export const premiumAsset=(id:LandscapeAssetId)=>PREMIUM_FURNITURE.find(a=>a.id===id);
