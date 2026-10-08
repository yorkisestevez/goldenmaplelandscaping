import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, MapPin, Phone } from 'lucide-react';
import SEO from '../../components/SEO';
import { breadcrumb, faqPage, graph, serviceNode } from '../../utils/schema';
import PlanningQuote from '../../components/PlanningQuote';
import type { ProjectCategory } from '../../data/projects';
import Testimonials from '../../components/Testimonials';
import PublicationTrustBar from '../../components/PublicationTrustBar';
import { trackCall } from '../../utils/analytics';
import {
  SERVICES,
  LOCATIONS,
  SERVICE_KEYS,
  LOCATION_KEYS,
  HAND_BUILT_COMBOS,
  type ServiceKey,
  type LocationKey,
} from '../../data/serviceLocations';
import { BUSINESS, publicClaimCopy, publicContact, publicPostalAddress } from '../../data/business';

/**
 * Parse the URL slug like "interlocking-barrie" or "composite-decking-orillia"
 * into a service key + location key, where service may be hyphenated.
 */
function parseSlug(slug: string | undefined): { service: ServiceKey; location: LocationKey } | null {
  if (!slug) return null;
  for (const svc of SERVICE_KEYS) {
    if (slug.startsWith(svc + '-')) {
      const loc = slug.slice(svc.length + 1) as LocationKey;
      if (LOCATION_KEYS.includes(loc)) return { service: svc, location: loc };
    }
  }
  return null;
}

