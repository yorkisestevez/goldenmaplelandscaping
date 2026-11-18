/**
 * Researched 2025–2026 outdoor-living trends the yard-concept AI may score against.
 * Brief, sources and reasoning: docs/deckcraft/design-trends-2026.md (researched 2026-10-05).
 * Approved by the owner on 2026-10-06, as drafted. Product and colour ids are real ids from src/data/hardscape-index.json.
 * Dependency-free on purpose: it is bundled lazily.
 */

export const DESIGN_TRENDS_STATUS = 'approved' as 'draft' | 'approved';

export type DesignMove =
  | 'raised-patio' | 'fire-room' | 'seat-wall' | 'terraced-beds'
  | 'raised-beds' | 'stone-steps' | 'planting' | 'ground-fit';

export interface DesignTrendSource { title: string; url: string; date?: string }

export interface DesignTrend {
  id: string;
  name: string;
  summary: string;
  /** 0..1 relevance for Barrie residential work. */
  weight: number;
  favours: { products?: string[]; colours?: string[]; moves?: DesignMove[] };
  avoid?: string;
  confidence: 'high' | 'medium' | 'low';
  sources: DesignTrendSource[];
}

const S = {
  techo2026: { title: 'Techo-Bloc Reveals 7 Outdoor Design Ideas to Help Homeowners Create More Intentional Backyards in 2026 (press release)', url: 'https://natlawreview.com/press-releases/techo-bloc-reveals-7-outdoor-design-ideas-help-homeowners-create-more', date: '2026-04-13' },
  techoPatterns2026: { title: 'Techo-Bloc, Best Paver Patterns and Designs for 2026', url: 'https://blog.techo-bloc.com/best-paver-patterns-and-designs-for-2026', date: '2025-04-14' },
  techo2025: { title: 'Techo-Bloc, 12 Backyard Trends 2025', url: 'https://blog.techo-bloc.com/12-backyard-trends-2025-top-landscape-outdoor-design', date: '2025-04-14' },
  unilock2026: { title: 'Unilock, Top 5 Hardscape and Landscape Design Trends in 2026', url: 'https://unilock.com/uncategorized/2026-outdoor-trends/', date: '2026' },
  nalp2026: { title: 'NALP, Five Landscape Design Trends for 2026 (J. Odom)', url: 'https://blog.landscapeprofessionals.org/five-landscape-design-trends-for-2026/', date: '2025-12-29' },
  houzzStudy2026: { title: '2026 U.S. Houzz Outdoor Trends Study (n=1,191)', url: 'https://www.houzz.com/magazine/2026-u-s-houzz-outdoor-trends-study-stsetivw-vs~185306879', date: '2026-06-02' },
  houzz10: { title: 'Houzz, 10 Outdoor Remodeling Trends to Know for 2026', url: 'https://www.houzz.com/magazine/10-outdoor-remodeling-trends-to-know-for-2026-stsetivw-vs~185305660', date: '2026-06-02' },
  houzzPro: { title: 'Houzz Pro, Investing in outdoor living: 5 of the biggest backyard trends of 2026', url: 'https://pro.houzz.com/pro-learn/blog/2026-houzz-outdoor-trends-report', date: '2026-07-09' },
  dutra2026: { title: 'Dutra Landscape & Pools, Top 10 Southern Ontario Landscape Trends for 2026', url: 'https://www.dutrascape.ca/blog/2026-landscape-trends', date: 'Dec 4 (year not shown)' },
  forma2026: { title: 'Forma Landscaping, Top Outdoor Design Trends for 2026 (Ontario)', url: 'https://www.formalandscaping.ca/post/top-outdoor-design-trends-for-2026-landscaping-innovations-transforming-ontario-homes', date: '2025-11-22' },
  nick2026: { title: 'Les Pavages Nick & Associés, 2026 Landscaping Trends (Permacon large formats)', url: 'https://pavagesnick.com/2026-landscaping-trends/' },
  lsrcaNative: { title: 'LSRCA, Native Gardens', url: 'https://lsrca.on.ca/index.php/home/native-gardens/' },
  versaLok7: { title: 'VERSA-LOK Technical Bulletin 7, Tiered Walls', url: 'https://www.versa-lok.com/assets/sites/versalok2016/uploads/assets/uploads/techbull7.pdf', date: '2019' },
  barrieOpenAir: { title: 'City of Barrie Open Air Fires By-law 2004-185 (consolidated), s. 3.2.2', url: 'https://www.barrie.ca/Open-Air-Fires-Bylaw.pdf' },
  barrieOsfba: { title: 'City of Barrie Outdoor Solid Fuel Burning Appliances By-law 2007-210 (summary page)', url: 'https://www.barrie.ca/government/policies-laws/laws-listing/outdoor-solid-fuel-burning-appliances-law' },
  ugaBeds: { title: 'UGA Extension C1027-4, Raised Garden Bed Dimensions', url: 'https://fieldreport.caes.uga.edu/publications/C1027-4/', date: '2022-12-14' },
} satisfies Record<string, DesignTrendSource>;

