import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import SEO from './SEO';
import RelatedProjects from './RelatedProjects';
import PlanningQuote from './PlanningQuote';
import { breadcrumb, faqPage, graph, serviceNode } from '../utils/schema';
import type { BarrieServiceDef } from '../data/barrieServices';

/**
 * Template for the data-driven Barrie money pages (src/data/barrieServices.ts).
 * Layout and tokens mirror the hand-built service pages (light theme: nearblack =
 * parchment page, surface = white card, burgundy = the one dark CTA band). The
 * keyword H1 is the small gold line; the display tagline is a <p>, same as the
 * retrofitted service pages.
 */
export default function BarrieServicePage({ def }: { def: BarrieServiceDef }) {
  const path = `/services/${def.slug}/`;
  // Estimator-priced pages keep the planning-range CTA; others (e.g. seasonal clean-ups) supply their own.
  const cta = def.cta ?? {
    label: 'See My Cost Range',
    to: `/cost-estimator?type=${def.estimatorType}`,
    band: ['Start with a planning range.', 'Then we walk the site.'] as [string, string],
    bandBody: 'The cost estimator gives you a planning range first. If the number works, we visit, measure, and put the base, drainage and materials in a written scope for your property.',
  };
  const schema = graph(
    serviceNode({ path, name: def.h1, serviceType: def.serviceType, description: def.description, areaServed: 'Barrie' }),
    breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Services', path: '/services/' },
      { name: def.h1, path },
    ]),
    faqPage(path, def.faqs),
  );

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO title={def.title} description={def.description} canonical={`https://goldenmaplelandscaping.ca${path}`} schema={schema} />

      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-16 lg:gap-24 items-start mb-32">
            <div>
              <h1 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">{def.h1}</h1>
              <p className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                {def.tagline[0]} <br />
                <span className="italic text-brand-gold-dark">{def.tagline[1]}</span>
              </p>
              {def.intro.map((para, i) => (
                <p key={i} className="font-sans text-lg text-brand-muted leading-relaxed mb-8 font-light">{para}</p>
              ))}
              <div className="flex flex-col sm:flex-row gap-10 mt-12">
                <Link to={cta.to} className="btn-primary">{cta.label}</Link>
                <Link to="/contact" className="flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold-dark transition-colors">
                  Talk to us about your project <ArrowRight size={16} strokeWidth={1.5} />
                </Link>
              </div>
            </div>

            <div className="bg-brand-surface p-10 md:p-14 rounded-[2px] border border-brand-dim/40 shadow-2xl">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">{def.scopeHeading}</h2>
              <ul className="space-y-6">
                {def.scope.map((item) => (
                  <li key={item} className="flex items-start gap-5 font-sans text-[15px] text-brand-bonewhite leading-snug font-light">
                    <Check size={18} className="text-brand-gold-dark shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="max-w-xl mb-24">
            <PlanningQuote
              source={def.slug}
              rate={def.slug === 'interlocking-driveways-barrie' ? '$55–$85' : undefined}
              rateDetail="per square foot installed for interlocking. A planning range, not a quote for your property."
              categories={def.projectCategories}
              defaultService={def.slug === 'interlocking-driveways-barrie' ? 'Interlock driveway' : def.slug === 'seasonal-cleanup-barrie' ? 'Seasonal clean-up' : def.slug === 'outdoor-kitchens-barrie' ? 'Outdoor kitchen' : def.slug === 'porcelain-patios-barrie' ? 'Interlocking patio' : 'Not sure yet'}
              repairHref={def.slug === 'interlocking-driveways-barrie' || def.slug === 'porcelain-patios-barrie' ? '/premium-patio-rebuild-barrie/' : undefined}
            />
          </div>

          <div className="max-w-4xl mx-auto mb-32 space-y-20">
            {def.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-8">{section.heading}</h2>
                {section.body.map((para, i) => (
                  <p key={i} className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-6 font-light">{para}</p>
                ))}
              </section>
            ))}
          </div>

          <RelatedProjects categories={def.projectCategories} heading={def.projectsHeading} />

          <div className="mb-32">
            <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite mb-16 text-center leading-tight">Questions we get about {def.primaryKeyword.toLowerCase()}</h2>
            <div className="max-w-4xl mx-auto space-y-8">
              {def.faqs.map((item) => (
                <div key={item.q} className="bg-brand-surface p-10 md:p-12 rounded-[2px] border border-brand-dim/40 shadow-2xl">
                  <h3 className="font-display text-2xl md:text-3xl font-light text-brand-bonewhite mb-5">{item.q}</h3>
                  <p className="font-sans text-brand-muted leading-relaxed font-light">{item.a}</p>
                </div>
              ))}
            </div>
          </div>

          <nav aria-label="Related reading" className="max-w-4xl mx-auto mb-8">
            <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Keep reading</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {def.related.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group flex items-center justify-between gap-6 bg-brand-surface px-8 py-6 rounded-[2px] border border-brand-dim/40 font-sans text-[15px] text-brand-bonewhite hover:border-brand-gold/60 transition-colors"
                  >
                    <span>{link.label}</span>
                    <ArrowRight size={16} strokeWidth={1.5} className="text-brand-gold-dark shrink-0 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-7xl font-light mb-12 leading-tight">
            {cta.band[0]} <br />
            <span className="text-brand-gold italic">{cta.band[1]}</span>
          </h2>
          <p className="font-sans text-lg text-brand-porcelain/80 max-w-2xl mx-auto mb-16 font-light">
            {cta.bandBody}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to={cta.to} className="btn-primary px-12 py-4">{cta.label}</Link>
            <Link to="/contact" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-porcelain/80 hover:text-brand-gold transition-colors">Or contact us →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
