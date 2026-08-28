import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Calculator, Calendar, ArrowRight, CheckCircle2, FileText, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAttributionFields, getConversionEventFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { trackLead } from '../utils/analytics';
import { genEventId } from '../utils/eventId';

const encodeForm = (data: Record<string, string>) =>
  Object.keys(data)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');

async function postToNetlify(form: HTMLFormElement, formName: string, eventId: string): Promise<void> {
  const fd = new FormData(form);
  const payload: Record<string, string> = { 'form-name': formName, ...getConversionEventFields(eventId) };
  fd.forEach((v, k) => { if (typeof v === 'string') payload[k] = v; });
  Object.assign(payload, getAttributionFields(), getBehaviorFields());
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[dev] ${formName} payload (would POST to Netlify):`, payload);
    return;
  }
  await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeForm(payload),
  });
}

const BuyersGuide = () => {
  const [guideSubmitted, setGuideSubmitted] = useState(false);
  const [estimateSubmitted, setEstimateSubmitted] = useState(false);
  const [isGuideLoading, setIsGuideLoading] = useState(false);
  const [isEstimateLoading, setIsEstimateLoading] = useState(false);

  const handleGuideSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGuideLoading(true);
    const eventId = genEventId();
    const fd = new FormData(e.currentTarget);   // capture before the await (currentTarget nulls out after)
    try {
      await postToNetlify(e.currentTarget, 'guide-download', eventId);
      // Event name matches the Netlify form-name above ('guide-download'), not
      // a different label — every other form on the site (contact, quick-quote,
      // estimate-request) reports the same string it submits under, so GA4/Meta
      // form_name/content_name lines up with the CRM's form_name field instead
      // of silently diverging from it.
      trackLead('guide-download', 'top-of-funnel', undefined, eventId, {
        email: fd.get('email') as string | null,
        phone: fd.get('phone') as string | null,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[guide-download] submit failed', err);
    }
    setIsGuideLoading(false);
    setGuideSubmitted(true);

    setTimeout(() => {
      const link = document.createElement('a');
      link.href = '/downloads/golden-maple-buyers-guide.pdf';
      link.download = 'golden-maple-buyers-guide.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 1000);
  };

  const handleEstimateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsEstimateLoading(true);
    const eventId = genEventId();
    const fd = new FormData(e.currentTarget);   // capture before the await (currentTarget nulls out after)
    try {
      await postToNetlify(e.currentTarget, 'estimate-request', eventId);
      trackLead('estimate-request', 'high-intent', undefined, eventId, {
        email: fd.get('email') as string | null,
        phone: fd.get('phone') as string | null,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[estimate-request] submit failed', err);
    }
    setIsEstimateLoading(false);
    setEstimateSubmitted(true);
  };

  return (
    <section id="buyers-guide" className="section-padding bg-brand-nearblack">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* TIER 1: FREE DOWNLOAD */}
          <div className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 blur-3xl -mr-16 -mt-16 group-hover:bg-brand-gold/10 transition-colors duration-700" />
            
            <div className="relative z-10">
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block font-normal">
                Free Resource
              </span>
              <h3 className="font-display text-4xl font-light text-brand-bonewhite mb-8 leading-tight">
                The Outdoor Living <br />
                <span className="italic">Buyers Guide</span>
              </h3>
              
              <ul className="space-y-6 mb-12">
                {[
                  "What to expect from the design-build process",
                  "Material comparisons: interlock, natural stone, porcelain",
                  "How to budget for a $40K–$90K+ project",
                  "Questions to ask every contractor",
                  "Golden Maple's 5-year warranty explained"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-4 font-sans text-sm text-brand-muted font-light leading-relaxed">
                    <CheckCircle2 size={18} className="text-brand-gold-dark shrink-0 mt-0.5" strokeWidth={1.5} />
                    {item}
                  </li>
                ))}
              </ul>

              <AnimatePresence mode="wait">
                {!guideSubmitted ? (
                  <motion.form 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleGuideSubmit}
                    className="space-y-6"
                    name="guide-download"
                  >
                    <input type="hidden" name="form-name" value="guide-download" />
                    <input type="hidden" name="source" value="buyers_guide_download" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        required
                        type="text"
                        name="name"
                        placeholder="First Name"
                        className="w-full bg-brand-nearblack border border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all rounded-[2px] placeholder:text-brand-muted/70 font-light"
                      />
                      <input 
                        required
                        type="email" 
                        name="email"
                        placeholder="Email Address"
                        className="w-full bg-brand-nearblack border border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all rounded-[2px] placeholder:text-brand-muted/70 font-light"
                      />
                    </div>
                    <button 
                      disabled={isGuideLoading}
                      type="submit" 
                      className="btn-primary w-full group py-5 disabled:opacity-50"
                    >
                      {isGuideLoading ? "Processing..." : "Download the Guide"}
                      {!isGuideLoading && <Download size={16} className="ml-3 group-hover:translate-y-1 transition-transform" strokeWidth={1.5} />}
                    </button>
                    <p className="font-sans text-[10px] text-center text-brand-bonewhite/65 uppercase tracking-widest">Instant PDF Access</p>
                  </motion.form>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 bg-brand-gold/5 border border-brand-gold/20 text-center rounded-[2px]"
                  >
                    <div className="w-16 h-16 bg-brand-gold rounded-full flex items-center justify-center mx-auto mb-6">
                      <Download size={32} className="text-brand-black" strokeWidth={1.5} />
                    </div>
                    <h4 className="font-display text-2xl text-brand-bonewhite mb-2">Check Your Downloads</h4>
                    <p className="font-sans text-brand-muted text-sm font-light leading-relaxed">
                      Your guide is on its way. If it doesn't start automatically, <a href="/downloads/golden-maple-buyers-guide.pdf" className="text-brand-gold-dark underline decoration-2 underline-offset-4">click here to download manually</a>.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* TIER 2: FREE ESTIMATE */}
          <div className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 blur-3xl -mr-16 -mt-16 group-hover:bg-brand-gold/10 transition-colors duration-700" />
            
            <div className="relative z-10">
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block font-normal">
                No Obligation
              </span>
              <h3 className="font-display text-4xl font-light text-brand-bonewhite mb-6 leading-tight">
                Request a <br />
                <span className="italic">Project Estimate</span>
              </h3>
              <p className="font-sans text-sm text-brand-muted mb-10 leading-relaxed font-light">Tell us about your project and we'll follow up within 1 business day.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 mb-8 text-[11px] text-brand-bonewhite uppercase tracking-wider font-normal">
                {[
                  "Rough budget range",
                  "Timeline confirmation",
                  "No site visit required",
                  "Upgrade at any time"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle2 size={14} className="text-brand-gold-dark" strokeWidth={2} />
                    {item}
                  </div>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {!estimateSubmitted ? (
                  <motion.form 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleEstimateSubmit}
                    className="space-y-4"
                    name="estimate-request"
                  >
                    <input type="hidden" name="form-name" value="estimate-request" />
                    <input type="hidden" name="source" value="estimate_request" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input 
                        required
                        type="text" 
                        name="name"
                        placeholder="Full Name"
                        className="w-full bg-brand-nearblack border border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all rounded-[2px] placeholder:text-brand-muted/70 font-light"
                      />
                      <input 
                        required
                        type="tel" 
                        name="phone"
                        placeholder="Phone Number"
                        className="w-full bg-brand-nearblack border border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all rounded-[2px] placeholder:text-brand-muted/70 font-light"
                      />
                    </div>
                    <input 
                      required
                      type="email" 
                      name="email"
                      placeholder="Email Address"
                      className="w-full bg-brand-nearblack border border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all rounded-[2px] placeholder:text-brand-muted/70 font-light"
                    />
                    <div className="relative">
                      <select
                        required
                        name="service"
                        className="w-full bg-brand-nearblack border border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all rounded-[2px] font-light appearance-none cursor-pointer"
                      >
                        <option value="" disabled selected>Type of Project</option>
                        <option>Interlocking Driveway or Patio</option>
                        <option>Natural Stone or Flagstone</option>
                        <option>Porcelain Installation</option>
                        <option>Retaining Wall</option>
                        <option>Steps & Walkways</option>
                        <option>Composite Deck</option>
                        <option>Outdoor Kitchen or Fire Feature</option>
                        <option>Full Backyard Transformation</option>
                        <option>Other / Not Sure Yet</option>
                      </select>
                      <ArrowRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-brand-muted pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select 
                        name="budget"
                        className="w-full bg-brand-nearblack border border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all rounded-[2px] font-light appearance-none cursor-pointer"
                      >
                        <option value="" disabled selected>Approximate Budget (Optional)</option>
                        <option>Under $20K</option>
                        <option>$20K–$40K</option>
                        <option>$40K–$60K</option>
                        <option>$60K–$90K</option>
                        <option>$90K+</option>
                        <option>Not sure yet</option>
                      </select>
                      <ArrowRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-brand-muted pointer-events-none" />
                    </div>
                    <textarea
                      name="details"
                      placeholder="Brief Description (Optional)"
                      rows={2}
                      className="w-full bg-brand-nearblack border border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all rounded-[2px] placeholder:text-brand-muted/70 font-light resize-none"
                    />
                    <button 
                      disabled={isEstimateLoading}
                      type="submit" 
                      className="btn-primary w-full group py-5 disabled:opacity-50"
                    >
                      {isEstimateLoading ? "Submitting..." : "Send My Request"}
                      {!isEstimateLoading && <ArrowRight size={16} className="ml-3 group-hover:translate-x-2 transition-transform" strokeWidth={1.5} />}
                    </button>
                  </motion.form>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-10 bg-brand-gold/5 border border-brand-gold/20 text-center rounded-[2px]"
                  >
                    <div className="w-16 h-16 bg-brand-gold rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 size={32} className="text-brand-black" strokeWidth={2} />
                    </div>
                    <h4 className="font-display text-3xl text-brand-bonewhite mb-3 font-light">Request Received</h4>
                    <p className="font-sans text-brand-muted text-sm font-light leading-relaxed">
                      Thank you for trusting Golden Maple. Our project specialist will review your details and reach out within 24 hours.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* TIER 3: DESIGN PACKAGE BAR */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 bg-brand-cream-light rounded-[2px] p-8 md:p-12 overflow-hidden relative group border border-brand-gold/40 shadow-[0_18px_50px_-30px_rgba(33,30,21,0.4)]"
        >
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-40" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-10 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="px-6 py-2 border border-brand-gold/40 rounded-full font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark bg-brand-gold/10">
                Serious Buyers
              </div>
              <div>
                <h4 className="font-display text-3xl text-brand-ink mb-2 font-light">Book a <span className="italic text-brand-green-dark">Design Package</span></h4>
                <p className="font-sans text-brand-muted text-sm font-light">
                  A paid on-site consultation. Full fee <span className="text-brand-ink font-normal underline decoration-brand-gold decoration-1 underline-offset-[6px]">credited toward your build</span> when you proceed.
                </p>
              </div>
            </div>
            <Link
              to="/contact"
              className="bg-brand-gold text-brand-black font-sans text-[11px] font-normal uppercase tracking-[0.25em] py-4 px-10 rounded-[2px] hover:bg-brand-gold-dark hover:translate-y-[-2px] transition-all duration-500 whitespace-nowrap shadow-xl"
            >
              Tell Us Your Budget
            </Link>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default BuyersGuide;
