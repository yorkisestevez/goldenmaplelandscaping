import { motion } from 'motion/react';
import { Shield, Award, CheckCircle, Star } from 'lucide-react';
import SEO from '../components/SEO';
import BookingScheduler from '../components/BookingScheduler';

export default function Book() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Book a Free 15-Minute Discovery Call',
    description:
      'Pick a time that works for you. Free 15-minute discovery call with Yorkis Estevez, founder of Golden Maple Landscaping. Honest scope, honest budget, no pressure.',
    url: 'https://goldenmaplelandscaping.ca/book',
  };

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Book Your Free 15-Minute Discovery Call | Golden Maple Landscaping"
        description="Pick a time that works for you. Free 15-minute discovery call with Yorkis. Honest scope, honest budget, no pressure."
        canonical="https://goldenmaplelandscaping.ca/book"
        schema={schema}
      />

      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block"
            >
              Free Discovery Call · 15 Minutes
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1 }}
              className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-12"
            >
              Pick a time <br />
              <span className="italic text-brand-gold-dark">that works for you.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light max-w-xl mx-auto"
            >
              Fifteen minutes on the phone with Yorkis. We'll talk through your project, give you an honest read on scope and budget, and tell you straight whether we're the right fit. No fee, no pressure, no sales script.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="max-w-4xl mx-auto"
          >
            <BookingScheduler />
          </motion.div>

          {/* Trust bar below */}
          <div className="max-w-4xl mx-auto mt-20 pt-16 border-t border-brand-dim/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={12} className="text-brand-gold fill-brand-gold" strokeWidth={0} />
                  ))}
                </div>
                <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                  5.0 · 8 Reviews
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <Shield size={20} className="text-brand-gold" strokeWidth={1.5} />
                <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                  WSIB Certified
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <Award size={20} className="text-brand-gold" strokeWidth={1.5} />
                <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                  $5M Liability
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <CheckCircle size={20} className="text-brand-gold" strokeWidth={1.5} />
                <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                  5-Year Warranty
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
