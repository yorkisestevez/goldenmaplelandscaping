import { motion } from 'motion/react';
import { CheckCircle, Shield, Heart, ArrowRight, Phone, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { trackCall } from '../../utils/analytics';
import { BUSINESS, publicClaimCopy, publicContact } from '../../data/business';

export default function Completion() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscape Project Completion & Handover Barrie | Golden Maple"
        description="Learn how project completion, walkthroughs, and written workmanship terms are discussed for Simcoe County landscape projects."
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
                Phase Six: Completion
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.1] mb-12">
                The Final <br />
                <span className="italic text-brand-gold-dark">Walkthrough.</span>
              </h1>
              <p className="font-sans text-xl text-brand-muted leading-relaxed mb-16 font-light">
                Project completion includes a walkthrough to review the agreed scope, care information, and any current written workmanship terms for your project.
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
              <div className="absolute inset-0 bg-brand-black/20" />
            </motion.div>
          </div>

          <div className="mb-40">
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-[1.2]">The Golden Maple <br/> <span className="italic text-brand-gold-dark">Certification of Quality.</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
              {[
                { title: "Final Walkthrough", desc: "A project-specific review of the completed scope and any questions you have about the work." },
                { title: "Written Terms", desc: publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, "Current written workmanship terms can be reviewed for your project.") },
                { title: "Care Information", desc: "Care and maintenance considerations can be discussed for the materials selected for your project." },
                { title: "System Handover", desc: "Where applicable, project-specific product information and operating details can be reviewed." },
                { title: "Site Closeout", desc: "Closeout details are confirmed against the project-specific scope." },
                { title: "Photography Permission", desc: "Any request to photograph a completed space is discussed separately with the property owner." }
              ].map((item, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 group hover:border-brand-gold/50 transition-all duration-300">
                  <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-6">{item.title}</h3>
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
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite mb-12">Clear Completion Details.</h2>
              <p className="font-sans text-xl text-brand-muted leading-relaxed font-light mb-12">
                Before closeout, ask to review the current written workmanship terms, care guidance, and project-specific next steps.
              </p>
              <Link to="/" className="flex items-center gap-4 text-brand-gold-dark font-sans text-xs uppercase tracking-widest justify-center hover:gap-8 transition-all font-medium py-2">
                <span>Back to Home</span>
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-7xl font-light mb-16 leading-tight">
            Ready to build <br />
            <span className="text-brand-gold italic">something enduring?</span>
          </h2>
          <div className="flex flex-col items-center justify-center gap-10">
            <Link to="/contact" className="btn-primary px-20 py-5">Tell Us Your Budget</Link>
            <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('completion_phone')} className="font-sans text-sm text-brand-gold hover:underline flex items-center gap-2">
              <Phone size={14} /> {publicContact.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
