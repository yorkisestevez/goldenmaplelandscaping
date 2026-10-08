import LeadForm from './LeadForm';
import { publicContact } from '../data/business';

/** Homepage-style contact form. Kept for any page that still mounts it. */
export default function HeroContactForm() {
  return (
    <div className="min-w-0">
      <LeadForm
        formName="contact"
        source="hero"
        idPrefix="hero-contact"
        submitLabel="Get my estimate"
        heading="Tell us about the project"
        intro={`Or call ${publicContact.phoneDisplay}.`}
      />
    </div>
  );
}
