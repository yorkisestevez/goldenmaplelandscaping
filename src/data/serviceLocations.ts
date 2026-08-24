/**
 * Source-of-truth for the Service × Location SEO matrix.
 * Each (service, location) pair generates a unique landing page at /services/:service-:location
 *
 * Notes on local content uniqueness:
 *   - terrain    → injected into "Why this matters here" section
 *   - soil       → drives base-prep paragraph
 *   - projects   → list of typical project types most common in that area
 *   - anchors    → local landmark/neighborhood references for natural local SEO
 *   - postalRoot → first 3 chars of postal code, used in schema
 */

export type ServiceKey = 'interlocking' | 'composite-decking' | 'retaining-walls' | 'landscape-design';
export type LocationKey =
  | 'barrie'
  | 'innisfil'
  | 'oro-medonte'
  | 'springwater'
  | 'orillia'
  | 'wasaga-beach'
  | 'midland'
  | 'collingwood';

export interface ServiceDef {
  slug: ServiceKey;
  name: string;
  shortName: string;
  blurb: string;
  startingPriceText: string;
  perUnitText: string;
  scope: string[];
  whyMatters: string;
  faqs: { q: string; a: string }[];
  heroImg: string;
}

export interface LocationDef {
  slug: LocationKey;
  name: string;
  region: string;
  postalRoot: string;
  lat: number;
  lng: number;
  population: string;
  terrain: string;
  soil: string;
  projects: string[];
  anchors: string[];
  intro: string;
}

