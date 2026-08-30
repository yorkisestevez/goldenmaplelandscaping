import SEO from '../components/SEO';
import { trackCall } from '../utils/analytics';

export default function Terms() {
  return (
    <>
      <SEO
        title="Terms of Use | Golden Maple Landscaping"
        description="Terms of use for goldenmaplelandscaping.ca and Golden Maple Landscaping services."
        canonical="https://goldenmaplelandscaping.ca/terms"
      />
      <div className="bg-brand-nearblack min-h-screen pt-32 pb-24">
        <div className="container-custom max-w-3xl">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">Legal</span>
          <h1 className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite mb-4">Terms of Use</h1>
          <p className="font-sans text-sm text-brand-muted mb-16 font-light">Last updated: May 2026</p>

          <div className="prose prose-invert prose-brand max-w-none font-sans font-light text-brand-muted leading-relaxed space-y-6">
            <p>
              These terms govern your use of goldenmaplelandscaping.ca (the "Site") operated by Golden Maple Landscaping ("we", "us", "our"). By using the Site you agree to these terms. If you do not agree, please do not use the Site.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Use of the Site</h2>
            <p>
              You may use the Site for personal, non-commercial purposes — to learn about our services, request a quote, or book a consultation. You agree not to use the Site for any unlawful purpose, to scrape content at scale, or to interfere with site security.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Estimates and pricing</h2>
            <p>
              The cost estimator and any pricing shown on the Site provide ballpark ranges only. Final pricing is set in a written quote after we measure your site and confirm scope, materials, and conditions. Nothing on the Site is a binding offer or contract.
            </p>
            <p>
              We update pricing periodically. Past quotes do not bind us to current pricing for new projects.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Intellectual property</h2>
            <p>
              All content on the Site — text, photos, illustrations, logos, design — is owned by Golden Maple Landscaping or used under license. You may share links to our pages and quote brief excerpts with attribution; you may not copy, republish, or use our content commercially without written permission.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Project photos</h2>
            <p>
              Project photos shown on the Site are real Golden Maple Landscaping installations or licensed product imagery from our material partners (Techo-Bloc, Unilock, Permacon, Trex, TimberTech, Porcea, Oakville Stone). Where we show a partner-provided product photo, we credit the manufacturer.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Third-party links</h2>
            <p>
              The Site may link to third-party websites (review platforms, manufacturer pages, social media). We don't control those sites and aren't responsible for their content or practices.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Reviews and testimonials</h2>
            <p>
              Reviews and testimonials shown on the Site are real customer feedback collected from Google, Houzz, or directly from clients with their permission. Individual project results vary based on site, materials, and scope.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Limitation of liability</h2>
            <p>
              The Site and its content are provided "as is" without warranty of any kind. To the fullest extent permitted by law, Golden Maple Landscaping is not liable for any indirect, incidental, or consequential damages arising from your use of the Site. This does not limit any warranties or obligations under a signed construction contract.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Governing law</h2>
            <p>
              These terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable in Ontario. Any dispute will be resolved in the courts of Simcoe County, Ontario.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Changes to these terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the Site after an update means you accept the revised terms. Material changes will be flagged on this page.
            </p>

            <h2 className="font-display text-2xl text-brand-bonewhite mt-12 mb-4">Contact</h2>
            <p>
              Questions about these terms: <a href="mailto:yorkis@goldenmaplelandscaping.ca" className="text-brand-gold-dark hover:underline">yorkis@goldenmaplelandscaping.ca</a><br />
              Phone: <a href="tel:7055003581" onClick={() => trackCall('terms_phone')} className="text-brand-gold-dark hover:underline">(705) 500-3581</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
