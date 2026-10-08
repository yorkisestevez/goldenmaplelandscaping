import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle, Phone, Shield } from 'lucide-react';
import SEO from '../components/SEO';
import { breadcrumb, faqPage, graph, serviceNode } from '../utils/schema';
import Testimonials from '../components/Testimonials';
import { BUSINESS, publicClaimCopy, publicContact } from '../data/business';
import { portfolioImage, CARD_SIZES, type ImageRef } from '../data/portfolioImages';
import { trackLead, trackCall } from '../utils/analytics';
import { getAttributionFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { genEventId } from '../utils/eventId';

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

const encode = (data: Record<string, string>) =>
  Object.keys(data)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');

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
    q: 'Do you offer a warranty on paver patios?',
    a: publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms are available for your project.'),
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

const PROJECT_TYPES = [
  'New paver patio',
  'Patio rebuild / replacement',
  'Paver walkway or entrance',
  'Paver driveway',
  'Pool surround',
  'Something else',
];

const BUDGET_RANGES = ['Under $15K', '$15K – $30K', '$30K – $60K', '$60K+', 'Not sure yet'];

type Status = 'idle' | 'submitting' | 'success' | 'error';

function PaverQuoteForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    service: 'New paver patio',
    budget: '',
    details: '',
    'bot-field': '',
  });

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.details.trim() || !form.budget) {
      setStatus('error');
      setErrorMsg('Just need your name, phone, a budget range, and a quick line about your project.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setStatus('error');
      setErrorMsg('Please enter a valid email so we can send your estimate.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');

    const eventId = genEventId();
    const payload = {
      'form-name': 'estimate-request',
      source: 'paver-patio-ads',
      event_id: eventId,
      ...getAttributionFields(),
      ...getBehaviorFields(),
      ...form,
    };

    // Vite dev server doesn't process Netlify form submissions — short-circuit
    // to success so the full UI + analytics flow can be previewed locally.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[dev] estimate-request payload (would POST to Netlify):', payload);
      trackLead('estimate-request', 'high-intent', undefined, eventId, { email: form.email, phone: form.phone }, { payload });
      setStatus('success');
      return;
    }

    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(payload),
      });
      if (!res.ok) throw new Error('Network response was not ok');
      trackLead('estimate-request', 'high-intent', undefined, eventId, { email: form.email, phone: form.phone }, { payload });
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg(`Connection issue. Call ${publicContact.phoneDisplay} to discuss your project.`);
    }
  };

  const inputClass =
    'w-full bg-transparent border-b border-brand-porcelain-soft/25 py-3 px-1 font-sans text-brand-porcelain placeholder:text-brand-porcelain-soft/70 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 transition-colors font-light';

  if (status === 'success') {
    return (
      <div className="bg-brand-burgundy/95 backdrop-blur-md border border-brand-gold/30 rounded-[2px] p-10 shadow-2xl text-center">
        <div className="mx-auto w-14 h-14 rounded-full border border-brand-gold flex items-center justify-center mb-6">
          <CheckCircle size={24} className="text-brand-gold" strokeWidth={1.5} />
        </div>
        <h2 className="font-display text-3xl font-light text-brand-porcelain mb-4">
          We've got it.
        </h2>
        <p className="font-sans text-sm text-brand-porcelain-soft leading-relaxed font-light mb-8">
          Thanks — we'll review your project and be in touch shortly. Want to talk sooner? Pick a time that works for you.
        </p>
        <Link
          to="/book"
          className="inline-flex items-center justify-center bg-brand-gold text-brand-black font-sans text-[11px] font-medium uppercase tracking-[0.18em] py-4 px-8 rounded-[2px] transition-all duration-300 hover:bg-brand-porcelain w-full mb-5"
        >
          Book a Discovery Call
        </Link>
        <a
          href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('paver_ads_form_phone')}
          className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold hover:underline inline-flex items-center gap-2"
        >
          <Phone size={12} strokeWidth={1.5} />
          {publicContact.phoneDisplay}
        </a>
      </div>
    );
  }

  return (
    <div id="quote-form" className="bg-brand-burgundy/95 backdrop-blur-md border border-brand-gold/25 rounded-[2px] p-8 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      <h2 className="font-display text-3xl md:text-4xl font-light text-brand-porcelain leading-tight mb-3">
        Get your <span className="italic text-brand-gold">paver patio estimate</span>
      </h2>
      <p className="font-sans text-sm text-brand-porcelain-soft font-light mb-8 leading-relaxed">
        Tell us about your project — we'll respond with next steps and a project-specific range.
      </p>

      <form
        name="estimate-request"
        method="POST"
        onSubmit={onSubmit}
        className="space-y-5"
        noValidate
      >
        <input type="hidden" name="form-name" value="estimate-request" />
        <input type="hidden" name="source" value="paver-patio-ads" />
        <p className="hidden">
          <label>Don't fill this out: <input name="bot-field" onChange={onChange} /></label>
        </p>

        <div>
          <label htmlFor="pq-name" className="sr-only">Full Name</label>
          <input
            id="pq-name"
            type="text"
            name="name"
            required
            value={form.name}
            onChange={onChange}
            autoComplete="name"
            className={inputClass}
            placeholder="Your full name"
          />
        </div>

        <div>
          <label htmlFor="pq-phone" className="sr-only">Phone Number</label>
          <input
            id="pq-phone"
            type="tel"
            name="phone"
            required
            value={form.phone}
            onChange={onChange}
            autoComplete="tel"
            inputMode="tel"
            className={inputClass}
            placeholder="Phone number"
          />
        </div>

        <div>
          <label htmlFor="pq-email" className="sr-only">Email Address</label>
          <input
            id="pq-email"
            type="email"
            name="email"
            required
            value={form.email}
            onChange={onChange}
            autoComplete="email"
            inputMode="email"
            className={inputClass}
            placeholder="Email address"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="pq-service" className="block font-sans text-[10px] uppercase tracking-[0.2em] text-brand-porcelain-soft/80 mb-1 font-light">
              Project type
            </label>
            <select
              id="pq-service"
              name="service"
              required
              value={form.service}
              onChange={onChange}
              className={`${inputClass} [&>option]:bg-brand-surface [&>option]:text-brand-bonewhite`}
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pq-budget" className="block font-sans text-[10px] uppercase tracking-[0.2em] text-brand-porcelain-soft/80 mb-1 font-light">
              Budget range
            </label>
            <select
              id="pq-budget"
              name="budget"
              required
              value={form.budget}
              onChange={onChange}
              className={`${inputClass} [&>option]:bg-brand-surface [&>option]:text-brand-bonewhite`}
            >
              <option value="" disabled>Select a range</option>
              {BUDGET_RANGES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="pq-details" className="sr-only">Project Description</label>
          <textarea
            id="pq-details"
            name="details"
            required
            rows={4}
            value={form.details}
            onChange={onChange}
            className={`${inputClass} resize-none`}
            placeholder="Tell us about your project — size, timing, anything we should know"
          />
        </div>

        {status === 'error' && (
          <p className="font-sans text-xs text-brand-error font-light">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full py-5 mt-2 inline-flex items-center justify-center gap-3 group bg-brand-gold text-brand-black font-sans text-[11px] font-medium uppercase tracking-[0.18em] rounded-[2px] transition-all duration-300 hover:bg-brand-porcelain disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Sending…' : (
            <>
              Get My Estimate
              <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        <div className="flex items-start justify-center gap-3 pt-4 text-[11px] text-brand-porcelain-soft font-light leading-relaxed">
          <Shield size={14} className="text-brand-gold/70 shrink-0 mt-px" strokeWidth={1.5} />
          <span>We only contact you about your project. No spam, ever — and we never share your number.</span>
        </div>
      </form>
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
            <div>
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
            </div>

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

      <Testimonials count={3} />

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
