import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ProjectCard from './ProjectCard';
import { BUSINESS, canPublish } from '../data/business';
import { projectsInCategory, type ProjectCategory } from '../data/projects';

/**
 * Owner-attested Golden Maple jobs in the given portfolio categories — the
 * first-hand proof block for service pages. Renders nothing when the portfolio
 * register isn't publishable or no attested job exists in those categories, so a
 * page never borrows a catalogue or AI image as "our work".
 */
export default function RelatedProjects({ categories, heading, limit = 3 }: { categories: readonly ProjectCategory[]; heading: string; limit?: number }) {
  const verified = canPublish(BUSINESS.reviews.portfolio) && canPublish(BUSINESS.reviews.photoRights);
  const projects = verified ? categories.flatMap((c) => projectsInCategory(c)).slice(0, limit) : [];
  if (projects.length === 0) return null;

  return (
    <section className="mb-32" aria-labelledby="related-projects-heading">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
        <h2 id="related-projects-heading" className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite leading-tight">{heading}</h2>
        <Link to="/portfolio" className="flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold-dark transition-colors">
          Full portfolio <ArrowRight size={16} strokeWidth={1.5} />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
        {projects.map((p, i) => <ProjectCard key={p.slug} project={p} delay={i * 0.06} />)}
      </div>
    </section>
  );
}
