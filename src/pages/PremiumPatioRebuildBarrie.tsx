import { Link } from 'react-router-dom';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import SEO from '../components/SEO';

const rebuildTriggers = ['Sinking or rocking pavers', 'Water pooling near foundation', 'Weeds/joint failure every season', 'Uneven steps or trip hazards', 'Old concrete/pavers to remove', 'You want it rebuilt once, properly'];
const ranges = [
  { range: '$25K–$45K', title: 'Clean Patio Rebuild', detail: 'Old surface removal, excavation, open-graded base, pavers, edge restraint, polymeric joints.' },
  { range: '$40K–$75K', title: 'Rebuild + Upgrade', detail: 'Larger patio footprint, steps, border/inlay, drainage correction, lighting conduit, premium material.' },
  { range: '$60K–$100K+', title: 'Failure Fix + Outdoor Room', detail: 'Replace failed hardscape and expand into dining/lounge zones with walls, fire, or lighting.' },
];

export default function PremiumPatioRebuildBarrie() {
  return (
    <div className="bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Premium Patio Rebuilds Barrie | Fix Sinking Interlock | Golden Maple"
        description="Replace a sinking, dated, or poorly built patio in Barrie with a premium open-graded base, drainage-aware rebuild, and 5-year structural warranty."
        canonical="https://goldenmaplelandscaping.ca/premium-patio-rebuild-barrie"
      />
      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="max-w-5xl mb-24">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-8 block">Sinking Patio Rebuilds · $25K-$100K+</span>
            <h1 className="font-display text-5xl md:text-8xl font-light leading-[1.05] mb-10">Your patio failed because <span className="italic text-brand-gold">the base failed.</span></h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed max-w-3xl font-light mb-12">Most failed interlock looks like a surface problem. It is almost always an excavation, drainage, base, or edge-restraint problem hiding underneath.</p>
            <div className="flex flex-col sm:flex-row gap-5">
              <Link to="/cost-estimator?type=patio" className="btn-primary">Estimate a Patio Rebuild</Link>
              <Link to="/resources/why-patios-sink-barrie" className="btn-ghost inline-flex items-center gap-3">Why patios sink <ArrowRight size={16} /></Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-28">
            {ranges.map((p) => (
              <div key={p.title} className="bg-brand-surface border border-brand-dim/10 p-10 rounded-[2px] shadow-2xl">
                <div className="font-display text-3xl text-brand-gold mb-4">{p.range}</div>
                <h2 className="font-display text-2xl mb-4">{p.title}</h2>
                <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{p.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 mb-28">
            <div className="bg-brand-burgundy/10 border border-brand-burgundy/30 p-12 rounded-[2px]">
              <AlertTriangle className="text-brand-gold mb-6" />
              <h2 className="font-display text-4xl font-light mb-6">We do not reset failed work on the same failed base.</h2>
              <p className="font-sans text-brand-muted leading-relaxed font-light">A rebuild is not a cosmetic repair. We remove the bad assembly, correct the water and base problem, then rebuild with clear stone, HPB, geotextile where needed, edge restraint, and a 5-year structural warranty.</p>
            </div>
            <div className="bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-8">Best-fit rebuild triggers</h2>
              <ul className="space-y-5">
                {rebuildTriggers.map((item) => <li key={item} className="flex gap-4 text-sm uppercase tracking-[0.18em] font-light"><Check size={17} className="text-brand-gold shrink-0" />{item}</li>)}
              </ul>
            </div>
          </div>

          <div className="text-center bg-brand-surface p-12 rounded-[2px] border border-brand-gold/20">
            <h2 className="font-display text-4xl md:text-6xl font-light mb-8">If the old patio failed once, <span className="text-brand-gold">do not buy the same build twice.</span></h2>
            <p className="font-sans text-brand-muted max-w-2xl mx-auto mb-10">Send photos and a budget range. We will tell you whether the project is a reset, a rebuild, or a full outdoor living upgrade.</p>
            <Link to="/contact" className="btn-primary">Send Rebuild Details</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
