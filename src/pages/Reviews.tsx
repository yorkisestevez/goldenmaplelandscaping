import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import GoogleReviewsLink from '../components/GoogleReviewsLink';
import { publicContact } from '../data/business';
import { trackCall } from '../utils/analytics';

/**
 * Reviews live on Google. This page does not invent excerpts, names, counts, or a rating.
 * When googleRating and googleReviewCount are filled in src/data/ownerFacts.ts, the link label updates.
 */
export default function Reviews() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Google Reviews | Golden Maple Landscaping Barrie"
        description="Read Golden Maple Landscaping reviews on Google. We don't republish review text on this site."
        canonical="https://goldenmaplelandscaping.ca/reviews/"
      />
      <section className="section-padding pt-32 md:pt-48">
        <div className="container-custom max-w-3xl">
          <p className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6">Barrie · Simcoe County</p>
          <h1 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite leading-tight mb-8">
            Our reviews are on <span className="italic text-brand-gold-dark">Google.</span>
          </h1>
          <p className="font-sans text-lg text-brand-muted font-light leading-relaxed mb-6">
            Golden Maple builds interlocking patios and driveways, retaining walls, and composite decks for homeowners in Barrie and nearby towns. Homeowner reviews are published on our Google listing, not rewritten here.
          </p>
          <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-10">
            This page does not show star counts or quotations until those details are confirmed for the site. Use the link below to read the reviews on Google.
          </p>
          <GoogleReviewsLink className="btn-primary inline-flex" />
          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link to="/contact" className="btn-ghost">Get my free estimate</Link>
            <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('reviews_phone')} className="btn-ghost">
              Call {publicContact.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
