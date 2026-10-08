import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Check, Phone } from 'lucide-react';
import SEO from '../components/SEO';
import LeadForm from '../components/LeadForm';
import GoogleReviewsLink from '../components/GoogleReviewsLink';
import { breadcrumb, faqPage, graph, serviceNode } from '../utils/schema';
import { BUSINESS, publicContact } from '../data/business';
import { portfolioImage, CARD_SIZES, type ImageRef } from '../data/portfolioImages';
import { trackCall } from '../utils/analytics';

/**
 * Ads landing page: /paver-patios/
 *
 * Conversion-focused, mobile-first. Hero carries the H1, a clickable phone
 * number, and the quote form above the fold. The form posts to the existing
 * Netlify "estimate-request" schema (declared in public/__forms.html — the
 * only schema source, so no data-netlify attribute on the runtime JSX) and
 * fires GA4 generate_lead via trackLead on submit.
 *
 * Contact facts come from the central business config (publicContact);
 * workmanship wording goes through publicClaimCopy. No invented claims.
 * Project photos are owner-attested register images only (portfolioImages).
 */

const FAQ = [
  {
    q: 'How much does a paver patio cost in Barrie?',
    a: 'Every patio is priced from its own scope — size, access, drainage, and materials all change the number. Share your details through the form above and we will discuss a project-specific range for your property.',
  },
  {
    q: 'What goes underneath the pavers?',
    a: 'Excavation depth, base materials, and drainage are project-specific. We review your soil, grades, and water flow on site, then confirm every detail in a written scope before work starts.',
  },
  {
    q: 'Which paver brands do you install?',
    a: 'We install Techo-Bloc, Permacon, Unilock, and other leading paver brands. Colour, texture, and finish are selected with you and confirmed in the written scope for your project.',
  },
  {
    q: 'How long does a paver patio take to build?',
    a: 'Timelines are project-specific and depend on size, access, and scope. Your written scope includes the build schedule before we start, and we keep the site clean and communication steady throughout.',
  },
];

// Page-level nodes only; they reference the single #business declared in root.tsx.
const pageSchema = graph(
  serviceNode({ path: '/paver-patios/', name: 'Custom paver patios in Barrie', serviceType: 'Paver patio installation', areaServed: 'Barrie' }),
  breadcrumb([{ name: 'Home', path: '/' }, { name: 'Services', path: '/services/' }, { name: 'Custom paver patios in Barrie', path: '/paver-patios/' }]),
  faqPage('/paver-patios/', FAQ),
);

const heroImage: ImageRef = portfolioImage(
  'barrie-bungalow-patio-1',
  'full',
  'Completed interlocking paver patio with a gazebo-covered dining area behind a brick bungalow in Barrie, ON',
);
const ogImage = `${BUSINESS.canonicalUrl}${heroImage.src}`;

const PROJECT_SHOTS: { image: ImageRef; title: string; town: string }[] = [
  {
    image: portfolioImage('barrie-bungalow-patio-1', 'card', 'Interlocking paver patio with a gazebo-covered dining set behind a brick bungalow in Barrie, ON'),
    title: 'Bungalow patio with gazebo',
    town: 'Barrie',
  },
  {
    image: portfolioImage('barrie-diamond-inlay-patio-1', 'card', 'Slab patio with a dark border and a diamond inlay beside a brick home in Simcoe County, ON'),
    title: 'Patio with diamond inlay',
    town: 'Simcoe County',
  },
  {
    image: portfolioImage('gazebo-patio-1', 'card', 'Slab patio with a cedar gazebo over a dining set, a low block wall and a new lawn in Simcoe County, ON'),
    title: 'Patio with cedar gazebo',
    town: 'Simcoe County',
  },
  {
    image: portfolioImage('sloped-backyard-patio-steps-2', 'card', 'Block retaining wall with built-in steps down to a slab patio with a charcoal border in Simcoe County, ON'),
    title: 'Retaining wall, steps and patio',
    town: 'Simcoe County',
  },
];

function PaverQuoteForm() {
  return (
    <div id="quote-form" className="bg-brand-burgundy/95 backdrop-blur-md border border-brand-gold/25 rounded-[2px] p-5 sm:p-8 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      <p className="mb-6">
        <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-brand-gold block mb-2">Planning range</span>
        <span className="font-display text-4xl text-brand-porcelain">$55–$85</span>
        <span className="block font-sans text-sm text-brand-porcelain/80 font-light mt-2">per square foot installed for interlocking. A planning range, not a quote for this property.</span>
      </p>
      <p className="font-sans text-sm text-brand-porcelain/80 font-light mb-6">
        Sinking or uneven interlock is a repair and re-level.{' '}
        <Link to="/premium-patio-rebuild-barrie/" className="text-brand-gold underline underline-offset-2">See patio rebuilds in Barrie</Link>.
      </p>
      <LeadForm
        formName="estimate-request"
        source="paver-patio-ads"
        idPrefix="paver-ads"
        variant="dark"
        defaultService="Interlocking patio"
        submitLabel="Get my estimate"
        heading="Get your paver patio estimate"
        intro="Tell us about the patio. We reply about next steps and a range for this property."
      />
    </div>
  );
}

