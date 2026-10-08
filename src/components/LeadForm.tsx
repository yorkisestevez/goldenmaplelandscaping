import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { PROJECT_BUDGET_RANGES } from '../data/projectBudgets';
import { OWNER_FACTS, ownerFact } from '../data/ownerFacts';
import { publicContact } from '../data/business';
import { trackLead } from '../utils/analytics';
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

type Errors = Partial<Record<keyof Fields, string>>;

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

function validate(fields: Fields): Errors {
  const errors: Errors = {};
  if (fields.name.trim().length < 2) errors.name = 'Add your name so we know who to call.';
  const digits = fields.phone.replace(/\D/g, '');
  if (digits.length < 10) errors.phone = 'Enter a phone number with at least 10 digits.';
  if (!EMAIL_RE.test(fields.email.trim())) errors.email = 'Enter an email like name@email.com.';
  if (fields.town.trim().length < 2) errors.town = 'Add your town or postal code.';
  if (!fields.service) errors.service = 'Choose the kind of project.';
  if (!fields.timing) errors.timing = 'Choose when you want to build.';
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
  const [fields, setFields] = useState<Fields>(() => emptyFields(defaultService));
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
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setStatus('error');
      setFormError('Check the highlighted fields and try again.');
      return;
    }
    setStatus('submitting');
    setFormError('');
    try {
      const { eventId, payload } = await postNetlifyForm({
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
        extra,
      });
      const tier = intent ?? (formName === 'guide-download' || formName === 'cost-guide' ? 'top-of-funnel' : 'high-intent');
      trackLead(formName, tier, undefined, eventId, { email: fields.email, phone: fields.phone }, { payload });
      navigate(`/thank-you/?form=${encodeURIComponent(formName)}`);
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full name" id={id('name')} error={errors.name} labelCls={labelCls} errorCls={errorCls}>
          <input id={id('name')} name="name" type="text" autoComplete="name" value={fields.name} onChange={(event) => set('name', event.target.value)} placeholder="Jane Doe" className={fieldCls} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Phone" id={id('phone')} error={errors.phone} labelCls={labelCls} errorCls={errorCls}>
          <input id={id('phone')} name="phone" type="tel" inputMode="tel" autoComplete="tel" value={fields.phone} onChange={(event) => set('phone', event.target.value)} placeholder="(705) 555-0199" className={fieldCls} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="Email" id={id('email')} error={errors.email} labelCls={labelCls} errorCls={errorCls}>
          <input id={id('email')} name="email" type="email" inputMode="email" autoComplete="email" value={fields.email} onChange={(event) => set('email', event.target.value)} placeholder="you@email.com" className={fieldCls} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Town or postal code" id={id('town')} error={errors.town} labelCls={labelCls} errorCls={errorCls}>
          <input id={id('town')} name="town" type="text" autoComplete="postal-code" value={fields.town} onChange={(event) => set('town', event.target.value)} placeholder="Barrie or L4N" className={fieldCls} aria-invalid={!!errors.town} />
        </Field>
        <Field label="Project type" id={id('service')} error={errors.service} labelCls={labelCls} errorCls={errorCls}>
          <div className="relative">
            <select id={id('service')} name="service" value={fields.service} onChange={(event) => set('service', event.target.value)} className={`${fieldCls} appearance-none pr-10`} aria-invalid={!!errors.service}>
              <option value="">Choose a project</option>
              {LEAD_SERVICES.map((service) => <option key={service} value={service}>{service}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-gold-dark" aria-hidden="true" />
          </div>
        </Field>
        <Field label="When do you want to build?" id={id('timing')} error={errors.timing} labelCls={labelCls} errorCls={errorCls}>
          <div className="relative">
            <select id={id('timing')} name="timing" value={fields.timing} onChange={(event) => set('timing', event.target.value)} className={`${fieldCls} appearance-none pr-10`} aria-invalid={!!errors.timing}>
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

      {formError && <p className={errorCls} role="alert">{formError}</p>}

      <button type="submit" disabled={status === 'submitting'} className="btn-primary w-full py-4 disabled:opacity-50">
        {status === 'submitting' ? 'Sending…' : submitLabel}
      </button>
      <p className={`font-sans text-[12px] text-center ${dark ? 'text-brand-porcelain/70' : 'text-brand-muted'}`}>
        We only use this to reply about your project.{' '}
        <GoogleReviewsLink className={dark ? 'text-brand-gold underline underline-offset-2' : 'text-brand-gold-dark underline underline-offset-2'} />
      </p>
    </form>
  );
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
