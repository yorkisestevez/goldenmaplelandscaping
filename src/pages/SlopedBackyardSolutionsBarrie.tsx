import { Link } from 'react-router-dom';
import { ArrowRight, Check, Shield } from 'lucide-react';
import SEO from '../components/SEO';

const packages = [
  { range: '$30K–$55K', title: 'Grade Fix + Drainage', detail: 'Slope correction, water routing, excavation, base prep, and a clean usable zone for a future patio.' },
  { range: '$50K–$100K', title: 'Patio + Retaining Wall', detail: 'The core Golden Maple target: level outdoor living space, steps, wall, drainage, and proper open-graded base.' },
  { range: '$90K–$150K+', title: 'Terraced Backyard Transformation', detail: 'Multi-zone patios, tiered retaining walls, lighting, fire feature, and staged access through difficult lots.' },
];

const symptoms = ['Water runs toward the house', 'The yard is too sloped to use', 'Existing wall is leaning or failing', 'Walkout basement needs steps/landings', 'Cheap patio quote ignored drainage', 'You need usable space, not just stones'];

export default function SlopedBackyardSolutionsBarrie() {
  return (
    <div className="bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Sloped Backyard & Retaining Wall Solutions Barrie | Golden Maple"
        description="Turn a sloped, wet, or unusable Barrie backyard into a level outdoor living space with retaining walls, drainage, steps, and premium hardscape construction."
        canonical="https://goldenmaplelandscaping.ca/sloped-backyard-solutions-barrie"
      />
      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="max-w-5xl mb-24">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-8 block">Retaining Walls · Drainage · Grade Correction</span>
            <h1 className="font-display text-5xl md:text-8xl font-light leading-[1.05] mb-10">Fix the slope. <span className="italic text-brand-gold">Reclaim the yard.</span></h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed max-w-3xl font-light mb-12">If your backyard is steep, wet, awkward, or failing, the patio is not the first decision. The first decision is how water moves, where the grade lands, and what structure holds it for the next twenty winters.</p>
            <div className="flex flex-col sm:flex-row gap-5">
              <Link to="/cost-estimator?type=wall" className="btn-primary">Price a Sloped Yard Project</Link>
              <Link to="/resources/retaining-wall-engineer-required-ontario" className="btn-ghost inline-flex items-center gap-3">When walls need engineering <ArrowRight size={16} /></Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-28">
            {packages.map((p) => (
              <div key={p.title} className="bg-brand-surface border border-brand-dim/10 p-10 rounded-[2px] shadow-2xl">
                <div className="font-display text-3xl text-brand-gold mb-4">{p.range}</div>
                <h2 className="font-display text-2xl mb-4">{p.title}</h2>
                <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{p.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 mb-28">
            <div className="bg-brand-burgundy/10 border border-brand-burgundy/30 p-12 rounded-[2px]">
              <Shield className="text-brand-gold mb-6" />
              <h2 className="font-display text-4xl font-light mb-6">This is where cheap hardscape fails.</h2>
              <p className="font-sans text-brand-muted leading-relaxed font-light">A sloped yard needs structure and drainage before it needs pavers. Golden Maple scopes retaining walls, drain tile, clear-stone backfill, geogrid where required, steps, base depth, and access before quoting the pretty surface.</p>
            </div>
            <div className="bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-8">Good-fit symptoms</h2>
              <ul className="space-y-5">
                {symptoms.map((item) => <li key={item} className="flex gap-4 text-sm uppercase tracking-[0.18em] font-light"><Check size={17} className="text-brand-gold shrink-0" />{item}</li>)}
              </ul>
            </div>
          </div>

          <div className="text-center bg-brand-surface p-12 rounded-[2px] border border-brand-gold/20">
            <h2 className="font-display text-4xl md:text-6xl font-light mb-8">Most qualified projects land between <span className="text-brand-gold">$50K and $100K.</span></h2>
            <p className="font-sans text-brand-muted max-w-2xl mx-auto mb-10">That range gives the project enough room for excavation, wall structure, drainage, premium material, and proper production time — instead of cutting corners where failure starts.</p>
            <Link to="/contact" className="btn-primary">Send Photos + Budget</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
