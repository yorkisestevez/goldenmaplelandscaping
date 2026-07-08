import { Link } from 'react-router-dom';
import { ArrowRight, Check, Layers } from 'lucide-react';
import SEO from '../components/SEO';

const packages = [
  { range: '$90K–$120K', title: 'Outdoor Living Core', detail: 'Large patio, walls or steps, lighting conduit, drainage corrections, and one lifestyle feature such as fire or pergola.' },
  { range: '$120K–$160K', title: 'Full Backyard Build', detail: 'Multi-zone patio, retaining/seat walls, outdoor kitchen or fire area, lighting, planting edges, and full grade planning.' },
  { range: '$160K+', title: 'Estate / Phased Transformation', detail: 'Pool-adjacent hardscape, terraced grade changes, multi-trade coordination, premium material packages, and phased construction.' },
];

const inclusions = [
  'Site walk focused on grade, access, drainage, and family use',
  'Budget-first scope planning before design gets too expensive',
  'Patio, walls, steps, lighting, and add-ons planned as one system',
  'Ontario freeze-thaw base strategy for every hardscape surface',
  'Clear written phasing if the project should span more than one season',
  '5-year structural warranty on Golden Maple hardscape work',
];

export default function FullBackyardTransformationsBarrie() {
  return (
    <div className="bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Full Backyard Transformations Barrie | $90K+ Outdoor Living | Golden Maple"
        description="Complete backyard transformations in Barrie and Simcoe County: patios, retaining walls, steps, lighting, fire, outdoor kitchens, drainage, and premium hardscape systems."
        canonical="https://goldenmaplelandscaping.ca/full-backyard-transformations-barrie"
      />
      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="max-w-5xl mb-24">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-8 block">Full Backyard Transformations · $90K-$160K+</span>
            <h1 className="font-display text-5xl md:text-8xl font-light leading-[1.05] mb-10">One backyard. <span className="italic text-brand-gold">One engineered plan.</span></h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed max-w-3xl font-light mb-12">A full transformation is not a patio with accessories bolted on later. It is grade, water, structure, traffic flow, lighting, fire, cooking, and family use planned together before excavation starts.</p>
            <div className="flex flex-col sm:flex-row gap-5">
              <Link to="/cost-estimator?type=full" className="btn-primary">Estimate a Full Backyard</Link>
              <Link to="/luxury-landscape-barrie" className="btn-ghost inline-flex items-center gap-3">See premium construction <ArrowRight size={16} /></Link>
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
              <Layers className="text-brand-gold mb-6" />
              <h2 className="font-display text-4xl font-light mb-6">The expensive mistake is building one piece at a time.</h2>
              <p className="font-sans text-brand-muted leading-relaxed font-light">When lighting, walls, pergola footings, drainage, and patio zones are planned after the patio is installed, homeowners pay twice: first in rework, then in a backyard that never feels intentional. Golden Maple builds the system in the right order.</p>
            </div>
            <div className="bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-8">What belongs in the first plan</h2>
              <ul className="space-y-5">
                {inclusions.map((item) => <li key={item} className="flex gap-4 text-sm uppercase tracking-[0.18em] font-light"><Check size={17} className="text-brand-gold shrink-0" />{item}</li>)}
              </ul>
            </div>
          </div>

          <div className="text-center bg-brand-surface p-12 rounded-[2px] border border-brand-gold/20">
            <h2 className="font-display text-4xl md:text-6xl font-light mb-8">Best-fit projects usually start at <span className="text-brand-gold">$90K+.</span></h2>
            <p className="font-sans text-brand-muted max-w-2xl mx-auto mb-10">That budget gives the project room for the real work: excavation, base, drainage, walls or steps, layout, premium material, and enough crew days to build it without shortcuts.</p>
            <Link to="/contact" className="btn-primary">Send Backyard Details</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
