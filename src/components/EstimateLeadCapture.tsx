import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, CheckCircle, FileText, Phone } from 'lucide-react';
import { trackLead } from '../utils/analytics';
import { getAttributionFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { genEventId } from '../utils/eventId';
import { BUSINESS, publicClaimCopy, publicContact } from '../data/business';
import { scoreGoldenMapleLead } from '../utils/leadScoring';

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
  /** What the customer actually SAW on screen — the confidence-widened range.
   *  Differs from totalLow/High (the raw engine basis). Sales needs both: the
   *  engine number to quote from, and the seen number so a call never opens by
   *  contradicting the figure the customer is looking at. */
  displayedLow?: number;
  displayedHigh?: number;
  /** Optional target the customer set for themselves. */
  targetBudget?: number | null;
  /** Non-numeric scope picks (fire pit / pergola / lighting size, kitchen
   *  scope, wall height). The engine prices some of these from tier alone, so
   *  they don't all move the estimate — but they're still real scope the
   *  customer told us, and Yorkis needs them to quote accurately. */
  scopeSizes?: string;
  conditions: string[];
  /** Per-type follow-up answers keyed `${element}.${question}` (e.g. "patio.surface": "concrete") */
  details: Record<string, string>;
  /** Engine v3 exact invoice figures (cents). Optional so old callers compile. */
  preciseSubtotalCents?: number | null;
  preciseHstCents?: number | null;
  preciseGrandTotalCents?: number | null;
}

