import { useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Unlock, Mail } from 'lucide-react';
import { trackLead } from '../utils/analytics';
import { getAttributionFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { genEventId } from '../utils/eventId';
import type { VaultEstimate } from '../utils/estimatorVault';
import { publicContact } from '../data/business';

const encode = (data: Record<string, string>) =>
  Object.keys(data)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Status = 'idle' | 'submitting' | 'error';

/**
 * The repeat-pricing gate: the first estimate is free end-to-end; pricing a
 * SECOND project asks for an email once, then the device stays unlocked for
 * good. Posts the Netlify `estimator-unlock` form (declared in
 * public/__forms.html — runtime JSX must NOT carry data-netlify, see the trap
 * documented there), which the submission-created bridge forwards to the CRM
 * like every other form.
 */
export default function EstimatorUnlock({
  lastEstimate,
  onUnlocked,
}: {
  /** The build that earned the free run — shown so the gate reads as a
   *  continuation of value already delivered, not a wall. */
  lastEstimate: VaultEstimate | null;
  onUnlocked: (email: string) => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({ name: '', email: '', 'bot-field': '' });

  const onChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setStatus('error');
      setErrorMsg('Just a working email — that\'s the whole gate.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');

    const eventId = genEventId();
    const payload = {
      'form-name': 'estimator-unlock',
      source: 'estimator-repeat-unlock',
      event_id: eventId,
      ...getAttributionFields(),
      ...getBehaviorFields(),
      name: form.name,
      email: form.email,
      'bot-field': form['bot-field'],
      project_type: lastEstimate?.projectType ?? '',
      city: lastEstimate?.city ?? '',
      sqft: lastEstimate ? String(lastEstimate.sqft) : '',
      last_estimate_total: lastEstimate ? (lastEstimate.subtotalCents / 100).toFixed(2) : '',
      last_permalink: lastEstimate?.permalink ?? '',
    };

    const finish = () => {
      trackLead('estimator-unlock', 'top-of-funnel', lastEstimate ? Math.round(lastEstimate.subtotalCents / 100) : undefined, eventId, { email: form.email }, { payload });
      onUnlocked(form.email.trim());
    };

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[dev] estimator-unlock payload (would POST to Netlify):', payload);
      finish();
      return;
    }

    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(payload),
      });
      if (!res.ok) throw new Error('Network response was not ok');
      finish();
    } catch {
      setStatus('error');
      setErrorMsg(`Connection issue. Call ${publicContact.phoneDisplay} — we answer in person.`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="max-w-xl mx-auto text-center py-6"
    >
      <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold-dark mb-6">
        <Unlock size={20} strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-3xl md:text-4xl text-brand-bone mb-3 tracking-tight">
        Price as many projects as you like.
      </h3>
      <p className="font-sans font-light text-[15px] text-brand-muted leading-relaxed mb-2">
        Your first estimate was free, no strings
        {lastEstimate ? (
          <> — <span className="text-brand-bone tabular-nums">{money(lastEstimate.subtotalCents)}</span> for your {lastEstimate.sqft > 0 ? `${lastEstimate.sqft} sqft ` : ''}{lastEstimate.projectType}</>
        ) : null}.
      </p>
      <p className="font-sans font-light text-[15px] text-brand-muted leading-relaxed mb-8">
        Drop your email once and this device unlocks unlimited estimates, plus saved
        builds you can reopen and compare. No spam — we only reach out if you ask us to.
      </p>

      <form onSubmit={onSubmit} className="space-y-3 text-left" name="estimator-unlock">
        <input type="hidden" name="form-name" value="estimator-unlock" />
        <p className="hidden">
          <label>Don't fill this out: <input name="bot-field" value={form['bot-field']} onChange={onChange} /></label>
        </p>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={onChange}
          placeholder="Name (optional)"
          autoComplete="name"
          className="w-full bg-brand-cream-light border border-brand-dim rounded-2xl px-5 py-4 font-sans text-[14px] text-brand-bone placeholder:text-brand-muted/70 outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus:border-brand-gold/50 transition-colors"
        />
        <div className="relative">
          <Mail size={15} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="you@email.com"
            autoComplete="email"
            required
            className="w-full bg-brand-cream-light border border-brand-dim rounded-2xl pl-12 pr-5 py-4 font-sans text-[14px] text-brand-bone placeholder:text-brand-muted/70 outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus:border-brand-gold/50 transition-colors"
          />
        </div>
        {status === 'error' && (
          <p className="font-sans text-[12px] text-brand-error">{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="btn-primary !rounded-full w-full justify-center text-center !py-4 disabled:opacity-60"
        >
          {status === 'submitting' ? 'Unlocking…' : 'Unlock unlimited estimates →'}
        </button>
      </form>

      <p className="font-sans text-[11px] font-light text-brand-muted mt-6 leading-relaxed">
        One email, once — it never re-locks. Your saved builds stay on this device.
      </p>
    </motion.div>
  );
}