export default function PaverPatioBarrieAds() {
  const processSteps = [
    { title: 'Site assessment', desc: 'We walk your property together and review drainage, access, grades, and how you will use the space — then talk materials and budget honestly.' },
    { title: 'Design & written scope', desc: 'You get a clear plan: layout, paver selection, base and drainage details, and written workmanship terms — confirmed before we break ground.' },
    { title: 'Build & handover', desc: 'We excavate, build the base, lay every paver to grade, finish the joints, and leave your property clean. Then it is yours to enjoy.' },
  ];

  const trustItems = [
    'Project-specific base & drainage plan',
    'Written workmanship terms for your project',
    'Clear scope confirmed in writing before we start',
  ];

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Custom Paver Patios in Barrie | Paver Patio Installation"
        description="Custom paver patios in Barrie — interlocking patios planned for your property's drainage and soil, with a written scope and workmanship terms. Get a project estimate."
        canonical="https://goldenmaplelandscaping.ca/paver-patios"
        schema={pageSchema}
        image={ogImage}
      />

      <section className="section-padding pt-40 md:pt-48">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <a
                href={`tel:${publicContact.phoneTel}`}
                onClick={() => trackCall('paver_ads_header_phone')}
                className="inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-bonewhite transition-colors mb-10"
              >
                <Phone size={14} strokeWidth={1.5} />
                Prefer to talk? {publicContact.phoneDisplay}
              </a>
              <h1 className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-8">
                Custom Paver Patios <br />
                <span className="italic text-brand-gold-dark">in Barrie</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-10 font-light">
                Interlocking paver patios planned around your property's drainage, grades, and soil — then built on a proper base.
              </p>
              <ul className="space-y-4 mb-12">
                {trustItems.map((item) => (
                  <li key={item} className="flex items-center gap-4 font-sans text-sm text-brand-bonewhite font-light">
                    <Check size={18} className="text-brand-gold-dark shrink-0" strokeWidth={1.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-5">
                <Link to="/book" className="btn-primary">Book a Discovery Call</Link>
                <Link to="/cost-estimator?type=patio" className="btn-ghost inline-flex items-center gap-3">
                  See Your Cost Range <ArrowRight size={16} strokeWidth={1.5} />
                </Link>
              </div>
            </motion.div>

            <PaverQuoteForm />
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
              Recent Work
            </span>
            <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite leading-tight mb-8">
              Paver patios we've <span className="italic text-brand-gold-dark">built.</span>
            </h2>
            <p className="font-sans text-brand-muted font-light">
              Completed Golden Maple jobs, photographed by our crew.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {PROJECT_SHOTS.map((shot) => (
              <figure key={shot.image.src} className="bg-brand-surface border border-brand-dim/10 rounded-[2px] overflow-hidden shadow-2xl">
                <img
                  src={shot.image.src}
                  srcSet={shot.image.srcSet}
                  sizes={CARD_SIZES}
                  width={shot.image.width}
                  height={shot.image.height}
                  alt={shot.image.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-[4/3] object-cover"
                  referrerPolicy="no-referrer"
                />
                <figcaption className="p-6">
                  <div className="font-display text-xl font-light text-brand-bonewhite mb-1">{shot.title}</div>
                  <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted font-light">{shot.town}</div>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/portfolio" className="inline-flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold-dark transition-colors">
              View Full Portfolio <ArrowRight size={16} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
              The Process
            </span>
            <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite leading-tight">
              Three steps to <span className="italic text-brand-gold-dark">your new patio.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {processSteps.map((step, idx) => (
              <div key={step.title} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl">
                <span className="font-display text-6xl font-light text-brand-gold-dark/20 block mb-10">0{idx + 1}</span>
                <h3 className="font-display text-3xl font-light text-brand-bonewhite mb-6">{step.title}</h3>
                <p className="font-sans text-brand-muted leading-relaxed font-light">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mb-16">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
              Paver Patio Questions
            </span>
            <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite">
              Straight <span className="italic text-brand-gold-dark">answers.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
            {FAQ.map((faq, idx) => (
              <div key={idx} className="bg-brand-surface p-8 md:p-10 border border-brand-dim/10 rounded-[2px] hover:border-brand-gold/20 transition-colors">
                <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-4 md:mb-6 leading-tight">{faq.q}</h3>
                <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding text-center">
        <GoogleReviewsLink className="btn-primary inline-flex" />
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-7xl font-light mb-8 leading-tight">
            Let's plan your <span className="italic text-brand-gold">paver patio.</span>
          </h2>
          <p className="font-sans text-lg text-brand-porcelain-soft max-w-2xl mx-auto mb-12 font-light">
            Send your project details or pick a time to talk it through — we'll take it from there.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
            <Link
              to="/book"
              className="inline-flex items-center justify-center bg-brand-gold text-brand-black font-sans text-[11px] font-medium uppercase tracking-[0.18em] py-4 px-8 rounded-[2px] transition-all duration-300 hover:bg-brand-porcelain"
            >
              Book a Discovery Call
            </Link>
            <Link
              to="/cost-estimator?type=patio"
              className="inline-flex items-center justify-center border border-brand-porcelain/30 text-brand-porcelain font-sans text-[11px] uppercase tracking-[0.25em] py-4 px-8 rounded-[2px] hover:border-brand-gold hover:text-brand-gold transition-colors"
            >
              See Your Cost Range
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
