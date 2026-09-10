import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Phone } from 'lucide-react';
import SEO from '../components/SEO';
import Testimonials from '../components/Testimonials';
import { publicContact } from '../data/business';
import { trackCall } from '../utils/analytics';

// Tier 2 — Signature outdoor living projects ($35K-$90K).
// Hook: integrated systems (patio + pergola + lighting + fire + planting),
// engineered as one project, not installed in pieces.
// Primary CTA: BuyersGuide download (medium-commitment, fits Signature buyer).

const STARTING_POINTS = [] as { range: string; label: string; detail: string }[];

const FAQ = [
  { q: 'How do we start planning?', a: 'Contact us to discuss your property, priorities, and the current consultation and design scope.' },
  { q: 'How are construction details decided?', a: 'Materials, drainage, base preparation, timing, and responsibilities are confirmed for the project-specific written scope.' },
  { q: 'What terms should I expect?', a: 'Ask for current written workmanship terms, manufacturer information where applicable, and the scope for your project.' },
];

export default function OutdoorLivingBarrie() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Outdoor Living Planning in Barrie | Golden Maple"
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
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">
                Outdoor Living Projects
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                Outdoor living, <br />
                <span className="italic text-brand-gold-dark">planned around your property.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                Patio, wall, steps, fire feature, lighting, planting, shade — designed as one system before anything gets excavated. Most contractors quote each piece separately and bolt them together. We plan footings, conduit runs, drainage, access, and grade as a single build so it doesn't look added-on five years from now.
              </p>
              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/cost-estimator?type=patio" className="btn-primary">See Project Cost Range</Link>
                <a
                  href={`tel:${publicContact.phoneTel}`}
                  onClick={() => trackCall('outdoor_living_lander_phone')}
                  className="inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-gold transition-colors"
                >
                  <Phone size={14} strokeWidth={1.5} /> Call {publicContact.phoneDisplay}
                </a>
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
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">
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
                  <span className="font-display text-3xl font-light text-brand-gold-dark block mb-4">{sp.range}</span>
                  <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-6">{sp.label}</h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{sp.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Engineering wedge */}
          <div className="bg-brand-burgundy/10 border border-brand-burgundy/30 rounded-[2px] p-12 md:p-16 mb-40">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
              Why integrated beats stitched-together
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-10">
              Pergola footings get poured the same week as the patio base.
            </h2>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-8 font-light">
              A coordinated plan can identify drainage, structural, lighting, and access considerations before construction. Confirm the proposed sequence and scope for your project.
            </p>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-10 font-light">
              Planning components together can help identify coordination needs before construction. Confirm the proposed sequence, materials, and scope for your project.
            </p>
            <Link to="/resources/backyard-renovation-roi-ontario" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-bonewhite transition-colors inline-flex items-center gap-4">
              See the ROI math <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>

          {/* What's included */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-40">
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">Project-scope considerations</h2>
              <ul className="space-y-8">
                {[
                  'Survey of grade, drainage, sun angles',
                  '3D design walkthrough before excavation',
                  'Project-specific base and drainage planning',
                  'Conduit run for low-volt lighting',
                  'Drainage tie-in to existing storm',
                  'Pergola or shade structure footings',
                  'Polymeric joints, edge restraint',
                  'Current written workmanship terms',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-6 font-sans text-sm uppercase tracking-[0.2em] text-brand-bonewhite font-light">
                    <Check size={18} className="text-brand-gold-dark shrink-0" strokeWidth={1.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">Common Signature additions</h2>
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
                    <Check size={18} className="text-brand-gold-dark shrink-0" strokeWidth={1.5} />
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

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-8xl font-light mb-12 leading-tight">
            Start with the guide. <br />
            <span className="text-brand-gold italic">Book the walk when you're ready.</span>
          </h2>
          <p className="font-sans text-lg text-brand-porcelain/80 max-w-2xl mx-auto mb-16 font-light">
            Start with a realistic planning range. Most outdoor living builds land between $40K and $90K+, with full backyard transformations moving past $90K once walls, kitchen, lighting, fire, or major grade correction enter the scope.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/cost-estimator?type=patio" className="btn-primary px-12 py-4">See Project Cost Range</Link>
            <Link to="/contact" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-porcelain/80 hover:text-brand-gold transition-colors">Or book a site walk →</Link>
          </div>
        </div>
      </section>

      <Testimonials count={3} />
    </div>
  );
}
