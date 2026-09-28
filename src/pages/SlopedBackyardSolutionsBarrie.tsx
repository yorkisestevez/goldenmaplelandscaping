import { Link } from 'react-router-dom';
import { ArrowRight, Check, Shield } from 'lucide-react';
import SEO from '../components/SEO';
import { BUSINESS, publicClaimCopy } from '../data/business';

const packages = [
  { range: '$30K–$55K', title: 'Grade Fix + Drainage', detail: 'Slope correction, water routing, excavation, base prep, and a clean usable zone for a future patio.' },
  { range: '$50K–$100K', title: 'Patio + Retaining Wall', detail: 'The core Golden Maple target: level outdoor living space, steps, wall, drainage, and proper open-graded base.' },
  { range: '$90K–$150K+', title: 'Terraced Backyard Transformation', detail: 'Multi-zone patios, tiered retaining walls, lighting, fire feature, and staged access through difficult lots.' },
];

const symptoms = ['Water runs toward the house', 'The yard is too sloped to use', 'Existing wall is leaning or failing', 'Walkout basement needs steps/landings', 'Cheap patio quote ignored drainage', 'You need usable space, not just stones'];

export default function SlopedBackyardSolutionsBarrie() {

  const faqs = [
    {
      q: "Does my retaining wall need an engineer?",
      a: "It depends on the wall's height, what it holds back, and what sits above it. Our article on when Ontario retaining walls need engineering walks through the triggers — and every Golden Maple wall scope confirms the engineering call in writing before construction starts.",
    },
    {
      q: "My backyard has no machine access. Can you still build?",
      a: "Usually, yes — it just changes the production plan. Tight access means smaller equipment or hand work, more days on site, and a higher price. That is exactly why access gets scoped before quoting, not discovered mid-project.",
    },
    {
      q: "What happens to all the excavated soil?",
      a: "Where the lot allows, we regrade it into the landscape as part of the grade plan. Where it does not, it is hauled off-site. Either way, disposal is written into the scope — never a surprise line item later.",
    },
    {
      q: "How long does a wall-and-patio project take?",
      a: "Wall height, access, and weather drive the schedule more than square footage does. Timelines are confirmed in the written scope after the site walk — we would rather give you a real date than a fast one.",
    },
  ];
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
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Retaining Walls · Drainage · Grade Correction</span>
            <h1 className="font-display text-5xl md:text-8xl font-light leading-[1.05] mb-10">Fix the slope. <span className="italic text-brand-gold-dark">Reclaim the yard.</span></h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed max-w-3xl font-light mb-12">If your backyard is steep, wet, awkward, or failing, the patio is not the first decision. The first decision is how water moves, where the grade lands, and what structure holds it for the next twenty winters.</p>
            <div className="flex flex-col sm:flex-row gap-5">
              <Link to="/cost-estimator?type=wall" className="btn-primary">Price a Sloped Yard Project</Link>
              <Link to="/resources/retaining-wall-engineer-required-ontario" className="btn-ghost inline-flex items-center gap-3">When walls need engineering <ArrowRight size={16} /></Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-28">
            {packages.map((p) => (
              <div key={p.title} className="bg-brand-surface border border-brand-dim/10 p-10 rounded-[2px] shadow-2xl">
                <div className="font-display text-3xl text-brand-gold-dark mb-4">{p.range}</div>
                <h2 className="font-display text-2xl mb-4">{p.title}</h2>
                <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{p.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 mb-28">
            <div className="bg-brand-burgundy/10 border border-brand-burgundy/30 p-12 rounded-[2px]">
              <Shield className="text-brand-gold-dark mb-6" />
              <h2 className="font-display text-4xl font-light mb-6">This is where cheap hardscape fails.</h2>
              <p className="font-sans text-brand-muted leading-relaxed font-light">A sloped yard needs structure and drainage before it needs pavers. Golden Maple scopes retaining walls, drain tile, clear-stone backfill, geogrid where required, steps, base depth, and access before quoting the pretty surface.</p>
            </div>
            <div className="bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8">Good-fit symptoms</h2>
              <ul className="space-y-5">
                {symptoms.map((item) => <li key={item} className="flex gap-4 text-sm uppercase tracking-[0.18em] font-light"><Check size={17} className="text-brand-gold-dark shrink-0" />{item}</li>)}
              </ul>
            </div>
          </div>


          <div className="mb-28">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Barrie Terrain</span>
            <h2 className="font-display text-4xl md:text-6xl font-light mb-10 max-w-4xl">Half of Barrie is a hill. <span className="italic text-brand-gold-dark">Build like it.</span></h2>
            <div className="grid lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                <p className="font-sans text-brand-muted leading-relaxed font-light">Barrie&apos;s terrain is mixed — flat lakeshore in the south, rolling drumlin slopes through the north and east — and most properties here have at least mild grading challenges. Walkout basements are common, which means the most-used door in the house often opens onto the steepest part of the lot.</p>
                <p className="font-sans text-brand-muted leading-relaxed font-light">The mistake we see most: a patio quoted before anyone planned where the water goes. On a slope, water is the project and the pavers are the finish. From Allandale to Holly to Letitia Heights, the lots change — the physics does not.</p>
              </div>
              <div className="bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
                <h3 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8">What a proper slope scope includes</h3>
                <ul className="space-y-5">
                  {["Grade plan: where water starts, travels, and leaves", "Retaining wall structure, with geogrid where required", "Drain tile and clear-stone backfill behind walls", "Steps and landings tied into the wall system", "Access plan for excavation equipment", "Written scope before the first shovel"].map((item) => <li key={item} className="flex gap-4 text-sm uppercase tracking-[0.18em] font-light"><Check size={17} className="text-brand-gold-dark shrink-0" />{item}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-28">
            <div className="max-w-3xl mb-16">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Sloped Yard Questions</span>
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
            <h2 className="font-display text-4xl md:text-6xl font-light mb-8">Most qualified projects land between <span className="text-brand-gold-dark">$50K and $100K.</span></h2>
            <p className="font-sans text-brand-muted max-w-2xl mx-auto mb-10">That range gives the project enough room for excavation, wall structure, drainage, premium material, and proper production time — instead of cutting corners where failure starts.</p>
            <Link to="/contact" className="btn-primary">Send Photos + Budget</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
