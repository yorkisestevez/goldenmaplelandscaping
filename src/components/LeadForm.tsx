import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { PROJECT_BUDGET_RANGES } from '../data/projectBudgets';
import { OWNER_FACTS, ownerFact } from '../data/ownerFacts';
import { publicContact } from '../data/business';
import { trackLead } from '../utils/analytics';
import { bookingSearch } from '../utils/bookingPrefill';
import { postNetlifyForm, type NetlifyFormName } from '../utils/postNetlifyForm';
import GoogleReviewsLink from './GoogleReviewsLink';

export const LEAD_SERVICES = [
  'Interlocking patio',
  'Interlock driveway',
  'Retaining wall',
  'Composite deck',
  'Landscape design',
  'Outdoor kitchen',
  'Patio repair or re-level',
  'Seasonal clean-up',
  'Not sure yet',
] as const;

const TIMING = [
  'As soon as you can fit it',
  'This building season',
  'Next building season',
  'Just researching',
] as const;

const SERVICE_FROM_QUERY: Record<string, (typeof LEAD_SERVICES)[number]> = {
  'seasonal-cleanup': 'Seasonal clean-up',
  patio: 'Interlocking patio',
  driveway: 'Interlock driveway',
  wall: 'Retaining wall',
  deck: 'Composite deck',
  repair: 'Patio repair or re-level',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 8_000_000;

type Fields = {
  name: string;
  phone: string;
  email: string;
  town: string;
  service: string;
  timing: string;
  budget: string;
  details: string;
  botField: string;
};

type Errors = Partial<Record<keyof Fields | 'photos' | 'contact', string>>;

const emptyFields = (service = ''): Fields => ({
  name: '',
  phone: '',
  email: '',
  town: '',
  service,
  timing: '',
  budget: '',
  details: '',
  botField: '',
});

function isGuide(formName: NetlifyFormName): boolean {
  return formName === 'guide-download' || formName === 'cost-guide';
}

function validateStep1(fields: Fields, guide: boolean): Errors {
  const errors: Errors = {};
  if (fields.name.trim().length < 2) errors.name = 'Add your name so we know who to reply to.';
  if (guide) {
    if (!EMAIL_RE.test(fields.email.trim())) errors.email = 'Enter an email like name@email.com.';
    return errors;
  }
  const digits = fields.phone.replace(/\D/g, '');
  const phoneOk = digits.length >= 10;
  const emailOk = EMAIL_RE.test(fields.email.trim());
  if (!phoneOk && !emailOk) errors.contact = 'Add a phone number or an email so we can reply.';
  if (fields.phone.trim() && !phoneOk) errors.phone = 'Enter a phone number with at least 10 digits.';
  if (fields.email.trim() && !emailOk) errors.email = 'Enter an email like name@email.com.';
  if (!fields.service) errors.service = 'Choose the kind of project.';
  return errors;
}

export default function LeadForm({
  formName,
  source,
  submitLabel,
  heading,
  intro,
  idPrefix,
  defaultService = '',
  intent,
  extra,
  variant = 'light',
}: {
  formName: NetlifyFormName;
  source: string;
  submitLabel: string;
  heading?: string;
  intro?: string;
  idPrefix: string;
  defaultService?: string;
  intent?: 'high-intent' | 'top-of-funnel';
  extra?: Record<string, string>;
  variant?: 'light' | 'dark';
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const guide = isGuide(formName);
  const [step, setStep] = useState<1 | 2>(1);
  const [fields, setFields] = useState<Fields>(() => emptyFields(defaultService));
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const preset = SERVICE_FROM_QUERY[searchParams.get('service') ?? ''];
    if (preset) setFields((current) => ({ ...current, service: preset }));
  }, [searchParams]);

  const dark = variant === 'dark';
  const labelCls = dark
    ? 'font-sans text-[10px] uppercase tracking-[0.18em] text-brand-porcelain/80 block mb-2'
    : 'font-sans text-[10px] uppercase tracking-[0.18em] text-brand-muted block mb-2';
  const fieldCls = dark
    ? 'w-full min-w-0 bg-transparent border border-brand-porcelain/25 rounded-[2px] px-3 py-3 font-sans text-base text-brand-porcelain placeholder:text-brand-porcelain/50 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40'
    : 'w-full min-w-0 bg-brand-nearblack border border-brand-dim rounded-[2px] px-3 py-3 font-sans text-base text-brand-bonewhite placeholder:text-brand-muted/60 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40';
  const errorCls = 'font-sans text-[13px] text-brand-error mt-1.5';

  const set = (key: keyof Fields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, contact: key === 'phone' || key === 'email' ? undefined : current.contact }));
  };

  const thanksHref = () => {
    const query = new URLSearchParams({ form: formName });
    const name = fields.name.trim();
    const phone = fields.phone.trim();
    const email = fields.email.trim();
    const service = fields.service;
    if (name) query.set('name', name);
    if (phone) query.set('phone', phone);
    if (email) query.set('email', email);
    if (service) query.set('service', service);
    return `/thank-you/?${query.toString()}`;
  };

  const post = (followUp: string, files?: File[]) => postNetlifyForm({
    formName,
    source,
    name: fields.name.trim(),
    phone: fields.phone.trim(),
    email: fields.email.trim(),
    service: fields.service,
    town: fields.town.trim(),
    timing: fields.timing,
    budget: fields.budget,
    details: fields.details.trim(),
    botField: fields.botField,
    extra: { ...extra, ...(followUp ? { follow_up: followUp } : {}) },
    files,
  });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!guide && step === 2) {
      const photoError = photoProblem(photos);
      if (photoError) {
        setErrors({ photos: photoError });
        setStatus('error');
        setFormError(photoError);
        return;
      }
      setStatus('submitting');
      setFormError('');
      try {
        await post('details', photos);
        navigate(thanksHref());
      } catch {
        setStatus('error');
        setFormError(`Something went wrong. Call ${publicContact.phoneDisplay} or email ${publicContact.email}.`);
      }
      return;
    }

    const nextErrors = validateStep1(fields, guide);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setStatus('error');
      setFormError('Check the highlighted fields and try again.');
      return;
    }
    setStatus('submitting');
    setFormError('');
    try {
      const { eventId, payload } = await post('');
      const tier = intent ?? (guide ? 'top-of-funnel' : 'high-intent');
      trackLead(formName, tier, undefined, eventId, { email: fields.email, phone: fields.phone }, { payload });
      if (guide) {
        navigate(thanksHref());
        return;
      }
      setStatus('idle');
      setStep(2);
    } catch {
      setStatus('error');
      setFormError(`Something went wrong. Call ${publicContact.phoneDisplay} or email ${publicContact.email}.`);
    }
  };

  const response = ownerFact(OWNER_FACTS.responseTime);
  const minimum = ownerFact(OWNER_FACTS.projectMinimum);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form name={formName} method="POST" onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="form-name" value={formName} />
      <input type="hidden" name="source" value={source} />
      <p className="hidden" aria-hidden="true">
        <label>
          Don&apos;t fill this out:{' '}
          <input name="bot-field" value={fields.botField} onChange={(event) => set('botField', event.target.value)} tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      {heading && <h2 className={`font-display text-2xl md:text-3xl font-light leading-tight ${dark ? 'text-brand-porcelain' : 'text-brand-bonewhite'}`}>{heading}</h2>}
      {intro && <p className={`font-sans text-sm leading-relaxed font-light ${dark ? 'text-brand-porcelain/80' : 'text-brand-muted'}`}>{intro}</p>}
      {response && <p className={`font-sans text-sm ${dark ? 'text-brand-gold' : 'text-brand-gold-dark'}`}>{response}</p>}
      {minimum && <p className={`font-sans text-sm ${dark ? 'text-brand-porcelain/80' : 'text-brand-muted'}`}>{minimum}</p>}
      {!guide && (
        <p className={`font-sans text-[11px] uppercase tracking-[0.18em] ${dark ? 'text-brand-porcelain/70' : 'text-brand-muted'}`}>
          Step {step} of 2
        </p>
      )}

      {guide ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" id={id('name')} error={errors.name} labelCls={labelCls} errorCls={errorCls}>
            <input id={id('name')} name="name" type="text" autoComplete="name" value={fields.name} onChange={(event) => set('name', event.target.value)} placeholder="Jane Doe" className={fieldCls} aria-invalid={!!errors.name} required />
          </Field>
          <Field label="Email" id={id('email')} error={errors.email} labelCls={labelCls} errorCls={errorCls}>
            <input id={id('email')} name="email" type="email" inputMode="email" autoComplete="email" value={fields.email} onChange={(event) => set('email', event.target.value)} placeholder="you@email.com" className={fieldCls} aria-invalid={!!errors.email} required />
          </Field>
        </div>
      ) : step === 1 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" id={id('name')} error={errors.name} labelCls={labelCls} errorCls={errorCls}>
            <input id={id('name')} name="name" type="text" autoComplete="name" value={fields.name} onChange={(event) => set('name', event.target.value)} placeholder="Jane Doe" className={fieldCls} aria-invalid={!!errors.name} required />
          </Field>
          <Field label="Phone or email" id={id('phone')} error={errors.phone || errors.contact} labelCls={labelCls} errorCls={errorCls}>
            <input id={id('phone')} name="phone" type="tel" inputMode="tel" autoComplete="tel" value={fields.phone} onChange={(event) => set('phone', event.target.value)} placeholder="(705) 555-0199" className={fieldCls} aria-invalid={!!(errors.phone || errors.contact)} />
          </Field>
          <Field label="Email, if you prefer" id={id('email')} error={errors.email} labelCls={labelCls} errorCls={errorCls}>
            <input id={id('email')} name="email" type="email" inputMode="email" autoComplete="email" value={fields.email} onChange={(event) => set('email', event.target.value)} placeholder="you@email.com" className={fieldCls} aria-invalid={!!errors.email} />
          </Field>
          <Field label="Project type" id={id('service')} error={errors.service} labelCls={labelCls} errorCls={errorCls}>
            <div className="relative">
              <select id={id('service')} name="service" value={fields.service} onChange={(event) => set('service', event.target.value)} className={`${fieldCls} appearance-none pr-10`} aria-invalid={!!errors.service} required>
                <option value="">Choose a project</option>
                {LEAD_SERVICES.map((service) => <option key={service} value={service}>{service}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-gold-dark" aria-hidden="true" />
            </div>
          </Field>
        </div>
      ) : (
        <div className="space-y-4">
          <p className={`font-sans text-sm leading-relaxed font-light ${dark ? 'text-brand-porcelain/80' : 'text-brand-muted'}`}>
            We have your name and how to reach you. Town, timing, notes, and photos are optional.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Town or postal code (optional)" id={id('town')} labelCls={labelCls} errorCls={errorCls}>
              <input id={id('town')} name="town" type="text" autoComplete="postal-code" value={fields.town} onChange={(event) => set('town', event.target.value)} placeholder="Barrie or L4N" className={fieldCls} />
            </Field>
            <Field label="When do you want to build? (optional)" id={id('timing')} labelCls={labelCls} errorCls={errorCls}>
              <div className="relative">
                <select id={id('timing')} name="timing" value={fields.timing} onChange={(event) => set('timing', event.target.value)} className={`${fieldCls} appearance-none pr-10`}>
                  <option value="">Choose timing</option>
                  {TIMING.map((timing) => <option key={timing} value={timing}>{timing}</option>)}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-gold-dark" aria-hidden="true" />
              </div>
            </Field>
          </div>
          <Field label="Budget (optional)" id={id('budget')} labelCls={labelCls} errorCls={errorCls}>
            <div className="relative">
              <select id={id('budget')} name="budget" value={fields.budget} onChange={(event) => set('budget', event.target.value)} className={`${fieldCls} appearance-none pr-10`}>
                <option value="">Not sure yet</option>
                {PROJECT_BUDGET_RANGES.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-gold-dark" aria-hidden="true" />
            </div>
          </Field>
          <Field label="Anything we should know? (optional)" id={id('details')} labelCls={labelCls} errorCls={errorCls}>
            <textarea id={id('details')} name="details" rows={3} value={fields.details} onChange={(event) => set('details', event.target.value)} placeholder="Size, access, or what you want the space to do." className={fieldCls} />
          </Field>
          <Field label="Photos (optional)" id={id('photos')} error={errors.photos} labelCls={labelCls} errorCls={errorCls}>
            <input
              id={id('photos')}
              name="photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                const next = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS);
                setPhotos(next);
                setErrors((current) => ({ ...current, photos: undefined }));
              }}
              className={fieldCls}
            />
            <span className={`block font-sans text-[12px] mt-1.5 ${dark ? 'text-brand-porcelain/70' : 'text-brand-muted'}`}>Up to {MAX_PHOTOS} photos. Skip this if you would rather talk it through.</span>
          </Field>
        </div>
      )}

      {formError && <p className={errorCls} role="alert">{formError}</p>}

      {!guide && step === 2 ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="submit" disabled={status === 'submitting'} className="btn-primary flex-1 py-4 disabled:opacity-50">
            {status === 'submitting' ? 'Sending…' : 'Send details'}
          </button>
          <button
            type="button"
            disabled={status === 'submitting'}
            className="btn-ghost flex-1 py-4 disabled:opacity-50"
            onClick={() => navigate(thanksHref())}
          >
            Skip for now
          </button>
        </div>
      ) : (
        <button type="submit" disabled={status === 'submitting'} className="btn-primary w-full py-4 disabled:opacity-50">
          {status === 'submitting' ? 'Sending…' : submitLabel}
        </button>
      )}
      <p className={`font-sans text-[12px] text-center ${dark ? 'text-brand-porcelain/70' : 'text-brand-muted'}`}>
        We only use this to reply about your project.{' '}
        <GoogleReviewsLink className={dark ? 'text-brand-gold underline underline-offset-2' : 'text-brand-gold-dark underline underline-offset-2'} />
        {!guide && step === 1 && (
          <>
            {' '}
            <Link to={bookingSearch({ name: fields.name, phone: fields.phone, email: fields.email, service: fields.service })} className={dark ? 'text-brand-gold underline underline-offset-2' : 'text-brand-gold-dark underline underline-offset-2'}>Book a call</Link>
          </>
        )}
      </p>
    </form>
  );
}

function photoProblem(files: File[]): string {
  if (files.length > MAX_PHOTOS) return `Choose up to ${MAX_PHOTOS} photos.`;
  if (files.some((file) => file.size > MAX_PHOTO_BYTES)) return 'Each photo needs to be under 8 MB.';
  return '';
}

function Field({
  label,
  id,
  error,
  labelCls,
  errorCls,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  labelCls: string;
  errorCls: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{label}</label>
      {children}
      {error && <p id={`${id}-error`} className={errorCls}>{error}</p>}
    </div>
  );
}
