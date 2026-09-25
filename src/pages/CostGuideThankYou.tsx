import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { CheckCircle, Download, Phone, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { trackCall } from '../utils/analytics';
import { publicContact } from '../data/business';

const PDF_URL = '/downloads/2026-simcoe-county-backyard-cost-guide.pdf';

export default function CostGuideThankYou() {
  useEffect(() => {
    const t = setTimeout(() => {
      const link = document.createElement('a');
      link.href = PDF_URL;
      link.download = '2026-simcoe-county-backyard-cost-guide.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Your Cost Guide Is On The Way"
        description="Your free 2026 Simcoe County Backyard Cost Guide is downloading. Check your email for the PDF link and follow-up budget worksheets."
        canonical="https://goldenmaplelandscaping.ca/cost-guide/thank-you"
        noindex
      />

      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="mx-auto w-20 h-20 rounded-full border border-brand-gold flex items-center justify-center mb-12"
            >
              <CheckCircle size={32} className="text-brand-gold" strokeWidth={1.5} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-12"
            >
              Your guide is <br />
              <span className="italic text-brand-gold-dark">downloading.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light mb-16"
            >
              The PDF will start automatically in a moment. We've also emailed you a copy plus a few short follow-ups with sample budgets. Watch your inbox over the next two weeks.
            </motion.p>

            <motion.a
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              href={PDF_URL}
              download
              className="btn-primary inline-flex items-center justify-center gap-3 py-5 px-12 mb-20"
            >
              <Download size={16} strokeWidth={1.5} />
              Download If It Didn't Start
            </motion.a>

            {/* Soft CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="bg-brand-surface border border-brand-dim/10 rounded-[2px] p-10 md:p-12 text-left"
            >
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
                While You're Here
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-light text-brand-bonewhite leading-tight mb-6">
                Want to skip the guide and just talk?
              </h2>
              <p className="font-sans text-sm md:text-base text-brand-muted leading-relaxed font-light mb-10">
                Yorkis offers a <span className="text-brand-gold-dark">free estimate request</span> for any homeowner thinking about a project this year. Honest scope, honest budget, no pressure.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 items-stretch">
                <a
                  href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('costguidethankyou_phone')}
                  className="flex-1 flex items-center justify-center gap-3 border border-brand-gold/30 text-brand-gold-dark font-sans text-[10px] uppercase tracking-[0.25em] py-4 hover:bg-brand-gold/5 transition-colors"
                >
                  <Phone size={14} strokeWidth={1.5} />
                  {publicContact.phoneDisplay}
                </a>
                <Link
                  to="/contact"
                  className="flex-1 btn-primary py-4 inline-flex items-center justify-center gap-3"
                >
                  Get My Free Estimate
                  <ArrowRight size={14} strokeWidth={1.5} />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
