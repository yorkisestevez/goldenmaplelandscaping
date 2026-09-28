/**
 * Barrie money pages rendered by src/components/BarrieServicePage.tsx.
 *
 * One record per page so the copy can be checked like data:
 * scripts/check-barrie-services.ts (npm run lint) asserts the slug doesn't collide
 * with the service x town matrix, the title and H1 carry the keyword from
 * docs/seo-authority/keyword-map.json, titles are unique, and a page exists only
 * while its BUSINESS.serviceOfferings fact is publishable. The postbuild claim
 * gate (scripts/claim-rules.json) still scans the rendered HTML.
 *
 * Copy rules (2026-09-27): no universal base depth (construction.baseDepth is
 * conflicting), no price ranges until the owner supplies them, no credential,
 * warranty, review or "free" claims, no promise to handle permits.
 *
 * Side-effect-free: react-router.config.ts may import it at build time.
 */
import { BUSINESS, publicClaimCopy, type BusinessFact } from './business';
import type { ProjectCategory } from './projects';

export interface BarrieServiceDef {
  /** URL slug under /services/ — always ends in -barrie. */
  slug: `${string}-barrie`;
  primaryKeyword: string;
  /** <title> (the SEO component appends the business name). */
  title: string;
  description: string;
  h1: string;
  /** Large display line under the H1: [plain, italic]. */
  tagline: [string, string];
  serviceType: string;
  intro: string[];
  scopeHeading: string;
  scope: string[];
  sections: { heading: string; body: string[] }[];
  faqs: { q: string; a: string }[];
  /** Attested portfolio categories to show as related work (empty = none shown). */
  projectCategories: ProjectCategory[];
  projectsHeading: string;
  related: { label: string; to: string }[];
  /** /cost-estimator?type= value (VALID_PROJECT_TYPES in Estimator.tsx). */
  estimatorType: 'patio' | 'steps' | 'kitchen' | 'wall' | 'full';
  offering: BusinessFact<string>;
}

const PERMITS = publicClaimCopy(BUSINESS.commercialPolicies.permits, 'Permit needs and responsibilities are confirmed for each project.');

