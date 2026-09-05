import { motion } from 'motion/react';
import { Shield, Heart, CheckCircle, ArrowRight, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { trackCall } from '../../utils/analytics';
import { publicContact } from '../../data/business';

export default function MaterialSelection() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscape Material Curation Barrie | Premium Partners | Golden Maple"
        description="Selecting the right materials is critical for durability and luxury. We curate premium collections from partners like Unilock and Techo-Bloc for our Simcoe County clients."
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
                Phase Four: Curation
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.1] mb-12">
                The Luxury of <br />
                <span className="italic text-brand-gold-dark">Choice.</span>
              </h1>
              <p className="font-sans text-xl text-brand-muted leading-relaxed mb-16 font-light">
                Not all stone is created equal. We curate a selection of high-performance materials that not only match your home's aesthetic but also withstand the extreme freeze-thaw cycles of Ontario's climate.
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
                src="/images/projects/luxury decking.jpg"
                alt="Luxury Landscape Materials Barrie"
                className="w-full h-full object-cover grayscale opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-brand-black/20" />
            </motion.div>
          </div>

          <div className="mb-40">
            <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite mb-24 text-center leading-[1.2]">Curation beyond <br/> <span className="italic text-brand-gold-dark">just aesthetics.</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
              {[
                { title: "Partner Selection", desc: "We exclusively work with premium manufacturers like Unilock, Techo-Bloc, and Permacon for consistent quality." },
                { title: "Color Theory & Harmonics", desc: "Expert selection of material palettes that balance with your home's exterior stone, brick, or siding." },
                { title: "Textural Contrast", desc: "Juxtaposing smooth pavers with rough-hewn natural stone accents for a layered, luxury feel." },
                { title: "Planting Palettes", desc: "Curating a mix of native and ornamental species for seasonal interest and long-term privacy." },
                { title: "Lighting Hardware", desc: "Selecting high-end In-lite integrated lighting systems for architectural nighttime illumination." },
                { title: "Structural Components", desc: "Using engineered retaining wall blocks and high-density gravel bases that exceed industry standards." }
              ].map((item, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 hover:border-brand-gold/30 transition-all duration-300">
                  <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-6">{item.title}</h3>
                  <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brand-surface p-16 md:p-24 rounded-[2px] border border-brand-dim/10 mb-40 text-center">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite mb-12">Quality from the Inside Out.</h2>
              <p className="font-sans text-xl text-brand-muted leading-relaxed font-light mb-12 text-balance lg:px-12">
                Material selection considers appearance, site conditions, maintenance expectations, and the project-specific construction scope.
              </p>
              <Link to="/process/construction" className="flex items-center gap-4 text-brand-gold-dark font-sans text-xs uppercase tracking-widest justify-center hover:gap-8 transition-all font-medium py-2">
                <span>Phase Five: Engineered Construction</span>
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-7xl font-light mb-16 leading-tight">
            Curate your <br />
            <span className="text-brand-gold italic">luxury sanctuary.</span>
          </h2>
          <div className="flex flex-col items-center justify-center gap-10">
            <Link to="/contact" className="btn-primary px-20 py-5">Tell Us Your Budget</Link>
            <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('materialselection_phone')} className="font-sans text-sm text-brand-gold hover:underline flex items-center gap-2">
              <Phone size={14} /> {publicContact.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
