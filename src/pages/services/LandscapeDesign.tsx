import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Map, Check, ArrowRight, Shield, Award, CheckCircle } from 'lucide-react';
import SEO from '../../components/SEO';
import Testimonials from '../../components/Testimonials';

const FAQ = [
  {
    q: "What is included in a landscape design package?",
    a: "Our Design Package includes a 3D conceptual model, detailed planting plans, material selections, and lighting design. We provide a comprehensive plan that ensures your vision is executed flawlessly before construction begins."
  },
  {
    q: "How long does the landscape design process take?",
    a: "The design process typically takes 2-4 weeks, depending on the complexity of the project. This includes the initial consultation, conceptual design, and final revisions."
  },
  {
    q: "Do you charge for landscape consultations?",
    a: "Discovery is free — your first 15-minute call with us is on the house, and so is the property walk that follows if we're a fit. From there, two paid steps are available if you want more than a ballpark: a $99 on-site design session (credited back if you book) gets you to ±5% with material samples and a layout sketch, and full landscape design (3D renderings, planting plan, fixed-price quote) starts at $2,500 and is fully credited back if you build with us."
  },
  {
    q: "What if I only want the design and not the construction?",
    a: "If you require a design-only service without construction, our packages typically start at $5,000. This includes a full architectural 3D rendering of the project, two design revisions, and one final render revision to ensure every detail is perfect."
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

export default function LandscapeDesign() {
  const designSteps = [
    { title: "Consultation", desc: "We meet on-site to understand your vision, lifestyle needs, and the unique characteristics of your property." },
    { title: "Conceptual Design", desc: "Our designers create a 3D model that allows you to walk through your new backyard before a single stone is laid." },
    { title: "Material Selection", desc: "We guide you through choosing the perfect pavers, natural stone, and plantings to match your aesthetic." },
    { title: "Final Presentation", desc: "A comprehensive plan including 3D renders, technical drawings, and a detailed construction quote." }
  ];

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscape Design Barrie"
        description="Full-service landscape design for Barrie homeowners. From concept to 3D render to build. Create your dream outdoor living space. Book a design consultation."
        canonical="https://goldenmaplelandscaping.ca/services/landscape-design-barrie"
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
                Architectural Planning
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                See it first. <br />
                <span className="italic text-brand-gold-dark">Then we build it.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                The most expensive mistake in landscaping is finding out, halfway through construction, that what's being built doesn't match what you imagined. We've solved that. Before a single stone moves, you walk your finished backyard in 3D. The colours. The light. The way the space flows on a Sunday morning. You sign off on the picture, then we build the picture. Surprises are for birthdays — not your backyard.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-10">
                <div className="flex flex-col gap-4 w-full sm:w-auto">
                  <Link to="/contact" className="btn-primary py-5 px-10">Get My Estimate</Link>
                  <span className="font-sans text-xs text-brand-muted italic font-light text-center sm:text-left">
                    Free estimate · 24-hour response.
                  </span>
                </div>
                <Link to="/portfolio" className="flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold-dark transition-colors">
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
                src="/images/projects/rendering1.jpg"
                alt="Landscape Design Rendering Barrie"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          <div className="mb-40">
            <div className="text-center max-w-3xl mx-auto mb-24">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">
                The Design Process
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight">
                From vision to reality.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {designSteps.map((step, idx) => (
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
                  "3D Conceptual Modeling (1 Render Revision)",
                  "2 Design Concept Revisions",
                  "Detailed Planting Plans",
                  "Material Selection & Sourcing",
                  "Integrated Lighting Design",
                  "Laser-Guided Site Surveys"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-6 font-sans text-sm uppercase tracking-[0.2em] text-brand-bonewhite font-light">
                    <Check size={18} className="text-brand-gold-dark shrink-0" strokeWidth={1.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-surface p-16 rounded-[2px] border border-brand-dim/10 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-12 block">Available Add-Ons — Quoted Separately</h2>
              <ul className="space-y-8">
                {[
                  "Master Planning Services",
                  "Phased Construction Planning",
                  "Custom Structure Design",
                  "Water Feature Integration",
                  "Outdoor Kitchen Layouts",
                  "Permit Application Handling"
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
            See your dream backyard <br />
            <span className="text-brand-gold italic">before we build it.</span>
          </h2>
          <p className="font-sans text-lg text-brand-porcelain/80 max-w-2xl mx-auto mb-16 font-light">
            No guesswork, no surprises. You'll know exactly what your space will look like — down to the last stone — before we ever pick up a shovel. That's the peace of mind our design process gives you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/cost-estimator?type=full" className="btn-primary px-12 py-4">See Your Project Cost Range</Link>
            <Link to="/contact" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-porcelain/80 hover:text-brand-gold transition-colors">Or Book a Design Session →</Link>
          </div>
        </div>
      </section>

      <Testimonials count={3} />
    </div>
  );
}
