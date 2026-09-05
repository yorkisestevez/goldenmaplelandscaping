import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Phone } from 'lucide-react';
import SEO from '../components/SEO';
import Testimonials from '../components/Testimonials';
import { trackCall } from '../utils/analytics';

// Tier 3 — Premium residential landscapes ($90K-$160K+).
// Hook: engineered residential landscape, multi-trade coordination, multi-season planning.
// Primary CTA: BookingScheduler — in-person consult only (high-commitment).

const CASE_STUDIES = [] as { title: string; range: string; detail: string }[];

const FAQ = [
  { q: 'How do we start planning?', a: 'Contact us to discuss your property, priorities, and the current consultation and design scope.' },
  { q: 'How are construction details decided?', a: 'Materials, drainage, base preparation, timing, and responsibilities are confirmed for the project-specific written scope.' },
  { q: 'What terms should I expect?', a: 'Ask for current written workmanship terms, manufacturer information where applicable, and the scope for your project.' },
];

export default function LuxuryLandscapeBarrie() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Luxury Landscape Construction Barrie | Premium Residential Hardscape | Golden Maple"
        description="Premium residential landscape construction in Barrie, Innisfil, Oro-Medonte. Pool decks, multi-trade coordination, phased builds. Engineered residential landscapes, not installed yards. Project starts $90K."
        canonical="https://goldenmaplelandscaping.ca/luxury-landscape-barrie"
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
                Premium Projects · $90K-$160K+
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                Engineered <br />
                <span className="italic text-brand-gold-dark">residential landscapes.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                Pool decks, full property regrades, multi-trade coordination, phased multi-season builds. Premium projects start at an in-person consult — there's no honest way to price a $120,000 build from a phone call. We walk the property, talk through the soil and the grades, and come back with a design before the first quote. Most Premium builds land between $94,000 and $158,000.
              </p>
              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/contact" className="btn-primary">Book a Consult</Link>
                <a
                  href="tel:7055003581"
                  onClick={() => trackCall('luxury_lander_phone')}
                  className="inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-gold transition-colors"
                >
                  <Phone size={14} strokeWidth={1.5} /> Call (705) 500-3581
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
                src="/images/projects/luxury outdoor kitchen.jpeg"
                alt="Premium residential landscape with outdoor kitchen in Simcoe County"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          {/* Case studies — real Premium project shapes */}
          <div className="mb-40">
            <div className="text-center max-w-3xl mx-auto mb-24">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">
                Recent Premium builds
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight">
                What this scale looks like.
              </h2>
              <p className="font-sans text-base text-brand-muted leading-relaxed mt-10 font-light">
                Three projects from the last 18 months. Details anonymized where homeowners haven't given testimonial permission; scope and budget are real.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {CASE_STUDIES.map((cs, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl">
                  <span className="font-display text-3xl font-light text-brand-gold-dark block mb-4">{cs.range}</span>
                  <h3 className="font-display text-xl font-light text-brand-bonewhite mb-6">{cs.title}</h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{cs.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* The Premium difference */}
          <div className="bg-brand-burgundy/10 border border-brand-burgundy/30 rounded-[2px] p-12 md:p-16 mb-40">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
              Why an in-person consult comes first
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-10">
              Three trades, two seasons, one project manager.
            </h2>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-8 font-light">
              At Premium scale, the decisions made in the first 90 minutes on site determine whether the project costs $94,000 or $158,000. Soil grade, drainage, where the existing storm tile runs, whether a pool contractor is in the picture, whether the build can phase across two seasons or has to land in one — none of that is a phone-call conversation.
            </p>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-10 font-light">
              The consult is unbilled. If we're a fit, the next step is a paid design phase ($4,800-$11,000, applied against the build budget if you proceed). If we're not, you keep the walk-through notes and a list of what to ask the next contractor.
            </p>
            <Link to="/process" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-bonewhite transition-colors inline-flex items-center gap-4">
              See the full process <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>

          {/* What's part of every Premium project */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-40">
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">Project-scope considerations</h2>
              <ul className="space-y-8">
                {[
                  'On-site consult before quoting',
                  'Landscape design phase with renders',
                  'Site survey including drainage + grade',
                  'Multi-trade coordination on our side',
                  'Project-specific base and drainage planning',
                  'Phased schedule with written timeline',
                  'Project manager assigned to the build',
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
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">Common Premium elements</h2>
              <ul className="space-y-8">
                {[
                  'Pool deck + surround (coordinating with pool contractor)',
                  'Tiered armourstone retaining',
                  'Full property drainage rework',
                  'Wiarton flagstone or natural-stone feature zones',
                  'Outdoor kitchen with gas line + 240V',
                  'Covered pergola or pavilion structure',
                  'Layered lighting (path, accent, security)',
                  'Sport-court or fitness pad foundation',
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
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-tight">What clients ask first</h2>
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
            Walk the property. <br />
            <span className="text-brand-gold italic">Then we draw.</span>
          </h2>
          <p className="font-sans text-lg text-brand-porcelain/80 max-w-2xl mx-auto mb-16 font-light">
            Premium starts in person. Book a 90-minute consult — we walk the property, talk grade and drainage, and come back with a design before the first quote.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/contact" className="btn-primary px-12 py-4">Book the Consult</Link>
            <a
              href="tel:7055003581"
              onClick={() => trackCall('luxury_lander_final_phone')}
              className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-porcelain/80 hover:text-brand-gold transition-colors"
            >
              Or call (705) 500-3581
            </a>
          </div>
        </div>
      </section>

      <Testimonials count={3} />
    </div>
  );
}
