import { Link } from 'react-router-dom';
import { ArrowRight, Check, Layers } from 'lucide-react';
import SEO from '../components/SEO';
import { BUSINESS, publicClaimCopy } from '../data/business';

const packages = [
  { range: '$90K–$120K', title: 'Single-Season Transformation', detail: 'Patio, retaining wall or steps, drainage correction, lighting conduit, and one feature element — built as one coordinated project.' },
  { range: '$120K–$160K', title: 'Multi-Zone Outdoor Living', detail: 'Dining and lounge zones, walls, steps, lighting, and a fire feature planned as one system with real traffic flow between zones.' },
  { range: '$160K+', title: 'Estate-Level Build', detail: 'Outdoor kitchen, premium stone, full lighting design, and phased construction across seasons guided by one master plan.' },
];

const inclusions = [
  'Site walk focused on grade, access, drainage, and family use',
  'Budget-first scope planning before design gets too expensive',
  'Patio, walls, steps, lighting, and add-ons planned as one system',
  'Project-specific base and drainage planning',
  'Clear written phasing if the project should span more than one season',
  'Current written workmanship terms confirmed for the project',
];

export default function FullBackyardTransformationsBarrie() {

  const faqs = [
    {
      q: "How long does a full transformation take?",
      a: "Design, permits, and the build itself run on three separate clocks. Most single-season builds mean several weeks of on-site production once excavation starts — the exact schedule is confirmed in the written scope after the site walk.",
    },
    {
      q: "Can we split the project across two seasons?",
      a: "Yes — phased builds are common at this budget. The master plan is finished up front so phase one (structure, drainage, base) sets up phase two (finishes, features) without rework or cutting open new work.",
    },
    {
      q: "Do we need to move out during construction?",
      a: "No. Access is staged so the house stays livable — most clients are home through the whole build. Expect noise, dust, and a backyard you cannot use for a while. That is the honest version.",
    },
    {
      q: "When should we start the conversation?",
      a: "Earlier than you think. Planning and design in late winter means permits, materials, and a production slot are lined up before build season. Summer inquiries typically build in the fall.",
    },
  ];
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
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Full Backyard Transformations · $90K-$160K+</span>
            <h1 className="font-display text-5xl md:text-8xl font-light leading-[1.05] mb-10">One backyard. <span className="italic text-brand-gold-dark">One engineered plan.</span></h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed max-w-3xl font-light mb-12">A full transformation is not a patio with accessories bolted on later. It is grade, water, structure, traffic flow, lighting, fire, cooking, and family use planned together before excavation starts.</p>
            <div className="flex flex-col sm:flex-row gap-5">
              <Link to="/cost-estimator?type=full" className="btn-primary">Estimate a Full Backyard</Link>
              <Link to="/luxury-landscape-barrie" className="btn-ghost inline-flex items-center gap-3">See premium construction <ArrowRight size={16} /></Link>
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
              <Layers className="text-brand-gold-dark mb-6" />
              <h2 className="font-display text-4xl font-light mb-6">The expensive mistake is building one piece at a time.</h2>
              <p className="font-sans text-brand-muted leading-relaxed font-light">When lighting, walls, pergola footings, drainage, and patio zones are planned after the patio is installed, homeowners pay twice: first in rework, then in a backyard that never feels intentional. A coordinated plan can help identify sequencing needs before construction.</p>
            </div>
            <div className="bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8">What belongs in the first plan</h2>
              <ul className="space-y-5">
                {inclusions.map((item) => <li key={item} className="flex gap-4 text-sm uppercase tracking-[0.18em] font-light"><Check size={17} className="text-brand-gold-dark shrink-0" />{item}</li>)}
              </ul>
            </div>
          </div>


          <div className="mb-28">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Phasing</span>
            <h2 className="font-display text-4xl md:text-6xl font-light mb-10 max-w-4xl">Phase it once, on paper, <span className="italic text-brand-gold-dark">before you build.</span></h2>
            <div className="grid lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                <p className="font-sans text-brand-muted leading-relaxed font-light">Some transformations should span two seasons — and that is fine, as long as the phasing is decided in the plan instead of mid-project. Structure and drainage go in first: walls, base, water management, conduit for future lighting, footings for a future pergola. Finishes follow.</p>
                <p className="font-sans text-brand-muted leading-relaxed font-light">What you never want is a patio installed this year that has to be cut open next year for the drain tile somebody forgot. A master plan drawn before excavation is the cheapest insurance a large project can buy.</p>
              </div>
              <div className="bg-brand-surface border border-brand-dim/10 p-12 rounded-[2px]">
                <h3 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8">Phase one always includes</h3>
                <ul className="space-y-5">
                  {["Grade and water management plan", "Retaining walls and structural steps", "Open-graded base and drainage", "Conduit for future lighting and gas", "Footings for future structures", "One written master plan"].map((item) => <li key={item} className="flex gap-4 text-sm uppercase tracking-[0.18em] font-light"><Check size={17} className="text-brand-gold-dark shrink-0" />{item}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-28">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Barrie, Block by Block</span>
            <h2 className="font-display text-4xl md:text-6xl font-light mb-10 max-w-4xl">From Allandale to the <span className="italic text-brand-gold-dark">north-end drumlins.</span></h2>
            <div className="max-w-4xl space-y-6">
              <p className="font-sans text-brand-muted leading-relaxed font-light">We build transformations across Barrie — from Allandale and Holly in the south to Letitia Heights and the drumlin slopes in the north. The lots change: flat lakeshore lots with nowhere for water to go, sloped north-end properties that need real structure, walkout basements that demand the lower level be designed, not left over.</p>
              <p className="font-sans text-brand-muted leading-relaxed font-light">The approach does not change. Grade, water, structure, traffic flow, and family use get planned together before excavation starts — whether the project is one season or two.</p>
            </div>
          </div>

          <div className="mb-28">
            <div className="max-w-3xl mb-16">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Transformation Questions</span>
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
            <h2 className="font-display text-4xl md:text-6xl font-light mb-8">Best-fit projects usually start at <span className="text-brand-gold-dark">$90K+.</span></h2>
            <p className="font-sans text-brand-muted max-w-2xl mx-auto mb-10">That budget gives the project room for the real work: excavation, base, drainage, walls or steps, layout, premium material, and enough crew days to build it without shortcuts.</p>
            <Link to="/contact" className="btn-primary">Send Backyard Details</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