export const SERVICES: Record<ServiceKey, ServiceDef> = {
  interlocking: {
    slug: 'interlocking',
    name: 'Interlocking Stone Installation',
    shortName: 'Interlocking',
    blurb:
      'Engineered patios, walkways, and driveways built on a 12–16" base to outlast Ontario freeze-thaw cycles.',
    startingPriceText: '$55–$85',
    perUnitText: 'per square foot installed',
    scope: [
      'Engineered base prep (12–16" excavation, compacted 3/4" clear stone, HPB bedding)',
      'Geotextile separation on clay soils',
      'Premium Techo-Bloc, Permacon, or Unilock pavers',
      'Polymeric or Romex jointing',
      'Drainage planning + 1.5–2% slope away from foundation',
      '5-year sink and settlement warranty',
    ],
    whyMatters:
      "Here's what nobody tells you about an interlocking patio: it's only as good as the 14 inches of compacted base underneath it. The patios that fail in year two? They looked identical to the good ones on day one. The difference is invisible — buried underground, where every cheap contractor cuts the corner. We don't. That's why ours are still flat in 2046.",
    faqs: [
      {
        q: 'How long does an interlocking patio take to install?',
        a: 'A typical 400 sqft patio takes 4–7 days from excavation to final compaction, weather permitting. Restricted access can extend that to 9 days.',
      },
      {
        q: 'What pavers do you recommend?',
        a: 'For 90% of projects we use Techo-Bloc or Permacon. Both offer lifetime transferable warranties and engineered colour mixes that resist freeze-thaw fading. Unilock Beacon Hill is our pick for traditional aesthetics.',
      },
      {
        q: 'What stops the patio from sinking?',
        a: 'Three things: 12–16" of properly compacted clear stone base, geotextile fabric to keep clay from migrating into the base, and 1.5–2% drainage slope to prevent water saturation. We document all three in your build photos.',
      },
      {
        q: "What's included in your warranty?",
        a: 'Five years against sinking, settlement, and joint failure. If a paver moves more than ¼" out of plane within five years of install, we come back and re-set it at no charge.',
      },
    ],
    heroImg: '/images/projects/paver-driveway.JPG',
  },
  'composite-decking': {
    slug: 'composite-decking',
    name: 'Composite Decking Construction',
    shortName: 'Composite Decking',
    blurb:
      'TimberTech and Trex composite decks engineered for Ontario weather — no staining, no rot, 25-year manufacturer warranty.',
    startingPriceText: '$45–$85',
    perUnitText: 'per square foot installed',
    scope: [
      'Pressure-treated structural framing on engineered concrete piers',
      'TimberTech AZEK Vintage or Trex Transcend deck boards',
      'Hidden fastener system — no visible screws',
      'Aluminum or composite railing systems',
      'Integrated low-voltage LED post and stair lighting',
      '25-year manufacturer warranty + our 5-year build warranty',
    ],
    whyMatters:
      "If you've owned a wood deck, you know the truth: every May is a sanding-and-staining ritual, and somewhere around year seven the rot starts. Composite is more upfront and free for two decades after that. By year ten, the math doesn't even compare. By year twenty, you'll wonder why anyone still builds with wood.",
    faqs: [
      {
        q: 'TimberTech vs. Trex — which is better?',
        a: "Both are excellent. TimberTech AZEK Vintage has the most realistic wood grain we've seen and a 50-year limited warranty. Trex Transcend is slightly more affordable with a 25-year warranty. We install both.",
      },
      {
        q: 'Will composite get hot in summer?',
        a: 'Some lighter colours can warm in direct sun. Mid-tone and darker browns stay surprisingly cool. We help you pick a colour and orientation that works for your space.',
      },
      {
        q: 'Do composite boards fade?',
        a: 'Modern capped composites (TimberTech AZEK, Trex Transcend) have engineered UV-stable surfaces. Expect minimal fade in the first 5 years, slight mellowing thereafter — far less than wood.',
      },
      {
        q: 'How long does construction take?',
        a: 'A 300–500 sqft deck typically takes 7–10 working days from footings to railing. Larger multi-level decks run 2–3 weeks.',
      },
    ],
    heroImg: '/images/projects/luxury decking.jpg',
  },
  'retaining-walls': {
    slug: 'retaining-walls',
    name: 'Retaining Wall Construction',
    shortName: 'Retaining Walls',
    blurb:
      'Engineered structural walls built with geogrid reinforcement to hold sloped lots flat — for decades, not seasons.',
    startingPriceText: '$60–$140',
    perUnitText: 'per square foot of wall face',
    scope: [
      '3/4" clear stone footing on compacted aggregate',
      'Allan Block, Techo-Bloc Mini-Creta, or Permacon engineered units',
      'Geogrid reinforcement at every 2 vertical feet (mandatory above 3 feet)',
      '4" perforated drain tile behind wall, daylighted',
      '12" of clear stone backfill before native soil',
      'Engineered cap stones, mortared',
    ],
    whyMatters:
      "A leaning retaining wall is the most expensive mistake we see in this industry. Once a wall tips, it has to come out — every stone of it — and start over. The walls that fail above three feet are almost always the ones built without geogrid. We install geogrid on every single wall, full stop. Not because the engineering code requires it. Because we don't want to be the contractor in your inbox five years from now apologizing.",
    faqs: [
      {
        q: 'Do I need a permit for my retaining wall?',
        a: 'In most Simcoe County municipalities, walls under 3 feet do not need a permit. Walls over 3 feet require an engineered drawing and building permit. We handle both processes.',
      },
      {
        q: 'What is geogrid and why does it matter?',
        a: "Geogrid is high-tensile mesh that ties wall units back into the earth in horizontal layers. It's what keeps a tall wall from rotating forward over time. Walls without it lean by 18 months.",
      },
      {
        q: "What's the lifespan of an engineered retaining wall?",
        a: 'Properly built (engineered base, geogrid, drainage, clear stone backfill), expect 40–50 years of structural life. The pavers above the wall will fail before the wall does.',
      },
      {
        q: 'Can you tier a tall slope?',
        a: 'Yes — tiered walls (two or three 3-foot walls with planted terraces between them) are often more cost-effective than one 8-foot wall, and they look better. We design both.',
      },
    ],
    heroImg: '/images/projects/IMG_4826.jpg',
  },
  'landscape-design': {
    slug: 'landscape-design',
    name: 'Landscape Design Services',
    shortName: 'Landscape Design',
    blurb:
      'Full-property design with site assessment, 3D renderings, planting plans, and fixed-price construction quotes.',
    startingPriceText: '$2,500–$8,000',
    perUnitText: 'design fee, credited if you build with us',
    scope: [
      'On-site assessment and grading survey',
      'Hand sketches → 2D CAD plan → 3D photorealistic renderings',
      'Material and plant selection with samples',
      'Drainage and lighting plan',
      'Phased construction sequence',
      'Fixed-price build quote (not estimates — guaranteed pricing)',
    ],
    whyMatters:
      "Most contractors sketch your project on the back of a quote sheet during the first visit. That's how you end up with a $50K patio that doesn't drain — or matches the wrong side of the house. We separate design from construction on purpose. Get the plan right first. Build the right thing second. The order matters.",
    faqs: [
      {
        q: 'Is the design fee refunded if I build with you?',
        a: '100% — every dollar of the design fee comes off your final invoice if you proceed to construction with us. The fee exists to ensure serious clients and cover the design time.',
      },
      {
        q: 'Can I take your design to another builder?',
        a: 'Yes. The design is yours. Most clients build with us because we know the design intimately, but you are not locked in.',
      },
      {
        q: 'How long does the design process take?',
        a: 'Typical timeline is 4–6 weeks from kickoff: 1 week for measurement and concept, 2–3 weeks for design iteration, 1 week for final renderings and quote.',
      },
      {
        q: 'What if I just want plants and beds, not hardscaping?',
        a: 'We design soft-scape only projects. Planting plans, garden beds, lighting, and irrigation can be designed and built without any patio or wall work.',
      },
    ],
    heroImg: '/images/projects/Outdoor living life.jpeg',
  },
};

