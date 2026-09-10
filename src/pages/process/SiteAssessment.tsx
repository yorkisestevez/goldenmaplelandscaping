import { motion } from 'motion/react';
import { Ruler, Shield, Heart, CheckCircle, ArrowRight, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { trackCall } from '../../utils/analytics';
import { publicContact } from '../../data/business';

export default function SiteAssessment() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscape Site Analysis Barrie | Engineering & Assessment | Golden Maple"
        description="The Golden Maple site analysis goes beyond measurements. We evaluate soil, drainage, and structural integrity for your Simcoe County landscape project to ensure your investment lasts."
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
                Phase Two: Assessment
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.1] mb-12">
                Engineering <br />
                <span className="italic text-brand-gold-dark">Precision.</span>
              </h1>
              <p className="font-sans text-xl text-brand-muted leading-relaxed mb-16 font-light">
                Before a single 3D rendering is created, we must first understand the literal foundation of your project. We look for the technical details that others ignore—soil composition, water runoff patterns, and existing structural elevations.
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
                alt="Landscape Engineering Analysis Barrie"
                className="w-full h-full object-cover grayscale opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-8 bottom-8 bg-brand-black/80 backdrop-blur-md p-6 border border-brand-gold/20 rounded-[2px]">
                <p className="font-sans text-[10px] uppercase tracking-widest text-brand-gold mb-2">Technical Standard</p>
                <p className="font-display text-xl text-brand-porcelain italic font-light">Laser-Guided Precision</p>
              </div>
            </motion.div>
          </div>

          <div className="mb-40">
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-[1.2]">The components of <br/> <span className="italic text-brand-gold-dark">a professional assessment.</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
              {[
                { title: "Laser Site Surveys", desc: "We use professional laser levels to capture every elevation change, ensuring your patio or pool deck is perfectly graded." },
                { title: "Drainage Logistics", desc: "Analyzing water runoff patterns to prevent future basement flooding or ice buildup in Barrie's harsh winters." },
                { title: "Existing Vegetation", desc: "Evaluation of the health and viability of existing trees and shrubs that can be preserved or integrated." },
                { title: "Utility Locate Mapping", desc: "A high-level review of potential utility conflicts to ensure safety and code compliance from day one." },
                { title: "Access Optimization", desc: "Laying out precisely how we'll move machinery and materials to minimize property disturbance." },
                { title: "Structural Evaluation", desc: "Checking the integrity of your home's foundation or existing walls that will interface with new builds." }
              ].map((item, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 group hover:border-brand-gold/30 transition-all duration-500">
                  <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-6 group-hover:italic group-hover:translate-x-2 transition-all">{item.title}</h3>
                  <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brand-surface p-16 md:p-24 rounded-[2px] border border-brand-dim/10 mb-40 text-center">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite mb-12">Built for the Canadian Climate.</h2>
              <p className="font-sans text-xl text-brand-muted leading-relaxed font-light mb-12">
                Site conditions vary across Simcoe County. Reviewing the ground, drainage, and existing features helps inform a project-specific construction scope.
              </p>
              <Link to="/process/3d-design" className="flex items-center gap-4 text-brand-gold-dark font-sans text-xs uppercase tracking-widest justify-center hover:gap-8 transition-all font-medium py-2">
                <span>Phase Three: 3D Visualization</span>
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-7xl font-light mb-16 leading-tight">
            Ready for a <br />
            <span className="text-brand-gold italic">precision build?</span>
          </h2>
          <div className="flex flex-col items-center justify-center gap-10">
            <Link to="/contact" className="btn-primary px-20 py-5">Tell Us Your Budget</Link>
            <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('siteassessment_phone')} className="font-sans text-sm text-brand-gold hover:underline flex items-center gap-2">
              <Phone size={14} /> {publicContact.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
