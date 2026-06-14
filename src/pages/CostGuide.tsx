import { useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, FileText, Shield, Star, BookOpen } from 'lucide-react';
import SEO from '../components/SEO';
import { trackLead } from '../utils/analytics';
import { getAttributionFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { genEventId } from '../utils/eventId';

const encode = (data: Record<string, string>) =>
  Object.keys(data)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');

type Status = 'idle' | 'submitting' | 'error';

const HIGHLIGHTS = [
  'Real per-sqft prices for interlocking, decking, walls, and full backyards in Simcoe County',
  '5 hidden costs that turn an "$18,000 bargain" into a $58,000 rebuild',
  '4 questions to ask a cheap contractor — in writing — before you sign',
  'How base prep depth, paver brand, and site grade actually change your final number',
  'Sample budgets: $25K functional patio → $120K elevated outdoor living',
];

export default function CostGuide() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    location: '',
    'bot-field': '',
  });

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setStatus('error');
      setErrorMsg('Just need your name and email — we\'ll send the guide right over.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      // Pack the self-reported town into `address` so CRM stores it cleanly,
      // and append a marker into `details` so the lead view shows what they downloaded.
      const enrichedDetails = `Downloaded the 2026 Simcoe County Cost Guide${
        form.location ? ` (location: ${form.location})` : ''
      }`;

      const eventId = genEventId();
      const payload = {
        'form-name': 'cost-guide',
        source: 'cost-guide-page',
        event_id: eventId,
        ...getAttributionFields(),
        ...getBehaviorFields(),
        name: form.name,
        email: form.email,
        address: form.location,
        details: enrichedDetails,
        'bot-field': form['bot-field'],
      };

      // Vite dev server doesn't process Netlify form submissions — short-circuit
      // in dev so the success flow + redirect can be previewed.
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[dev] cost-guide payload (would POST to Netlify):', payload);
        trackLead('cost-guide', 'top-of-funnel', undefined, eventId, { email: form.email });
        navigate('/cost-guide/thank-you');
        return;
      }

      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(payload),
      });
      if (!res.ok) throw new Error('Network response was not ok');
      trackLead('cost-guide', 'top-of-funnel', undefined, eventId, { email: form.email });
      navigate('/cost-guide/thank-you');
    } catch {
      setStatus('error');
      setErrorMsg('Connection issue. Email yorkis@goldenmaplelandscaping.ca and we\'ll send it manually.');
    }
  };

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: '2026 Simcoe County Backyard Cost Guide',
    description:
      'Free PDF guide with real 2026 pricing for interlocking, decking, retaining walls, and full backyard renovations in Barrie and Simcoe County, Ontario.',
    url: 'https://goldenmaplelandscaping.ca/cost-guide',
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
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="flex items-center gap-4 mb-10"
              >
                <div className="h-px w-16 bg-brand-gold" />
                <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold">
                  Free Download · 2026 Edition
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.1 }}
                className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-12"
              >
                The 2026 Simcoe County <br />
                <span className="text-brand-gold italic">backyard cost guide.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light max-w-xl mb-12"
              >
                Real 2026 pricing from 42 completed jobs across Barrie, Innisfil, Oro-Medonte and Springwater. The numbers other contractors don't want you to see — and the hidden costs that turn a low quote into a five-figure regret.
              </motion.p>

              <motion.ul
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.4 }}
                className="space-y-6 mb-16"
              >
                {HIGHLIGHTS.map((h, idx) => (
                  <li key={idx} className="flex items-start gap-5">
                    <CheckCircle size={20} className="text-brand-gold mt-1 shrink-0" strokeWidth={1.5} />
                    <span className="font-sans text-sm md:text-base text-brand-muted leading-relaxed font-light">
                      {h}
                    </span>
                  </li>
                ))}
              </motion.ul>

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
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="bg-brand-surface border border-brand-gold/25 rounded-[2px] p-10 md:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className="text-brand-gold fill-brand-gold" strokeWidth={0} />
                    ))}
                  </div>
                  <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold">
                    5.0 · 42 Reviews
                  </span>
                </div>

                <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite leading-tight mb-3">
                  Send me <span className="italic text-brand-gold">the guide.</span>
                </h2>
                <p className="font-sans text-sm text-brand-muted font-light mb-10 leading-relaxed">
                  Instant download. We'll also send 4 short emails over the next 2 weeks with case studies and budget worksheets — no pitches.
                </p>

                <form
                  name="cost-guide"
                  method="POST"
                  data-netlify="true"
                  data-netlify-honeypot="bot-field"
                  onSubmit={onSubmit}
                  className="space-y-6"
                  noValidate
                >
                  <input type="hidden" name="form-name" value="cost-guide" />
                  <input type="hidden" name="source" value="cost-guide-page" />
                  <p className="hidden">
                    <label>Don't fill this out: <input name="bot-field" onChange={onChange} /></label>
                  </p>

                  <div>
                    <label htmlFor="cg-name" className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-normal mb-3 block">First Name</label>
                    <input
                      id="cg-name"
                      type="text"
                      name="name"
                      required
                      value={form.name}
                      onChange={onChange}
                      autoComplete="given-name"
                      className="w-full bg-brand-nearblack border-b border-brand-dim/30 py-3 px-1 font-sans text-brand-bonewhite focus:border-brand-gold outline-none transition-colors font-light"
                      placeholder="Jane"
                    />
                  </div>

                  <div>
                    <label htmlFor="cg-email" className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-normal mb-3 block">Email Address</label>
                    <input
                      id="cg-email"
                      type="email"
                      name="email"
                      required
                      value={form.email}
                      onChange={onChange}
                      autoComplete="email"
                      className="w-full bg-brand-nearblack border-b border-brand-dim/30 py-3 px-1 font-sans text-brand-bonewhite focus:border-brand-gold outline-none transition-colors font-light"
                      placeholder="jane@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="cg-location" className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-normal mb-3 block">Town or City <span className="text-brand-dim normal-case tracking-normal">(optional)</span></label>
                    <input
                      id="cg-location"
                      type="text"
                      name="location"
                      value={form.location}
                      onChange={onChange}
                      className="w-full bg-brand-nearblack border-b border-brand-dim/30 py-3 px-1 font-sans text-brand-bonewhite focus:border-brand-gold outline-none transition-colors font-light"
                      placeholder="Barrie / Innisfil / Oro-Medonte..."
                    />
                  </div>

                  {status === 'error' && (
                    <p className="font-sans text-xs text-red-600 font-light">{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="btn-primary w-full py-5 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
                  >
                    {status === 'submitting' ? 'Sending…' : (
                      <>
                        Download The Guide
                        <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  <p className="font-sans text-[10px] text-brand-muted/70 text-center font-light leading-relaxed">
                    By downloading, you agree to receive occasional emails from Golden Maple. We never share your address.
                  </p>
                </form>
              </motion.div>
            </div>
          </div>

          {/* What's inside */}
          <div className="mt-40 max-w-3xl mx-auto">
            <div className="text-center mb-20">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-6 block">
                What's Inside
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite leading-tight">
                12 pages of <span className="italic text-brand-gold">honest numbers.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { title: 'Per-sqft pricing for 6 patio sizes', body: 'From 50sqft front walkways to 900sqft double driveways — installed prices in 2026.' },
                { title: 'Material cost ladder', body: 'Concrete vs. Techo-Bloc vs. porcelain vs. natural stone — with lifespan data.' },
                { title: '4 sample backyards', body: 'Functional ($25K) → Entertainer ($30K) → Outdoor Room ($40K+) → Elevated ($120K).' },
                { title: 'The base-prep truth', body: 'Why 14–16" of engineered base costs more — and why 6" guarantees failure by year 2.' },
                { title: '5 hidden upcharges', body: 'Drainage, slope, restricted access, geotextile, geogrid — when they apply, what they add.' },
                { title: 'Red flags in cheap quotes', body: 'The exact phrases and quote structures that signal you\'re about to lose $40K.' },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.05 }}
                  className="bg-brand-surface border border-brand-dim/10 p-10 rounded-[2px] hover:border-brand-gold/20 transition-colors"
                >
                  <BookOpen size={20} className="text-brand-gold mb-6" strokeWidth={1.5} />
                  <h3 className="font-display text-xl font-light text-brand-bonewhite mb-4 leading-tight">{item.title}</h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