export const LOCATIONS: Record<LocationKey, LocationDef> = {
  barrie: {
    slug: 'barrie',
    name: 'Barrie',
    region: 'Simcoe County',
    postalRoot: 'L4M',
    lat: 44.3894,
    lng: -79.6903,
    population: '150,000+',
    terrain:
      'Mixed — flat lakeshore in the south, rolling drumlin slopes in the north and east. Most properties have at least mild grading challenges.',
    soil:
      'Heavy clay south of Mapleview Drive, sandier loam in the north end. Both require deeper base prep than the Ontario average — clay especially needs 14"+ excavation and full geotextile.',
    projects: [
      'Walkout basement decks',
      'Sloped backyard patios with retaining walls',
      'Driveway expansions on corner lots',
      'Front entrance makeovers',
    ],
    anchors: ['Allandale', 'Painswick', 'Holly', 'Letitia Heights', 'Sunnidale Park', 'Centennial Beach'],
    intro:
      "Barrie is home. Half of every season we work within fifteen minutes of our own shop, and we know the streets, the soil, and the houses by heart. If you've spent winters watching cracks open in your driveway or summers wishing you actually used the backyard — we've probably built next door to you, and we'd be glad to be your neighbour for the next twenty years too.",
  },
  innisfil: {
    slug: 'innisfil',
    name: 'Innisfil',
    region: 'Simcoe County',
    postalRoot: 'L9S',
    lat: 44.3,
    lng: -79.6,
    population: '43,000+',
    terrain:
      'Lake Simcoe waterfront properties dominate the east; flatter agricultural lots inland. Lakefront builds need particular care for shoreline drainage and frost setback.',
    soil:
      'Sandy loam near the shoreline, transitioning to clay loam inland. Lakeshore properties drain well — but the high water table requires careful base depth planning.',
    projects: [
      'Lake Simcoe waterfront patios and stairs',
      'Pool surround installations',
      'Outdoor kitchens and entertaining decks',
      'Driveway interlock for cottage-style homes',
    ],
    anchors: ['Lefroy', 'Stroud', 'Alcona', 'Cookstown', 'Big Bay Point', 'Friday Harbour'],
    intro:
      "You bought the Innisfil property to enjoy the lake — not to spend three years fighting a sinking patio or a deck that warps every spring. The lakefront soil here is forgiving, but only for crews who know how to read it. We've spent enough time around Big Bay Point and Friday Harbour to know exactly what these properties demand, and we build to that standard every time.",
  },
  'oro-medonte': {
    slug: 'oro-medonte',
    name: 'Oro-Medonte',
    region: 'Simcoe County',
    postalRoot: 'L0L',
    lat: 44.55,
    lng: -79.55,
    population: '21,000+',
    terrain:
      'Significant grade changes — the Oro Moraine runs through it. Many estate properties sit on natural slopes that require terraced retaining walls and stepped patio designs.',
    soil:
      'Glacial till and gravel in the moraine areas, clay loam in the lowlands. The well-drained moraine soil is forgiving; the low-lying clay sections demand extra attention to drainage and frost depth.',
    projects: [
      'Estate-scale terraced backyards',
      'Long curved driveways with feature entrances',
      'Pool surrounds with integrated retaining',
      'Wooded-lot decks with cantilevered structures',
    ],
    anchors: ['Horseshoe Valley', 'Hawkestone', 'Shanty Bay', 'Sugarbush', 'Simcoe County Forest'],
    intro:
      "An Oro-Medonte property doesn't get built to a template — and it shouldn't. The wooded lots, the moraine slopes, the views you bought the acreage for in the first place. These are projects that demand a contractor who'll spend the time to get the design right before a single tree is touched. That's how we work, every time.",
  },
  springwater: {
    slug: 'springwater',
    name: 'Springwater',
    region: 'Simcoe County',
    postalRoot: 'L9X',
    lat: 44.45,
    lng: -79.85,
    population: '20,000+',
    terrain:
      'Rolling moraine country — Snow Valley, Horseshoe Valley adjacent terrain. Most properties have grade changes that translate into beautiful tiered designs.',
    soil:
      'Sandy loam to gravel in the elevated sections, drainage-challenged clay in the river valleys. Springwater builds typically need careful subsurface drainage planning.',
    projects: [
      'Tiered backyard hardscape with multiple zones',
      'Large rural driveways with culvert integration',
      'Estate decks with hot tub integration',
      'Country home front entrances and stone steps',
    ],
    anchors: ['Midhurst', 'Elmvale', 'Anten Mills', 'Hillsdale', 'Snow Valley'],
    intro:
      "You moved to Springwater for the space. The land. The room to make something beautiful. We've worked across the township from Midhurst to Elmvale, and we've learned that the best projects here — the ones that hold up for decades — are the ones where the design respects what's already there. We build to the land, not against it.",
  },
  orillia: {
    slug: 'orillia',
    name: 'Orillia',
    region: 'Simcoe County',
    postalRoot: 'L3V',
    lat: 44.6,
    lng: -79.42,
    population: '33,000+',
    terrain:
      'Lake Couchiching and Lake Simcoe shoreline plus mature urban neighbourhoods. Older homes mean older drainage systems that need careful integration with new hardscape.',
    soil:
      'Lake-influenced clay loam common across the city, with sandy pockets near the shoreline. Older established neighbourhoods often have surprise utility runs that excavation must respect.',
    projects: [
      'Heritage home walkway and step restorations',
      'Couchiching shoreline patios',
      'Downtown courtyard redesigns',
      'Modern decks for waterfront cottages',
    ],
    anchors: ['Sunshine City', 'Couchiching Beach', 'Atherley', 'Westmount', 'Tudhope Park'],
    intro:
      "Orillia is a city that notices when work is done right — and notices, even more, when it isn't. Heritage homes, Couchiching waterfront, a downtown that takes pride in how things look. If you live here, you've probably already seen what bad landscaping does to a beautiful property. We're here to make sure that's not what happens to yours.",
  },
  'wasaga-beach': {
    slug: 'wasaga-beach',
    name: 'Wasaga Beach',
    region: 'Simcoe County',
    postalRoot: 'L9Z',
    lat: 44.52,
    lng: -80.01,
    population: '24,000+',
    terrain:
      "Sand. The world's longest freshwater beach defines the geology — most of the town sits on deep sandy soils with very high drainage capacity but unique base-prep considerations.",
    soil:
      'Pure sand throughout most of the town. Excellent natural drainage but requires properly compacted aggregate base — sand alone will not support a paver patio long-term.',
    projects: [
      'Beach-house patios with sand integration',
      'Cottage-style decks and screened porches',
      'Driveways for vacation homes',
      'Pool decks with sand-friendly construction',
    ],
    anchors: ['Beach Area 1', 'Beach Area 2', 'Allenwood', 'New Wasaga', 'Wasaga Beach Provincial Park'],
    intro:
      "Building on Wasaga sand isn't like building anywhere else in Ontario — and contractors who don't understand that leave behind patios that disappear into the dunes by year three. We've put in the years to learn how to build on this stuff properly: deeper bases, stabilizing geotextile, the patience to do it right. So your space stays where you built it, every winter, every spring.",
  },
  midland: {
    slug: 'midland',
    name: 'Midland',
    region: 'Simcoe County',
    postalRoot: 'L4R',
    lat: 44.75,
    lng: -79.88,
    population: '17,000+',
    terrain:
      'Georgian Bay shoreline with rocky outcrops in places, gentler terrain inland. Bedrock can complicate excavation in waterfront properties.',
    soil:
      'Variable — rocky shoreline pockets, clay loam inland, sandy loam in the central neighbourhoods. Site-specific assessment is mandatory in Midland.',
    projects: [
      'Georgian Bay waterfront patios',
      'Boathouse and dock-adjacent hardscape',
      'Town-home small-yard makeovers',
      'Cottage walkways through wooded lots',
    ],
    anchors: ['Little Lake', 'Midland Bay', 'Penetanguishene Road', 'Tiffin Park', 'Sainte-Marie among the Hurons'],
    intro:
      "Midland's Georgian Bay properties are some of the most beautiful waterfront in Ontario — and some of the trickiest to build on. The shoreline limestone surprises crews who haven't seen it before. We've worked through it, around it, and on top of it for years. Your property deserves a builder who's already solved its puzzles.",
  },
  collingwood: {
    slug: 'collingwood',
    name: 'Collingwood',
    region: 'Simcoe / Grey County',
    postalRoot: 'L9Y',
    lat: 44.5,
    lng: -80.22,
    population: '25,000+',
    terrain:
      'Niagara Escarpment meets Georgian Bay — dramatic terrain. Blue Mountain area properties often sit on slopes with significant grade changes; downtown is flatter but has deep frost penetration.',
    soil:
      'Shallow soil over limestone bedrock in the escarpment areas, clay loam in town. Bedrock proximity can change excavation strategy completely.',
    projects: [
      'Ski-chalet patios and hot tub decks',
      'Escarpment-view stone walls and terraces',
      'Heritage downtown courtyards',
      'Modern lakefront walkout decks',
    ],
    anchors: ['Blue Mountain', 'Cranberry Resort', 'Tremont', 'Living Water Resort', 'Sunset Point'],
    intro:
      "Collingwood is a town that takes design seriously — from downtown heritage restorations to Blue Mountain chalets perched on the escarpment. You moved here, or built here, because you wanted something better than ordinary. Your outdoor space should match that decision. We build to that level, every project.",
  },
};

