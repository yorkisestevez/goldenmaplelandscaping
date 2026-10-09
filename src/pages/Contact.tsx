import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import SEO from '../components/SEO';
import LeadForm from '../components/LeadForm';
import GoogleReviewsLink from '../components/GoogleReviewsLink';
import { publicContact } from '../data/business';
import { OWNER_FACTS, ownerFact } from '../data/ownerFacts';
import { trackCall } from '../utils/analytics';

export default function Contact() {
  const extraHours = ownerFact(OWNER_FACTS.extraHours);

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Contact Golden Maple | Patios, Walls & Decks in Barrie"
        description="Send a short project form for interlocking, retaining walls, or composite decks in Barrie and Simcoe County."
        canonical="https://goldenmaplelandscaping.ca/contact"
      />
      <section className="pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="container-custom">
          <div className="max-w-3xl mb-8 md:mb-12">
            <p className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-4">
              Get an estimate
            </p>
            <h1 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite leading-[1.05] mb-4">
              Tell us what you want built.
            </h1>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light">
              Name, a phone number or email, and the project type are enough to start. Town, timing, notes, and photos are optional on the next step. Yorkis reviews the request and replies about scope.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-7 bg-brand-surface p-5 sm:p-8 md:p-10 rounded-[2px] border border-brand-dim/10 min-w-0">
              <LeadForm
                formName="contact"
                source="contact-page"
                idPrefix="contact"
                submitLabel="Send my project"
                heading="Project form"
              />
            </div>

            <aside className="lg:col-span-5 space-y-8 min-w-0">
              <div className="space-y-6">
                <h2 className="font-display text-2xl font-light text-brand-bonewhite">Talk to us directly</h2>
                <Link to="/book" className="btn-secondary inline-flex">Book a call</Link>
                <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('contact_direct_line')} className="flex items-start gap-4 min-w-0">
                  <Phone size={20} className="text-brand-gold-dark shrink-0 mt-1" strokeWidth={1.5} />
                  <span>
                    <span className="block font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted">Phone</span>
                    <span className="font-sans text-lg text-brand-bonewhite">{publicContact.phoneDisplay}</span>
                  </span>
                </a>
                <a href={`mailto:${publicContact.email}`} className="flex items-start gap-4 min-w-0">
                  <Mail size={20} className="text-brand-gold-dark shrink-0 mt-1" strokeWidth={1.5} />
                  <span className="min-w-0">
                    <span className="block font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted">Email</span>
                    <span className="font-sans text-base text-brand-bonewhite break-all">{publicContact.email}</span>
                  </span>
                </a>
                <div className="flex items-start gap-4">
                  <MapPin size={20} className="text-brand-gold-dark shrink-0 mt-1" strokeWidth={1.5} />
                  <span>
                    <span className="block font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted">Where we build</span>
                    <span className="font-sans text-base text-brand-bonewhite">Barrie and Simcoe County, Ontario</span>
                  </span>
                </div>
                <div className="flex items-start gap-4">
                  <Clock size={20} className="text-brand-gold-dark shrink-0 mt-1" strokeWidth={1.5} />
                  <span>
                    <span className="block font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted">Office hours</span>
                    <span className="font-sans text-base text-brand-bonewhite">Monday–Friday, 8:00 AM–6:00 PM</span>
                    {extraHours && <span className="block font-sans text-sm text-brand-muted mt-1">{extraHours}</span>}
                  </span>
                </div>
              </div>
              <GoogleReviewsLink className="font-sans text-sm text-brand-gold-dark underline underline-offset-2" />
            </aside>
          </div>

          <div className="mt-12 h-64 md:h-80 w-full rounded-[2px] overflow-hidden border border-brand-dim/10">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d91063.15933010724!2d-79.761214!3d44.389355!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x882aa346f368739d%3A0x279169666518a38!2sBarrie%2C%20ON!5e0!3m2!1sen!2sca!4v1710950000000!5m2!1sen!2sca"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Barrie area map — not a Golden Maple office location"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
