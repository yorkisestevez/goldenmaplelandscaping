import { useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Mail, CheckCircle, FileText } from 'lucide-react';
import { trackLead } from '../utils/analytics';
import { getAttributionFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { genEventId } from '../utils/eventId';

const encode = (data: Record<string, string>) =>
  Object.keys(data)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');

type Status = 'idle' | 'submitting' | 'success' | 'error';

export interface EstimatePayload {
  projectType: string;
  selectedElements: string[];
  totalLow: number;
  totalHigh: number;
  brandName: string;
  city: string;
  sqft: number;
  addOns: string[];
  hasPhotos: boolean;
  conditions: string[];
}

export default function EstimateLeadCapture({ estimate }: { estimate: EstimatePayload }) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    'bot-field': '',
  });

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setStatus('error');
      setErrorMsg('Need name, email, and phone to send your estimate.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');

    const eventId = genEventId();
    const payload = {
      'form-name': 'cost-estimator',
      source: 'cost-estimator',
      event_id: eventId,
      ...getAttributionFields(),
      ...getBehaviorFields(),
      name: form.name,
      email: form.email,
      phone: form.phone,
      'bot-field': form['bot-field'],
      project_type: estimate.projectType,
      project_elements: estimate.selectedElements.join(','),
      estimate_low: String(estimate.totalLow),
      estimate_high: String(estimate.totalHigh),
      brand_chosen: estimate.brandName,
      city: estimate.city,
      sqft: String(estimate.sqft),
      add_ons: estimate.addOns.join(','),
      has_photos: String(estimate.hasPhotos),
      site_conditions: estimate.conditions.join(','),
    };

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[dev] cost-estimator payload (would POST to Netlify):', payload);
      trackLead('cost-estimator', 'high-intent', undefined, eventId, { email: form.email, phone: form.phone });
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
      trackLead('cost-estimator', 'high-intent', undefined, eventId, { email: form.email, phone: form.phone });
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Connection issue. Call (705) 500-3581 — we answer in person.');
    }
  };

  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="bg-gradient-to-b from-brand-gold/10 to-brand-cream-light backdrop-blur-xl border border-brand-gold/30 rounded-3xl p-9 text-center shadow-[0_20px_60px_-30px_rgba(212,175,99,0.3)]"
      >
        <div className="mx-auto w-14 h-14 rounded-full bg-brand-gold/15 border border-brand-gold/40 flex items-center justify-center mb-5">
          <CheckCircle size={24} className="text-brand-gold" strokeWidth={1.5} />
        </div>
        <h4 className="font-display text-3xl text-brand-bone mb-3 tracking-tight">Estimate sent.</h4>
        <p className="font-sans text-[14px] font-light text-brand-muted leading-relaxed">
          Check <span className="text-brand-bone">{form.email}</span> in the next minute or two.
          <br />Now — pick a time below to lock in your numbers.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-brand-cream-light to-brand-cream-light backdrop-blur-xl border border-brand-dim/60 rounded-3xl p-7 md:p-9">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center">
          <FileText size={14} className="text-brand-gold" strokeWidth={1.75} />
        </div>
        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold">
          Save Your Estimate
        </span>
      </div>
      <h4 className="font-display text-3xl text-brand-bone mb-3 tracking-tight">
        Email me this breakdown
      </h4>
      <p className="font-sans text-[13px] font-light text-brand-muted mb-7 leading-relaxed">
        We'll send a PDF copy plus a quick summary of what's typical for your project size in {estimate.city || 'Simcoe County'}. No spam, no obligation.
      </p>

      <form
        name="cost-estimator"
        method="POST"
        data-netlify="true"
        data-netlify-honeypot="bot-field"
        onSubmit={onSubmit}
        className="space-y-4"
        noValidate
      >
        <input type="hidden" name="form-name" value="cost-estimator" />
        <p className="hidden">
          <label>Don't fill this out: <input name="bot-field" onChange={onChange} /></label>
        </p>

        <input
          type="text"
          name="name"
          value={form.name}
          onChange={onChange}
          required
          autoComplete="name"
          placeholder="Your full name"
          className="w-full bg-brand-cream border border-brand-dim/60 hover:border-brand-gold/60 focus:border-brand-gold/60 focus:bg-brand-cream py-3.5 px-4 rounded-2xl font-sans text-[15px] text-brand-bone placeholder:text-brand-muted/60 outline-none transition-all font-light"
        />
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={onChange}
          required
          autoComplete="email"
          placeholder="Email address"
          className="w-full bg-brand-cream border border-brand-dim/60 hover:border-brand-gold/60 focus:border-brand-gold/60 focus:bg-brand-cream py-3.5 px-4 rounded-2xl font-sans text-[15px] text-brand-bone placeholder:text-brand-muted/60 outline-none transition-all font-light"
        />
        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={onChange}
          required
          autoComplete="tel"
          inputMode="tel"
          placeholder="Phone number"
          className="w-full bg-brand-cream border border-brand-dim/60 hover:border-brand-gold/60 focus:border-brand-gold/60 focus:bg-brand-cream py-3.5 px-4 rounded-2xl font-sans text-[15px] text-brand-bone placeholder:text-brand-muted/60 outline-none transition-all font-light"
        />

        {status === 'error' ? (
          <p className="font-sans text-xs text-red-600 font-light">{errorMsg}</p>
        ) : null}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="btn-primary !rounded-full w-full py-4 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_8px_24px_-8px_rgba(212,175,99,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(212,175,99,0.55)] transition-shadow"
        >
          <Mail size={16} strokeWidth={1.5} />
          {status === 'submitting' ? 'Sending…' : 'Email Me My Estimate'}
        </button>

        <p className="font-sans text-[11px] text-brand-muted/80 text-center font-light pt-2">
          We only use this to send your estimate and follow up on your project. We never share your info.
        </p>
      </form>
    </div>
  );
}
