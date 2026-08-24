import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Grid, Check, ArrowRight, Shield, Award, CheckCircle } from 'lucide-react';
import SEO from '../../components/SEO';
import Testimonials from '../../components/Testimonials';

const FAQ = [
  {
    q: "How deep should an interlocking base be in Barrie, ON?",
    a: "In Barrie and Simcoe County, the freeze-thaw cycle is significant. We recommend a minimum of 12-16\" of compacted aggregate base for driveways and patios alike. This ensures the stones do not shift or heave over time."
  },
  {
    q: "How long does interlocking stone last?",
    a: "When properly engineered with our 12-16\" base standard, interlocking stone can last 25-30+ years. We provide a 5-year structural warranty to guarantee this longevity."
  },
  {
    q: "Do you offer a warranty on interlocking installations?",
    a: "Yes, Golden Maple Landscaping provides a 5-year sink and settlement warranty on all interlocking stone installations. Our installation process is engineered for longevity and structural integrity."
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

export default function Interlocking() {
  const processSteps = [
    { title: "Excavation", desc: "We dig deep—12 to 16 inches—to ensure a solid foundation that won't shift during the freeze-thaw cycle." },
    { title: "Base Preparation", desc: "Multiple layers of crushed aggregate, each meticulously compacted to engineering standards." },
    { title: "Laying & Patterning", desc: "Precision placement of premium pavers with laser-guided grading." },
    { title: "Polymeric Sanding", desc: "High-performance jointing sand that prevents weed growth and locks stones in place permanently." }
  ];

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Interlocking Stone Installation Barrie"
        description="Expert interlocking stone patios, driveways & walkways in Barrie. Techo-Bloc & Permacon certified. Precision-built hardscapes that last. Free estimate today."
        canonical="https://goldenmaplelandscaping.ca/services/interlocking-barrie"
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
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                Hardscape Construction
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                A patio that's <br />
                <span className="italic text-brand-gold">still flat in 2046.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                You've seen what happens when an interlocking patio is built wrong. Sunken corners. Joints full of weeds. The whole thing pitching toward the foundation by year three. We're here to make sure that's not the story you tell about yours. We dig deeper, source from <span className="text-brand-gold font-normal">Unilock, Techo-Bloc, and Permacon</span>, and stand behind every square foot for five full years — <span className="text-brand-gold font-normal">no job minimum, priced to your real scope.</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/contact" className="btn-primary">Get My Estimate</Link>
                <Link to="/portfolio" className="flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold transition-colors">
                  View Portfolio <ArrowRight size={16} strokeWidth={1.5} />
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
                src="/images/projects/paver-driveway.JPG"
                alt="Interlocking Stone Patio in Barrie ON"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          <div className="mb-40">
            <div className="text-center max-w-3xl mx-auto mb-24">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                The Process
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight">
                How we build for longevity.
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-40">
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-12 block">What's Included</h2>
              <ul className="space-y-8">
                {[
                  "12-16\" Compacted Aggregate Base",
                  "Industrial Grade Geotextile Fabric",
                  "Laser-Guided Grading & Drainage",
                  "High-Performance Polymeric Sand",
                  "Concrete Edge Restraint Systems",
                  "5-Year Structural Warranty",
                  "Lifetime Product Warranty"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-6 font-sans text-sm uppercase tracking-[0.2em] text-brand-bonewhite font-light">
                    <Check size={18} className="text-brand-gold shrink-0" strokeWidth={1.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-12 block">Premium Options</h2>
              <ul className="space-y-8">
                {[
                  "Natural Stone Accents & Borders",
                  "Porcelain Paver Systems",
                  "Permeable Paving Solutions",
                  "In-Lite Landscape Lighting",
                  "Custom Fire Pit Integration",
                  "Outdoor Kitchen Foundations"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-6 font-sans text-sm uppercase tracking-[0.2em] text-brand-bonewhite font-light">
                    <Check size={18} className="text-brand-gold shrink-0" strokeWidth={1.5} />
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

      <section className="section-padding bg-brand-burgundy text-brand-bonewhite">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-8xl font-light mb-12 leading-tight">
            Stop imagining it. <br />
            <span className="text-brand-gold italic">Let's build it.</span>
          </h2>
          <p className="font-sans text-lg text-brand-bonewhite/80 max-w-2xl mx-auto mb-16 font-light">
            You've been looking at your driveway or patio long enough. Let's turn it into something that makes your neighbours slow down when they drive past. One conversation is all it takes to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/cost-estimator?type=patio" className="btn-primary px-12 py-4">See Your Cost Range</Link>
            <Link to="/contact" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-bonewhite/80 hover:text-brand-gold transition-colors">Or Get My Estimate →</Link>
          </div>
        </div>
      </section>

      <Testimonials count={3} />
    </div>
  );
}
