import { motion } from 'motion/react';
import { Heart, Shield, CheckCircle, ArrowRight, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { trackCall } from '../../utils/analytics';
import { publicContact } from '../../data/business';

export default function Design3D() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="3D Landscape Design Barrie | Visual Simulation | Golden Maple"
        description="Visualize your luxury Simcoe County backyard before construction. We provide high-resolution 3D landscape design and walkthroughs in Barrie, ON for architectural accuracy."
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
                Phase Three: Visualization
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.1] mb-12">
                A Vision in <br />
                <span className="italic text-brand-gold-dark">3D Rendering.</span>
              </h1>
              <p className="font-sans text-xl text-brand-muted leading-relaxed mb-16 font-light">
                Why guess what your backyard will look like when you can walk through it? Our high-resolution 3D landscape design process eliminates ambiguity and allows you to experience the spatial flow, lighting, and material textures of your future retreat.
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
              className="relative aspect-[16/9] rounded-[2px] overflow-hidden shadow-2xl border border-brand-dim/10"
            >
              <img
                src="/images/projects/rendering1.jpg"
                alt="3D Landscape Design Barrie Ontario"
                className="w-full h-full object-cover grayscale opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-8 bottom-8 bg-brand-black/80 backdrop-blur-md p-6 border border-brand-gold/20 rounded-[2px]">
                <p className="font-sans text-[10px] uppercase tracking-widest text-brand-gold mb-2">Simulated Reality</p>
                <p className="font-display text-xl text-brand-porcelain italic font-light">Architectural Walkthroughs</p>
              </div>
            </motion.div>
          </div>

          <div className="mb-40">
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-[1.2]">The power of <br/> <span className="italic text-brand-gold-dark">architectural visualization.</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
              {[
                { title: "Spatial Relationship", desc: "Understand the true scale of your patio, pool, and dining areas in relationship to your home's footprint." },
                { title: "Daylight Simulation", desc: "We simulate sun-pathing to show how your outdoor living areas will be naturally lit from morning to late evening." },
                { title: "Custom Night-Lighting", desc: "Experience the ambiance of your In-lite integrated lighting system before the cables are even laid." },
                { title: "Material Texture", desc: "Visualize the difference between natural flagstone and premium Unilock pavers with stunning realism." },
                { title: "Elevation Logic", desc: "See how retaining walls and steps will actually look as structural transitions on your sloped properties." },
                { title: "Vegetation Growth", desc: "Understand the mature size of trees and plantings to ensure long-term privacy and spatial comfort." }
              ].map((item, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 group hover:-translate-y-2 transition-all duration-500">
                  <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-6">{item.title}</h3>
                  <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brand-surface p-16 md:p-24 rounded-[2px] border border-brand-dim/10 mb-40 text-center">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite mb-12">Correct Mistakes Before They Happen.</h2>
              <p className="font-sans text-xl text-brand-muted leading-relaxed font-light mb-12">
                A professional 3D landscape design is the most powerful tool for ensuring client satisfaction. It prevents construction delays and costly mid-build modifications by locking in the vision with architectural certainty.
              </p>
              <Link to="/process/material-selection" className="flex items-center gap-4 text-brand-gold-dark font-sans text-xs uppercase tracking-widest justify-center hover:gap-8 transition-all font-medium py-2">
                <span>Phase Four: Material Curation</span>
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-7xl font-light mb-16 leading-tight">
            Want to see your <br />
            <span className="text-brand-gold italic">backyard in 3D?</span>
          </h2>
          <div className="flex flex-col items-center justify-center gap-10">
            <Link to="/contact" className="btn-primary px-20 py-5">Tell Us Your Budget</Link>
            <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('design3d_phone')} className="font-sans text-sm text-brand-gold hover:underline flex items-center gap-2">
              <Phone size={14} /> {publicContact.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