export const BARRIE_SERVICES: readonly BarrieServiceDef[] = [
  {
    slug: 'interlocking-driveways-barrie',
    primaryKeyword: 'Interlock Driveways',
    title: 'Interlock Driveways Barrie | Driveway Pavers Built for Vehicle Loads',
    description: 'Interlock driveways in Barrie built on a base sized for vehicle loads, clay soil and freeze-thaw, with borders, edge restraint and drainage planned per site.',
    h1: 'Interlock Driveways in Barrie',
    tagline: ['A driveway built for cars,', 'not just curb appeal.'],
    serviceType: 'Interlock driveway installation',
    intro: [
      "A driveway is the hardest-working surface on the property. It carries a vehicle's weight every day, takes plow blades and salt all winter, and on many Barrie lots it sits on clay or silty soil that heaves when it freezes. A patio-grade base under a driveway is the most common reason interlock ruts, sinks at the apron, or pushes its border out within a few seasons.",
      'We plan interlock driveways from the ground down: what the soil is, where the water goes, how the car turns, and what holds the edges. The paver and pattern come after that.',
    ],
    scopeHeading: 'What a driveway scope covers',
    scope: [
      'Removal and haul-away of the old asphalt, concrete or interlock',
      'Excavation to a depth set by soil, drainage and vehicle use, written into the scope',
      'Geotextile separation over clay subgrade',
      'Compacted 3/4" clear stone base with high-performance bedding (HPB)',
      'Soldier course or border band on a concrete-backed edge restraint',
      'Grading that moves water away from the garage and foundation',
      'Polymeric sand jointing',
      'Clean tie-ins at the garage slab, walkway and front steps',
    ],
    sections: [
      {
        heading: 'Why driveway interlock fails in Barrie',
        body: [
          "Most failed driveways come down to three things: a base sized for foot traffic, water that sits in the base instead of draining through it, and edges with nothing holding them. Tires turning in place push sideways on the pavers. If the border isn't locked in, the field slowly walks outward and the joints open.",
          "The clay and silty soils found on many Barrie sites make all three worse. They hold water, and water that freezes under a driveway lifts it. The fix isn't \"more gravel\" by default. It's separating the clay from the stone with geotextile, giving water a way out, and sizing the base for the load it actually carries.",
        ],
      },
      {
        heading: 'Base, bedding and edges',
        body: [
          'Our driveway bases are compacted 3/4-inch clear stone over a geotextile separation layer, with high-performance bedding under the pavers. Clear stone is open-graded: water passes through it instead of sitting in it, which matters on sites where the subgrade drains slowly.',
          "Driveway bases are built deeper than patio bases because they carry vehicles. The exact excavation depth depends on the soil, the drainage and how the driveway is used, and it's written into your scope before work starts. It isn't quoted as a one-size number.",
          "The edges get as much attention as the field. A soldier course or border band sits on a concrete-backed restraint so the pavers can't spread under turning tires.",
        ],
      },
      {
        heading: 'Choosing pavers for a driveway',
        body: [
          'Driveway pavers are usually 60 to 80 mm thick. Thicker units, laid in an interlocking pattern such as herringbone, resist the twisting load of turning tires better than running bond or large-format slabs.',
          'Large, thin slabs that look great on a patio are generally the wrong choice where cars park. We install pavers from manufacturers including Permacon, Unilock and Techo-Bloc, and follow the manufacturer\'s guidance for the unit you choose.',
          'Colour matters too. Darker, textured pavers hide tire marks and the odd oil drip better than smooth, light tones.',
        ],
      },
      {
        heading: 'Winter, salt and snow clearing',
        body: [
          "Concrete pavers made to the CSA A231.2 standard are tested for freeze-thaw durability in the presence of de-icing salt. If a section ever settles, individual units can be lifted and reset. Poured concrete and asphalt can't be repaired that way.",
          'Clear the driveway with a plastic-edged blade or a plow fitted with skid shoes, and skip metal ice choppers on the surface. If you would rather not shovel at all, a heated driveway has to be planned into the base from the start.',
        ],
      },
      {
        heading: 'Widening, curb cuts and grading',
        body: [
          "Replacing a driveway at the same footprint usually doesn't change anything at the road. Widening it or moving the curb cut needs a Right-of-Way Activity (ROWA) permit from the City of Barrie and has to meet zoning, and lot grading has to keep water moving away from your house and off your neighbour's property.",
          PERMITS,
        ],
      },
    ],
    faqs: [
      { q: 'How long does an interlock driveway last in Barrie?', a: 'With a base sized for vehicle loads, working drainage and a locked-in edge, an interlock driveway can last for decades, and individual pavers can be lifted and reset instead of replacing the whole surface. Early failures are most often base, drainage or edge-restraint problems, not the pavers themselves.' },
      { q: 'Is interlock better than asphalt or concrete for a driveway?', a: "Asphalt costs the least up front and poured concrete sits in the middle. Interlock costs more, but it can be repaired paver by paver and it moves with freeze-thaw without cracking across the whole surface. The right choice depends on budget, how long you'll own the home and how the driveway ties into the front entrance." },
      { q: 'How deep is the base under an interlock driveway?', a: 'Deeper than a patio base, because it carries vehicles. There is no single correct number: depth is set by soil, drainage and use, and it is written into the scope for your site.' },
      { q: 'Can you widen my driveway?', a: `Often, yes. In Barrie, widening a driveway or changing the curb cut needs a Right-of-Way Activity (ROWA) permit from the City and has to meet zoning, lot grading and drainage. ${PERMITS}` },
      { q: 'Will a snowplow damage an interlock driveway?', a: 'Not if the surface is flush and the edges are restrained. Ask your snow contractor to use a plastic-edged blade or skid shoes, and avoid chipping ice with metal tools.' },
    ],
    projectCategories: ['Driveways'],
    projectsHeading: 'Driveway work by Golden Maple',
    related: [
      { label: 'Interlocking Driveway Lifespan in Ontario', to: '/resources/interlocking-driveway-lifespan-ontario' },
      { label: 'Heated Driveways: Are They Worth It in Barrie?', to: '/resources/heated-driveway-worth-it-barrie' },
      { label: 'Clear Stone vs. Granular A', to: '/resources/clear-stone-vs-granular-a-base' },
      { label: 'Interlocking patios & walkways', to: '/services/interlocking-barrie' },
    ],
    estimatorType: 'patio',
    offering: BUSINESS.serviceOfferings.interlockDriveways,
  },
  {
    slug: 'porcelain-patios-barrie',
    primaryKeyword: 'Porcelain Patios',
    title: 'Porcelain Patios Barrie | Porcelain Pavers on a Frost-Ready Base',
    description: 'Porcelain patios in Barrie: outdoor porcelain pavers on a base designed for freeze-thaw, with the right setting method, jointing and slip resistance.',
    h1: 'Porcelain Patios in Barrie',
    tagline: ['Porcelain looks like tile.', 'It has to be built like a patio.'],
    serviceType: 'Porcelain paver patio installation',
    intro: [
      "Outdoor porcelain pavers give you the clean, large-format look of interior tile. They absorb almost no water, the colour doesn't fade, and the surface shrugs off wine, grease and pool chemicals. They are also unforgiving. A porcelain slab can't be tamped into place like a concrete paver, and it cracks or rocks if the base underneath moves.",
      'In Barrie that means designing the base for freeze-thaw and clay soil first. The porcelain is the finish; the base is the patio.',
    ],
    scopeHeading: 'What a porcelain patio scope covers',
    scope: [
      'Site and drainage review before layout',
      'Excavation and a compacted base sized to the site',
      'A setting method matched to the porcelain product: bedding over aggregate, pedestals over a slab, or a bonded install',
      'Layout planned to limit cuts and line joints up with doors, steps and borders',
      'Joint spacers and a jointing material suited to porcelain',
      'Borders, steps and transitions to interlock, decking or lawn',
      'A slip-resistance check for pool surrounds, steps and shaded areas',
    ],
    sections: [
      {
        heading: "What porcelain pavers are, and what they aren't",
        body: [
          'Outdoor porcelain pavers are usually about 20 mm (3/4 inch) thick and fired at high temperature, so they absorb very little water. Porcelain tile is defined by water absorption of 0.5% or less. Low absorption is why good outdoor porcelain resists frost damage and staining better than most natural stone and concrete, and its fired-in colour resists fading.',
          "What they aren't is flexible. Concrete pavers interlock and tolerate a little base movement. A large porcelain slab bridges over any soft spot and eventually cracks or rocks. Every porcelain decision starts with how the base will stay flat through a Barrie winter.",
        ],
      },
      {
        heading: 'Three ways to install porcelain outdoors',
        body: [
          'Bedding over a compacted aggregate base. This is common for patios at grade, where the porcelain manufacturer approves the method for the application.',
          'Pedestals over a concrete slab. The slabs sit on adjustable supports, which keeps them level and lets water drain underneath. This is often used over existing concrete.',
          'Bonded to a concrete slab with an exterior-rated setting material. This is the most rigid option, used for steps and high-traffic transitions.',
          "The right method depends on the existing surface, drainage, height limits at the doors and what the porcelain manufacturer specifies. We confirm it in the written scope rather than defaulting to one system.",
        ],
      },
      {
        heading: 'Slip resistance, pools and steps',
        body: [
          'Outdoor porcelain comes in textured finishes made for wet areas. Around pools, on steps and on shaded patios that stay damp, choose an exterior finish and check the manufacturer\'s rating for wet use.',
          'Step treads usually need a matching bullnose or coping piece. Transitions to interlock or lawn need an edge that holds the porcelain in place.',
        ],
      },
      {
        heading: 'Porcelain, interlock or natural stone?',
        body: [
          'Interlock is the most forgiving over Barrie clay and the easiest to repair. Natural stone brings real variation and warmth, but it absorbs more water and needs sealing decisions. Porcelain gives the most consistent, low-maintenance surface, at the cost of a more demanding install.',
          'A common approach is to mix them: porcelain on the main patio, interlock on the walkways and driveway.',
        ],
      },
      {
        heading: 'Looking after a porcelain patio',
        body: [
          'Porcelain pavers generally don\'t need sealing; follow the manufacturer\'s care guide for your finish. Sweep, rinse, and use a pH-neutral cleaner for grease. Check the joints each spring and top up any gaps with the same jointing product that was used during installation.',
        ],
      },
    ],
    faqs: [
      { q: 'Is porcelain good for patios in Ontario winters?', a: "Outdoor-rated porcelain is very frost-resistant because it absorbs almost no water. The risk isn't the slab, it's the base. If the base heaves or settles, rigid slabs crack or rock, so the base and drainage have to be designed for freeze-thaw first." },
      { q: 'Can porcelain go over my existing concrete patio?', a: "Sometimes. If the slab is sound, drains properly and there's room for the added height at the door, pedestals or a bonded install over the concrete can work. A cracked or heaving slab usually has to come out first." },
      { q: 'Is a porcelain patio slippery when wet?', a: 'Outdoor porcelain comes in textured finishes made for wet areas. Choose one rated for exterior and pool use, especially for steps and pool surrounds.' },
      { q: 'Does a porcelain patio cost more than interlock?', a: 'Usually. The material costs more and the installation is slower and less forgiving. Pricing is confirmed in the written scope for your site.' },
      { q: 'Do porcelain pavers need to be sealed?', a: "Generally not. Porcelain absorbs so little water that it doesn't need a sealer the way concrete or natural stone can; follow the manufacturer's care guide for your finish. The joints are maintained separately." },
    ],
    projectCategories: ['Patios & interlocking'],
    projectsHeading: 'Patio work by Golden Maple',
    related: [
      { label: 'Pool Deck Materials Compared: Porcelain, Concrete Pavers, Natural Stone', to: '/resources/pool-deck-materials-ontario' },
      { label: "Natural Stone vs. Pavers: A Buyer's Guide", to: '/resources/natural-stone-vs-pavers-barrie' },
      { label: 'Best Pavers for Pool Decks in Simcoe County', to: '/resources/best-pavers-pool-deck-simcoe-county' },
      { label: 'Patio contractor in Barrie', to: '/patios-barrie' },
    ],
    estimatorType: 'patio',
    offering: BUSINESS.serviceOfferings.porcelainPatios,
  },
  {
    slug: 'outdoor-kitchens-barrie',
    primaryKeyword: 'Outdoor Kitchens',
    title: 'Outdoor Kitchens Barrie | Outdoor Kitchen Design & Construction',
    description: 'Outdoor kitchens in Barrie planned with the patio they sit on: frost-ready foundations, gas and power routed before paving, and winter-proof materials.',
    h1: 'Outdoor Kitchens in Barrie',
    tagline: ['Plan the kitchen', 'before you pave the patio.'],
    serviceType: 'Outdoor kitchen design and construction',
    intro: [
      "An outdoor kitchen is a patio problem before it's an appliance problem. The island needs a foundation that won't heave, gas and power have to run under the patio before it's laid, and the cooking zone has to sit where smoke, wind and foot traffic work for you, not wherever space was left over.",
      'We design the kitchen and the hardscape around it as one plan, so sleeves, conduit and drainage are in the base before the first paver goes down.',
    ],
    scopeHeading: 'What an outdoor kitchen scope covers',
    scope: [
      'Layout of the cooking, prep, serving and seating zones',
      'Island structure in block or masonry with a stone or veneer finish',
      'A footing or slab designed to stay stable through freeze-thaw',
      'Sleeves and conduit under the patio for gas, power and water',
      'Coordination with the licensed gas and electrical trades',
      'Countertops, storage and appliance cut-outs sized to the appliance specifications',
      'Task and ambient lighting for evening cooking',
      'Tie-ins to the patio, seating walls and fire features',
    ],
    sections: [
      {
        heading: 'Start with the foundation',
        body: [
          "A kitchen island is heavy and rigid. If it sits on a base that moves in winter, countertops crack and doors stop closing. Islands need a stable footing or slab designed for frost, and the patio around them has to be built so the two surfaces don't heave against each other.",
          "That's why the island foundation and utility sleeves go in during the base phase of the patio, not after it.",
        ],
      },
      {
        heading: 'Gas, power and water',
        body: [
          'In Ontario, gas piping and appliance connections must be done by a TSSA-certified gas technician working for a TSSA-registered contractor, and new electrical work needs a notification filed with the ESA, typically by the ESA-licensed electrical contractor doing the work. We plan the routes, place sleeves and conduit under the patio, and coordinate with those trades so nothing has to be cut out of a finished surface later.',
          "A natural-gas grill needs a line from the house; propane keeps the island independent. Outdoor outlets need GFCI protection, and fridges and lighting need circuits planned for them.",
        ],
      },
      {
        heading: 'Materials that survive a Barrie winter',
        body: [
          'Counters and cladding have to handle freeze-thaw, UV and grease. Dense natural stone, concrete and outdoor-rated porcelain perform well; soft or porous stone needs sealing and more upkeep. Doors, drawers and appliances should be rated for outdoor installation.',
          'Plan for November as well as July: a shut-off and drain for any water line, a cover for the grill, and a layout you can close up for the season.',
        ],
      },
      {
        heading: 'A layout that actually works',
        body: [
          "Keep the grill downwind of the seating, leave counter space on both sides of the cooktop, and give the cook a sightline to the table. A raised bar counter on the guest side keeps people close without crowding the grill.",
          'Most outdoor kitchens tie into a patio, a seating wall or a fire feature. Designing them together is how the space reads as one outdoor room.',
        ],
      },
    ],
    faqs: [
      { q: 'Do I need a permit for an outdoor kitchen in Barrie?', a: `It depends on the scope. Gas work needs TSSA-certified technicians, electrical work needs an ESA notification, and a roof or pergola over the kitchen can bring building-permit rules into play. ${PERMITS}` },
      { q: 'Should my outdoor kitchen run on natural gas or propane?', a: 'Natural gas means no tanks to swap but needs a line run from the house by a TSSA-certified gas technician. Propane keeps the island independent and is simpler to install, at the cost of refilling tanks.' },
      { q: 'Can you add an outdoor kitchen to my existing patio?', a: "Sometimes. If the patio base is sound and the utilities can reach the island without trenching through the finished surface, yes. Often it's cleaner to rebuild the section of patio where the kitchen will sit." },
      { q: 'What does an outdoor kitchen cost?', a: 'It depends on size, appliances and finishes. The cost estimator includes an outdoor kitchen option for a planning range, and the written scope confirms the real number.' },
      { q: 'How do I protect an outdoor kitchen over the winter?', a: 'Shut off and drain any water line, cover the grill and appliances, and keep snow off the counters with a fitted cover.' },
    ],
    projectCategories: ['Patios & interlocking'],
    projectsHeading: 'Patio work by Golden Maple',
    related: [
      { label: 'Planning an Outdoor Kitchen in Ontario', to: '/resources/outdoor-kitchen-planning-guide' },
      { label: 'Fire Pit Rules in Barrie', to: '/resources/fire-pit-regulations-barrie' },
      { label: 'Pergola vs. Pavilion vs. Gazebo in Barrie', to: '/resources/pergola-vs-pavilion-vs-gazebo-barrie' },
      { label: 'Landscape Lighting Guide', to: '/resources/landscape-lighting-guide-barrie' },
    ],
    estimatorType: 'kitchen',
    offering: BUSINESS.serviceOfferings.outdoorKitchens,
  },
  {
    slug: 'front-entrance-landscaping-barrie',
    primaryKeyword: 'Front Entrance Landscaping',
    title: 'Front Entrance Landscaping Barrie | Front Steps, Walkways & Landings',
    description: 'Front entrance landscaping in Barrie: stone or interlock steps, landings and walkways built for frost, with drainage away from the foundation and lighting.',
    h1: 'Front Entrance Landscaping in Barrie',
    tagline: ['The first ten metres', 'of your home.'],
    serviceType: 'Front entrance landscaping',
    intro: [
      "The front entrance is the part of the property you walk on every day and the part everyone sees from the street. It's also where the problems pile up: steps that heave every winter, a walkway that tilts water toward the foundation, a landing that ices over under a downspout.",
      'We rebuild entrances as one piece (steps, landing, walkway, driveway tie-in, lighting and planting) so they look finished together and stay level through the freeze-thaw cycle.',
    ],
    scopeHeading: 'What a front entrance scope covers',
    scope: [
      'Removal of failing precast steps, concrete or old interlock',
      'A frost-aware base under the steps and landing',
      'Natural stone slab steps or interlocking step units',
      'Consistent riser heights and a landing sized for the door',
      'Walkway and driveway tie-ins',
      'Grading and downspout routing away from the foundation',
      'Low-voltage lighting for steps and paths',
      'Planting beds that frame the entrance',
    ],
    sections: [
      {
        heading: 'Why front steps move',
        body: [
          'Precast concrete steps and poured stoops often sit on a shallow base against the foundation wall, which is exactly where roof water and snowmelt collect. That water freezes under them, they lift, and they rarely settle back to where they started. The gap that opens against the house then funnels even more water in.',
          "Rebuilding the steps without fixing where the water goes just resets the clock.",
        ],
      },
      {
        heading: 'Steps people can trust',
        body: [
          'Every riser in a flight of steps should be the same height and every tread the same depth. Uneven steps are how people trip, especially at night or in snow. Where a landing, porch or step is more than 600 mm (about 2 ft) above the adjacent ground, the Ontario Building Code requires a guard, and longer flights generally need a handrail under the Code.',
          'Natural stone slab treads give the cleanest look with the fewest joints. Interlocking step units match paver walkways and driveways. Both need a base that won\'t heave.',
        ],
      },
      {
        heading: 'Walkway, landing and driveway as one design',
        body: [
          'A good front walkway is wide enough for two people side by side, drains away from the house, and meets the driveway without a trip edge. A generous landing at the door leaves room to open a storm door and set down the groceries.',
          'Using the same paver family, or a matching border, across the driveway, walkway and steps is what makes an entrance look designed rather than patched.',
        ],
      },
      {
        heading: 'Light and planting',
        body: [
          'Low-voltage step and path lighting makes the entrance safer and shows off the stonework after dark, and it is easiest to run while the steps and walkway are being rebuilt.',
          'Planting softens the hardscape and frames the door. Near the driveway, choose plants that tolerate road salt and the snow piled up from shovelling.',
        ],
      },
    ],
    faqs: [
      { q: 'Can you replace my precast concrete front steps?', a: 'Yes. The precast unit comes out, and new stone or interlock steps are built on a new base, with the landing and walkway tied in.' },
      { q: 'Should I choose natural stone or interlock steps?', a: 'Natural stone slab steps have fewer joints and a more solid, custom look. Interlocking step units match paver walkways and driveways. Both last when they sit on a base built for frost.' },
      { q: 'Why is water pooling at my front door?', a: 'Usually the walkway or landing slopes toward the house, or a downspout empties onto it. A rebuild corrects the grade so water moves away from the foundation.' },
      { q: 'Do I need a permit for new front steps?', a: `Sometimes, for example where the steps serve a raised porch or change the structure at the door. ${PERMITS}` },
      { q: 'Can you add lighting to my front steps?', a: 'Yes. Low-voltage lighting is easiest to add while the steps and walkway are being rebuilt, because the cable can run under the new surface.' },
    ],
    projectCategories: ['Walkways & entrances', 'Walls & steps'],
    projectsHeading: 'Front entrance and step work by Golden Maple',
    related: [
      { label: 'What Does a Paver Walkway Cost in Barrie?', to: '/resources/paver-walkway-cost-barrie' },
      { label: 'Landscape Lighting Mistakes to Avoid', to: '/resources/outdoor-lighting-design-mistakes' },
      { label: 'How to Protect Interlocking Stone From Winter Damage', to: '/resources/winter-damage-prevention-interlocking' },
      { label: 'Interlock driveways in Barrie', to: '/services/interlocking-driveways-barrie' },
    ],
    estimatorType: 'steps',
    offering: BUSINESS.serviceOfferings.frontEntrances,
  },
];

export function getBarrieService(slug: string): BarrieServiceDef {
  const def = BARRIE_SERVICES.find((s) => s.slug === slug);
  if (!def) throw new Error(`Unknown Barrie service page: ${slug}`);
  return def;
}
