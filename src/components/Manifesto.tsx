import { motion } from 'motion/react';
import { Phone } from 'lucide-react';
import { FOUNDER } from '../data/founder';
import { trackCall } from '../utils/analytics';
import { publicContact } from '../data/business';

export default function Manifesto() {
  return (
    <section id="manifesto" className="py-24 md:py-64 bg-brand-burgundy text-brand-porcelain relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 md:gap-24 items-center">
          {/* Portrait Image */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 relative"
          >
            <div className="aspect-[4/5] md:aspect-[3/4] rounded-[2px] overflow-hidden relative z-10 border border-brand-gold/20 group/photo shadow-2xl">
              <img
                src={FOUNDER.portrait.src}
                alt={FOUNDER.portrait.alt}
                className="w-full h-full object-cover object-top transition-transform duration-700 group-hover/photo:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-burgundy/60 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 opacity-0 group-hover/photo:opacity-100 transition-opacity duration-500">
                <p className="font-display text-2xl text-brand-porcelain italic font-light">Yorkis Estevez</p>
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mt-1">{FOUNDER.role}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-brand-porcelain-soft">AI-generated founder illustration — not a photograph.</p>
            {/* Decorative elements */}
            <div className="absolute -top-6 -left-6 w-24 h-24 border-t border-l border-brand-gold/30 z-0" />
            <div className="absolute -bottom-6 -right-6 w-24 h-24 border-b border-r border-brand-gold/30 z-0" />
            
            {/* Decorative watermark — aria-hidden so screen readers skip it and
                the contrast auditor (which ignores aria-hidden) doesn't flag
                deliberately-ghosted ornament as invisible text. */}
            <div aria-hidden="true" className="absolute -right-4 top-1/2 -translate-y-1/2 hidden lg:block">
              <span className="font-display text-[120px] text-brand-gold/5 select-none leading-none uppercase font-light">GOLDEN MAPLE</span>
            </div>
          </motion.div>

          {/* Manifesto Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7"
          >
            <div className="font-sans text-[11px] tracking-[0.35em] uppercase text-brand-gold mb-8 md:mb-10 flex items-center gap-6">
              <span>A Note From the Founder</span>
              <div className="h-px bg-brand-gold/20 flex-1" />
            </div>
            
            <h2 className="font-display text-4xl md:text-7xl font-light leading-[1.1] mb-10">
              Built like it's <br />
              <span className="italic text-brand-gold">our own backyard.</span>
            </h2>

            <div className="space-y-8 font-sans font-light text-base md:text-lg text-brand-porcelain-soft leading-relaxed">
              <p className="text-brand-porcelain font-medium italic">
                Start with the way you want to use your backyard, then work through the details that make the plan practical.
              </p>
              <p>
                In an industry known for shortcuts, we'd rather take the extra time and do it properly. When a family is going to live with a space for the next twenty years, it's worth building right the first time.
              </p>
              <p>
                Discuss who will supervise the work, how site protection and communication will be handled, and which excavation, drainage and material specifications belong in your written scope.
              </p>
              <p>
                My promise is simple: an honest quote, careful work, and a backyard your family will actually want to spend time in.
              </p>
            </div>

            <div className="mt-16 flex flex-col sm:flex-row items-start sm:items-center gap-8">
              <div>
                <p className="font-display text-4xl text-brand-gold italic font-light">{FOUNDER.name}</p>
                <p className="font-sans text-[10px] tracking-[0.3em] uppercase text-brand-porcelain-soft mt-2">{FOUNDER.role}</p>
              </div>
              <div className="hidden sm:block h-12 w-px bg-brand-gold/20" />
              <div className="flex flex-col gap-1">
                <span className="font-sans text-[11px] uppercase tracking-widest text-brand-gold">Direct Line</span>
                <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('manifesto_phone')} className="font-display text-2xl text-brand-porcelain hover:text-brand-gold transition-colors font-light">{publicContact.phoneDisplay}</a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
