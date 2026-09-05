import { motion } from 'motion/react';
import { Compass, Shield, Heart, CheckCircle, ArrowRight, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { trackCall } from '../../utils/analytics';
import { BUSINESS, publicClaimCopy, publicContact } from '../../data/business';

export default function Consultation() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Landscaping Consultation Barrie | Golden Maple"
        description="Start a conversation about your project scope, site conditions, and current consultation and design options."
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
              <span className="font-sans text-xs tracking-[0.4em] uppercase text-brand-gold-dark mb-10 block">
                Phase One: The Brief
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.1] mb-12">
                Your Budget <br />
                <span className="italic text-brand-gold-dark">Becomes a Brief.</span>
              </h1>
              <p className="font-sans text-xl text-brand-muted leading-relaxed mb-16 font-light">
                Start by sharing what you are picturing and the budget you have in mind. We can discuss project scope, timing, and the current consultation and design options for your property.
              </p>

              <div className="bg-brand-surface p-10 border border-brand-gold/20 rounded-[2px] mb-16">
                <h3 className="font-display text-2xl text-brand-gold-dark mb-4">Start with the Scope.</h3>
                <p className="font-sans text-brand-muted leading-relaxed font-light mb-6">
                  {publicClaimCopy(BUSINESS.commercialPolicies.consultation, "Contact us to confirm the current consultation and design scope.")}
                </p>
                <Link to="/contact" className="btn-primary w-full py-5 text-center px-8">Get My Free Estimate</Link>
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
                src="/images/projects/Golden Maple deck and walkway.jpg"
                alt="Landscape Consultation in Barrie Ontario"
                className="w-full h-full object-cover grayscale opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-brand-black/20" />
            </motion.div>
          </div>

          <div className="mb-40">
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-[1.2]">What we cover in <br/> <span className="italic text-brand-gold-dark">your written estimate.</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
              {[
                { title: "Lifestyle Discovery", desc: "How do you intend to use the space? Whether it's high-traffic entertaining or quiet sanctuary, we listen first." },
                { title: "Property Assessment", desc: "A high-level overview of grades, drainage patterns, and potential engineering challenges." },
                { title: "Budget Alignment", desc: "Discuss the project scope and budget considerations for your property." },
                { title: "Material Direction", desc: "Initial thoughts on colors, textures, and product collections from premium partners like Unilock." },
                { title: "Preliminary Timeline", desc: "Discussion of the design-build schedule and when your transformation can begin." },
                { title: "Strategic Roadmapping", desc: "Laying out the literal next steps—from site assessment to final 3D design." }
              ].map((item, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10">
                  <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-6">{item.title}</h3>
                  <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brand-surface p-16 md:p-24 rounded-[2px] border border-brand-dim/10 mb-40">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite mb-12">Start with a Conversation.</h2>
              <div className="space-y-8 font-sans text-xl text-brand-muted leading-relaxed font-light">
                <p>
                  The right project starts with a clear conversation about goals, site conditions, and budget.
                </p>
                <p>
                  Contact us to confirm the current consultation process and whether the project is a fit.
                </p>
                <p className="text-brand-bonewhite font-normal">
                  The next steps, deliverables, and any associated terms are confirmed for the specific project.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-7xl font-light mb-16 leading-tight">
            Ready to start <br />
            <span className="text-brand-gold italic">Phase One?</span>
          </h2>
          <div className="flex flex-col items-center justify-center gap-10">
            <Link to="/contact" className="btn-primary px-20 py-5">Tell Us Your Budget</Link>
            <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('consultation_phone')} className="font-sans text-sm text-brand-gold hover:underline flex items-center gap-2">
              <Phone size={14} /> {publicContact.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
