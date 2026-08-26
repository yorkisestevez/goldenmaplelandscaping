import { motion } from 'motion/react';
import { Phone } from 'lucide-react';

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
                src="/images/projects/Yorkis Estevez.jpg"
                alt="Yorkis Estevez - Founder of Golden Maple Landscaping"
                className="w-full h-full object-cover object-top transition-transform duration-700 group-hover/photo:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-burgundy/60 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 opacity-0 group-hover/photo:opacity-100 transition-opacity duration-500">
                <p className="font-display text-2xl text-brand-porcelain italic font-light">Yorkis Estevez</p>
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mt-1">Founder & Lead Builder</p>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-6 -left-6 w-24 h-24 border-t border-l border-brand-gold/30 z-0" />
            <div className="absolute -bottom-6 -right-6 w-24 h-24 border-b border-r border-brand-gold/30 z-0" />
            
            <div className="absolute -right-4 top-1/2 -translate-y-1/2 hidden lg:block">
              <span className="font-display text-[120px] text-brand-gold/5 select-none leading-none uppercase font-light">EST. 2020</span>
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
                "I started Golden Maple with one simple rule: build every project like it's going in my own backyard."
              </p>
              <p>
                In an industry known for shortcuts, we'd rather take the extra time and do it properly. When a family is going to live with a space for the next twenty years, it's worth building right the first time.
              </p>
              <p>
                I'm on-site for every build, looking after the details that decide whether a patio lasts — the 12–16" compacted base you'll never see, the clean lines you will, a tidy site every evening, and communication that doesn't go quiet after the deposit.
              </p>
              <p>
                My promise is simple: an honest quote, careful work, and a backyard your family will actually want to spend time in.
              </p>
            </div>

            <div className="mt-16 flex flex-col sm:flex-row items-start sm:items-center gap-8">
              <div>
                <p className="font-display text-4xl text-brand-gold italic font-light">Yorkis Estevez</p>
                <p className="font-sans text-[10px] tracking-[0.3em] uppercase text-brand-porcelain-soft mt-2">Founder & Principal Designer</p>
              </div>
              <div className="hidden sm:block h-12 w-px bg-brand-gold/20" />
              <div className="flex flex-col gap-1">
                <span className="font-sans text-[11px] uppercase tracking-widest text-brand-gold">Direct Line</span>
                <a href="tel:7055003581" className="font-display text-2xl text-brand-porcelain hover:text-brand-gold transition-colors font-light">705-500-3581</a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
