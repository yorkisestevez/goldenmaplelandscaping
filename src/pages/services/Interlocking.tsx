import { motion } from 'motion/react';
import { CheckCircle, Shield, Award, Phone, ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { trackCall, trackEngagement } from '../../utils/analytics';

const PROOF = [
  '12–16" compacted base for Barrie freeze-thaw',
  'Unilock · Techo-Bloc · Permacon',
  '5-year sink & settlement warranty',
  'WSIB certified · $5M liability',
];

const INCLUDED = [
  '12–16" compacted aggregate base',
  'Geotextile fabric',
  'Laser-guided grading & drainage',
  'Polymeric sand joints',
  'Concrete edge restraint',
  '5-year structural warranty',
];

const FAQS = [
  {
    q: 'How deep should an interlocking base be in Barrie?',
    a: 'For Barrie and Simcoe County freeze-thaw, we dig 12–16 inches of compacted aggregate — not the 6–8 inches that sinks after one winter.',
  },
  {
    q: 'How long does interlocking last when it is built right?',
    a: 'With a proper base, interlocking can last 25–30+ years. We back every install with a 5-year sink and settlement warranty.',
  },
  {
    q: 'Do you only work in Barrie?',
    a: 'Barrie is home base. We also build across Simcoe County and Cottage Country — Innisfil, Oro-Medonte, Springwater, and nearby.',
  },
];

export default function Interlocking() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Interlocking Stone Barrie | Patios & Driveways | Golden Maple"
        description="Barrie interlocking stone installation with a 12–16 inch base for Ontario winters. Free estimate. WSIB certified, $5M liability, 5-year warranty."
        canonical="https://goldenmaplelandscaping.ca/services/interlocking-barrie"
      />

      <section className="section-padding pt-40 pb-16">
        <div className="container-custom max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center mb-12"
          >
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 inline-flex items-center gap-2">
              <MapPin size={14} strokeWidth={1.5} /> Barrie · Simcoe County · Cottage Country
            </span>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-6">
              Interlocking that stays flat <br />
              <span className="italic text-brand-gold-dark">through Barrie winters.</span>
            </h1>
            <p className="font-sans text-base md:text-lg text-brand-muted font-light leading-relaxed max-w-2xl mx-auto mb-8">
              Patios and driveways engineered for freeze-thaw — not a thin base that sinks by year three.
              Free estimate. Yorkis replies in 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link
                to="/contact"
                onClick={() => trackEngagement('cta_click', 'interlock_lander_estimate')}
                className="btn-primary px-12 py-5 w-full sm:w-auto text-center"
              >
                Get My Free Estimate
              </Link>
              <a
                href="tel:7055003581"
                onClick={() => trackCall('interlock_lander_phone')}
                className="inline-flex items-center justify-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-gold transition-colors py-4"
              >
                <Phone size={14} strokeWidth={1.5} /> Call (705) 500-3581
              </a>
            </div>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3 max-w-3xl mx-auto">
              {PROOF.map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center gap-2 font-sans text-[10px] uppercase tracking-[0.16em] text-brand-porcelain/90"
                >
                  <CheckCircle size={14} className="text-brand-gold shrink-0" strokeWidth={1.5} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
            {[
              { icon: Shield, label: 'WSIB Certified' },
              { icon: Award, label: '$5M Liability' },
              { icon: CheckCircle, label: '5-Year Warranty' },
            ].map((c) => (
              <div
                key={c.label}
                className="bg-brand-surface border border-brand-dim/10 p-6 rounded-[2px] flex items-center justify-center gap-3"
              >
                <c.icon size={18} className="text-brand-gold-dark" strokeWidth={1.5} />
                <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-bonewhite">
                  {c.label}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
            <div>
              <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-6">
                How we build interlocking in Barrie
              </h2>
              <ol className="space-y-5">
                {[
                  'Excavate 12–16" for frost and drainage',
                  'Compact clear stone in engineered lifts',
                  'Laser-grade the bed and set premium pavers',
                  'Lock joints with polymeric sand + edge restraint',
                ].map((step, i) => (
                  <li key={step} className="flex gap-4 font-sans text-sm text-brand-muted font-light">
                    <span className="text-brand-gold-dark font-normal">{String(i + 1).padStart(2, '0')}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div className="bg-brand-surface border border-brand-dim/10 p-8 rounded-[2px]">
              <h3 className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark mb-6">
                What&apos;s included
              </h3>
              <ul className="space-y-3 mb-8">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex gap-3 font-sans text-sm text-brand-muted font-light">
                    <CheckCircle size={16} className="text-brand-gold-dark shrink-0 mt-0.5" strokeWidth={1.5} />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/contact"
                onClick={() => trackEngagement('cta_click', 'interlock_lander_mid_estimate')}
                className="btn-primary w-full py-4 text-center block"
              >
                Get My Free Estimate
              </Link>
            </div>
          </div>

          <div className="mb-20">
            <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-8 text-center">
              Common questions
            </h2>
            <div className="space-y-4 max-w-3xl mx-auto">
              {FAQS.map((faq) => (
                <div key={faq.q} className="bg-brand-surface border border-brand-dim/10 p-8 rounded-[2px]">
                  <h3 className="font-display text-xl font-light text-brand-gold-dark mb-3">{faq.q}</h3>
                  <p className="font-sans text-sm text-brand-muted font-light leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
            <h2 className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite mb-6">
              Ready for a patio that stays put?
            </h2>
            <p className="font-sans text-base text-brand-muted font-light mb-8 max-w-xl mx-auto">
              Free estimate for Barrie interlocking. Name, phone, and email are enough to start.
            </p>
            <Link
              to="/contact"
              onClick={() => trackEngagement('cta_click', 'interlock_lander_final_estimate')}
              className="btn-primary px-14 py-5 inline-flex items-center gap-3"
            >
              Get My Free Estimate
              <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
