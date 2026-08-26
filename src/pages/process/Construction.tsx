import { motion } from 'motion/react';
import { Hammer, Shield, CheckCircle, ArrowRight, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

export default function Construction() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscape Construction Barrie | Engineered 12-16 Inch Bases | Golden Maple"
        description="The Golden Maple Construction Standard: 16-inch deep bases, daily site management, and code-exceeding structural engineering for luxury Simcoe County landscapes."
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
                Phase Five: Implementation
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.1] mb-12">
                Engineered <br />
                <span className="italic text-brand-gold-dark">Construction.</span>
              </h1>
              <p className="font-sans text-xl text-brand-muted leading-relaxed mb-16 font-light">
                The most important part of any landscape is the part you never see. We build for the long-term, employing engineering standards that are nearly double the industry average to ensure zero shifting, zero settlement, and a lifetime of structural integrity.
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
                src="/images/projects/Golden Maple deck and walkway.jpg"
                alt="Landscape Construction Barrie Ontario"
                className="w-full h-full object-cover grayscale opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-8 bottom-8 bg-brand-black/80 backdrop-blur-md p-6 border border-brand-gold/20 rounded-[2px]">
                <p className="font-sans text-[10px] uppercase tracking-widest text-brand-gold mb-2">Structural Standard</p>
                <p className="font-display text-xl text-brand-porcelain italic font-light">12–16" Base Implementation</p>
              </div>
            </motion.div>
          </div>

          <div className="mb-40">
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-[1.2]">The Golden Maple <br/> <span className="italic text-brand-gold-dark">Standard of Build.</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
              {[
                { title: "12–16\" Engineered Bases", desc: "Twice the industry norm. We excavate 12-16 inches deep for interlocking to ensure your investment remains perfectly level indefinitely." },
                { title: "Code-Exceeding Framing", desc: "Framing our composite decks to meet and exceed Ontario building code for absolute stability and safety." },
                { title: "Precision Jointing", desc: "Using high-performance polymeric sands and structural edging that won't separate after one Canadian winter." },
                { title: "Daily Site Cleanliness", desc: "We treat your property as a professional job site, not a mess. Daily tidying and final wash-downs are standard." },
                { title: "Protective Ground-Cover", desc: "Using industrial mats and protection layers to minimize heavy machinery impacts on your existing lawn and property." },
                { title: "Constant Communication", desc: "You'll have a dedicated point of contact for daily updates on project milestones and progress." }
              ].map((item, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 group hover:border-brand-gold/30 transition-all duration-300">
                  <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-6 group-hover:translate-x-2 transition-all">{item.title}</h3>
                  <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brand-surface p-16 md:p-24 rounded-[2px] border border-brand-dim/10 mb-40 text-center">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite mb-12">Built to Outlast.</h2>
              <p className="font-sans text-xl text-brand-muted leading-relaxed font-light mb-12 text-balance lg:px-12">
                We believe in building it once and building it right. Our 5-year sink and settlement warranty on craftsmanship is only possible because we refuse to skip a single step of the engineering process—even if it's hidden under the surface.
              </p>
              <Link to="/process/completion" className="flex items-center gap-4 text-brand-gold-dark font-sans text-xs uppercase tracking-widest justify-center hover:gap-8 transition-all font-medium py-2">
                <span>Phase Six: Handover & Warranty</span>
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-7xl font-light mb-16 leading-tight">
            Build a legacy <br />
            <span className="text-brand-gold italic">in your backyard.</span>
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
