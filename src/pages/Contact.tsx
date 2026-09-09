import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { MapPin, Phone, Mail, Clock, Shield, Award, CheckCircle, ChevronDown } from 'lucide-react';
import SEO from '../components/SEO';
import { trackLead, trackCall } from '../utils/analytics';
import { getAttributionFields } from '../utils/utmCapture';
import { getBehaviorFields } from '../utils/behavior';
import { genEventId } from '../utils/eventId';
import { scoreGoldenMapleLead } from '../utils/leadScoring';

const encode = (data: Record<string, string>) =>
  Object.keys(data)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&');

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function Contact() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    service: 'Backyard Outdoor Living / Premium Patio',
    budget: '',
    details: '',
    'bot-field': '',
  });

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      setStatus('error');
      setErrorMsg('Please fill in your name, phone, and email.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');

    // Compose details: include service interest + budget so the CRM (which only
    // tracks `details`/`message`) doesn't lose this context.
    const enrichedDetails = [
      form.service && `Service: ${form.service}`,
      form.budget && `Budget: ${form.budget}`,
      form.details && `\nNotes: ${form.details}`,
    ]
      .filter(Boolean)
      .join(' · ');

    const eventId = genEventId();
    const leadScore = scoreGoldenMapleLead({
      budget: form.budget,
      service: form.service,
      details: form.details,
    });
    const payload = {
      'form-name': 'contact',
      event_id: eventId,
      ...getAttributionFields(),
      ...getBehaviorFields(),
      ...form,
      details: enrichedDetails || form.details,
      lead_score: String(leadScore.score),
      lead_tier: leadScore.tier,
      lead_score_reasons: leadScore.reasons.join(','),
    };

    // Vite dev server doesn't process Netlify form submissions — short-circuit
    // to success in dev so the full UI + analytics flow can be previewed locally.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[dev] contact payload (would POST to Netlify):', payload);
      trackLead('contact', 'high-intent', undefined, eventId, { email: form.email, phone: form.phone }, { payload });
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
      trackLead('contact', 'high-intent', undefined, eventId, { email: form.email, phone: form.phone }, { payload });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg('Something went wrong. Please call us at (705) 500-3581 or email yorkis@goldenmaplelandscaping.ca.');
    }
  };

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Start a Golden Maple Project | Premium Hardscape Barrie"
        description="Request a free estimate for a premium patio, retaining wall, sloped-yard fix, or full backyard transformation in Barrie and Simcoe County."
        canonical="https://goldenmaplelandscaping.ca/contact"
      />
      
      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-32">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">
              Get Your Estimate
            </span>
            <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
              Get a free estimate. <br />
              <span className="italic text-brand-gold-dark">Yorkis replies in 24 hours.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
              Tell us your name, phone, and email — and a little about the space if you have it. Yorkis comes back within 24 hours with an honest read on scope, timeline, and whether we're the right fit. Budget is optional. No sales call required to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 mb-40">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl">
                <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-8 leading-tight">Tell us about your space</h2>

                <div className="mb-12 p-6 bg-brand-nearblack/50 border-l-2 border-brand-gold">
                  <p className="font-sans text-base text-brand-muted leading-relaxed font-light">
                    Name, phone, and email are enough to start. A ballpark budget helps us reply with real options, but it's optional. Yorkis comes back personally with an honest scope and timeline. No call required to get started.
                  </p>
                </div>

                {status === 'success' ? (
                  <div className="py-16 text-center space-y-8">
                    <div className="mx-auto w-16 h-16 rounded-full border border-brand-gold flex items-center justify-center">
                      <CheckCircle size={28} className="text-brand-gold-dark" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-display text-3xl font-light text-brand-bonewhite">Estimate request received.</h3>
                    <p className="font-sans text-base text-brand-muted leading-relaxed font-light max-w-md mx-auto">
                      Yorkis will review your project and respond within <span className="text-brand-gold-dark">24 hours</span> with an honest scope, timeline, and next steps.
                    </p>
                    <p className="font-sans text-sm text-brand-muted font-light">
                      Project urgent? Call <a href="tel:7055003581" onClick={() => trackCall('contact_success_phone')} className="text-brand-gold-dark hover:underline">(705) 500-3581</a> directly.
                    </p>
                  </div>
                ) : (
                  <form
                    name="contact"
                    method="POST"
                    onSubmit={onSubmit}
                    className="space-y-10"
                    noValidate
                  >
                    <input type="hidden" name="form-name" value="contact" />
                    <p className="hidden">
                      <label>Don't fill this out: <input name="bot-field" onChange={onChange} /></label>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-4">
                        <label className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-normal">Full Name *</label>
                        <input
                          type="text"
                          name="name"
                          required
                          value={form.name}
                          onChange={onChange}
                          className="w-full bg-brand-nearblack border-b-2 border-brand-dim p-4 font-sans text-brand-bonewhite placeholder:text-brand-muted/70 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-colors font-light"
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-normal">Phone Number *</label>
                        <input
                          type="tel"
                          name="phone"
                          required
                          value={form.phone}
                          onChange={onChange}
                          className="w-full bg-brand-nearblack border-b-2 border-brand-dim p-4 font-sans text-brand-bonewhite placeholder:text-brand-muted/70 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-colors font-light"
                          placeholder="(705) 500-3581"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-normal">Email Address *</label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={form.email}
                        onChange={onChange}
                        className="w-full bg-brand-nearblack border-b-2 border-brand-dim p-4 font-sans text-brand-bonewhite placeholder:text-brand-muted/70 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-colors font-light"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-normal">Service Interest</label>
                      <div className="relative">
                      <select
                        name="service"
                        value={form.service}
                        onChange={onChange}
                        className="w-full bg-brand-nearblack border-b-2 border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-colors appearance-none cursor-pointer font-light"
                      >
                        <option>Backyard Outdoor Living / Premium Patio</option>
                        <option>Patio + Retaining Wall / Steps / Drainage</option>
                        <option>Sloped Backyard / Retaining Wall Solution</option>
                        <option>Premium Patio Rebuild</option>
                        <option>Full Backyard Transformation</option>
                        <option>Front Entrance / Walkway Package</option>
                        <option>Other Hardscape Project</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-gold-dark pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted font-normal">Investment range (optional)</label>
                      <div className="relative">
                      <select
                        name="budget"
                        value={form.budget}
                        onChange={onChange}
                        className="w-full bg-brand-nearblack border-b-2 border-brand-dim p-4 font-sans text-brand-bonewhite focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-colors appearance-none cursor-pointer font-light"
                      >
                        <option value="" disabled>Choose a ballpark…</option>
                        <option value="under-25k">Under $25k</option>
                        <option value="25k-50k">$25k – $50k</option>
                        <option value="50k-100k">$50k – $100k</option>
                        <option value="100k-250k">$100k – $250k</option>
                        <option value="250k+">$250k+</option>
                        <option value="unsure">Not sure yet</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-gold-dark pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="font-sans text-xs uppercase tracking-[0.25em] text-brand-muted font-normal">Project Details</label>
                      <textarea
                        name="details"
                        rows={4}
                        value={form.details}
                        onChange={onChange}
                        className="w-full bg-brand-nearblack border-b-2 border-brand-dim p-4 font-sans text-brand-bonewhite placeholder:text-brand-muted/70 focus:border-brand-gold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 transition-colors font-light text-base"
                        placeholder="Tell us about your project goals and timeline..."
                      />
                    </div>
                    {status === 'error' && (
                      <p className="font-sans text-sm text-brand-error font-light">{errorMsg}</p>
                    )}
                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="btn-primary w-full py-6 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status === 'submitting' ? 'Sending…' : 'Send My Project Details'}
                    </button>
                    <div className="flex items-start justify-center gap-3 pt-2 text-[11px] text-brand-muted font-light leading-relaxed">
                      <Shield size={14} className="text-brand-gold-dark/70 shrink-0 mt-px" strokeWidth={1.5} />
                      <span>We only contact you about your project. No spam, ever — and we never share your information.</span>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-20"
            >
              <div className="space-y-16">
                <h2 className="font-display text-3xl font-light text-brand-bonewhite leading-tight">Get in Touch</h2>
                <div className="space-y-12">
                  <div className="flex items-start gap-10">
                    <div className="bg-brand-gold/5 p-6 rounded-[2px] border border-brand-gold/10">
                      <MapPin size={24} className="text-brand-gold-dark" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-3">Our Location</h3>
                      <p className="font-sans text-brand-muted font-light">Barrie, Ontario, Canada</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-10">
                    <div className="bg-brand-gold/5 p-6 rounded-[2px] border border-brand-gold/10">
                      <Phone size={24} className="text-brand-gold-dark" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-3">Phone</h3>
                      <a href="tel:7055003581" onClick={() => trackCall('contact_direct_line')} className="font-sans text-brand-muted hover:text-brand-gold-dark transition-colors font-normal">(705) 500-3581</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-10">
                    <div className="bg-brand-gold/5 p-6 rounded-[2px] border border-brand-gold/10">
                      <Mail size={24} className="text-brand-gold-dark" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-3">Email</h3>
                      <a href="mailto:yorkis@goldenmaplelandscaping.ca" className="font-sans text-brand-muted hover:text-brand-gold-dark transition-colors font-normal">yorkis@goldenmaplelandscaping.ca</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-10">
                    <div className="bg-brand-gold/5 p-6 rounded-[2px] border border-brand-gold/10">
                      <Clock size={24} className="text-brand-gold-dark" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-3">Hours</h3>
                      <p className="font-sans text-brand-muted font-light">Mon - Fri: 8:00 AM - 6:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10">
                <h3 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">Our Credentials</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <div className="flex items-center gap-4 font-sans text-xs uppercase tracking-[0.2em] text-brand-bonewhite font-normal">
                    <Shield size={18} className="text-brand-gold-dark" strokeWidth={1.5} /> WSIB Certified
                  </div>
                  <div className="flex items-center gap-4 font-sans text-xs uppercase tracking-[0.2em] text-brand-bonewhite font-normal">
                    <Award size={18} className="text-brand-gold-dark" strokeWidth={1.5} /> $5M Liability
                  </div>
                  <div className="flex items-center gap-4 font-sans text-xs uppercase tracking-[0.2em] text-brand-bonewhite font-normal">
                    <CheckCircle size={18} className="text-brand-gold-dark" strokeWidth={1.5} /> 5-Year Structural Warranty
                  </div>
                  <div className="flex items-center gap-4 font-sans text-xs uppercase tracking-[0.2em] text-brand-bonewhite font-normal">
                    <CheckCircle size={18} className="text-brand-gold-dark" strokeWidth={1.5} /> Engineering Standard
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="h-[600px] w-full rounded-[2px] overflow-hidden shadow-2xl border border-brand-dim/10 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-1000">
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d91063.15933010724!2d-79.761214!3d44.389355!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x882aa346f368739d%3A0x279169666518a38!2sBarrie%2C%20ON!5e0!3m2!1sen!2sca!4v1710950000000!5m2!1sen!2sca" 
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Golden Maple Landscaping Location in Barrie ON"
            ></iframe>
          </div>
        </div>
      </section>
    </div>
  );
}
