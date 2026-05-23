import { motion } from 'motion/react';
import { CheckCircle, Shield, Heart, ArrowRight, Phone, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

export default function Completion() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscape Warranty & Handover Barrie | 5-Year Guarantee | Golden Maple"
        description="The Golden Maple completion process includes a final 25-point walkthrough and activation of your 5-year structural warranty for Simcoe County landscapes."
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
              <span className="font-sans text-xs tracking-[0.4em] uppercase text-brand-gold mb-10 block">
                Phase Six: Completion
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.1] mb-12">
                The Final <br />
                <span className="italic text-brand-gold">Walkthrough.</span>
              </h1>
              <p className="font-sans text-xl text-brand-muted leading-relaxed mb-16 font-light">
                Our relationship doesn't end when the stones are set. We conduct a rigorous 25-point final inspection with you, ensuring every detail matches the architectural vision and activating your long-term craftsmanship warranty.
              </p>
              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/contact" className="btn-primary w-full sm:w-auto py-5 text-center px-8">Tell Us Your Budget</Link>
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
                alt="Final Landscape Completion Barrie Ontario"
                className="w-full h-full object-cover grayscale opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-brand-nearblack/20" />
            </motion.div>
          </div>

          <div className="mb-40">
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-[1.2]">The Golden Maple <br/> <span className="italic text-brand-gold">Certification of Quality.</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
              {[
                { title: "25-Point Final Inspection", desc: "A detailed checklist covering joint sand compaction, edge-restraint stability, and lighting alignment." },
                { title: "Warranty Activation", desc: "Official activation of our 5-year structural craftsmanship warranty, giving you absolute peace of mind." },
                { title: "Maintenance Education", desc: "We provide your customized maintenance guide for stone, decking, and plantings to ensure long-term beauty." },
                { title: "In-lite System Handover", desc: "Walking you through your smart landscape lighting app and ensuring all timers are set to your preference." },
                { title: "Final Site Wash-Down", desc: "We leave your property in spotless condition, using power-washing to remove any construction dust or debris." },
                { title: "Professional Photography", desc: "We may request a final session to photograph your transformated space for our Simcoe County portfolio." }
              ].map((item, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 group hover:border-brand-gold/50 transition-all duration-300">
                  <h3 className="font-display text-2xl font-light text-brand-gold mb-6">{item.title}</h3>
                  <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brand-surface p-16 md:p-24 rounded-[2px] border border-brand-dim/10 mb-40 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5">
               <Award size={200} />
            </div>
            <div className="max-w-4xl mx-auto">
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite mb-12">Security in a 5-Year Structural Warranty.</h2>
              <p className="font-sans text-xl text-brand-muted leading-relaxed font-light mb-12">
                We're a Barrie-based firm, which means our reputation is everything. We stand by our work so that you can enjoy your luxury outdoor sanctuary with confidence for decades, not just seasons.
              </p>
              <Link to="/" className="flex items-center gap-4 text-brand-gold font-sans text-xs uppercase tracking-widest justify-center hover:gap-8 transition-all font-medium py-2">
                <span>Back to Home</span>
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-bonewhite">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-7xl font-light mb-16 leading-tight">
            Ready to build <br />
            <span className="text-brand-gold italic">something enduring?</span>
          </h2>
          <div className="flex flex-col items-center justify-center gap-10">
            <Link to="/contact" className="btn-primary px-20 py-5">Tell Us Your Budget</Link>
            <a href="tel:7055003581" className="font-sans text-sm text-brand-gold hover:underline flex items-center gap-2">
              <Phone size={14} /> (705) 500-3581
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
