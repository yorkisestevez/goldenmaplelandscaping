import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import Testimonials from '../components/Testimonials';

// Premium patio projects ($35K-$75K).
// Hook: cost transparency + base-depth differentiator + budget qualification.
// Primary CTA: cost estimator to pre-frame serious outdoor-room economics.

const FAQ = [
  { q: 'How do we start planning?', a: 'Contact us to discuss your property, priorities, and the current consultation and design scope.' },
  { q: 'How are construction details decided?', a: 'Materials, drainage, base preparation, timing, and responsibilities are confirmed for the project-specific written scope.' },
  { q: 'What terms should I expect?', a: 'Ask for current written workmanship terms, manufacturer information where applicable, and the scope for your project.' },
];

export default function PatiosBarrie() {
  const processSteps = [
    { title: 'Project review', desc: 'We discuss site conditions, intended use, and the details needed for a written scope.' },
    { title: 'Excavation and preparation', desc: 'Excavation, drainage, and base details are determined for the site and written scope.' },
    { title: 'Materials and drainage', desc: 'Proposed materials and drainage approach are confirmed for the project-specific scope.' },
    { title: 'Lay, sand, walk-through', desc: 'Pavers placed against stringline. Polymeric sand swept and watered in. Walk-through on the same day with you, so you see what you bought.' },
  ];

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Premium Patios in Barrie | $35K-$75K Outdoor Rooms | Golden Maple"
        description="Premium patio and outdoor-room projects in Barrie and Simcoe County. Real planning ranges, clear-stone bases, drainage-aware construction, and project-specific written workmanship terms."
        canonical="https://goldenmaplelandscaping.ca/patios-barrie"
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
                Premium Patio Projects · $35K-$75K
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                Patios planned for <br />
                <span className="italic text-brand-gold-dark">20 Simcoe winters.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                Real cost range, no sales pressure. Most premium patio projects Golden Maple is built to serve run between $35,000 and $75,000 depending on size, access, base prep, drainage, steps, and material choice. The cost estimator gives you a planning range first. If the number works, we book the site walk.
              </p>
              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/cost-estimator?type=patio" className="btn-primary">See My Cost Range</Link>
                <Link to="/resources/clear-stone-vs-granular-a-base" className="flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold-dark transition-colors">
                  Why the base matters <ArrowRight size={16} strokeWidth={1.5} />
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
                src="/images/projects/IMG_4826.jpg"
                alt="Hardscape patio in Barrie Ontario with clear stone base"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          {/* The wedge — base material */}
          <div className="bg-brand-burgundy/10 border border-brand-burgundy/30 rounded-[2px] p-12 md:p-16 mb-40">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
              What most quotes don't tell you
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-10">
              Base and drainage details should fit the site.
            </h2>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-8 font-light">
              Material selection and drainage design should be reviewed in relation to the site, intended use, and written scope.
            </p>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-10 font-light">
              Ask how proposed base materials, drainage, and maintenance expectations apply to your project.
            </p>
            <Link to="/resources/clear-stone-vs-granular-a-base" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-bonewhite transition-colors inline-flex items-center gap-4">
              Read the engineering breakdown <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>

          {/* Process */}
          <div className="mb-40">
            <div className="text-center max-w-3xl mx-auto mb-24">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">
                The Build
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight">
                Four steps. No mystery.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {processSteps.map((step, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl">
                  <span className="font-display text-6xl font-light text-brand-gold-dark/10 block mb-10">0{idx + 1}</span>
                  <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-6">{step.title}</h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* What's included */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-40">
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">Project-scope considerations</h2>
              <ul className="space-y-8">
                {[
                  'Project-specific excavation and base planning',
                  'Geotextile fabric base separation',
                  'Project-specific material and drainage planning',
                  'HPB bedding chip (not concrete sand)',
                  'Material options confirmed for the project',
                  'Polymeric sand joints',
                  'Concrete edge restraint',
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
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">Common add-ons</h2>
              <ul className="space-y-8">
                {[
                  'Natural stone accent border',
                  'In-Lite step + path lighting',
                  'Built-in seat wall',
                  'Fire pit integration',
                  'Permeable section for drainage',
                  'Custom pattern or colour blend',
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
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-tight">Questions worth asking</h2>
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
            See the number first. <br />
            <span className="text-brand-gold italic">Then we talk.</span>
          </h2>
          <p className="font-sans text-lg text-brand-porcelain/80 max-w-2xl mx-auto mb-16 font-light">
            Real planning range in 60 seconds. If the number works, we book a site walk. If the project needs walls, drainage, lighting, or a fire zone, we scope it as an outdoor room instead of pretending it is just pavers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/cost-estimator?type=patio" className="btn-primary px-12 py-4">See My Cost Range</Link>
            <Link to="/contact" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-porcelain/80 hover:text-brand-gold transition-colors">Or book a site walk →</Link>
          </div>
        </div>
      </section>

      <Testimonials count={3} />
    </div>
  );
}
