import { useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import GoogleReviewsLink from '../components/GoogleReviewsLink';
import BookingScheduler from '../components/BookingScheduler';

export default function Book() {
  const [params] = useSearchParams();
  const fromEstimator = params.get('from') === 'estimator';
  const low = params.get('low');
  const high = params.get('high');
  const project = params.get('project');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Book a Project Conversation',
    description:
      'Pick a time to discuss your project and confirm the current consultation scope.',
    url: 'https://goldenmaplelandscaping.ca/book/',
  };

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Book a Project Conversation | Golden Maple Landscaping"
        description="Pick a time to discuss your project and confirm the current consultation scope."
        canonical="https://goldenmaplelandscaping.ca/book"
        schema={schema}
      />

      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
              Project Conversation
            </span>

            <h1 className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-12">
              Pick a time <br />
              <span className="italic text-brand-gold-dark">that works for you.</span>
            </h1>

            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed font-light max-w-xl mx-auto">
              Use the scheduler to request a project conversation. We will confirm the current consultation, site-visit, design, and project-scope details directly.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {fromEstimator && (
              <p className="font-sans text-sm text-brand-bonewhite bg-brand-surface border border-brand-gold/30 rounded-[2px] p-4 mb-6 text-left">
                Site visit requested with your estimator
                {project ? ` (${project}` : ''}
                {low && high ? `${project ? ', ' : ' ('}$${Number(low).toLocaleString('en-CA')}–$${Number(high).toLocaleString('en-CA')}` : ''}
                {project || (low && high) ? ').' : '.'} The scheduler below is the same booking form. It does not confirm the visit until someone replies.
              </p>
            )}
            <BookingScheduler />
          </div>

          <div className="max-w-4xl mx-auto mt-20 pt-16 border-t border-brand-dim/20 text-center">
            <GoogleReviewsLink className="font-sans text-sm text-brand-gold-dark underline underline-offset-2" />
          </div>
        </div>
      </section>
    </div>
  );
}
