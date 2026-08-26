import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import Testimonials from '../components/Testimonials';

// Premium patio projects ($35K-$75K).
// Hook: cost transparency + base-depth differentiator + budget qualification.
// Primary CTA: cost estimator to pre-frame serious outdoor-room economics.

const FAQ = [
  {
    q: "What does a patio actually cost in Barrie in 2026?",
    a: "Most premium patio and outdoor-room projects we want to attract run $35,000-$75,000. The range depends on size, access, paver line, excavation depth, drainage, steps, lighting, borders, and whether the patio is paired with a wall or fire zone. The cost estimator gives you a realistic planning range before we book time on site.",
  },
  {
    q: "Why is the base depth a big deal?",
    a: "Most contractors in Simcoe County dig 6-8 inches and use Granular A. We dig 12 down and use 3/4\" clear stone over a compacted virgin-soil base. Granular A traps water that freezes and lifts your pavers; clear stone drains at 250 inches per hour and stays stable through 60-85 freeze-thaw cycles a winter. That's the difference between a patio that looks new in year 8 and one that's pitching toward your foundation by year 3.",
  },
  {
    q: "Do you build smaller patios? What's the minimum?",
    a: "We can build smaller surfaces when they are part of a larger entrance, walkway, or backyard plan. Standalone small patios are usually not the best fit unless the scope can support proper excavation, base prep, mobilization, cleanup, and warranty. Our online patio planning floor is now $35,000 so the project has room to be built properly.",
  },
  {
    q: "What's the difference between this tier and 'outdoor living'?",
    a: "A premium patio means the patio is the main build: a serious hardscape surface with proper base, drainage thinking, and possible steps, borders, lighting, or fire. Outdoor living means the patio is one element of a larger system — usually paired with walls, pergola, kitchen, lighting, or multi-zone family use.",
  },
];

export default function PatiosBarrie() {
  const processSteps = [
    { title: 'Site walk & quote', desc: 'We come out, measure, talk through soil and grade. Quote on the spot for jobs under 600 sqft.' },
    { title: 'Excavation to 12"', desc: 'Down to virgin ground. Geotextile fabric across the base. No shortcuts on the prep that the next contractor would hide.' },
    { title: 'Clear stone + HPB', desc: '3/4" clear stone compacted in 3-4" lifts. High-performance bedding chip on top. Open-graded so water moves through, never sits.' },
    { title: 'Lay, sand, walk-through', desc: 'Pavers placed against stringline. Polymeric sand swept and watered in. Walk-through on the same day with you, so you see what you bought.' },
  ];

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Premium Patios in Barrie | $35K-$75K Outdoor Rooms | Golden Maple"
        description="Premium patio and outdoor-room projects in Barrie and Simcoe County. Real planning ranges, clear-stone bases, drainage-aware construction, and a 5-year structural warranty."
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
                Patios that survive <br />
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
              95% of Barrie patios sit on Granular A. We use 3/4" clear stone instead.
            </h2>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-8 font-light">
              Granular A was engineered for highway construction — designed to pack tight and shed water off an asphalt surface. Under interlocking pavers, water comes through the joints and gets trapped in the fines. Freezes, expands, lifts the corners. We see it every spring on patios installed less than five years ago.
            </p>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-10 font-light">
              We build on 3/4" clear stone — uniform-size aggregate that drains at 250 inches per hour by design. Water moves through, never sits, never freezes in a layer that can heave. Costs us about $1.50 more per square foot. Adds 20 years to the patio.
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
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">What's in every quote</h2>
              <ul className="space-y-8">
                {[
                  '12" excavation to virgin ground',
                  'Geotextile fabric base separation',
                  '3/4" clear stone, compacted in lifts',
                  'HPB bedding chip (not concrete sand)',
                  'Techo-Bloc or Permacon pavers',
                  'Polymeric sand joints',
                  'Concrete edge restraint',
                  '5-year sink and settlement warranty',
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
