import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import Testimonials from '../components/Testimonials';

// Tier 1 — Foundation projects ($12K-$35K).
// Hook: cost transparency + base-depth differentiator.
// Primary CTA: cost estimator (low-commitment, matches Foundation buyer intent).

const FAQ = [
  {
    q: "What does a patio actually cost in Barrie in 2026?",
    a: "Most Foundation-tier patios we build run $14,000-$32,000. The range depends on size (200-700 sqft), paver line (Techo-Bloc Blu 60 vs Permacon Lineo vs higher-end series), and how much excavation the soil demands. The cost estimator above gives you a tight range in 60 seconds — no email gate, no phone call required.",
  },
  {
    q: "Why is the base depth a big deal?",
    a: "Most contractors in Simcoe County dig 6-8 inches and use Granular A. We dig 12 down and use 3/4\" clear stone over a compacted virgin-soil base. Granular A traps water that freezes and lifts your pavers; clear stone drains at 250 inches per hour and stays stable through 50 freeze-thaw cycles a winter. That's the difference between a patio that looks new in year 8 and one that's pitching toward your foundation by year 3.",
  },
  {
    q: "Do you build smaller patios? What's the minimum?",
    a: "We've done 180 sqft side-yard patios in the south end and 280 sqft walkout pads off back doors in Painswick. There's no hard minimum — what we won't do is cut corners on the base just to hit a low price. If a small patio is what you need, you'll still get the 12-inch clear-stone base and the 5-year warranty.",
  },
  {
    q: "What's the difference between this tier and 'outdoor living'?",
    a: "Foundation means the patio is the project. Outdoor living means the patio is one element of a larger plan — usually paired with a pergola, lighting, retaining wall, or fire feature, designed as a system rather than installed in pieces. If you're thinking about more than one element, the Outdoor Living page is a better starting point.",
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
        title="Patios in Barrie | Real Cost Range + 12-Inch Base | Golden Maple"
        description="Foundation-tier patio installations in Barrie and Simcoe County. Real cost ranges, 3/4 inch clear stone bases, 5-year sink and settlement warranty. See your cost in 60 seconds."
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
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                Foundation Projects · $14K-$32K
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                Patios that survive <br />
                <span className="italic text-brand-gold">20 Simcoe winters.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                Real cost range, no email gate, no salesperson on the other end. Most Foundation patios in Barrie run between $14,000 and $32,000 depending on size and paver line. The cost estimator below gives you a tight range in 60 seconds. If the number works for you, we book a site walk. If it doesn't, you've lost a minute.
              </p>
              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/cost-estimator?type=patio" className="btn-primary">See My Cost Range</Link>
                <Link to="/resources/clear-stone-vs-granular-a-base" className="flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold transition-colors">
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
                src="/images/projects/best.JPEG"
                alt="Hardscape patio in Barrie Ontario with clear stone base"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          {/* The wedge — base material */}
          <div className="bg-brand-burgundy/10 border border-brand-burgundy/30 rounded-[2px] p-12 md:p-16 mb-40">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-8 block">
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
            <Link to="/resources/clear-stone-vs-granular-a-base" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold hover:text-brand-bonewhite transition-colors inline-flex items-center gap-4">
              Read the engineering breakdown <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>

          {/* Process */}
          <div className="mb-40">
            <div className="text-center max-w-3xl mx-auto mb-24">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                The Build
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight">
                Four steps. No mystery.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {processSteps.map((step, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl">
                  <span className="font-display text-6xl font-light text-brand-gold/10 block mb-10">0{idx + 1}</span>
                  <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-6">{step.title}</h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* What's included */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-40">
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-12 block">What's in every quote</h2>
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
                    <Check size={18} className="text-brand-gold shrink-0" strokeWidth={1.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-12 block">Common add-ons</h2>
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
                    <Check size={18} className="text-brand-gold shrink-0" strokeWidth={1.5} />
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

      <section className="section-padding bg-brand-burgundy text-brand-bonewhite">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-8xl font-light mb-12 leading-tight">
            See the number first. <br />
            <span className="text-brand-gold italic">Then we talk.</span>
          </h2>
          <p className="font-sans text-lg text-brand-bonewhite/80 max-w-2xl mx-auto mb-16 font-light">
            Real cost range in 60 seconds. No email. No callback queue. If the number works, we book a site walk. If not, no hard feelings.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/cost-estimator?type=patio" className="btn-primary px-12 py-4">See My Cost Range</Link>
            <Link to="/contact" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-bonewhite/80 hover:text-brand-gold transition-colors">Or book a site walk →</Link>
          </div>
        </div>
      </section>

      <Testimonials count={3} />
    </div>
  );
}
