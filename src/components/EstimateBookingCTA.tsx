import type { ReactNode } from 'react';
import { Calendar, Sparkles, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { trackCall } from '../utils/analytics';
import { BUSINESS, publicClaimCopy, publicContact } from '../data/business';
import { getProject, projectCover } from '../data/projects';
import ResponsiveImage from './ResponsiveImage';

/**
 * Two-track CTA: project conversation or design enquiry.
 *
 * Optional integration (set in Netlify env var):
 *   VITE_STRIPE_DESIGN_URL — Stripe Payment Link for a design session
 *
 * The conversation track points at the booking flow.
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
  // Conversation track preserves the existing booking route.
  // Sending people to /contact made them re-type everything the estimator already captured.
  const freeHref = '/book';
  const designHref = stripeDesignUrl || '/contact?type=design';

  // Owner-attested completed-project photos only (scripts/portfolio-sources.mjs).
  const proofPhotos = ['barrie-diamond-inlay-patio', 'sloped-backyard-patio-steps', 'deck-and-garden-walkway']
    .map((slug) => projectCover(getProject(slug)!));

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-3 gap-2 md:gap-3" data-testid="estimator-proof-strip">
        {proofPhotos.map((photo) => (
          <div key={photo.src} className="aspect-[4/3] overflow-hidden rounded-[2px] border border-brand-dim/10">
            <ResponsiveImage image={photo} sizes="(min-width: 768px) 20vw, 33vw" aspect="fill" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>

      <div className="text-center">
        <h4 className="font-display text-3xl md:text-5xl text-brand-bone mb-3 tracking-tight">
          Lock in your <span className="italic text-brand-gold-dark">exact numbers.</span>
        </h4>
        <p className="font-sans text-[15px] font-light text-brand-muted max-w-xl mx-auto leading-relaxed">
          Two ways to go from ballpark to bid. Pick the one that fits where you are.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Track 1 — project phone call */}
        <CTACard
          href={freeHref}
          className="group relative bg-gradient-to-b from-brand-gold/[0.10] to-brand-gold/[0.02] border border-brand-gold/40 rounded-3xl p-8 hover:border-brand-gold/70 hover:from-brand-gold/[0.14] transition-all flex flex-col backdrop-blur-xl shadow-[0_20px_60px_-30px_rgba(212,175,99,0.35)]"
        >
          <div className="absolute -top-3 left-7 bg-brand-gold text-brand-black font-sans text-[9px] uppercase tracking-widest px-3 py-1 rounded-full font-medium shadow-[0_4px_12px_rgba(212,175,99,0.5)]">
            Project call
          </div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center">
              <Calendar size={18} className="text-brand-gold-dark" strokeWidth={1.75} />
            </div>
            <span className="font-display text-2xl text-brand-bone tracking-tight">Project Discovery Call</span>
          </div>
          <p className="font-sans text-[13px] font-light text-brand-muted mb-6 flex-1 leading-relaxed">
            A quick phone call with Yorkis to confirm scope, timeline, and budget fit for your project. No site visit, no sales pitch — just an honest read on your numbers.
          </p>
          <ul className="space-y-2 mb-7 font-sans text-[12px] font-light text-brand-bone">
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />Pick a phone time that works for you</li>
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />Your estimator numbers reviewed live</li>
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />Honest read if we're not the right fit</li>
          </ul>
          <div className="flex items-center justify-between mt-auto pt-5 border-t border-brand-gold/15">
            <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold-dark">Book My Call</span>
            <Calendar size={16} className="text-brand-gold-dark group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </div>
        </CTACard>

        {/* Track 2 — design enquiry */}
        <CTACard
          href={designHref}
          className="group relative bg-brand-cream-light border border-brand-dim/60 rounded-3xl p-8 hover:border-brand-gold/60 transition-all flex flex-col"
        >
          <div className="absolute -top-3 left-7 bg-brand-bone text-brand-porcelain font-sans text-[9px] uppercase tracking-widest px-3 py-1 rounded-full font-medium">
            Design enquiry
          </div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-cream border border-brand-dim/60 flex items-center justify-center">
              <Sparkles size={18} className="text-brand-gold-dark" strokeWidth={1.75} />
            </div>
            <span className="font-display text-2xl text-brand-bone tracking-tight">Design Session</span>
          </div>
          <p className="font-sans text-[13px] font-light text-brand-muted mb-6 flex-1 leading-relaxed">
            Contact us to confirm the current design scope, format, and project fit.
          </p>
          <ul className="space-y-2 mb-7 font-sans text-[12px] font-light text-brand-bone">
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />{publicClaimCopy(BUSINESS.commercialPolicies.design, 'Current design details are available.')}</li>
            <li className="flex gap-2.5 items-start"><span className="mt-1.5 w-1 h-1 rounded-full bg-brand-gold shrink-0" />Discuss materials, layout, and project priorities</li>
          </ul>
          <div className="flex items-center justify-between mt-auto pt-5 border-t border-brand-dim/60">
            <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold-dark">Book Design Session</span>
            <Calendar size={16} className="text-brand-gold-dark group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </div>
        </CTACard>
      </div>

      <div className="text-center pt-1">
        <a
          href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('estimatebookingcta_phone')}
          className="font-sans text-[13px] text-brand-gold-dark hover:text-brand-bone transition-colors inline-flex items-center gap-2"
        >
          <Phone size={14} strokeWidth={1.5} />
          Or call us directly: {publicContact.phoneDisplay}
        </a>
      </div>
    </div>
  );
}
