import GoogleReviewsLink from '../../GoogleReviewsLink';

const GoogleReviews = () => (
  <section className="section-padding bg-brand-cream">
    <div className="container-custom text-center max-w-2xl mx-auto">
      <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-green-dark mb-6 block font-medium">
        Reviews
      </span>
      <h2 className="font-display text-4xl md:text-6xl font-light text-brand-ink mb-8">
        Read what homeowners wrote on Google.
      </h2>
      <p className="font-sans text-base text-brand-ink-soft font-light leading-relaxed mb-8">
        We don&apos;t reprint reviews on this site. The current comments, photos, and rating live on our Google listing.
      </p>
      <GoogleReviewsLink className="btn-primary inline-flex" />
    </div>
  </section>
);

export default GoogleReviews;
