import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Grid, Check, ArrowRight, Shield, Award, CheckCircle, Hammer, Ruler, Layers } from 'lucide-react';
import SEO from '../../components/SEO';
import Testimonials from '../../components/Testimonials';

const FAQ = [
  {
    q: "Why choose TimberTech composite decking over wood?",
    a: "TimberTech decking is engineered to resist fading, staining, scratching, and mold. Unlike traditional wood, it requires no sanding, staining, or sealing, saving you thousands in maintenance costs over its 25-50 year lifespan."
  },
  {
    q: "Are you certified TimberTech installers?",
    a: "Yes, Golden Maple Landscaping is a recognized TimberTech Pro. This means we have undergone specialized training and can offer enhanced labor warranties. We provide a 10-year craftsmanship warranty on our installation, while TimberTech provides up to a 50-year product warranty."
  },
  {
    q: "How long does a composite deck installation take?",
    a: "A typical high-end composite deck project takes between 2 to 4 weeks, depending on complexity, size, and additional features like integrated lighting or custom railings."
  }
];

export default function CompositeDecking() {
  const processSteps = [
    { title: "Structural Framing", desc: "We build our frames to exceed Ontario Building Code, using pressure-treated lumber or steel for maximum structural integrity." },
    { title: "TimberTech Selection", desc: "Choose from the Advanced PVC or Composite collections, featuring realistic wood grains and multi-width options." },
    { title: "Precision Installation", desc: "Using hidden fastener systems for a clean, screw-free surface that highlights the architectural lines of your deck." },
    { title: "Finishing Details", desc: "Custom fascia wrapping, integrated LED lighting, and high-end railing systems to complete the luxury look." }
  ];

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Composite Decking Installation Barrie"
        description="Low-maintenance composite decks built for Barrie winters. TimberTech & Trex options. Custom designs with lighting & railings. Get your free deck quote."
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
                Outdoor Living Construction
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                A deck you'll <br />
                <span className="italic text-brand-gold">never re-stain.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                Every May, the same ritual. The sanding. The staining. The hour spent looking at the spots where the wood is starting to rot and pretending you'll deal with it next year. We're done with that, and we think you should be too. We build TimberTech and Trex decks that look like real hardwood and stay that way — through every Ontario winter, with zero maintenance, for the next 25 years. <span className="text-brand-gold font-normal">Luxury decking projects start at $25,000.</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/contact" className="btn-primary">Book My Free Discovery Call</Link>
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
                src="/images/projects/Silver Maple Radiance Rail 0101.jpg"
                alt="Luxury Composite Decking in Barrie ON"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-8 left-8 bg-brand-nearblack/80 backdrop-blur-md p-6 border border-brand-gold/20 rounded-[2px]">
                <p className="font-sans text-[10px] uppercase tracking-widest text-brand-gold mb-2">Certified Partner</p>
                <p className="font-display text-xl text-brand-bonewhite italic font-light">TimberTech Pro Status</p>
              </div>
            </motion.div>
          </div>

          <div className="mb-40">
            <div className="text-center max-w-3xl mx-auto mb-24">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                The Process
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight">
                Built to last generations.
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
                  "TimberTech Advanced PVC or Composite",
                  "Hidden Fastener Systems (Screw-Free)",
                  "Code-Exceeding Structural Framing",
                  "Custom Fascia & Stair Wrapping",
                  "10-Year Structural Warranty",
                  "Up to 50-Year TimberTech Product Warranty"
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
                  "Multi-Width Plank Designs",
                  "Integrated LED Stair & Rail Lighting",
                  "Glass or Aluminum Railing Systems",
                  "Under-Deck Drainage Systems",
                  "Built-in Seating & Planters",
                  "Outdoor Kitchen Integration",
                  "Helical Pile Foundations"
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
            Spend your weekends <br />
            <span className="text-brand-gold italic">on the deck, not maintaining it.</span>
          </h2>
          <p className="font-sans text-lg text-brand-bonewhite/80 max-w-2xl mx-auto mb-16 font-light">
            Imagine a deck that looks stunning in year one and still looks stunning in year twenty — without you lifting a finger. That's exactly what we build. Let's make it happen for your home.
          </p>
          <Link to="/contact" className="btn-primary px-20">Design My Dream Deck</Link>
        </div>
      </section>

      <Testimonials count={3} />
    </div>
  );
}
