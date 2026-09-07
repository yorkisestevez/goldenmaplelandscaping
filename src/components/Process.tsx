import { motion } from 'motion/react';
import { Compass, Shield, Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Process() {
  return (
    <section id="process" className="py-24 md:py-64 bg-brand-burgundy text-brand-porcelain relative overflow-hidden">
      {/* Subtle background pattern/texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#D4AF63 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="font-sans text-xs tracking-[0.4em] uppercase text-brand-gold mb-8 md:mb-10 flex items-center gap-6">
              <span>The Process</span>
              <div className="h-px bg-brand-gold/20 flex-1" />
            </div>
            <h2 className="font-display text-4xl md:text-7xl font-light leading-[1.1] mb-8 md:mb-10">
              A partnership, <br />
              <span className="italic text-brand-gold">not just a project.</span>
            </h2>
            <p className="font-sans font-light text-base md:text-xl text-brand-porcelain-soft leading-relaxed mb-10 md:mb-14">
              Premium spaces require meticulous planning. The first step is a free estimate request — honest scope, honest budget, no pressure. Everything else flows from there.
            </p>

            <div className="mb-12 p-8 bg-brand-surface border border-brand-gold/20 rounded-[2px]">
              <h4 className="font-display text-2xl text-brand-gold-dark mb-4">Free Estimate</h4>
              <p className="font-sans text-base text-brand-muted leading-relaxed font-light">
                Your first conversation with us is <span className="text-brand-bonewhite font-normal">free, no strings attached</span>. We'll listen to what you're imagining, ask the right questions, and tell you honestly whether your project is a fit for what we do. If it is, the property walk that follows is also <span className="text-brand-bonewhite font-normal">on the house</span>.
              </p>
            </div>
            
            <div className="space-y-8 md:space-y-12">
              {[
                { icon: Compass, title: "On-Site Architectural Assessment", desc: "We walk your property, listen to your lifestyle needs, and evaluate the architectural possibilities." },
                { icon: Shield, title: "Curated Material Selection", desc: "Selection of premium, enduring materials that complement your home's existing aesthetic." },
                { icon: Heart, title: "3D Concept Visualization", desc: "Visualize your future space with stunning accuracy before a single stone is moved." }
              ].map((step, idx) => (
                <div key={idx} className="flex gap-6 md:gap-8">
                  <div className="mt-1">
                    <step.icon size={22} className="text-brand-gold md:size-[24px]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="font-display text-2xl md:text-3xl text-brand-porcelain mb-2 md:mb-3 font-light">{step.title}</h4>
                    <p className="font-sans font-light text-[15px] md:text-base text-brand-porcelain-soft leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 md:mt-20 flex flex-col md:flex-row items-center gap-10">
              <Link to="/contact" className="btn-primary w-full md:w-auto py-6 md:py-5 px-12 text-center inline-block">
                Get My Free Estimate
              </Link>
              <Link to="/process" className="flex items-center gap-4 text-brand-gold font-sans text-xs uppercase tracking-widest hover:gap-6 transition-all font-medium py-2">
                <span>View Full 6-Step Process</span>
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-[450px] md:h-[750px] rounded-[2px] overflow-hidden border border-brand-dim/10"
          >
            <img
              src="/images/projects/Golden Maple deck and walkway.jpg"
              alt="Architectural Planning in Barrie ON"
              className="w-full h-full object-cover grayscale opacity-80"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-brand-burgundy/20" />
            <div className="absolute inset-0 border border-brand-gold/10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
