import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import Testimonials from '../components/Testimonials';

// Tier 2 — Signature outdoor living projects ($35K-$90K).
// Hook: integrated systems (patio + pergola + lighting + fire + planting),
// engineered as one project, not installed in pieces.
// Primary CTA: BuyersGuide download (medium-commitment, fits Signature buyer).

const STARTING_POINTS = [
  {
    range: '$42K-$58K',
    label: 'Patio + Pergola + Lighting',
    detail: '500-700 sqft Techo-Bloc patio, cedar or Trex pergola, In-Lite path + step lighting on a transformer, planted border with mulch and edging.',
  },
  {
    range: '$58K-$78K',
    label: 'Patio + Outdoor Kitchen + Fire',
    detail: '500 sqft patio with a defined cooking zone, gas-line stub for grill or built-in burner, armourstone fire feature, integrated seating wall.',
  },
  {
    range: '$72K-$90K',
    label: 'Multi-Zone Backyard',
    detail: 'Dining patio + lounge patio with grade change, retaining wall in armourstone or Wiarton flagstone, drainage swale, layered planting, low-volt lighting throughout.',
  },
];

const FAQ = [
  {
    q: "Why not just install a patio first, then add the pergola and lighting later?",
    a: 'You can — it just costs more in total and never looks as integrated. When the patio goes in first, the contractor doesn\'t plan the pergola post footings or the conduit runs for lighting. Adding them after means cutting the polymeric sand, drilling through the base, running surface wire. By the time you\'re done, you\'ve spent 30-40% more than if it was designed as one system from the start. That\'s the value of the Signature tier — the project is engineered up front.',
  },
  {
    q: "Do you do the planting yourself or sub it out?",
    a: 'We do the hardscape and grading in-house. For planting design we work with one of two local horticulturalists who price out plants by zone-hardiness and mature size, not by what looks good in May. The plant work is invoiced through us, so you have one point of contact and one warranty conversation.',
  },
  {
    q: "How long does a Signature project actually take on site?",
    a: 'Most Signature builds run 4-7 weeks on site, weather depending. We pull soil at week one, run drainage and electrical conduit in week two, hardscape weeks three and four, structural elements (pergola, fire feature) weeks four and five, planting and final grading weeks six and seven. We share a written timeline before excavation so you know what gets built when.',
  },
  {
    q: "What's the line between this tier and Premium?",
    a: 'Signature projects are integrated outdoor-living systems for an existing house and lot. Premium is when the project includes pool decks, full property regrading, multi-trade coordination across landscape and architecture, or extends into a phased multi-year build. If you\'re renovating a property end-to-end, the Premium page is the right starting point.',
  },
];

