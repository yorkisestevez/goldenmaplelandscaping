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
  | 'collingwood'
  | 'bradford-west-gwillimbury'
  | 'newmarket';

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
      'Patios, walkways, and driveways planned around site conditions and Ontario freeze-thaw cycles; final base depth is confirmed in the written scope.',
    startingPriceText: '$55–$85',
    perUnitText: 'per square foot installed',
    scope: [
      'Base prep and materials specified for the site; excavation depth is confirmed per project',
      'Geotextile separation on clay soils',
      'Premium Techo-Bloc, Permacon, or Unilock pavers',
      'Polymeric or Romex jointing',
      'Drainage planning + 1.5–2% slope away from foundation',
      'Ask for current written workmanship terms for your project',
    ],
    whyMatters:
      "A patio's performance depends on what is below the surface: appropriate excavation, compaction, drainage and materials. Ask for the proposed base specification in your written scope; the right depth depends on the site and intended loading.",
    faqs: [
      {
        q: 'How long does an interlocking patio take to install?',
        a: 'A typical 400 sqft patio takes 4–7 days from excavation to final compaction, weather permitting. Restricted access can extend that to 9 days.',
      },
      {
        q: 'What pavers do you recommend?',
        a: 'Compare available Techo-Bloc, Permacon and Unilock options against your intended use, finish and budget. Confirm current product availability and manufacturer terms for the selected product; a brand reference does not establish installer certification.',
      },
      {
        q: 'What stops the patio from sinking?',
        a: 'Site-appropriate excavation, compaction, separation and drainage help manage settlement risk. Ask for the materials, depth, drainage design and inspection records applicable to your project in the written scope.',
      },
      {
        q: "What's included in your warranty?",
        a: 'Ask us for the current written workmanship terms, coverage, exclusions, and remedy for your project before contracting.',
      },
    ],
    heroImg: '/images/projects/paver-driveway.JPG',
  },
  'composite-decking': {
    slug: 'composite-decking',
    name: 'Composite Decking Construction',
    shortName: 'Composite Decking',
    blurb:
      'Composite deck options for Ontario weather; available products and any manufacturer warranty are confirmed with the selected product documentation.',
    startingPriceText: '$45–$85',
    perUnitText: 'per square foot installed',
    scope: [
      'Pressure-treated structural framing on engineered concrete piers',
      'TimberTech AZEK Vintage or Trex Transcend deck boards',
      'Hidden fastener system — no visible screws',
      'Aluminum or composite railing systems',
      'Integrated low-voltage LED post and stair lighting',
      'Manufacturer terms (if applicable) and Golden Maple workmanship terms are confirmed in writing for the selected project',
    ],
    whyMatters:
      'Compare composite and wood using purchase cost, maintenance requirements and the selected product documentation. Composite still requires care; neither material has a universal maintenance cost or lifespan.',
    faqs: [
      {
        q: 'TimberTech vs. Trex — which is better?',
        a: "Both are product options worth comparing. Manufacturer warranty availability, duration, exclusions, and transferability depend on the selected product and current manufacturer documentation; confirm them before purchase.",
      },
      {
        q: 'Will composite get hot in summer?',
        a: 'Surface temperature depends on the product, colour, sun exposure and ambient conditions. Review manufacturer temperature guidance and samples for your location before selecting a board.',
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
    heroImg: '/images/portfolio/deck-and-garden-walkway-1-v1-full-1280.webp',
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
      'Reinforcement layout specified for wall geometry, loading and engineering requirements',
      '4" perforated drain tile behind wall, daylighted',
      '12" of clear stone backfill before native soil',
      'Engineered cap stones, mortared',
    ],
    whyMatters:
      'Retaining walls require a coordinated assessment of loading, soil, drainage and reinforcement. Wall height alone does not determine the design. Confirm the applicable engineering and municipal requirements before construction.',
    faqs: [
      {
        q: 'Do I need a permit for my retaining wall?',
        a: 'Permit and engineering requirements depend on the municipality, height, site, and scope. Confirm responsibilities, fees, and application authority with Golden Maple and the relevant authority before work begins.',
      },
      {
        q: 'What is geogrid and why does it matter?',
        a: 'Geogrid can reinforce retained soil as part of a designed wall system. Its need, placement and length depend on the wall system, site loading and engineering specifications.',
      },
      {
        q: "What's the lifespan of an engineered retaining wall?",
        a: 'Service life varies with materials, design, loading, drainage and maintenance. Do not treat a general lifespan estimate as a project warranty; request the applicable written terms.',
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
      'Full-property design options may include site assessment, renderings, planting plans, and construction scope; confirm current deliverables and pricing before booking.',
    startingPriceText: 'Pricing confirmed on request',
    perUnitText: 'current design scope and any credit policy confirmed in writing',
    scope: [
      'On-site assessment and grading survey',
      'Hand sketches → 2D CAD plan → 3D photorealistic renderings',
      'Material and plant selection with samples',
      'Drainage and lighting plan',
      'Phased construction sequence',
      'Written construction scope and pricing provided after project review',
    ],
    whyMatters:
      "Most contractors sketch your project on the back of a quote sheet during the first visit. That's how you end up with a $50K patio that doesn't drain — or matches the wrong side of the house. We separate design from construction on purpose. Get the plan right first. Build the right thing second. The order matters.",
    faqs: [
      {
        q: 'Is the design fee refunded if I build with you?',
        a: 'Design-session pricing and any construction credit are currently subject to confirmation. Ask for the current written policy before booking.',
      },
      {
        q: 'Can I take your design to another builder?',
        a: 'Confirm design ownership, permitted use and transfer rights in the design agreement before commissioning work.',
      },
      {
        q: 'How long does the design process take?',
        a: 'Typical timeline is 4–6 weeks from kickoff: 1 week for measurement and concept, 2–3 weeks for design iteration, 1 week for final renderings and quote.',
      },
      {
        q: 'What if I just want plants and beds, not hardscaping?',
        a: 'Tell us which planting, garden, lighting or irrigation work you have in mind. Confirm current service availability and scope before booking.',
      },
    ],
    heroImg: '/images/portfolio/gazebo-patio-1-v1-full-1280.webp',
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
      'Soil conditions vary by property. Assess soil, water movement and loading before specifying excavation depth, separation and base materials.',
    projects: [
      'Walkout basement decks',
      'Sloped backyard patios with retaining walls',
      'Driveway expansions on corner lots',
      'Front entrance makeovers',
    ],
    anchors: ['Allandale', 'Painswick', 'Holly', 'Letitia Heights', 'Sunnidale Park', 'Centennial Beach'],
    intro:
      'Planning an outdoor project in Barrie? Share the address, site conditions and intended use so we can discuss fit, scope and current availability.',
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
      'An Innisfil outdoor project may need careful attention to drainage, access and shoreline restrictions. Share your project address to confirm service availability and arrange a scope discussion.',
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
      'Springwater properties can offer room for outdoor projects with varied terrain and access. Confirm current service availability for your address, and review the site before choosing a design or construction specification.',
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
  'bradford-west-gwillimbury': {
    slug: 'bradford-west-gwillimbury',
    name: 'Bradford',
    region: 'Simcoe County',
    postalRoot: 'L3Z',
    lat: 44.13,
    lng: -79.63,
    population: '43,000+',
    terrain:
      'Bradford sits on the uplands between Lake Simcoe and the Holland Marsh — flatter than Barrie’s drumlin country, with the Holland River corridors cutting through town. New subdivisions in Bradford and Bond Head sit on generous lots with gentle grades falling toward the marsh and the river valleys.',
    soil:
      'Productive farmland loams transitioning to suburban lots. The Holland Marsh muck soils are protected agricultural land, but low-lying lots near the Holland River corridors can carry high water tables and soft ground — drainage-first base design matters here more than most places we build.',
    projects: [
      'Interlock patios for new-build subdivisions',
      'Double driveways and front walkway upgrades',
      'Grading and drainage for low-lying lots',
      'Family backyard makeovers with room to grow',
    ],
    anchors: ['Bradford', 'Bond Head', 'Deerhurst', 'Green Valley', 'Newton Robinson', "Coulson's Hill"],
    intro:
      'Bradford is one of Simcoe County’s fastest-growing towns — new streets rising between the Holland River and the marsh, full of young families who need their outdoor space to work as hard as they do. We bring Barrie-honed hardscape craft south to Bradford and Bond Head: patios, driveways and drainage-first designs engineered for flat land and high water tables, built for Ontario winters.',
  },
  newmarket: {
    slug: 'newmarket',
    name: 'Newmarket',
    region: 'York Region',
    postalRoot: 'L3X',
    lat: 44.06,
    lng: -79.46,
    population: '88,000+',
    terrain:
      'Newmarket climbs the southern edge of the Oak Ridges Moraine — the town’s protected moraine lands carry Natural Core and Settlement Area designations, with kames, kettles and rolling ridges. The East Holland River corridors thread green ravines through Glenway, Stonehaven and the older neighbourhoods.',
    soil:
      'Fast-draining moraine sands and gravels over the tighter Newmarket Till — the geological formation named after this town. Excellent natural drainage, but the sand demands proper compaction and base design, and lots near the protected moraine areas or river corridors come with strict site-alteration rules.',
    projects: [
      'Moraine-edge patios with ravine outlooks',
      'Outdoor living for Glenway and Stonehaven subdivisions',
      'Retaining walls for sloped moraine lots',
      'Front entrance upgrades in established neighbourhoods',
    ],
    anchors: ['Glenway Estates', 'Stonehaven-Wyndham', 'Armitage', 'Central Newmarket', 'Summerhill Estates', 'Woodland Hill'],
    intro:
      'Newmarket is York Region’s seat — a town of 88,000 built on the edge of the Oak Ridges Moraine, where the ground itself carries the town’s name. Mature streets, new subdivisions, ravine lots and moraine-protected edges: this is terrain with real variety, and it rewards a builder who reads the site before drawing the plan. That’s how we work, every project.',
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
  'bradford-west-gwillimbury',
  'newmarket',
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

/** All combos that should be auto-generated (36 of them: 4 services × 9 non-Barrie locations). */
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
