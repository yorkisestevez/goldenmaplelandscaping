import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import SEO from '../components/SEO';
import { publicContact } from '../data/business';

/** Branded 404. Prerendered to /404/index.html and copied to /404.html so Netlify can return status 404. */
export default function NotFound() {
  return (
    <section className="section-padding bg-brand-nearblack">
      <SEO
        title="Page not found"
        description="That page is not on the Golden Maple Landscaping site. Call the office or request an estimate and we will point you to the right page."
        noindex
      />
      <div className="container-custom max-w-2xl pt-16">
        <p className="text-[10px] uppercase tracking-[0.22em] text-brand-gold-dark font-medium mb-6">404</p>
        <h1 className="font-display text-5xl md:text-7xl font-light text-brand-ink mb-8">Page not found</h1>
        <p className="text-brand-muted mb-10 leading-relaxed">
          The page you requested is not available. You can return home, call the office, or request an estimate.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/" className="btn-primary">Back to home</Link>
          <Link to="/contact" className="btn-secondary">Request an estimate</Link>
          <a href={`tel:${publicContact.phoneTel}`} className="inline-flex items-center gap-2 font-sans text-sm text-brand-ink">
            <Phone size={16} aria-hidden="true" />
            {publicContact.phoneDisplay}
          </a>
        </div>
      </div>
    </section>
  );
}
