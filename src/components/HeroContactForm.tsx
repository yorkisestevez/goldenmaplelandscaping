import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle, ChevronDown } from 'lucide-react';
import { trackLead, trackEngagement } from '../utils/analytics';
import { getAttributionFields, getConversionEventFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { genEventId } from '../utils/eventId';
import { scoreGoldenMapleLead } from '../utils/leadScoring';

const encode = (data: Record<string, string>) =>
  Object.keys(data)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');

type Status = 'idle' | 'submitting' | 'success' | 'error';

// Values must match Contact.tsx's budget enum exactly — both forms post to the
// same "contact" Netlify form and both feed scoreGoldenMapleLead(), which
// pattern-matches on these literal strings ('under-25k' | '25k-50k' |
// '50k-100k' | '100k-250k' | '250k+'). Mismatched buckets here silently
// zeroed out the budget component of every hero-form lead's score.
const BUDGET_RANGES = [
  { value: 'under-25k', label: 'Under $25k' },
  { value: '25k-50k', label: '$25k – $50k' },
  { value: '50k-100k', label: '$50k – $100k' },
  { value: '100k-250k', label: '$100k – $250k' },
  { value: '250k+', label: '$250k+' },
];
const UNSURE = 'unsure';

export default function HeroContactForm() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    budget: '',
    details: '',
    'bot-field': '',
  });

  const hasConcreteBudget = form.budget !== '' && form.budget !== UNSURE;
  const canSubmit =
    hasConcreteBudget &&
    !!form.name.trim() &&
    !!form.email.trim() &&
    status !== 'submitting';

  const onChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (status === 'error') setStatus('idle');
    if (e.target.name === 'budget') trackEngagement('hero_contact_budget', e.target.value);
  };

  const goToCalculator = () => {
    trackEngagement('cta_click', 'hero_contact_to_calculator');
    navigate('/cost-estimator');
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setStatus('error');
      setErrorMsg('Please add your name and email so we can reply.');
      return;
    }
    // Honor the brief: a range is needed to give a meaningful answer.
    if (!hasConcreteBudget) {
      setStatus('error');
      setErrorMsg('A rough range helps us reply with real options — pick one, or grab a quick estimate from the calculator.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');

    const budgetLabel = BUDGET_RANGES.find((b) => b.value === form.budget)?.label || form.budget;
    const enrichedDetails = [
      `Budget: ${budgetLabel}`,
      form.details && `\nNotes: ${form.details}`,
    ]
      .filter(Boolean)
      .join(' · ');

    const eventId = genEventId();
    const leadScore = scoreGoldenMapleLead({
      budget: form.budget,
      service: 'Home Hero Enquiry',
      details: form.details,
    });
    const payload = {
      'form-name': 'contact',
      ...getConversionEventFields(eventId),
      ...getAttributionFields(),
      ...getBehaviorFields(),
      name: form.name,
      email: form.email,
      phone: form.phone,
      service: 'Home Hero Enquiry',
      budget: form.budget,
      details: enrichedDetails,
      lead_score: String(leadScore.score),
      lead_tier: leadScore.tier,
      lead_score_reasons: leadScore.reasons.join(','),
      'bot-field': form['bot-field'],
    };

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[dev] hero contact payload (would POST to Netlify):', payload);
      trackLead('contact', 'high-intent', undefined, eventId, { email: form.email, phone: form.phone });
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
      trackLead('contact', 'high-intent', undefined, eventId, { email: form.email, phone: form.phone });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg('Something went wrong. Call (705) 500-3581 or email yorkis@goldenmaplelandscaping.ca.');
    }
  };

  const labelCls = 'font-sans text-[10px] uppercase tracking-[0.22em] text-brand-muted block mb-2';
  const fieldCls =
    'w-full bg-brand-nearblack border border-brand-dim rounded-2xl px-4 py-3 font-sans text-[14px] text-brand-ink placeholder:text-brand-ink-soft focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-colors';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="bg-brand-cream-light border border-brand-dim rounded-3xl p-6 md:p-8 shadow-[0_30px_70px_-28px_rgba(33,30,21,0.4)]"
    >
      {status === 'success' ? (
        <div className="py-8 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full border border-brand-gold flex items-center justify-center">
            <CheckCircle size={26} className="text-brand-gold-dark" strokeWidth={1.5} />
          </div>
          <h3 className="font-display text-2xl font-light text-brand-bonewhite">Thanks{form.name ? `, ${form.name.split(' ')[0]}` : ''} — talk soon.</h3>
          <p className="font-sans text-[14px] text-brand-bonewhite/80 leading-relaxed font-light max-w-xs mx-auto">
            Yorkis comes back within <span className="text-brand-gold-dark">24 hours</span> with an honest read on
            scope, timeline, and budget.
          </p>
          <a href="tel:7055003581" className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark hover:underline">
            Or call (705) 500-3581
          </a>
        </div>
      ) : (
        <form
          name="contact"
          method="POST"
          onSubmit={onSubmit}
          className="space-y-4"
          noValidate
        >
          <input type="hidden" name="form-name" value="contact" />
          <p className="hidden">
            <label>Don't fill this out: <input name="bot-field" onChange={onChange} /></label>
          </p>

          <div className="mb-1">
            <div className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark mb-1.5">
              Free Consultation · 24-Hour Reply
            </div>
            <h2 className="font-display text-2xl md:text-[28px] font-light text-brand-bonewhite leading-tight">
              Tell us about your <span className="italic text-brand-gold-dark">space.</span>
            </h2>
            <p className="font-sans text-[12.5px] text-brand-bonewhite/75 font-light mt-1.5 leading-relaxed">
              Yorkis replies personally — honest scope, honest budget, no sales call.
            </p>
          </div>

          <div>
            <label htmlFor="hc-name" className={labelCls}>Full name</label>
            <input id="hc-name" type="text" name="name" required autoComplete="name"
              value={form.name} onChange={onChange} placeholder="Jane Doe" className={fieldCls} />
          </div>

          <div>
            <label htmlFor="hc-email" className={labelCls}>Email</label>
            <input id="hc-email" type="email" name="email" inputMode="email" required autoComplete="email"
              value={form.email} onChange={onChange} placeholder="you@email.com" className={fieldCls} />
          </div>

          <div>
            <label htmlFor="hc-phone" className={labelCls}>Phone <span className="text-brand-bonewhite/60 normal-case tracking-normal">(optional)</span></label>
            <input id="hc-phone" type="tel" name="phone" inputMode="tel" autoComplete="tel"
              value={form.phone} onChange={onChange} placeholder="(705) 500-3581" className={fieldCls} />
          </div>

          <div>
            <label htmlFor="hc-budget" className={labelCls}>Investment range</label>
            <div className="relative">
              <select id="hc-budget" name="budget" value={form.budget} onChange={onChange}
                className={`${fieldCls} appearance-none cursor-pointer pr-10 ${form.budget ? '' : 'text-brand-muted/70'}`}>
                <option value="" disabled>Choose a ballpark…</option>
                {BUDGET_RANGES.map((b) => <option key={b.value} value={b.value} className="text-brand-ink">{b.label}</option>)}
                <option value={UNSURE} className="text-brand-ink">Not sure yet</option>
              </select>
              <ChevronDown size={15} className="text-brand-gold-dark absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
            </div>
            <p className="font-sans text-[11.5px] text-brand-bonewhite/55 font-light mt-2 leading-relaxed">
              A ballpark is perfect — it helps us reply with real options.{' '}
              <button type="button" onClick={goToCalculator} className="text-brand-gold-dark hover:text-brand-gold-dark/80 underline underline-offset-2 transition-colors">
                Not sure? Get a quick estimate
              </button>
            </p>
          </div>

          <div>
            <label htmlFor="hc-details" className={labelCls}>Anything we should know? <span className="text-brand-bonewhite/60 normal-case tracking-normal">(optional)</span></label>
            <textarea id="hc-details" name="details" rows={2}
              value={form.details} onChange={onChange} placeholder="A patio, a full backyard, a rough timeline…" className={fieldCls} />
          </div>

          {status === 'error' && (
            <p className="font-sans text-[13px] text-brand-error font-light">{errorMsg}</p>
          )}

          <button type="submit" disabled={!canSubmit}
            className="btn-primary !rounded-full w-full py-4 disabled:opacity-40 disabled:cursor-not-allowed">
            {status === 'submitting' ? 'Sending…' : 'Send My Project Details'}
          </button>

          <p className="font-sans text-[11px] text-brand-bonewhite/55 font-light text-center leading-relaxed">
            No obligation · We never share your information.
          </p>
        </form>
      )}
    </motion.div>
  );
}
