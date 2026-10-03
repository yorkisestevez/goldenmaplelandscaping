import type {OptionGroupId} from './optionGroups';

/**
 * Plain-language "what this is and why you'd pick it" lines for the designer's choices. Shown as the hint under each
 * select and beside each decking collection.
 *
 * Rules for this file (the copy is read as Golden Maple talking):
 * - Describe the option, never promise an outcome. No warranty lengths, credentials, permit handling, schedules or prices:
 *   those are owner-confirmed facts (BUSINESS_FACTS_REQUIRING_CONFIRMATION.md) and the price schedule already shows cost.
 * - Code figures must match docs/deckcraft/structure-sources.md: guards above 600 mm (24 in), 100 mm (4 in) openings,
 *   4 ft frost depth (Barrie deck permit checklist), deck blocks only for unattached low decks (Springwater guide).
 * - One or two sentences. The customer is choosing, not studying.
 */

/** Decking material families. Every collection maps to exactly one (check-deck-option-guides.ts). */
export const DECKING_FAMILIES={
  wood:'Real wood. Lowest upfront cost; it needs a stain or sealer every couple of seasons or it weathers grey.',
  cedar:'Real wood with natural colour. Seal it to keep the colour — left alone it ages to silver-grey.',
  composite:'Capped composite: a wood-and-polymer core inside a protective shell. No staining or sealing — soap and water cleans it.',
  pvc:'Advanced PVC: all polymer, with no wood fibre in the board, so it\'s lighter and doesn\'t soak up water. No staining or sealing.',
  mineral:'Mineral-based composite (Surestone): a mineral-filled core built to resist expanding and shrinking with temperature. No staining or sealing.',
} as const;
export type DeckingFamily=keyof typeof DECKING_FAMILIES;

/** Each offered collection: its family, plus a short positioning line where the manufacturer's own positioning is clear. */
export const COLLECTION_GUIDES:Record<string,{family:DeckingFamily;look?:string}>={
  pressure_treated:{family:'wood'},
  cedar:{family:'cedar'},
  tt_prime_plus:{family:'composite',look:'TimberTech\'s entry composite, in solid wood tones.'},
  tt_prime:{family:'composite',look:'Scalloped profile: grooves under the board make it lighter.'},
  tt_premier:{family:'composite',look:'Full profile: a solid board with no grooves underneath.'},
  tt_premier_plus:{family:'composite'},
  tt_terrain:{family:'composite',look:'Multi-tone wood grain in a mid-range composite.'},
  tt_terrain_plus:{family:'composite',look:'Multi-tone wood grain in a mid-range composite.'},
  tt_reserve:{family:'composite',look:'A reclaimed-wood look with deeper grain and colour variation.'},
  tt_legacy:{family:'composite',look:'TimberTech\'s top composite: hand-scraped texture and exotic-hardwood tones.'},
  tt_harvest:{family:'pvc',look:'TimberTech\'s entry PVC, in calm solid tones.'},
  tt_harvest_plus:{family:'pvc'},
  tt_landmark:{family:'pvc',look:'Multi-tone hardwood colours in a premium PVC.'},
  tt_vintage:{family:'pvc',look:'TimberTech\'s top PVC line, with its richest multi-tone hardwood colours.'},
  deck_vista:{family:'composite',look:'Deckorators\' wood-grain capped composite.'},
  deck_venture:{family:'composite'},
  deck_altitude:{family:'composite'},
  deck_voyage:{family:'mineral'},
  deck_summit:{family:'mineral'},
};

/** Short family names for the collection comparison list. */
const FAMILY_LABELS:Record<DeckingFamily,string>={wood:'Real wood',cedar:'Real wood',composite:'Capped composite',pvc:'Advanced PVC',mineral:'Mineral-based composite'};
export const collectionFamilyLabel=(id:string):string|undefined=>{const g=COLLECTION_GUIDES[id];return g&&FAMILY_LABELS[g.family];};

/** The guide line for a collection: positioning first, then its family. Undefined for an unknown id. */
export function collectionGuide(id:string):string|undefined{
  const g=COLLECTION_GUIDES[id];
  return g&&(g.look?`${g.look} ${DECKING_FAMILIES[g.family]}`:DECKING_FAMILIES[g.family]);
}

/** Per-choice guides for the select-style option groups. Keys are the option values in optionGroups.ts. */
export const OPTION_GUIDES:Partial<Record<OptionGroupId,Record<string,string>>>={
  pattern:{
    Straight:'Boards run one direction. The most efficient layout, with the least cutting.',
    Diagonal:'Boards at 45°. More cutting waste, and composite needs joists at 12 in on centre instead of 16, so it costs more.',
    'Picture Frame':'A border of boards around the edge hides the cut ends for a finished, custom look.',
    Herringbone:'Short boards in a zig-zag. The most cutting and framing of any layout — a feature, not a default.',
  },
  fasteningSystem:{
    Face:'Screws through the top of the board. Fastest and lowest cost, but the screw heads show.',
    Hidden:'Clips in grooved board edges. No screw heads on the surface, for a cleaner look.',
  },
  pictureFrameRows:{
    '0':'No border. Board ends finish at the fascia.',
    '1':'One row of border boards frames the deck and hides the cut ends.',
    '2':'Two rows make a wider border — often done in a contrasting colour.',
  },
  foundation:{
    'Concrete Piers':'Concrete footings poured below the frost line — at least 4 ft deep around Barrie. The usual choice for a deck attached to the house.',
    'Helical Piles':'Steel piles screwed in below frost. Nothing to cure, so framing can start right away — good for tight access or soft ground.',
    'Deck Blocks':'Precast blocks sitting on the ground. Only accepted for small, low decks that aren\'t attached to the house.',
  },
  stairType:{
    Straight:'One straight run of steps. The simplest and least costly stair.',
    Landing:'A flat landing breaks the run — used on taller decks, or to turn the stairs.',
    Winder:'Angled treads turn the corner without a landing. Saves space, but takes more cutting and framing.',
  },
  railingType:{
    None:'No railing. Only an option where the deck surface is 24 in (600 mm) or less above the ground.',
    'Wood Picket':'Wood balusters. The lowest-cost railing; it needs the same staining as wood decking.',
    Aluminum:'Powder-coated aluminum. Low maintenance, with slim balusters.',
    Cable:'Horizontal stainless cables keep the view open. They have to be tightly spaced and tensioned so no opening passes a 4 in (100 mm) sphere.',
    'Glass Panels':'Glass panels in a railing frame — the most open view.',
    'Frameless Glass':'Glass held by a base shoe or standoffs, with no frame around the view.',
    'Fortress AL13':'Fortress Al13 aluminum railing system.',
    'TT Classic':'TimberTech composite railing, built to pair with composite decking.',
    'TT Impression':'TimberTech Impression Rail Express: aluminum railing with a slim, modern profile.',
  },
};

/** The guide for the currently chosen value of a group, if there is one. */
export const optionGuide=(group:OptionGroupId,value:string|number):string|undefined=>OPTION_GUIDES[group]?.[String(value)];
