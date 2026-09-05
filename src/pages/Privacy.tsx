import SEO from '../components/SEO';
import { trackCall } from '../utils/analytics';
import { publicContact } from '../data/business';

export default function Privacy() {
  return (
    <>
      <SEO
        title="Privacy Policy | Golden Maple Landscaping"
        description="How Golden Maple Landscaping collects, uses, and protects your personal information."
        canonical="https://goldenmaplelandscaping.ca/privacy"
      />
      <div className="bg-brand-nearblack min-h-screen pt-32 pb-24">
        <div className="container-custom max-w-3xl">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">Legal</span>
          <h1 className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite mb-4">Privacy Policy</h1>
          <p className="font-sans text-sm text-brand-muted mb-16 font-light">Last updated: May 2026</p>

          <div className="prose prose-invert prose-brand max-w-none font-sans font-light text-brand-muted leading-relaxed space-y-6">
            <p>
              Golden Maple Landscaping ("we", "us", "our") respects your privacy. This policy explains what personal information we collect, how we use it, and the choices you have. By using goldenmaplelandscaping.ca you agree to this policy.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">What we collect</h2>
            <ul className="space-y-2 list-disc pl-6">
              <li><strong className="text-brand-bonewhite">Information you give us:</strong> name, phone, email, project details, and mailing address, via our forms or cost estimator.</li>
              <li><strong className="text-brand-bonewhite">Marketing attribution:</strong> referring URL, landing page, and click-tracking parameters (utm_source, utm_medium, utm_campaign, gclid, fbclid) so we can measure which channels send qualified leads.</li>
              <li><strong className="text-brand-bonewhite">Site behavior:</strong> pages visited, time on each page, scrolls, clicks, and visitor session recordings via Microsoft Clarity. We use this to improve the site, never to identify you personally.</li>
              <li><strong className="text-brand-bonewhite">Analytics identifiers:</strong> Google Analytics 4 client ID and Meta Pixel browser ID for aggregate measurement.</li>
            </ul>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">How we use your information</h2>
            <ul className="space-y-2 list-disc pl-6">
              <li>To respond to your project inquiry, schedule consultations, and send quotes.</li>
              <li>To send you the cost estimates, guides, or other materials you've requested.</li>
              <li>To improve our services and the website experience.</li>
              <li>To measure and optimize advertising performance.</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Who we share with</h2>
            <p>We share limited data with vetted service providers who help us run the business:</p>
            <ul className="space-y-2 list-disc pl-6">
              <li><strong className="text-brand-bonewhite">Netlify</strong> — hosts the website and processes form submissions.</li>
              <li><strong className="text-brand-bonewhite">Google (Analytics & Ads)</strong> — measures site traffic and ad conversions.</li>
              <li><strong className="text-brand-bonewhite">Meta (Facebook/Instagram)</strong> — measures ad conversions via the Meta Pixel.</li>
              <li><strong className="text-brand-bonewhite">Microsoft Clarity</strong> — anonymous heatmaps and session recordings for site improvement.</li>
              <li><strong className="text-brand-bonewhite">Our internal CRM</strong> — stores leads and project records for our team only.</li>
            </ul>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Cookies and tracking</h2>
            <p>
              We use cookies and similar technologies for essential site functionality, analytics, and marketing measurement. You can disable cookies via your browser settings; some features (forms, attribution) may not work fully if you do.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Your rights</h2>
            <p>
              Under Canadian privacy law (PIPEDA), you can request access to the personal information we hold about you, ask us to correct it, or request its deletion. Email <a href={`mailto:${publicContact.email}`} className="text-brand-gold-dark hover:underline">{publicContact.email}</a> and we'll respond within 30 days.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Data retention</h2>
            <p>
              We retain inquiry data for up to 3 years after our last contact with you, unless you ask us to delete it sooner. Project records for completed work are retained for 7 years for warranty and tax purposes.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Contact</h2>
            <p>
              Privacy questions: <a href={`mailto:${publicContact.email}`} className="text-brand-gold-dark hover:underline">{publicContact.email}</a><br />
              Phone: <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('privacy_phone')} className="text-brand-gold-dark hover:underline">{publicContact.phoneDisplay}</a><br />
              Mail: Golden Maple Landscaping, Barrie, ON, Canada
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
