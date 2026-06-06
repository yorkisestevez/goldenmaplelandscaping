import type { ReactNode } from 'react';
import { Calendar, Sparkles, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Two-track CTA: free written estimate via the budget form, OR paid $99 design session.
 *
 * Optional integration (set in Netlify env var):
 *   VITE_STRIPE_DESIGN_URL — Stripe Payment Link for the $99 design session
 *
 * The free track always points at /contact (the budget form).
 */
function CTACard({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const isExternal = href.startsWith('http');
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <Link to={href} className={className}>{children}</Link>;
}

export default function EstimateBookingCTA() {
  const stripeDesignUrl = (import.meta.env.VITE_STRIPE_DESIGN_URL as string | undefined)?.trim() || '';
  const freeHref = '/contact';
  const designHref = stripeDesignUrl || '/contact?type=design';

  return (
    <div className="space-y-7">
      <div className="text-center">
        <h4 className="font-display text-3xl md:text-5xl text-brand-bone mb-3 tracking-tight">
          Lock in your <span className="italic text-brand-gold">exact numbers.</span>
        </h4>
        <p className="font-sans text-[15px] font-light text-brand-muted max-w-xl mx-auto leading-relaxed">
          Two ways to go from ballpark to bid. Pick the one that fits where you are.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Track 1 — Free 15-min phone call */}
        <CTACard
          href={freeHref}
          className="group relative bg-gradient-to-b from-brand-gold/[0.10] to-brand-gold/[0.02] border border-brand-gold/40 rounded-3xl p-8 hover:border-brand-gold/70 hover:from-brand-gold/[0.14] transition-all flex flex-col backdrop-blur-xl shadow-[0_20px_60px_-30px_rgba(212,175,99,0.35)]"
        >
          <div className="absolute -top-3 left-7 bg-brand-gold text-brand-black font-sans text-[9px] uppercase tracking-widest px-3 py-1 rounded-full font-medium shadow-[0_4px_12px_rgba(212,175,99,0.5)]">
            Free
          </div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center">
              <Calendar size={18} className="text-brand-gold" strokeWidth={1.75} />
            </div>
            <span className="font-display text-2xl text-brand-bone tracking-tight">Written Estimate</span>
          </div>
          <p className="font-sans text-[13px] font-light text-brand-muted mb-6 flex-1 leading-relaxed">
            Share your budget and project details on the contact form. Yorkis comes back personally with scope, timeline, and a written estimate within 24 hours — no sales call required.
          </p>
          <ul className="space-y-2 mb-7 font-sans text-[12px] font-light text-brand-bone">
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />Three minutes to fill out the form</li>
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />Written response within 24 hours</li>
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />Honest read if we're not the right fit</li>
          </ul>
          <div className="flex items-center justify-between mt-auto pt-5 border-t border-brand-gold/15">
            <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold">Send My Budget</span>
            <Calendar size={16} className="text-brand-gold group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </div>
        </CTACard>

        {/* Track 2 — Paid design session */}
        <CTACard
          href={designHref}
          className="group relative bg-gradient-to-b from-brand-cream-light to-brand-cream-light border border-brand-dim/60 rounded-3xl p-8 hover:border-brand-gold/60 hover:from-brand-cream-light transition-all flex flex-col backdrop-blur-xl"
        >
          <div className="absolute -top-3 left-7 bg-brand-bone text-brand-black font-sans text-[9px] uppercase tracking-widest px-3 py-1 rounded-full font-medium">
            $99 · Credited Back
          </div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-cream border border-brand-dim/60 flex items-center justify-center">
              <Sparkles size={18} className="text-brand-gold" strokeWidth={1.75} />
            </div>
            <span className="font-display text-2xl text-brand-bone tracking-tight">Design Session</span>
          </div>
          <p className="font-sans text-[13px] font-light text-brand-muted mb-6 flex-1 leading-relaxed">
            60-minute on-site or video session with a designer. Material samples, layout sketches, exact pricing — yours to keep.
          </p>
          <ul className="space-y-2 mb-7 font-sans text-[12px] font-light text-brand-bone">
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />Layout sketch + material samples in hand</li>
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />$99 credited toward your project if you book</li>
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />For serious buyers ready in 30–90 days</li>
          </ul>
          <div className="flex items-center justify-between mt-auto pt-5 border-t border-brand-dim/60">
            <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold">Book Design Session</span>
            <Calendar size={16} className="text-brand-gold group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </div>
        </CTACard>
      </div>

      <div className="text-center pt-1">
        <a
          href="tel:7055003581"
          className="font-sans text-[13px] text-brand-gold hover:text-brand-bone transition-colors inline-flex items-center gap-2"
        >
          <Phone size={14} strokeWidth={1.5} />
          Or call us directly: (705) 500-3581
        </a>
      </div>
    </div>
  );
}
