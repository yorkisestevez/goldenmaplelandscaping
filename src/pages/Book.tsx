import { motion } from 'motion/react';
import { Shield, Award, CheckCircle, Star } from 'lucide-react';
import SEO from '../components/SEO';
import { BUSINESS, publicClaimCopy } from '../data/business';
import BookingScheduler from '../components/BookingScheduler';

export default function Book() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Book a Project Conversation',
    description:
      'Pick a time to discuss your project and confirm the current consultation scope.',
    url: 'https://goldenmaplelandscaping.ca/book',
  };

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Book a Project Conversation | Golden Maple Landscaping"
        description="Pick a time to discuss your project and confirm the current consultation scope."
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
              Project Conversation
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
              Use the scheduler to request a project conversation. We will confirm the current consultation, site-visit, design, and project-scope details directly.
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
                  {publicClaimCopy(BUSINESS.reviews.aggregate, 'Verified Google reviews.')}
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <Shield size={20} className="text-brand-gold" strokeWidth={1.5} />
                <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                  {publicClaimCopy(BUSINESS.credentials.wsib, 'Current coverage documentation is available.')}
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <Award size={20} className="text-brand-gold" strokeWidth={1.5} />
                <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                  {publicClaimCopy(BUSINESS.credentials.liabilityInsurance, 'Current liability coverage documentation is available.')}
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <CheckCircle size={20} className="text-brand-gold" strokeWidth={1.5} />
                <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                  {publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
