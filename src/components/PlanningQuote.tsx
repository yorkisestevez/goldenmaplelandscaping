import { Link } from 'react-router-dom';
import LeadForm from './LeadForm';
import ResponsiveImage from './ResponsiveImage';
import { BUSINESS, canPublish } from '../data/business';
import { projectCover, projectsInCategory, type ProjectCategory } from '../data/projects';

/**
 * Inline quick quote, an existing planning range, and real portfolio photos.
 * Rates passed in must already be published elsewhere. This component does not invent prices or photos.
 */
export default function PlanningQuote({
  source,
  rate,
  rateDetail = 'per square foot installed. A planning range, not a quote for your property.',
  categories = [],
  defaultService = '',
  repairHref,
}: {
  source: string;
  rate?: string;
  rateDetail?: string;
  categories?: readonly ProjectCategory[];
  defaultService?: string;
  repairHref?: string;
}) {
  const verified = canPublish(BUSINESS.reviews.portfolio) && canPublish(BUSINESS.reviews.photoRights);
  const photos = verified
    ? categories.flatMap((category) => projectsInCategory(category)).slice(0, 6)
    : [];

  return (
    <section className="bg-brand-surface border border-brand-dim/40 rounded-[2px] p-5 md:p-8 mb-12" aria-label="Quick quote">
      {rate && (
        <p className="mb-6">
          <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-brand-gold-dark block mb-2">Planning range</span>
          <span className="font-display text-4xl text-brand-bonewhite">{rate}</span>
          <span className="block font-sans text-sm text-brand-muted font-light mt-2">{rateDetail}</span>
        </p>
      )}
      {repairHref && (
        <p className="font-sans text-sm text-brand-muted font-light mb-6">
          Sinking or uneven interlock is a repair and re-level question.{' '}
          <Link to={repairHref} className="text-brand-gold-dark underline underline-offset-2">See patio rebuilds in Barrie</Link>.
        </p>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-6">
          {photos.map((project) => (
            <Link key={project.slug} to={`/portfolio/${project.slug}`} className="block aspect-[4/3] overflow-hidden rounded-[2px]">
              <ResponsiveImage image={projectCover(project)} sizes="(min-width: 768px) 18vw, 30vw" aspect="fill" className="h-full w-full object-cover" />
            </Link>
          ))}
        </div>
      )}
      <LeadForm
        formName="quick-quote"
        source={source}
        idPrefix={`qq-${source.replace(/[^a-z0-9]+/gi, '-')}`}
        submitLabel="Send my quick quote"
        heading="Tell us about the project"
        defaultService={defaultService}
      />
    </section>
  );
}
