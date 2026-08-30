import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, MapPin, CheckCircle, Star, Phone, Shield, Award } from 'lucide-react';
import SEO from '../../components/SEO';
import QuickQuote from '../../components/QuickQuote';
import {
import { trackCall } from '../../utils/analytics';
  SERVICES,
  LOCATIONS,
  SERVICE_KEYS,
  LOCATION_KEYS,
  type LocationKey,
} from '../../data/serviceLocations';

export default function LocationLanding() {
  const { slug } = useParams<{ slug: string }>();
  const key = (slug || '') as LocationKey;

  if (!LOCATION_KEYS.includes(key)) {
    return <Navigate to="/service-areas" replace />;
  }

  const location = LOCATIONS[key];

  const seoTitle = `Premium Landscaping in ${location.name}, Ontario | Golden Maple Landscaping`;
  const seoDescription = `Architectural landscaping and hardscape construction in ${location.name}, ${location.region}. Interlocking, decking, retaining walls, and full backyard renovations. 5-star rated. Free estimate request.`;

  const otherLocations = LOCATION_KEYS.filter((l) => l !== key);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://goldenmaplelandscaping.ca/locations/${key}`,
    name: `Golden Maple Landscaping — ${location.name}`,
    image:
      'https://goldenmaplelandscaping.ca/images/projects/Golden%20Maple%20deck%20and%20walkway.jpg',
    url: `https://goldenmaplelandscaping.ca/locations/${key}`,
    telephone: '+1-705-500-3581',
    email: 'yorkis@goldenmaplelandscaping.ca',
    priceRange: '$$$',
    address: {
      '@type': 'PostalAddress',
      addressLocality: location.name,
      addressRegion: 'ON',
      postalCode: location.postalRoot,
      addressCountry: 'CA',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: location.lat,
      longitude: location.lng,
    },
    areaServed: {
      '@type': 'City',
      name: location.name,
    },
  };

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={`https://goldenmaplelandscaping.ca/locations/${key}`}
        schema={schema}
      />

      {/* Hero */}
      <section className="relative pt-44 pb-24 overflow-hidden">
        <div className="absolute inset-0 z-0 bg-brand-nearblack">
          <img
            src="/images/projects/IMG_4826.jpg"
            alt={`Premium landscaping in ${location.name}, Ontario`}
            className="w-full h-full object-cover opacity-35"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-nearblack via-brand-nearblack/70 to-brand-nearblack/40" />
        </div>

        <div className="container-custom relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="flex items-center gap-4 mb-8"
              >
                <MapPin size={14} className="text-brand-gold-dark" strokeWidth={1.5} />
                <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark">
                  {location.region} · Population {location.population}
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.1 }}
                className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-10"
              >
                Premium landscaping <br />
                in <span className="text-brand-gold-dark italic">{location.name}.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light max-w-xl mb-10"
              >
                {location.intro}
              </motion.p>
            </div>

            <div className="lg:col-span-5 w-full">
              <QuickQuote />
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-brand-dim/20 bg-brand-surface/30">
        <div className="container-custom py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
            <div className="flex items-center gap-4">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} className="text-brand-gold-dark fill-brand-gold" strokeWidth={0} />
                ))}
              </div>
              <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
                5.0 · 8 Reviews
              </span>
            </div>
            <div className="flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
              <Shield size={14} className="text-brand-gold-dark" strokeWidth={1.5} /> WSIB Certified
            </div>
            <div className="flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
              <Award size={14} className="text-brand-gold-dark" strokeWidth={1.5} /> $5M Liability
            </div>
            <div className="flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-light">
              <CheckCircle size={14} className="text-brand-gold-dark" strokeWidth={1.5} /> 5-Yr Warranty
            </div>
          </div>
        </div>
      </section>

      {/* Local context */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
            <div className="lg:col-span-7">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
                Local context
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-12">
                Building in <span className="italic text-brand-gold-dark">{location.name}.</span>
              </h2>

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
                    Common project types
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
                    Neighbourhoods we serve
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
                  Free Estimate
                </span>
                <h3 className="font-display text-2xl font-light text-brand-bonewhite leading-tight mb-6">
                  15 minutes with Yorkis.
                </h3>
                <p className="font-sans text-sm text-brand-muted leading-relaxed font-light mb-10">
                  Honest scope and budget assessment for your {location.name} project. No fee, no pressure. Most calls confirm whether the budget fits the vision before anyone visits the site.
                </p>
                <a
                  href="tel:7055003581" onClick={() => trackCall('locationlanding_phone')}
                  className="block text-center border border-brand-gold/30 text-brand-gold-dark font-sans text-[10px] uppercase tracking-[0.25em] py-4 mb-3 hover:bg-brand-gold/5 transition-colors"
                >
                  Call (705) 500-3581
                </a>
                <Link
                  to="/contact"
                  className="btn-primary w-full py-4 inline-flex items-center justify-center gap-3 group"
                >
                  Get My Estimate
                  <ArrowRight size={14} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services available in this location */}
      <section className="border-t border-brand-dim/20 bg-brand-surface/20">
        <div className="container-custom py-32">
          <div className="text-center mb-20 max-w-2xl mx-auto">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
              Services in {location.name}
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite leading-tight">
              What we build <span className="italic text-brand-gold-dark">here.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SERVICE_KEYS.map((s) => {
              const svc = SERVICES[s];
              const target = `/services/${s}-${key}`;
              return (
                <Link
                  key={s}
                  to={target}
                  className="group bg-brand-surface border border-brand-dim/10 hover:border-brand-gold/30 p-12 rounded-[2px] transition-all flex flex-col"
                >
                  <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark mb-5">
                    {svc.startingPriceText} {svc.perUnitText}
                  </span>
                  <h3 className="font-display text-3xl font-light text-brand-bonewhite leading-tight mb-5 group-hover:text-brand-gold-dark transition-colors">
                    {svc.shortName} <br />
                    <span className="italic text-brand-muted text-2xl group-hover:text-brand-gold-dark/80 transition-colors">in {location.name}</span>
                  </h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light flex-1 mb-8">
                    {svc.blurb}
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

      {/* Other locations cross-link */}
      <section className="border-t border-brand-dim/20">
        <div className="container-custom py-24">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
            Other towns we serve
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite leading-tight mb-12">
            Across {location.region.replace('Simcoe / Grey County', 'Simcoe & Grey County').replace('Simcoe County', 'Simcoe County')}.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {otherLocations.map((l) => (
              <Link
                key={l}
                to={`/locations/${l}`}
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
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-brand-dim/20 bg-brand-surface/20">
        <div className="container-custom py-32 text-center">
          <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite leading-tight mb-10">
            Ready to start your <br />
            <span className="italic text-brand-gold-dark">{location.name} project?</span>
          </h2>
          <p className="font-sans text-base md:text-lg text-brand-muted font-light max-w-xl mx-auto mb-14 leading-relaxed">
            A 24-hour written estimate from Yorkis answers more than three rushed quotes ever will.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 items-center justify-center max-w-xl mx-auto">
            <a
              href="tel:7055003581" onClick={() => trackCall('locationlanding_phone')}
              className="flex-1 flex items-center justify-center gap-3 border border-brand-gold/30 text-brand-gold-dark font-sans text-[10px] uppercase tracking-[0.25em] py-5 px-8 hover:bg-brand-gold/5 transition-colors w-full"
            >
              <Phone size={14} strokeWidth={1.5} />
              (705) 500-3581
            </a>
            <Link
              to="/contact"
              className="flex-1 btn-primary py-5 inline-flex items-center justify-center gap-3 w-full"
            >
              Get My Estimate
              <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
