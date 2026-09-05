import { FileText, MessageCircle, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { conservativeTrustItems } from '../data/business';

const icons = [MessageCircle, ShieldCheck, FileText, ClipboardCheck] as const;

/** Shared trust surface: unresolved published claims remain conservative. */
export default function PublicationTrustBar({ className = '' }: { className?: string }) {
  return (
    <section className={`border-y border-brand-dim/20 bg-brand-surface/30 ${className}`} aria-label="Project information">
      <div className="container-custom py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {conservativeTrustItems.map((item, index) => {
            const Icon = icons[index];
            return <p key={item} className="flex items-start gap-3 font-sans text-[10px] uppercase tracking-[0.18em] text-brand-muted font-light"><Icon size={14} className="text-brand-gold-dark mt-0.5 shrink-0" strokeWidth={1.5} />{item}</p>;
          })}
        </div>
      </div>
    </section>
  );
}
