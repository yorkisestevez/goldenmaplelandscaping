import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Download } from 'lucide-react';
import SEO from '../components/SEO';
import { publicContact } from '../data/business';
import { trackCall } from '../utils/analytics';
import { bookingSearch } from '../utils/bookingPrefill';

const DOWNLOADS: Record<string, { href: string; filename: string; label: string }> = {
  'cost-guide': {
    href: '/downloads/2026-simcoe-county-backyard-cost-guide.pdf',
    filename: '2026-simcoe-county-backyard-cost-guide.pdf',
    label: 'Download the cost guide',
  },
  'guide-download': {
    href: '/downloads/golden-maple-buyers-guide.pdf',
    filename: 'golden-maple-buyers-guide.pdf',
    label: 'Download the buyer\'s guide',
  },
};

/** Destination URL after a successful lead form. Conversion events fire before this navigation. */
export default function ThankYou() {
  const [params] = useSearchParams();
  const form = params.get('form') ?? 'contact';
  const download = DOWNLOADS[form];
  const bookHref = bookingSearch({
    name: params.get('name') ?? '',
    phone: params.get('phone') ?? '',
    email: params.get('email') ?? '',
    service: params.get('service') ?? '',
  });

  useEffect(() => {
    if (!download) return;
    const timer = window.setTimeout(() => {
      const link = document.createElement('a');
      link.href = download.href;
      link.download = download.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [download]);

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Thanks — we have your project details"
        description="Golden Maple Landscaping received your project details. Call if you would rather talk it through."
        canonical="https://goldenmaplelandscaping.ca/thank-you/"
        noindex
      />
      <section className="section-padding pt-32 md:pt-48">
        <div className="container-custom max-w-2xl text-center">
          <div className="mx-auto w-16 h-16 rounded-full border border-brand-gold flex items-center justify-center mb-8">
            <CheckCircle size={28} className="text-brand-gold-dark" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite leading-tight mb-6">
            Thanks. We have <span className="italic text-brand-gold-dark">your details.</span>
          </h1>
          <p className="font-sans text-base md:text-lg text-brand-muted font-light leading-relaxed mb-8">
            Yorkis reviews project requests for Barrie and the surrounding towns. Pick a time for a call, or phone {publicContact.phoneDisplay} if you would rather talk now.
          </p>
          {download && (
            <a href={download.href} download className="btn-primary inline-flex items-center gap-3 mb-8">
              <Download size={16} aria-hidden="true" /> {download.label}
            </a>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={bookHref} className="btn-primary">Pick a call time</Link>
            <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('thank_you_phone')} className="btn-ghost">
              Call {publicContact.phoneDisplay}
            </a>
            <Link to="/portfolio" className="btn-ghost">See recent projects</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
