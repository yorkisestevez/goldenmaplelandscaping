import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle, Shield, Star, Calendar, Phone } from 'lucide-react';
import { trackLead, trackCall } from '../utils/analytics';
import { getAttributionFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { genEventId } from '../utils/eventId';

const encode = (data: Record<string, string>) =>
  Object.keys(data)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function QuickQuote() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    details: '',
    'bot-field': '',
  });

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.details.trim()) {
      setStatus('error');
      setErrorMsg('Just need name, phone, and a quick line about your project.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');

    const eventId = genEventId();
    const payload = {
      'form-name': 'quick-quote',
      source: 'hero',
      event_id: eventId,
      ...getAttributionFields(),
      ...getBehaviorFields(),
      ...form,
    };

    // Vite dev server doesn't process Netlify form submissions — short-circuit
    // to success so Yorkis can preview the full UI + analytics flow locally.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[dev] quick-quote payload (would POST to Netlify):', payload);
      trackLead('quick-quote', 'high-intent', undefined, eventId, { phone: form.phone });
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
      trackLead('quick-quote', 'high-intent', undefined, eventId, { phone: form.phone });
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Connection issue. Call (705) 500-3581 — we answer in person.');
    }
  };

  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-brand-burgundy/90 backdrop-blur-md border border-brand-gold/30 rounded-[2px] p-10 shadow-2xl text-center"
      >
        <div className="mx-auto w-14 h-14 rounded-full border border-brand-gold flex items-center justify-center mb-6">
          <CheckCircle size={24} className="text-brand-gold" strokeWidth={1.5} />
        </div>
        <h3 className="font-display text-2xl font-light text-brand-porcelain mb-4">
          We've got it.
        </h3>
        <p className="font-sans text-sm text-brand-porcelain-soft leading-relaxed font-light mb-8">
          Want to skip the wait? Book your <span className="text-brand-gold">free estimate request</span> directly — pick a time that works for you.
        </p>
        <Link
          to="/contact"
          className="btn-primary w-full py-4 inline-flex items-center justify-center gap-3 group mb-5"
        >
          <Calendar size={14} strokeWidth={1.5} />
          Pick A Time On The Calendar
          <ArrowRight size={14} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
        </Link>
        <a
          href="tel:7055003581" onClick={() => trackCall('quickquote_phone')}
          className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold hover:underline inline-flex items-center gap-2"
        >
          <Phone size={12} strokeWidth={1.5} />
          (705) 500-3581
        </a>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="bg-brand-burgundy/90 backdrop-blur-md border border-brand-gold/25 rounded-[2px] p-8 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={12} className="text-brand-gold fill-brand-gold" strokeWidth={0} />
          ))}
        </div>
        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold">5.0 · 8 Reviews</span>
      </div>

      <h2 className="font-display text-3xl md:text-4xl font-light text-brand-porcelain leading-tight mb-3">
        Get your free <span className="italic text-brand-gold">project estimate</span>
      </h2>
      <p className="font-sans text-sm text-brand-porcelain-soft font-light mb-8 leading-relaxed">
        estimate request with Yorkis — at a time that works for you. No fee. Honest answers about scope and budget.
      </p>

      <form
        name="quick-quote"
        method="POST"
        onSubmit={onSubmit}
        className="space-y-5"
        noValidate
      >
        <input type="hidden" name="form-name" value="quick-quote" />
        <input type="hidden" name="source" value="hero" />
        <p className="hidden">
          <label>Don't fill this out: <input name="bot-field" onChange={onChange} /></label>
        </p>

        <div>
          <label htmlFor="qq-name" className="sr-only">Full Name</label>
          <input
            id="qq-name"
            type="text"
            name="name"
            required
            value={form.name}
            onChange={onChange}
            autoComplete="name"
            className="w-full bg-transparent border-b border-brand-porcelain-soft/25 py-3 px-1 font-sans text-brand-porcelain placeholder:text-brand-porcelain-soft/70 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 transition-colors font-light"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label htmlFor="qq-phone" className="sr-only">Phone Number</label>
          <input
            id="qq-phone"
            type="tel"
            name="phone"
            required
            value={form.phone}
            onChange={onChange}
            autoComplete="tel"
            inputMode="tel"
            className="w-full bg-transparent border-b border-brand-porcelain-soft/25 py-3 px-1 font-sans text-brand-porcelain placeholder:text-brand-porcelain-soft/70 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 transition-colors font-light"
            placeholder="Phone number"
          />
        </div>

        <div>
          <label htmlFor="qq-project" className="sr-only">What are you building?</label>
          <input
            id="qq-project"
            type="text"
            name="details"
            required
            value={form.details}
            onChange={onChange}
            className="w-full bg-transparent border-b border-brand-porcelain-soft/25 py-3 px-1 font-sans text-brand-porcelain placeholder:text-brand-porcelain-soft/70 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 transition-colors font-light"
            placeholder="What are you building? (e.g. patio, full backyard, deck)"
          />
        </div>

        {status === 'error' && (
          <p className="font-sans text-xs text-brand-error font-light">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="btn-primary w-full py-5 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
        >
          {status === 'submitting' ? 'Sending…' : (
            <>
              Get My Free Estimate
              <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        <div className="flex items-start justify-center gap-3 pt-4 text-[11px] text-brand-porcelain-soft font-light leading-relaxed">
          <Shield size={14} className="text-brand-gold/70 shrink-0 mt-px" strokeWidth={1.5} />
          <span>We only contact you about your project. No spam, ever — and we never share your number.</span>
        </div>
      </form>
    </motion.div>
  );
}
