import { Link } from 'react-router-dom';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import SEO from '../components/SEO';
import { BUSINESS, publicClaimCopy } from '../data/business';

const rebuildTriggers = ['Sinking or rocking pavers', 'Water pooling near foundation', 'Weeds/joint failure every season', 'Uneven steps or trip hazards', 'Old concrete/pavers to remove', 'You want to discuss a rebuild plan'];
const ranges = [
  { range: '$25K–$45K', title: 'Clean Patio Rebuild', detail: 'Old surface removal, excavation, open-graded base, pavers, edge restraint, polymeric joints.' },
  { range: '$40K–$75K', title: 'Rebuild + Upgrade', detail: 'Larger patio footprint, steps, border/inlay, drainage correction, lighting conduit, premium material.' },
  { range: '$60K–$100K+', title: 'Failure Fix + Outdoor Room', detail: 'Replace failed hardscape and expand into dining/lounge zones with walls, fire, or lighting.' },
];

export default function PremiumPatioRebuildBarrie() {

  const faqs = [
    {
      q: "Can you just lift and reset my existing pavers?",
      a: "Only if the base underneath is worth keeping — and on a failed patio, it rarely is. We do not reset failed work on the same failed base. A reset on bad base buys you the same failure on a delay, so we would rather tell you that now than sell you the job twice.",
    },
    {
      q: "How do I tell a base problem from a surface problem?",
      a: "Surface problems are cosmetic: faded colour, worn sealer, a stain that will not lift. Base problems move: rocking pavers, joints that empty out every season, water pooling where it never used to, steps settling unevenly. If the patio moves, the problem is underneath.",
    },
    {
      q: "Do you haul away the old patio?",
      a: "Yes. Removal and disposal of the failed surface is part of every rebuild scope — the clean rebuild starts with old surface removal, fresh excavation, and an open-graded base built to drain.",
    },
    {
      q: "What do the written workmanship terms cover?",
      a: publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms are available for your project.'),
    },
  ];
  return (
    <div className="bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Premium Patio Rebuilds Barrie | Fix Sinking Interlock | Golden Maple"
        description="Plan a patio rebuild in Barrie with project-specific drainage, base, materials, and written workmanship terms."
        canonical="https://goldenmaplelandscaping.ca/premium-patio-rebuild-barrie"
      />
      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="max-w-5xl mb-24">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Sinking Patio Rebuilds · $25K-$100K+</span>
            <h1 className="font-display text-5xl md:text-8xl font-light leading-[1.05] mb-10">Your patio failed because <span className="italic text-brand-gold-dark">the base failed.</span></h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed max-w-3xl font-light mb-12">Most failed interlock looks like a surface problem. It is almost always an excavation, drainage, base, or edge-restraint problem hiding underneath.</p>
            <div className="flex flex-col sm:flex-row gap-5">
              <Link to="/cost-estimator?type=patio" className="btn-primary">Estimate a Patio Rebuild</Link>
              <Link to="/resources/why-patios-sink-barrie" className="btn-ghost inline-flex items-center gap-3">Why patios sink <ArrowRight size={16} /></Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-28">
            {ranges.map((p) => (
              <div key={p.title} className="bg-brand-surface border border-brand-dim/10 p-10 rounded-[2px] shadow-2xl">
                <div className="font-display text-3xl text-brand-gold-dark mb-4">{p.range}</div>
                <h2 className="font-display text-2xl mb-4">{p.title}</h2>
                <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{p.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 mb-28">
            <div className="bg-brand-burgundy/10 border border-brand-burgundy/30 p-12 rounded-[2px]">
              <AlertTriangle className="text-brand-gold-dark mb-6" />
              <h2 className="font-display text-4xl font-light mb-6">We do not reset failed work on the same failed base.</h2>
              <p className="font-sans text-brand-muted leading-relaxed font-light">A rebuild is not a cosmetic repair. We remove the bad assembly, correct the water and base problem, then rebuild with clear stone, HPB, geotextile where needed, edge restraint, and project-specific written workmanship terms.</p>
            </div>
            <div className="bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8">Best-fit rebuild triggers</h2>
              <ul className="space-y-5">
                {rebuildTriggers.map((item) => <li key={item} className="flex gap-4 text-sm uppercase tracking-[0.18em] font-light"><Check size={17} className="text-brand-gold-dark shrink-0" />{item}</li>)}
              </ul>
            </div>
          </div>


          <div className="mb-28">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Barrie Site Conditions</span>
            <h2 className="font-display text-4xl md:text-6xl font-light mb-10 max-w-4xl">Barrie is hard on patios. <span className="italic text-brand-gold-dark">The base decides.</span></h2>
            <div className="grid lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                <p className="font-sans text-brand-muted leading-relaxed font-light">Barrie sits between flat lakeshore in the south and rolling drumlin slopes through the north and east — and most properties here have at least mild grading challenges. That means water is always moving somewhere: down a slope toward a foundation, across a flat lot with nowhere to go, or into a base that was never built to drain.</p>
                <p className="font-sans text-brand-muted leading-relaxed font-light">Add Ontario freeze-thaw cycles — water trapped in a poorly drained base expands every winter and heaves pavers upward — and a patio built on shortcuts has a short life. The surface is just where the symptoms show up. Our rebuilds start by assuming the base is guilty until the excavation proves otherwise.</p>
                <Link to="/resources/why-patios-sink-barrie" className="btn-ghost inline-flex items-center gap-3">Read: why patios sink in Barrie <ArrowRight size={16} /></Link>
              </div>
              <div className="bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
                <h3 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8">What we usually find underneath</h3>
                <ul className="space-y-5">
                  {["Shallow excavation over native soil", "Fine screenings where open-graded stone belongs", "No geotextile separation between soil and base", "Missing or failed edge restraint", "Patio sloped toward the house, not away"].map((item) => <li key={item} className="flex gap-4 text-sm uppercase tracking-[0.18em] font-light"><Check size={17} className="text-brand-gold-dark shrink-0" />{item}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-28">
            <div className="max-w-3xl mb-16">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Rebuild Questions</span>
              <h2 className="font-display text-4xl md:text-6xl font-light">Straight answers.</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
              {faqs.map((faq, idx) => (
                <div key={idx} className="bg-brand-surface p-7 md:p-10 border border-brand-dim/10 rounded-[2px] hover:border-brand-gold/20 transition-colors">
                  <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-4 md:mb-6 leading-tight">{faq.q}</h3>
                  <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center bg-brand-surface p-12 rounded-[2px] border border-brand-gold/20">
            <h2 className="font-display text-4xl md:text-6xl font-light mb-8">If the old patio failed once, <span className="text-brand-gold-dark">do not buy the same build twice.</span></h2>
            <p className="font-sans text-brand-muted max-w-2xl mx-auto mb-10">Send photos and a budget range. We will tell you whether the project is a reset, a rebuild, or a full outdoor living upgrade.</p>
            <Link to="/contact" className="btn-primary">Send Rebuild Details</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