export default function ServiceLocation() {
  const { slug } = useParams<{ slug: string }>();
  const parsed = parseSlug(slug);

  if (!parsed) {
    return <Navigate to="/services" replace />;
  }

  // If a hand-built page exists, don't render this one — the explicit route in App.tsx
  // for that slug should win, but defensive check just in case.
  if (slug && HAND_BUILT_COMBOS.has(slug)) {
    return <Navigate to={`/services/${slug}`} replace />;
  }

  const service = SERVICES[parsed.service];
  const location = LOCATIONS[parsed.location];

  const titleHero = `${service.shortName} in ${location.name}, Ontario`;
  const seoTitle = `${service.shortName} in ${location.name} | Premium ${service.name} | Golden Maple Landscaping`;
  const warranty = publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, '');
  const seoDescription = `Premium ${service.name.toLowerCase()} in ${location.name}, ${location.region}. ${service.startingPriceText} ${service.perUnitText}.${warranty ? ` ${warranty}` : ''} Contact us to confirm project scope.`;
  const quoteCategories: Partial<Record<ServiceKey, ProjectCategory[]>> = {
    interlocking: ['Patios & interlocking', 'Driveways'],
    'composite-decking': ['Decks'],
    'retaining-walls': ['Walls & steps'],
  };

  // Cross-links: same service in other locations + other services in same location
  const otherLocations = LOCATION_KEYS.filter((l) => l !== parsed.location);
  const otherServices = SERVICE_KEYS.filter((s) => s !== parsed.service);

  // Page-level nodes only; they reference the single #business declared in root.tsx.
  const pagePath = `/services/${slug}/`;
  const schema = graph(
    serviceNode({
      path: pagePath,
      name: `${service.name} in ${location.name}`,
      serviceType: service.name,
      description: seoDescription,
      areaServed: { '@type': 'City', name: location.name, address: publicPostalAddress(location.name, location.postalRoot) },
      priceDescription: `${service.startingPriceText} ${service.perUnitText}`,
    }),
    faqPage(pagePath, service.faqs),
    breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Services', path: '/services/' },
      { name: titleHero, path: pagePath },
    ]),
  );


  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={`${BUSINESS.canonicalUrl}/services/${slug}`}
        schema={schema}
      />

      {/* Hero */}
      <section className="relative pt-44 pb-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={service.heroImg}
            alt={`${service.name} project in ${location.name}, Ontario`}
            className="w-full h-full object-cover opacity-40"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-nearblack via-brand-nearblack/70 to-brand-nearblack/30" />
        </div>

        <div className="container-custom relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-4 mb-8">
                <MapPin size={14} className="text-brand-gold-dark" strokeWidth={1.5} />
                <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark">
                  {location.name} · {location.region}
                </span>
              </div>

              <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-10">
                {service.shortName} in <br />
                <span className="text-brand-gold-dark italic">{location.name}, Ontario.</span>
              </h1>

              <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light max-w-xl mb-10">
                {service.blurb}
              </p>

              <div className="flex flex-wrap items-center gap-6 text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                <span className="flex items-center gap-2">
                  <span className="font-sans text-brand-gold-dark text-xl font-normal normal-case tracking-normal">
                    {service.startingPriceText}
                  </span>
                  <span>{service.perUnitText}</span>
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 w-full">
              <PlanningQuote
                source={`service-${slug}`}
                rate={service.startingPriceText.startsWith('$') ? service.startingPriceText : undefined}
                rateDetail={`${service.perUnitText}. A planning range, not a quote for your property.`}
                categories={quoteCategories[parsed.service] ?? []}
                defaultService={parsed.service === 'interlocking' ? 'Interlocking patio' : parsed.service === 'composite-decking' ? 'Composite deck' : parsed.service === 'retaining-walls' ? 'Retaining wall' : 'Landscape design'}
                repairHref={parsed.service === 'interlocking' ? '/premium-patio-rebuild-barrie/' : undefined}
              />
            </div>
          </div>
        </div>
      </section>

      <PublicationTrustBar />

      {/* Why this matters in this location */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
            <div className="lg:col-span-7">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
                Why {location.name}?
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-12">
                The {location.name} <span className="italic text-brand-gold-dark">build context.</span>
              </h2>
              <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light mb-10">
                {location.intro}
              </p>

              <div className="space-y-10">
                <div>
                  <h3 className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark mb-4">
                    The terrain
                  </h3>
                  <p className="font-sans text-sm md:text-base text-brand-muted leading-relaxed font-light">
                    {location.terrain}
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark mb-4">
                    The soil profile
                  </h3>
                  <p className="font-sans text-sm md:text-base text-brand-muted leading-relaxed font-light">
                    {location.soil}
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark mb-4">
                    Common project types we build here
                  </h3>
                  <ul className="space-y-3">
                    {location.projects.map((p, idx) => (
                      <li key={idx} className="flex items-start gap-4">
                        <CheckCircle size={16} className="text-brand-gold-dark mt-1 shrink-0" strokeWidth={1.5} />
                        <span className="font-sans text-sm md:text-base text-brand-muted font-light">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark mb-4">
                    Neighbourhoods we serve in {location.name}
                  </h3>
                  <p className="font-sans text-sm md:text-base text-brand-muted leading-relaxed font-light">
                    {location.anchors.join(' · ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-brand-surface border border-brand-dim/10 rounded-[2px] p-10 sticky top-32">
                <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
                  What's included
                </span>
                <h3 className="font-display text-2xl font-light text-brand-bonewhite leading-tight mb-8">
                  Premium {service.shortName.toLowerCase()} build, end to end.
                </h3>
                <ul className="space-y-5 mb-10">
                  {service.scope.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-4">
                      <CheckCircle size={16} className="text-brand-gold-dark mt-1 shrink-0" strokeWidth={1.5} />
                      <span className="font-sans text-sm text-brand-muted leading-relaxed font-light">{s}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/contact"
                  className="btn-primary w-full py-4 inline-flex items-center justify-center gap-3 group"
                >
                  Get My Free Estimate
                  <ArrowRight size={14} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why it matters - engineering callout */}
      <section className="border-t border-brand-dim/20 bg-brand-surface/20">
        <div className="container-custom py-24">
          <div className="max-w-3xl">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
              The engineering point
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-10">
              Why our {service.shortName.toLowerCase()} <span className="italic text-brand-gold-dark">lasts.</span>
            </h2>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light">
              {service.whyMatters}
            </p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-20">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
                Frequently Asked
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite leading-tight">
                Quick answers about <br />
                <span className="italic text-brand-gold-dark">{service.shortName.toLowerCase()} in {location.name}.</span>
              </h2>
            </div>

            <div className="space-y-6">
              {service.faqs.map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-brand-surface border border-brand-dim/10 rounded-[2px] p-8 hover:border-brand-gold/20 transition-colors"
                >
                  <summary className="cursor-pointer font-display text-xl font-light text-brand-bonewhite flex items-center justify-between gap-6 list-none">
                    <span>{faq.q}</span>
                    <ArrowRight
                      size={18}
                      strokeWidth={1.5}
                      className="text-brand-gold-dark shrink-0 transition-transform group-open:rotate-90"
                    />
                  </summary>
                  <p className="font-sans text-sm md:text-base text-brand-muted leading-relaxed font-light mt-6">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust: testimonials */}
      <Testimonials
        eyebrow={`${location.name} clients`}
        heading={<>Trusted across <span className="italic text-brand-gold-dark">Simcoe County.</span></>}
        count={3}
      />

      {/* Cross-links: same service, other locations */}
      <section className="border-t border-brand-dim/20">
        <div className="container-custom py-24">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
            We also build {service.shortName.toLowerCase()} in
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite leading-tight mb-12">
            Other towns we serve.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {otherLocations.map((l) => {
              const targetSlug = `${parsed.service}-${l}`;
              return (
                <Link
                  key={l}
                  to={`/services/${targetSlug}`}
                  className="group flex items-center justify-between border border-brand-dim/10 hover:border-brand-gold/30 hover:bg-brand-gold/5 px-6 py-5 transition-all rounded-[2px]"
                >
                  <span className="font-sans text-sm text-brand-bonewhite font-light group-hover:text-brand-gold-dark transition-colors">
                    {LOCATIONS[l].name}
                  </span>
                  <ArrowRight
                    size={14}
                    strokeWidth={1.5}
                    className="text-brand-muted group-hover:text-brand-gold-dark transition-all group-hover:translate-x-1"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Cross-links: same location, other services */}
      <section className="border-t border-brand-dim/20 bg-brand-surface/20">
        <div className="container-custom py-24">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
            More we build in {location.name}
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite leading-tight mb-12">
            Our other {location.name} services.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {otherServices.map((s) => {
              const targetSlug = `${s}-${parsed.location}`;
              return (
                <Link
                  key={s}
                  to={`/services/${targetSlug}`}
                  className="group bg-brand-surface border border-brand-dim/10 hover:border-brand-gold/30 p-10 rounded-[2px] transition-all flex flex-col"
                >
                  <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark mb-4">
                    {SERVICES[s].startingPriceText} {SERVICES[s].perUnitText}
                  </span>
                  <h3 className="font-display text-2xl font-light text-brand-bonewhite leading-tight mb-4 group-hover:text-brand-gold-dark transition-colors">
                    {SERVICES[s].shortName} in {location.name}
                  </h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light flex-1 mb-6">
                    {SERVICES[s].blurb}
                  </p>
                  <span className="flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.25em] text-brand-bonewhite group-hover:text-brand-gold-dark transition-colors">
                    Learn More
                    <ArrowRight
                      size={12}
                      strokeWidth={1.5}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-brand-dim/20">
        <div className="container-custom py-32 text-center">
          <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite leading-tight mb-10">
            Ready to build in <br />
            <span className="italic text-brand-gold-dark">{location.name}?</span>
          </h2>
          <p className="font-sans text-base md:text-lg text-brand-muted font-light max-w-xl mx-auto mb-14 leading-relaxed">
            Contact Yorkis to discuss scope, budget, and the current consultation options.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 items-center justify-center max-w-xl mx-auto">
            <a
              href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('servicelocation_phone')}
              className="flex-1 flex items-center justify-center gap-3 border border-brand-gold/30 text-brand-gold-dark font-sans text-[10px] uppercase tracking-[0.25em] py-5 px-8 hover:bg-brand-gold/5 transition-colors w-full"
            >
              <Phone size={14} strokeWidth={1.5} />
              {publicContact.phoneDisplay}
            </a>
            <Link
              to="/contact"
              className="flex-1 btn-primary py-5 inline-flex items-center justify-center gap-3 w-full"
            >
              Get My Free Estimate
              <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