export default function EstimateLeadCapture({
  estimate,
  permalink,
  onUnlock,
}: {
  estimate: EstimatePayload;
  /** Link that restores this exact build — the thing being traded for, and the
   *  reason this gate isn't withholding anything the customer already earned. */
  permalink?: string;
  /** Fired once name+email are captured — receives the email so the caller
   *  can also unlock the estimator vault (saving a build IS giving an email;
   *  asking again at the repeat gate would be asking twice for the same thing). */
  onUnlock?: (email: string) => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const copyPermalink = async () => {
    if (!permalink) return;
    try {
      await navigator.clipboard.writeText(permalink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard can be blocked by permissions; the input is selectable, so
      // there's still a working path. Don't surface an error for this.
    }
  };
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
    // Phone is optional — requiring it for a written estimate kills completion
    // (form-cro: every field must earn its place; email alone is a workable lead).
    if (!form.name.trim() || !form.email.trim()) {
      setStatus('error');
      setErrorMsg('Just your name and email — that\'s all we need to send it.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');

    const eventId = genEventId();
    const leadScore = scoreGoldenMapleLead({
      projectType: estimate.projectType,
      selectedElements: estimate.selectedElements,
      conditions: estimate.conditions,
      details: Object.entries(estimate.details).map(([k, v]) => `${k}=${v}`).join(', '),
      city: estimate.city,
      sqft: estimate.sqft,
      totalLow: estimate.totalLow,
      totalHigh: estimate.totalHigh,
      hasPhotos: estimate.hasPhotos,
    });
    // The estimate midpoint IS the conversion value. Sending 0 (the previous
    // behaviour) made ROAS unmeasurable on the site's highest-intent
    // conversion — Ads couldn't tell a $12K walkway from a $90K backyard.
    const conversionValue = Math.round((estimate.totalLow + estimate.totalHigh) / 2);

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
      displayed_low: String(estimate.displayedLow ?? estimate.totalLow),
      displayed_high: String(estimate.displayedHigh ?? estimate.totalHigh),
      target_budget: estimate.targetBudget != null ? String(estimate.targetBudget) : '',
      scope_sizes: estimate.scopeSizes ?? '',
      build_permalink: permalink ?? '',
      brand_chosen: estimate.brandName,
      city: estimate.city,
      sqft: String(estimate.sqft),
      add_ons: estimate.addOns.join(','),
      has_photos: String(estimate.hasPhotos),
      site_conditions: estimate.conditions.join(','),
      project_details: Object.entries(estimate.details).map(([k, v]) => `${k}=${v}`).join(', '),
      lead_score: String(leadScore.score),
      lead_tier: leadScore.tier,
      lead_score_reasons: leadScore.reasons.join(','),
      // Exact takeoff figures the customer saw (dollars, 2dp) — '' pre-v3.
      precise_subtotal: estimate.preciseSubtotalCents != null ? (estimate.preciseSubtotalCents / 100).toFixed(2) : '',
      precise_hst: estimate.preciseHstCents != null ? (estimate.preciseHstCents / 100).toFixed(2) : '',
      precise_total: estimate.preciseGrandTotalCents != null ? (estimate.preciseGrandTotalCents / 100).toFixed(2) : '',
    };

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[dev] cost-estimator payload (would POST to Netlify):', payload);
      trackLead('cost-estimator', 'high-intent', conversionValue, eventId, { email: form.email, phone: form.phone }, { payload });
      setStatus('success');
      onUnlock?.(form.email);
      return;
    }

    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(payload),
      });
      if (!res.ok) throw new Error('Network response was not ok');
      trackLead('cost-estimator', 'high-intent', conversionValue, eventId, { email: form.email, phone: form.phone }, { payload });
      setStatus('success');
      onUnlock?.(form.email);
    } catch {
      setStatus('error');
      setErrorMsg(`Connection issue. Call ${publicContact.phoneDisplay} to discuss your project.`);
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
          <CheckCircle size={24} className="text-brand-gold-dark" strokeWidth={1.5} />
        </div>
        <h4 className="font-display text-3xl text-brand-bone mb-3 tracking-tight">Build saved.</h4>
        <p className="font-sans text-[14px] font-light text-brand-muted leading-relaxed mb-5">
          We will send your saved estimate to <span className="text-brand-bone">{form.email}</span> and follow up about project details.
        </p>

        {/* The actual deliverable. Generated client-side, so it works the
            instant it appears — no "check your email for a link that may or
            may not arrive". */}
        {permalink ? (
          <div className="mb-6 text-left">
            <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark mb-2">
              Your build link
            </div>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={permalink}
                onFocus={e => e.currentTarget.select()}
                aria-label="Link back to your saved build"
                className="flex-1 min-w-0 bg-brand-cream-light border border-brand-dim py-2.5 px-3 rounded-2xl font-sans text-[12px] text-brand-bonewhite/80 outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
              />
              <button
                type="button"
                onClick={copyPermalink}
                className="shrink-0 px-4 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 hover:bg-brand-gold/20 transition-colors font-sans text-[12px] text-brand-gold-dark"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="font-sans text-[11px] font-light text-brand-muted mt-2">
              Bookmark it — it reopens this estimate with every choice you made.
            </p>
          </div>
        ) : null}

        <Link
          to="/book"
          className="btn-primary !rounded-full inline-flex items-center justify-center gap-2.5 py-3.5 px-7"
        >
          <Phone size={15} strokeWidth={1.5} />
          Book a project call
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="bg-brand-cream-light border border-brand-dim/60 rounded-3xl p-7 md:p-9">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center">
          <FileText size={14} className="text-brand-gold-dark" strokeWidth={1.75} />
        </div>
        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark">
          Save This Build
        </span>
      </div>
      <h4 className="font-display text-3xl text-brand-bone mb-3 tracking-tight">
        Keep the build you just made
      </h4>
      <p className="font-sans text-[13px] font-light text-brand-muted mb-7 leading-relaxed">
        Get a link back to this exact estimate — every choice you made, ready to keep tuning
        later or send to whoever else is deciding. We can follow up about a written estimate for your {estimate.city || 'Simcoe County'} project.
        Honest scope, no sales pressure.
      </p>

      <form
        name="cost-estimator"
        method="POST"
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
          className="w-full bg-brand-cream-light border border-brand-dim hover:border-brand-gold/60 focus:border-brand-gold/60 py-3.5 px-4 rounded-2xl font-sans text-[15px] text-brand-bone placeholder:text-brand-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all font-light"
        />
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={onChange}
          required
          autoComplete="email"
          placeholder="Email address"
          className="w-full bg-brand-cream-light border border-brand-dim hover:border-brand-gold/60 focus:border-brand-gold/60 py-3.5 px-4 rounded-2xl font-sans text-[15px] text-brand-bone placeholder:text-brand-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all font-light"
        />
        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={onChange}
          autoComplete="tel"
          inputMode="tel"
          placeholder="Phone (optional — for a faster reply)"
          className="w-full bg-brand-cream-light border border-brand-dim hover:border-brand-gold/60 focus:border-brand-gold/60 py-3.5 px-4 rounded-2xl font-sans text-[15px] text-brand-bone placeholder:text-brand-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-all font-light"
        />

        {status === 'error' ? (
          <p className="font-sans text-xs text-brand-error font-light">{errorMsg}</p>
        ) : null}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="btn-primary !rounded-full w-full py-4 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_8px_24px_-8px_rgba(212,175,99,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(212,175,99,0.55)] transition-shadow"
        >
          <Mail size={16} strokeWidth={1.5} />
          {status === 'submitting' ? 'Saving…' : 'Save My Build'}
        </button>

        <p className="font-sans text-[11px] text-brand-muted/80 text-center font-light pt-2">
          {publicClaimCopy(BUSINESS.reviews.aggregate, 'Verified Google reviews.')} We never share your info.
        </p>
      </form>
    </div>
  );
}
