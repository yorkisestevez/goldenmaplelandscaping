import { FileText, MessageCircle, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { conservativeTrustItems } from '../data/business';
import GoogleReviewsLink from './GoogleReviewsLink';

const icons = [MessageCircle, ShieldCheck, FileText, ClipboardCheck] as const;

/** Trust lines render only when src/data/ownerFacts.ts has a completed slot. */
export default function PublicationTrustBar({ className = '' }: { className?: string }) {
  if (conservativeTrustItems.length === 0) {
    return (
      <section className={`border-y border-brand-dim/20 bg-brand-surface/30 ${className}`} aria-label="Google reviews">
        <div className="container-custom py-5">
          <GoogleReviewsLink className="font-sans text-[11px] uppercase tracking-[0.18em] text-brand-gold-dark" />
        </div>
      </section>
    );
  }
  return (
    <section className={`border-y border-brand-dim/20 bg-brand-surface/30 ${className}`} aria-label="Project information">
      <div className="container-custom py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {conservativeTrustItems.map((item, index) => {
            const Icon = icons[index] ?? ClipboardCheck;
            return <p key={item} className="flex items-start gap-3 font-sans text-[10px] uppercase tracking-[0.18em] text-brand-muted font-light"><Icon size={14} className="text-brand-gold-dark mt-0.5 shrink-0" strokeWidth={1.5} />{item}</p>;
          })}
        </div>
        <GoogleReviewsLink className="mt-4 inline-block font-sans text-[11px] uppercase tracking-[0.18em] text-brand-gold-dark" />
      </div>
    </section>
  );
}