export const DESIGN_TRENDS: readonly DesignTrend[] = [
  {
    id: 'outdoor-rooms',
    name: 'Defined outdoor rooms',
    summary: 'Smaller, intimate zones (lounge, dining, quiet corner) instead of one large patio. On a slope each room takes its own level pad.',
    weight: 0.9,
    favours: { moves: ['raised-patio', 'fire-room', 'seat-wall', 'stone-steps', 'planting'] },
    avoid: 'One undivided field of paving with furniture floating in it.',
    confidence: 'high',
    sources: [S.nalp2026, S.houzz10, S.unilock2026],
  },
  {
    id: 'gas-fire-room',
    name: 'Fire as the room anchor, gas-first in Barrie',
    summary: 'A fire feature with seating around it is the most-requested room. In Barrie a linear gas table or gas bowl is the practical choice: no burn permit, no 4 m / 15 m wood-fire setbacks.',
    weight: 0.9,
    favours: { moves: ['fire-room', 'seat-wall', 'raised-patio'], products: ['techo-raffinato-wall', 'unilock-u-cara', 'permacon-melville-tandem-wall', 'oaks-nueva-150-wall'] },
    avoid: 'Open masonry wood pits on ordinary lots: an open fire needs a daily permit and 15 m from any dwelling, structure or combustible.',
    confidence: 'high',
    sources: [S.houzzPro, S.nalp2026, S.techo2025, S.dutra2026, S.barrieOpenAir, S.barrieOsfba],
  },
  {
    id: 'seat-walls',
    name: 'Seat walls that edge and zone the patio',
    summary: 'Low walls at seat height define patio edges, add seating and block wind around fire; lighting under the coping. On a slope the uphill retaining wall can finish at seat height.',
    weight: 0.85,
    favours: { moves: ['seat-wall', 'fire-room', 'raised-patio', 'ground-fit'], products: ['unilock-u-cara', 'unilock-pisa-smooth', 'unilock-sienastone-smooth', 'techo-raffinato-wall', 'techo-graphix-wall', 'techo-brandon-wall', 'permacon-melville-tandem-wall', 'oaks-nueva-150-wall', 'oaks-modan'] },
    confidence: 'high',
    sources: [S.unilock2026, S.dutra2026, S.techo2025],
  },
  {
    id: 'warm-earth-palette',
    name: 'Warm, earthy neutrals over cool grey',
    summary: 'Beige, greige, taupe and soft brown are the 2026 manufacturer colour story, replacing all-cool-grey patios.',
    weight: 0.85,
    favours: {
      moves: ['raised-patio', 'seat-wall', 'ground-fit'],
      products: ['unilock-soreno', 'unilock-richcliff', 'unilock-arcana', 'techo-terrazzo-slab', 'techo-blu60-smooth-slab', 'permacon-melville-60-slab', 'oaks-yorkville-60mm-slab'],
      colours: ['toscana-beige', 'pebble-taupe', 'avorio', 'stardust-beige', 'caff-crema', 'beige-cream', 'range-amber-beige', 'champagne'],
    },
    avoid: 'Whole-yard cool grey; keep grey and charcoal for contrast bands.',
    confidence: 'high',
    sources: [S.techo2026, S.unilock2026, S.techo2025],
  },
  {
    id: 'large-format-slabs',
    name: 'Large-format slabs, mixed with smaller units',
    summary: 'Big slabs (24 in and up) give fewer joints and a calmer field; 2026 patterns mix scales, using small units for borders and bands.',
    weight: 0.8,
    favours: {
      moves: ['raised-patio', 'fire-room', 'ground-fit'],
      products: ['unilock-umbriano', 'unilock-arcana', 'unilock-urban-line', 'techo-industria-slab', 'techo-blu60-smooth-slab', 'permacon-mega-melville-slab', 'permacon-melville-18-36-durafusion-slab', 'oaks-nueva-xl-slab', 'oaks-yorkville-60mm-slab'],
    },
    confidence: 'high',
    sources: [S.unilock2026, S.techoPatterns2026, S.nick2026, S.dutra2026],
  },
  {
    id: 'quiet-texture-controlled-contrast',
    name: 'Quiet texture and tone-on-tone contrast',
    summary: 'Understated surface texture; zones defined by small shifts within one colour family. Dark tones (onyx, charcoal) work as borders, steps and accents rather than the main field.',
    weight: 0.6,
    favours: {
      moves: ['raised-patio', 'fire-room', 'stone-steps'],
      products: ['techo-squadra-paver', 'techo-industria-flora-slab', 'techo-blu60-smooth-slab', 'unilock-umbriano', 'unilock-urban-line', 'permacon-mega-melville-slab'],
      colours: ['onyx-black', 'shale-grey', 'greyed-nickel', 'dark-charcoal', 'rockland-black'],
    },
    confidence: 'medium',
    sources: [S.techo2026, S.techoPatterns2026],
  },
  {
    id: 'split-level-terraces',
    name: 'Split levels and planted terraces on slopes',
    summary: 'Break a slope into level pads joined by steps, with planted terraces between short walls instead of one tall wall.',
    weight: 0.75,
    favours: {
      moves: ['terraced-beds', 'stone-steps', 'raised-patio', 'ground-fit', 'planting'],
      products: ['unilock-pisa-2', 'unilock-u-cara', 'techo-mini-cretaarchitectural150-wall', 'techo-semma-wall', 'techo-g-force-wall', 'permacon-vario-wall', 'permacon-lafitt-tandem-wall', 'oaks-ortana', 'oaks-proterra-split', 'oaks-gardenia-linear'],
    },
    avoid: 'Tiers closer than twice the lower wall height: they load each other and need engineering. Multiple tiers cost the most.',
    confidence: 'medium',
    sources: [S.techo2025, S.houzz10, S.versaLok7],
  },
  {
    id: 'organic-ground-fit',
    name: 'Work with the land',
    summary: 'Design around existing grade, trees and greenery rather than clearing and flattening; fewer and shorter walls.',
    weight: 0.6,
    favours: { moves: ['ground-fit', 'planting', 'stone-steps'] },
    avoid: 'Cutting a whole slope flat behind one tall wall when the levels can follow the ground.',
    confidence: 'medium',
    sources: [S.techo2026, S.unilock2026, S.versaLok7],
  },
  {
    id: 'natural-stone-character',
    name: 'Natural stone and authentic materials',
    summary: 'Natural stone, flagstone, sandstone and stacked-stone looks with organic edges, balanced against planting.',
    weight: 0.7,
    favours: {
      moves: ['stone-steps', 'planting', 'terraced-beds', 'ground-fit'],
      products: ['unilock-natural-stone-pavers', 'techo-sandstone-slab', 'unilock-beacon-hill-flagstone', 'unilock-richcliff', 'techo-maya-slab', 'techo-sandstonethinsetveneer-wall', 'unilock-rivercrest-wall', 'unilock-ledgestone'],
    },
    confidence: 'high',
    sources: [S.nalp2026, S.unilock2026, S.techo2025],
  },
  {
    id: 'native-low-maintenance-planting',
    name: 'Low-maintenance, native and pollinator planting',
    summary: 'Native, pollinator and drought-tolerant plants set in groups and layers; terraces and wall tops become planting rather than lawn.',
    weight: 0.85,
    favours: { moves: ['planting', 'terraced-beds', 'raised-beds'] },
    avoid: 'Scattered single plants and large thirsty lawns.',
    confidence: 'high',
    sources: [S.houzzPro, S.houzzStudy2026, S.lsrcaNative],
  },
  {
    id: 'landscape-lighting',
    name: 'Lighting as standard',
    summary: 'Path, step and under-coping seat-wall lighting so the yard works after dark.',
    weight: 0.8,
    favours: { moves: ['seat-wall', 'stone-steps', 'fire-room', 'planting'] },
    confidence: 'high',
    sources: [S.houzzPro, S.houzz10, S.unilock2026, S.techo2025],
  },
  {
    id: 'edible-raised-beds',
    name: 'Raised and terraced beds for food',
    summary: 'Herb and vegetable beds at working height, often built into a terrace or the sunny edge of a patio.',
    weight: 0.5,
    favours: { moves: ['raised-beds', 'terraced-beds'], products: ['unilock-u-cara', 'techo-mini-cretaarchitectural75-wall', 'permacon-wallstone-wall', 'oaks-nueva-75-wall', 'techo-borealis-wall'] },
    confidence: 'medium',
    sources: [S.houzzStudy2026, S.forma2026, S.ugaBeds],
  },
  {
    id: 'permeable-surfaces',
    name: 'Permeable paving',
    summary: 'Permeable interlock for walks and at-grade patios so rain soaks in; suits the low end of a slope.',
    weight: 0.55,
    favours: {
      moves: ['ground-fit', 'planting'],
      products: ['unilock-eco-promenade-ecoterra', 'permacon-aquapave-paver', 'oaks-hydr-eau-pave', 'oaks-enviro-midori', 'techo-aquastorm-paver', 'permacon-turfstone-80-and-100-paver', 'oaks-turf-slab'],
    },
    confidence: 'medium',
    sources: [S.techo2026, S.dutra2026],
  },
  {
    id: 'porcelain-pavers',
    name: 'Porcelain pavers',
    summary: 'Thin, dense porcelain gives an interior-style finish outdoors. Premium; price it before proposing large areas.',
    weight: 0.35,
    favours: { moves: ['raised-patio', 'fire-room'], products: ['permacon-november-mirage-porcelain-tile'], colours: ['land', 'rain', 'warm', 'wind'] },
    confidence: 'medium',
    sources: [S.nalp2026],
  },
  {
    id: 'terrazzo-outdoors',
    name: 'Terrazzo-look slabs',
    summary: 'Interior-inspired terrazzo finishes on patios, mostly in warm light tones.',
    weight: 0.3,
    favours: { moves: ['raised-patio', 'fire-room'], products: ['techo-terrazzo-slab', 'techo-terrazzo-paver'], colours: ['stardust-beige', 'mineral-white', 'moonrock-grey'] },
    confidence: 'low',
    sources: [S.techo2026, S.techo2025],
  },
  {
    id: 'wood-look-hardscape',
    name: 'Wood-texture concrete',
    summary: 'Wood-grain concrete walls, steps and stepping stones for a warm, low-maintenance timber look.',
    weight: 0.25,
    favours: { moves: ['stone-steps', 'seat-wall'], products: ['techo-borealis-slab', 'techo-borealis-wall', 'techo-borealis-stepping-stone-slab'], colours: ['smoked-pine', 'hazelnut-brandy'] },
    confidence: 'low',
    sources: [S.techo2025],
  },
];
