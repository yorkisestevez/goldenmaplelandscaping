import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Reveal from '../../Reveal';
import ResponsiveImage from '../../ResponsiveImage';
import { FEATURED_PROJECTS, projectCover } from '../../../data/projects';

const SelectedWork = () => (
  <section id="selected-work" className="section-padding bg-brand-cream-light scroll-mt-24">
    <div className="container-custom">
      <Reveal className="text-center max-w-3xl mx-auto mb-12 md:mb-24">
        <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
          Selected work
        </span>
        <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite">
          Recent work, up close.
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 lg:gap-12 mb-14 md:mb-20">
        {FEATURED_PROJECTS.map((project, idx) => (
          <Reveal key={project.slug} delay={idx * 0.1}>
            <Link to={`/portfolio/${project.slug}`} className="group flex flex-col">
              <div className="rounded-2xl overflow-hidden border border-brand-dim/40 bg-brand-surface mb-6 md:mb-10">
                <ResponsiveImage
                  image={projectCover(project)}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  aspect="4/3"
                  whenVisible
                  className="transition-transform duration-1000 motion-safe:group-hover:scale-[1.04]"
                />
              </div>
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark mb-4 block">
                {project.category}
              </span>
              <h3 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite leading-tight mb-6 group-hover:text-brand-gold-dark transition-colors">
                {project.title}
              </h3>
              <p className="font-sans text-brand-muted leading-relaxed font-light mb-6">
                {project.summary}
              </p>
              <div className="flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-bonewhite/80">
                <CheckCircle size={14} strokeWidth={1.5} className="text-brand-gold-dark shrink-0" aria-hidden="true" />
                Completed project · {project.town}, ON
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
      <Reveal className="text-center">
        <Link to="/portfolio" className="btn-ghost">View all projects</Link>
      </Reveal>
    </div>
  </section>
);

export default SelectedWork;
