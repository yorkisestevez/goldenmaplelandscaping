import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Check, Phone } from 'lucide-react';
import SEO from '../../components/SEO';
import Testimonials from '../../components/Testimonials';
import { publicContact } from '../../data/business';
import { trackCall, trackEngagement } from '../../utils/analytics';

const FAQ = [
  {
    q: "Do I need a permit for a retaining wall in Barrie, ON?",
    a: "Walls over about 1 metre often trigger municipal review in Barrie and Simcoe County, but the exact rule depends on height, drainage, and the town. We'll tell you what typically applies on your site and help you confirm before we build."
  },
  {
    q: "How long do retaining walls last?",
    a: "Wall design, drainage, reinforcement and written workmanship terms depend on the site and selected system. Ask us to confirm the current scope and written terms for your project."
  },
  {
    q: "What materials do you use for retaining walls?",
    a: "We use a variety of premium materials, including natural stone, pre-cast concrete blocks, and engineered wall systems. We select materials based on your project's structural needs and aesthetic preferences."
  }
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function RetainingWalls() {
  const engineeringSteps = [
    { title: "Drainage Systems", desc: "We install perforated drainage pipes and clear stone backfill to prevent hydrostatic pressure buildup." },
    { title: "Base Engineering", desc: "A minimum 12-inch compacted aggregate base ensures the wall remains level for decades." },
    { title: "Geogrid Reinforcement", desc: "For taller walls, we use high-strength geogrid to tie the wall into the soil for maximum stability." },
    { title: "Precision Leveling", desc: "Every block is laser-leveled to ensure architectural perfection and structural balance." }
  ];

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Retaining Wall Construction Barrie"
        description="Custom retaining walls for Barrie properties. Armour stone, natural stone & block walls built with engineering precision. Solve grading issues beautifully."
        canonical="https://goldenmaplelandscaping.ca/services/retaining-walls-barrie"
        schema={faqSchema}
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
                Structural Engineering
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                Walls that hold <br />
                <span className="italic text-brand-gold-dark">for generations.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                A retaining wall is one of those things you don't think about — until it starts to lean. We've spent years rebuilding walls other contractors put up without geogrid, without proper drainage, without an engineering plan. We're not interested in being the next chapter of that story. We build walls the way they should be built the first time, so the slope you've been ignoring becomes the feature your property is known for — <span className="text-brand-gold-dark font-normal">no job minimum, priced to your real scope.</span>
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Link
                  to="/contact"
                  onClick={() => trackEngagement('cta_click', 'wall_lander_estimate')}
                  className="btn-primary"
                >
                  Get My Free Estimate
                </Link>
                <a
                  href={`tel:${publicContact.phoneTel}`}
                  onClick={() => trackCall('wall_lander_phone')}
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
                src="/images/projects/garden-wall.JPEG"
                alt="Retaining Wall Construction in Barrie ON"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          <div className="mb-40">
            <div className="text-center max-w-3xl mx-auto mb-24">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">
                Engineering Standards
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight">
                Built to hold back time.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {engineeringSteps.map((step, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl">
                  <span className="font-display text-6xl font-light text-brand-gold-dark/10 block mb-10">0{idx + 1}</span>
                  <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-6">{step.title}</h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-40">
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">What's Included</h2>
              <ul className="space-y-8">
                {[
                  "12-16\" Compacted Aggregate Base",
                  "Geogrid Soil Reinforcement",
                  "Integrated Drainage Systems",
                  "Laser-Guided Leveling & Grading",
                  "Premium Coping & Cap Stones",
                  "Written workmanship terms confirmed per project",
                  "Site Cleanup & Restoration"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-6 font-sans text-sm uppercase tracking-[0.2em] text-brand-bonewhite font-light">
                    <Check size={18} className="text-brand-gold-dark shrink-0" strokeWidth={1.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">Premium Options</h2>
              <ul className="space-y-8">
                {[
                  "Natural Stone Veneer",
                  "Pre-Cast Concrete Systems",
                  "Multi-Level Terraced Walls",
                  "Integrated In-Lite Lighting",
                  "Custom Staircase Integration",
                  "Garden Bed Foundations"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-6 font-sans text-sm uppercase tracking-[0.2em] text-brand-bonewhite font-light">
                    <Check size={18} className="text-brand-gold-dark shrink-0" strokeWidth={1.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mb-40">
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-tight">Frequently Asked Questions</h2>
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
            That slope is not a problem. <br />
            <span className="text-brand-gold italic">It's an opportunity.</span>
          </h2>
          <p className="font-sans text-lg text-brand-porcelain/80 max-w-2xl mx-auto mb-16 font-light">
            Let's turn that unusable hillside into multi-level living space your family will use every single day. One consultation is all it takes to see what's possible.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/contact"
              onClick={() => trackEngagement('cta_click', 'wall_lander_final_estimate')}
              className="btn-primary px-12 py-4"
            >
              Get My Free Estimate
            </Link>
            <a
              href={`tel:${publicContact.phoneTel}`}
              onClick={() => trackCall('wall_lander_final_phone')}
              className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-porcelain/80 hover:text-brand-gold transition-colors"
            >
              Or call {publicContact.phoneDisplay}
            </a>
          </div>
        </div>
      </section>

      <Testimonials count={3} />
    </div>
  );
}