export const SERVICE_KEYS: ServiceKey[] = ['interlocking', 'composite-decking', 'retaining-walls', 'landscape-design'];
export const LOCATION_KEYS: LocationKey[] = [
  'barrie',
  'innisfil',
  'oro-medonte',
  'springwater',
  'orillia',
  'wasaga-beach',
  'midland',
  'collingwood',
];

/**
 * Combos that should NOT be auto-generated because a hand-built page already exists.
 * (Currently: the 4 Barrie service pages — Interlocking, RetainingWalls, LandscapeDesign, CompositeDecking)
 */
export const HAND_BUILT_COMBOS = new Set<string>([
  'interlocking-barrie',
  'composite-decking-barrie',
  'retaining-walls-barrie',
  'landscape-design-barrie',
]);

/** All combos that should be auto-generated (28 of them: 4 services × 7 non-Barrie locations). */
export function getAutoCombos(): { service: ServiceKey; location: LocationKey; slug: string }[] {
  const out: { service: ServiceKey; location: LocationKey; slug: string }[] = [];
  for (const svc of SERVICE_KEYS) {
    for (const loc of LOCATION_KEYS) {
      const slug = `${svc}-${loc}`;
      if (HAND_BUILT_COMBOS.has(slug)) continue;
      out.push({ service: svc, location: loc, slug });
    }
  }
  return out;
}
