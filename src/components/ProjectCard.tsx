import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CARD_SIZES, projectCover, type ProjectRecord } from '../data/projects';
import ResponsiveImage from './ResponsiveImage';
import Reveal from './Reveal';

export interface ProjectCardProps {
  project: ProjectRecord;
  sizes?: string;
  priority?: boolean;
  delay?: number;
}

/**
 * Portfolio card: 4:3 cover, then text BELOW the photo (never over it — the
 * contrast audit ignores gradients, and captions on the surface read better).
 */
export default function ProjectCard({ project, sizes = CARD_SIZES, priority = false, delay = 0 }: ProjectCardProps) {
  return (
    <Reveal delay={delay}>
      <Link to={`/portfolio/${project.slug}`} className="group block">
        <div className="mb-6 overflow-hidden rounded-[2px] border border-brand-dim/40 bg-brand-surface">
          <ResponsiveImage
            image={projectCover(project)}
            sizes={sizes}
            aspect="4/3"
            priority={priority}
            className="transition-transform duration-700 motion-safe:group-hover:scale-[1.03]"
          />
        </div>
        <span className="mb-3 block font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark">
          {project.category}
        </span>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-2xl font-light leading-tight text-brand-ink transition-colors group-hover:text-brand-gold-dark md:text-3xl">
            {project.title}
          </h3>
          <ArrowRight size={18} className="mt-2 shrink-0 text-brand-gold-dark" aria-hidden="true" />
        </div>
        <p className="mt-2 font-sans text-sm font-light text-brand-muted">{project.town}, ON</p>
      </Link>
    </Reveal>
  );
}