export default function OutdoorLivingBarrie() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Outdoor Living in Barrie | $40K-$90K Patio Systems | Golden Maple"
        description="Premium outdoor living projects in Barrie, Innisfil, Springwater, and Oro-Medonte. Patio, walls, steps, lighting, fire, drainage, and pergola elements engineered as one system."
        canonical="https://goldenmaplelandscaping.ca/outdoor-living-barrie"
      />

      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center mb-40">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                Outdoor Living Projects · $40K-$90K+
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                Outdoor living, <br />
                <span className="italic text-brand-gold">engineered for 20 winters.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                Patio, wall, steps, fire feature, lighting, planting, shade — designed as one system before anything gets excavated. Most contractors quote each piece separately and bolt them together. We plan footings, conduit runs, drainage, access, and grade as a single build so it doesn't look added-on five years from now.
              </p>
              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/cost-estimator?type=full" className="btn-primary">See Project Cost Range</Link>
                <Link to="/portfolio" className="flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold transition-colors">
                  Portfolio <ArrowRight size={16} strokeWidth={1.5} />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative aspect-[4/5] rounded-[2px] overflow-hidden shadow-2xl border border-brand-dim/10"
            >
              <img
                src="/images/projects/patio-pergola.jpg"
                alt="Outdoor living project in Barrie with pergola and lighting"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          {/* Starting points — concrete project ranges */}
          <div className="mb-40">
            <div className="text-center max-w-3xl mx-auto mb-24">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                Real starting points
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight">
                What the budget actually gets you.
              </h2>
              <p className="font-sans text-base text-brand-muted leading-relaxed mt-10 font-light">
                Three real project shapes we build most often, with the budget range each falls into. Pick the one closest to what you're picturing — the buyer's guide goes deeper on each.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {STARTING_POINTS.map((sp, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl">
                  <span className="font-display text-3xl font-light text-brand-gold block mb-4">{sp.range}</span>
                  <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-6">{sp.label}</h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{sp.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Engineering wedge */}
          <div className="bg-brand-burgundy/10 border border-brand-burgundy/30 rounded-[2px] p-12 md:p-16 mb-40">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-8 block">
              Why integrated beats stitched-together
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-10">
              Pergola footings get poured the same week as the patio base.
            </h2>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-8 font-light">
              When a Signature project is designed as a system, the lighting conduit goes in the trench beside the drainage line, the pergola footings go in before the base stone, and the fire feature is sized to the lounge zone before a single paver is cut. Costs less in labour and looks like it was always meant to be there.
            </p>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-10 font-light">
              The alternative — patio one year, pergola the next, lighting in year three — costs 30-40% more in total and never looks integrated. Every Barrie homeowner who calls us to "add a pergola to last year's patio" has paid for that lesson once already.
            </p>
            <Link to="/resources/backyard-renovation-roi-ontario" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold hover:text-brand-bonewhite transition-colors inline-flex items-center gap-4">
              See the ROI math <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>

          {/* What's included */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-40">
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-12 block">Always part of the scope</h2>
              <ul className="space-y-8">
                {[
                  'Survey of grade, drainage, sun angles',
                  '3D design walkthrough before excavation',
                  'Engineered base — 3/4" clear stone, HPB',
                  'Conduit run for low-volt lighting',
                  'Drainage tie-in to existing storm',
                  'Pergola or shade structure footings',
                  'Polymeric joints, edge restraint',
                  '5-year structural + 1-year planting warranty',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-6 font-sans text-sm uppercase tracking-[0.2em] text-brand-bonewhite font-light">
                    <Check size={18} className="text-brand-gold shrink-0" strokeWidth={1.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-12 block">Common Signature additions</h2>
              <ul className="space-y-8">
                {[
                  'Armourstone retaining wall',
                  'Wiarton flagstone accent zone',
                  'Built-in kitchen with gas line',
                  'Concrete fire feature',
                  'Multi-zone In-Lite lighting',
                  'Layered planting (Zone 5a-rated)',
                  'Cedar or Trex pergola',
                  'Drainage swale or french drain',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-6 font-sans text-sm uppercase tracking-[0.2em] text-brand-bonewhite font-light">
                    <Check size={18} className="text-brand-gold shrink-0" strokeWidth={1.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-40">
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-tight">Common questions</h2>
            <div className="max-w-4xl mx-auto space-y-12">
              {FAQ.map((item, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl">
                  <h3 className="font-display text-3xl font-light text-brand-bonewhite mb-6">{item.q}</h3>
                  <p className="font-sans text-brand-muted leading-relaxed font-light">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-bonewhite">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-8xl font-light mb-12 leading-tight">
            Start with the guide. <br />
            <span className="text-brand-gold italic">Book the walk when you're ready.</span>
          </h2>
          <p className="font-sans text-lg text-brand-bonewhite/80 max-w-2xl mx-auto mb-16 font-light">
            Start with a realistic planning range. Most outdoor living builds land between $40K and $90K+, with full backyard transformations moving past $90K once walls, kitchen, lighting, fire, or major grade correction enter the scope.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/cost-estimator?type=full" className="btn-primary px-12 py-4">See Project Cost Range</Link>
            <Link to="/contact" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-bonewhite/80 hover:text-brand-gold transition-colors">Or book a site walk →</Link>
          </div>
        </div>
      </section>

      <Testimonials count={3} />
    </div>
  );
}
