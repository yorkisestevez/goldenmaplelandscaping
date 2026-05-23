import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Calendar,
  Clock,
  Phone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { trackLead } from '../utils/analytics';
import { getAttributionFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { genEventId } from '../utils/eventId';

const CRM_BASE_URL =
  (import.meta.env.VITE_CRM_BASE_URL as string | undefined)?.trim() || '';

interface AvailabilitySlot {
  start: string;
  end: string;
  slot_type: string;
}

interface AvailabilityDay {
  date: string;
  day_name: string;
  slots: AvailabilitySlot[];
}

type Step = 'pick' | 'confirm' | 'submitting' | 'success' | 'error';

const SERVICE_OPTIONS = [
  'Complete Backyard Renovation',
  'Interlocking Stone & Patios',
  'Composite Decking',
  'Retaining Walls',
  'Landscape Design',
  'Pool Surround & Features',
  'Other',
];

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(time: string): string {
  // "13:00" → "1:00 PM"
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export default function BookingScheduler() {
  const [step, setStep] = useState<Step>('pick');
  const [errorMsg, setErrorMsg] = useState('');
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [pageOffset, setPageOffset] = useState(0); // pagination over the 14 days
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    service_interest: SERVICE_OPTIONS[0],
    notes: '',
  });

  const onChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Fetch availability on mount
  useEffect(() => {
    if (!CRM_BASE_URL) {
      setLoadingDays(false);
      return;
    }
    const today = new Date();
    const fromStr = today.toISOString().slice(0, 10);
    fetch(`${CRM_BASE_URL}/api/v1/public/bookings/availability?from=${fromStr}&days=14`)
      .then((r) => {
        if (!r.ok) throw new Error('Network');
        return r.json();
      })
      .then((data: { dates: AvailabilityDay[] }) => {
        setDays(data.dates || []);
        setLoadingDays(false);
      })
      .catch(() => {
        setLoadingDays(false);
        setErrorMsg('Could not load availability. Call (705) 500-3581 to book directly.');
      });
  }, []);

  const onPickSlot = (date: string, slot: AvailabilitySlot) => {
    setSelectedDate(date);
    setSelectedSlot(slot);
    setStep('confirm');
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) return;
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setErrorMsg('Name and either phone or email are required.');
      return;
    }
    setErrorMsg('');
    setStep('submitting');

    const eventId = genEventId();
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      booking_date: selectedDate,
      start_time: selectedSlot.start,
      slot_type: selectedSlot.slot_type,
      service_interest: form.service_interest,
      notes: form.notes.trim() || undefined,
      event_id: eventId,
      ...getAttributionFields(),
      ...getBehaviorFields(),
    };

    if (import.meta.env.DEV && !CRM_BASE_URL) {
      // eslint-disable-next-line no-console
      console.log('[dev] booking payload (would POST to CRM):', payload);
      trackLead('booking', 'high-intent', undefined, eventId);
      setStep('success');
      return;
    }

    try {
      const res = await fetch(`${CRM_BASE_URL}/api/v1/public/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Could not save your booking.');
      }
      trackLead('booking', 'high-intent', undefined, eventId);
      setStep('success');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Something went wrong. Call (705) 500-3581.'
      );
      setStep('error');
    }
  };

  // ---------- SUCCESS STATE ----------
  if (step === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-surface border border-brand-gold/30 rounded-[2px] p-12 text-center"
      >
        <div className="mx-auto w-16 h-16 rounded-full border border-brand-gold flex items-center justify-center mb-8">
          <CheckCircle size={28} className="text-brand-gold" strokeWidth={1.5} />
        </div>
        <h3 className="font-display text-3xl font-light text-brand-bonewhite mb-6">
          You're booked.
        </h3>
        <p className="font-sans text-base text-brand-muted leading-relaxed font-light max-w-md mx-auto mb-8">
          {selectedDate && selectedSlot && (
            <>
              <span className="text-brand-gold">{formatDateLong(selectedDate)}</span>
              <br />
              <span className="text-brand-gold">{formatTime(selectedSlot.start)}</span>
              <br />
              <br />
            </>
          )}
          A confirmation email is on its way. Yorkis will call you at the time you picked.
          Mark it on your calendar — we don't waste each other's time.
        </p>
        <a
          href="tel:7055003581"
          className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold hover:underline inline-flex items-center gap-2"
        >
          <Phone size={12} strokeWidth={1.5} />
          Need to reschedule? (705) 500-3581
        </a>
      </motion.div>
    );
  }

  // ---------- CONFIRM / FORM STATE ----------
  if (step === 'confirm' || step === 'submitting' || step === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-surface border border-brand-dim/10 rounded-[2px] p-10 md:p-12"
      >
        <button
          onClick={() => {
            setStep('pick');
            setErrorMsg('');
          }}
          className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted hover:text-brand-gold transition-colors flex items-center gap-2 mb-8"
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          Pick a different time
        </button>

        <div className="border-l-2 border-brand-gold pl-6 mb-10">
          <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mb-2 block">
            Selected
          </span>
          <p className="font-display text-2xl font-light text-brand-bonewhite">
            {selectedDate && formatDateLong(selectedDate)}
          </p>
          <p className="font-display text-xl font-light text-brand-gold italic">
            {selectedSlot && formatTime(selectedSlot.start)}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label htmlFor="bk-name" className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted mb-3 block">
                Full Name *
              </label>
              <input
                id="bk-name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={onChange}
                autoComplete="name"
                className="w-full bg-brand-nearblack border-b border-brand-dim/30 py-3 px-1 font-sans text-brand-bonewhite focus:border-brand-gold outline-none transition-colors font-light"
              />
            </div>
            <div>
              <label htmlFor="bk-phone" className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted mb-3 block">
                Phone *
              </label>
              <input
                id="bk-phone"
                name="phone"
                type="tel"
                required
                value={form.phone}
                onChange={onChange}
                autoComplete="tel"
                className="w-full bg-brand-nearblack border-b border-brand-dim/30 py-3 px-1 font-sans text-brand-bonewhite focus:border-brand-gold outline-none transition-colors font-light"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bk-email" className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted mb-3 block">
              Email
            </label>
            <input
              id="bk-email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              autoComplete="email"
              className="w-full bg-brand-nearblack border-b border-brand-dim/30 py-3 px-1 font-sans text-brand-bonewhite focus:border-brand-gold outline-none transition-colors font-light"
            />
          </div>

          <div>
            <label htmlFor="bk-service" className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted mb-3 block">
              What are you considering?
            </label>
            <select
              id="bk-service"
              name="service_interest"
              value={form.service_interest}
              onChange={onChange}
              className="w-full bg-brand-nearblack border-b border-brand-dim/30 py-3 px-1 font-sans text-brand-bonewhite focus:border-brand-gold outline-none transition-colors font-light appearance-none cursor-pointer"
            >
              {SERVICE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="bk-notes" className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted mb-3 block">
              Anything we should know?
            </label>
            <textarea
              id="bk-notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={onChange}
              className="w-full bg-brand-nearblack border-b border-brand-dim/30 py-3 px-1 font-sans text-brand-bonewhite focus:border-brand-gold outline-none transition-colors font-light"
              placeholder="Optional. The more we know, the better we use our 15 minutes."
            />
          </div>

          {errorMsg && (
            <p className="font-sans text-xs text-red-400 font-light">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={step === 'submitting'}
            className="btn-primary w-full py-5 inline-flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 'submitting' ? 'Booking…' : (
              <>
                Confirm My Request
                <ArrowRight size={14} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    );
  }

  // ---------- PICK STATE (date + time) ----------
  const visibleDays = days.slice(pageOffset, pageOffset + 7);
  const canGoBack = pageOffset > 0;
  const canGoForward = pageOffset + 7 < days.length;

  if (loadingDays) {
    return (
      <div className="bg-brand-surface border border-brand-dim/10 rounded-[2px] p-12 text-center">
        <div className="mx-auto w-8 h-8 rounded-full border-2 border-brand-gold/20 border-t-brand-gold animate-spin mb-6" />
        <p className="font-sans text-sm text-brand-muted font-light">Loading available times…</p>
      </div>
    );
  }

  if (!CRM_BASE_URL) {
    return (
      <div className="bg-brand-surface border border-brand-dim/10 rounded-[2px] p-12 text-center">
        <Calendar size={32} className="text-brand-gold/40 mx-auto mb-6" strokeWidth={1.5} />
        <p className="font-sans text-sm text-brand-muted font-light mb-4">
          Online booking is being set up.
        </p>
        <a
          href="tel:7055003581"
          className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold hover:underline inline-flex items-center gap-2"
        >
          <Phone size={12} strokeWidth={1.5} /> Call (705) 500-3581 to schedule
        </a>
      </div>
    );
  }

  if (errorMsg && days.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-dim/10 rounded-[2px] p-12 text-center">
        <p className="font-sans text-sm text-brand-muted font-light">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="bg-brand-surface border border-brand-dim/10 rounded-[2px] p-8 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mb-1 block">
            Step 1 of 2
          </span>
          <h3 className="font-display text-2xl font-light text-brand-bonewhite">
            Pick a time
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPageOffset(Math.max(0, pageOffset - 7))}
            disabled={!canGoBack}
            className="w-9 h-9 flex items-center justify-center border border-brand-dim/20 rounded-[2px] text-brand-bonewhite hover:border-brand-gold hover:text-brand-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setPageOffset(Math.min(days.length - 7, pageOffset + 7))}
            disabled={!canGoForward}
            className="w-9 h-9 flex items-center justify-center border border-brand-dim/20 rounded-[2px] text-brand-bonewhite hover:border-brand-gold hover:text-brand-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Day picker */}
      <div className="grid grid-cols-7 gap-2 mb-8">
        {visibleDays.map((d) => {
          const isAvailable = d.slots.length > 0;
          const isSelected = selectedDate === d.date;
          const dayNum = parseInt(d.date.split('-')[2], 10);
          return (
            <button
              key={d.date}
              onClick={() => isAvailable && setSelectedDate(d.date)}
              disabled={!isAvailable}
              className={`flex flex-col items-center justify-center py-4 rounded-[2px] border transition-all ${
                isSelected
                  ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                  : isAvailable
                    ? 'border-brand-dim/20 text-brand-bonewhite hover:border-brand-gold hover:bg-brand-gold/5'
                    : 'border-brand-dim/10 text-brand-dim cursor-not-allowed'
              }`}
            >
              <span className="font-sans text-[9px] uppercase tracking-[0.2em] mb-1">
                {d.day_name}
              </span>
              <span className="font-display text-xl font-light">{dayNum}</span>
              {isAvailable && (
                <span className="font-sans text-[8px] uppercase tracking-[0.15em] text-brand-muted mt-1">
                  {d.slots.length} {d.slots.length === 1 ? 'slot' : 'slots'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Time picker */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="border-t border-brand-dim/10 pt-8">
              <div className="flex items-center gap-3 mb-6">
                <Clock size={14} className="text-brand-gold" strokeWidth={1.5} />
                <span className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-bonewhite font-medium">
                  {formatDateLong(selectedDate)}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {days.find((d) => d.date === selectedDate)?.slots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => onPickSlot(selectedDate, slot)}
                    className="border border-brand-dim/20 hover:border-brand-gold hover:bg-brand-gold/5 py-4 px-6 rounded-[2px] font-sans text-sm text-brand-bonewhite hover:text-brand-gold transition-all"
                  >
                    {formatTime(slot.start)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedDate && (
        <p className="text-center font-sans text-xs text-brand-muted font-light italic mt-4">
          Pick a day above to see times.
        </p>
      )}
    </div>
  );
}
