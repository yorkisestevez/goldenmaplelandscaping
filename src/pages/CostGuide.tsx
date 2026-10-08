import { CheckCircle, FileText, Shield, BookOpen } from 'lucide-react';
import SEO from '../components/SEO';
import LeadForm from '../components/LeadForm';

const HIGHLIGHTS = [
  'Real per-sqft prices for interlocking, decking, walls, and full backyards in Simcoe County',
  '5 hidden costs that turn an "$18,000 bargain" into a $58,000 rebuild',
  '4 questions to ask a cheap contractor — in writing — before you sign',
  'How base prep depth, paver brand, and site grade actually change your final number',
  'Sample budgets: $25K functional patio → $120K elevated outdoor living',
];

export default function CostGuide() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: '2026 Simcoe County Backyard Cost Guide',
    description:
      'Free PDF guide with real 2026 pricing for interlocking, decking, retaining walls, and full backyard renovations in Barrie and Simcoe County, Ontario.',
    url: 'https://goldenmaplelandscaping.ca/cost-guide/',
  };

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Free 2026 Backyard Cost Guide — Barrie & Simcoe County"
        description="Free PDF: real 2026 prices for patios, decks, retaining walls, and full backyards in Simcoe County. Plus the 5 hidden costs cheap contractors hide. No spam."
        canonical="https://goldenmaplelandscaping.ca/cost-guide"
        schema={schema}
      />

      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
            {/* Left: Pitch */}
            <div className="lg:col-span-7">
              <div className="flex items-center gap-4 mb-10">
                <div className="h-px w-16 bg-brand-gold" />
                <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark">
                  Free Download · 2026 Edition
                </span>
              </div>

              <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                The 2026 Simcoe County <br />
                <span className="text-brand-gold-dark italic">backyard cost guide.</span>
              </h1>

              <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light max-w-xl mb-12">
                Real 2026 pricing from 42 completed jobs across Barrie, Innisfil, Oro-Medonte and Springwater. The numbers other contractors don't want you to see — and the hidden costs that turn a low quote into a five-figure regret.
              </p>

              <ul className="space-y-6 mb-16">
                {HIGHLIGHTS.map((h, idx) => (
                  <li key={idx} className="flex items-start gap-5">
                    <CheckCircle size={20} className="text-brand-gold mt-1 shrink-0" strokeWidth={1.5} />
                    <span className="font-sans text-sm md:text-base text-brand-muted leading-relaxed font-light">
                      {h}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-8 text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                <div className="flex items-center gap-3">
                  <FileText size={14} className="text-brand-gold" strokeWidth={1.5} />
                  12-page PDF
                </div>
                <span className="w-px h-4 bg-brand-dim/30" />
                <div className="flex items-center gap-3">
                  <Shield size={14} className="text-brand-gold" strokeWidth={1.5} />
                  No spam. Unsubscribe anytime.
                </div>
              </div>
            </div>

            {/* Right: Email Capture */}
            <div className="lg:col-span-5 w-full lg:sticky lg:top-32">
              <div className="bg-brand-surface border border-brand-gold/25 rounded-[2px] p-10 md:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite leading-tight mb-3">
                  Send me <span className="italic text-brand-gold-dark">the guide.</span>
                </h2>
                <p className="font-sans text-sm text-brand-muted font-light mb-8 leading-relaxed">
                  The PDF downloads on the next page. We do not add you to an email series from this form.
                </p>
                <LeadForm
                  formName="cost-guide"
                  source="cost-guide-page"
                  idPrefix="cost-guide"
                  submitLabel="Download the guide"
                  intent="top-of-funnel"
                />
              </div>
            </div>
          </div>

          {/* What's inside */}
          <div className="mt-40 max-w-3xl mx-auto">
            <div className="text-center mb-20">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
                What's Inside
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite leading-tight">
                12 pages of <span className="italic text-brand-gold-dark">honest numbers.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { title: 'Per-sqft pricing for 6 patio sizes', body: 'From 50sqft front walkways to 900sqft double driveways — installed prices in 2026.' },
                { title: 'Material cost ladder', body: 'Concrete vs. Techo-Bloc vs. porcelain vs. natural stone — with lifespan data.' },
                { title: '4 sample backyards', body: 'Functional ($25K) → Entertainer ($30K) → Outdoor Room ($40K+) → Elevated ($120K).' },
                { title: 'Site preparation', body: 'How soil, drainage, intended use and access affect the excavation and base plan.' },
                { title: '5 hidden upcharges', body: 'Drainage, slope, restricted access, geotextile, geogrid — when they apply, what they add.' },
                { title: 'Red flags in cheap quotes', body: 'The exact phrases and quote structures that signal you\'re about to lose $40K.' },
              ].map((item, idx) => (
                <div key={idx} className="bg-brand-surface border border-brand-dim/10 p-10 rounded-[2px] hover:border-brand-gold/20 transition-colors">
                  <BookOpen size={20} className="text-brand-gold mb-6" strokeWidth={1.5} />
                  <h3 className="font-display text-xl font-light text-brand-bonewhite mb-4 leading-tight">{item.title}</h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
