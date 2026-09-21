import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Instagram, MapPin } from 'lucide-react';
import SEO from '../components/SEO';
import Reveal from '../components/Reveal';
import ResponsiveImage from '../components/ResponsiveImage';
import PhotoGrid from '../components/PhotoGrid';
import ProjectCard from '../components/ProjectCard';
import { BUSINESS, canPublish } from '../data/business';
import { FULL_SIZES, PROJECTS, getProject, projectCoverFull, projectPhotos, projectsInCategory } from '../data/projects';

export default function ProjectDetail() {
  const { slug } = useParams();
  const project = slug ? getProject(slug) : undefined;
  const portfolioVerified = canPublish(BUSINESS.reviews.portfolio) && canPublish(BUSINESS.reviews.photoRights);

  if (!project) {
    return (
      <div className="bg-brand-nearblack min-h-screen flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="font-display text-4xl text-brand-ink mb-6">Project not found</h1>
          <Link to="/portfolio" className="btn-primary">Back to the portfolio</Link>
        </div>
      </div>
    );
  }

  const canonical = `${BUSINESS.canonicalUrl}/portfolio/${project.slug}`;

  if (!portfolioVerified) {
    return (
      <div className="bg-brand-nearblack min-h-screen">
        <SEO title="Project photos | Golden Maple" description="Ask us for examples that match your property and the work you are planning." canonical={canonical} />
        <section className="section-padding pt-40 md:pt-48">
          <div className="container-custom max-w-4xl">
            <Link to="/portfolio" className="inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-ink transition-colors mb-12"><ArrowLeft size={14} strokeWidth={2} aria-hidden="true" /> All projects</Link>
            <h1 className="font-display text-4xl md:text-7xl font-light text-brand-ink leading-[1.1] mb-10">Project photos are being prepared.</h1>
            <div className="bg-brand-surface border-l-2 border-brand-gold p-10 rounded-[2px]">
              <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">Ask us for examples that match your property and the work you are planning.</p>
              <Link to="/contact" className="btn-primary inline-block mt-10">Start a project conversation</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const idx = PROJECTS.findIndex((p) => p.slug === project.slug);
  const prev = idx > 0 ? PROJECTS[idx - 1] : undefined;
  const next = idx < PROJECTS.length - 1 ? PROJECTS[idx + 1] : undefined;
  const cover = projectCoverFull(project);
  const photos = projectPhotos(project);
  const related = projectsInCategory(project.category).filter((p) => p.slug !== project.slug).slice(0, 3);
  const absolute = (src: string) => `${BUSINESS.canonicalUrl}${src}`;

  const gallerySchema = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `${project.title} — ${project.town}, ON`,
    description: project.summary,
    url: `${canonical}/`,
    primaryImageOfPage: { '@type': 'ImageObject', contentUrl: absolute(cover.src), width: cover.width, height: cover.height, name: cover.alt },
    associatedMedia: photos.map((img) => ({ '@type': 'ImageObject', contentUrl: absolute(img.src), width: img.width, height: img.height, name: img.alt })),
    provider: { '@id': `${BUSINESS.canonicalUrl}/#business` },
  };

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title={`${project.title} | ${project.category} in ${project.town}`}
        description={project.summary}
        canonical={canonical}
        image={absolute(cover.src)}
        schema={gallerySchema}
      />

      <section className="section-padding pt-32 md:pt-48">
        <div className="container-custom">
          <Link to="/portfolio" className="group inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-ink transition-colors mb-12">
            <ArrowLeft size={14} strokeWidth={2} className="group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
            All projects
          </Link>

          <Reveal>
            <div className="flex flex-wrap items-center gap-6 mb-6">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark">{project.category}</span>
              <span className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted">
                <MapPin size={12} strokeWidth={1.5} className="text-brand-gold-dark" aria-hidden="true" /> {project.town}, ON
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-7xl font-light text-brand-ink leading-[1.1] mb-6">{project.title}</h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light max-w-3xl mb-14">{project.summary}</p>
          </Reveal>

          <div className="mb-6 overflow-hidden rounded-[2px] border border-brand-dim/40 bg-brand-surface">
            <ResponsiveImage image={cover} sizes={FULL_SIZES} aspect="3/2" priority />
          </div>

          {photos.length > 1 && (
            <div className="mt-14 mb-6">
              <h2 className="font-display text-3xl font-light text-brand-ink mb-8">Photos from this project</h2>
              <PhotoGrid images={photos} variant="masonry" lightboxLabel={`${project.title} photos`} />
            </div>
          )}

          {project.instagramPermalink && (
            <div className="mt-10">
              <a href={project.instagramPermalink} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center gap-3">
                <Instagram size={16} aria-hidden="true" /> View this project on Instagram
              </a>
            </div>
          )}

          <div className="flex justify-between items-center mt-20 pt-10 border-t border-brand-dim">
            {prev ? (
              <Link to={`/portfolio/${prev.slug}`} className="group flex items-center gap-4 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted hover:text-brand-gold-dark transition-colors">
                <ArrowLeft size={16} strokeWidth={1.5} className="group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
                Previous project
              </Link>
            ) : <div />}
            {next ? (
              <Link to={`/portfolio/${next.slug}`} className="group flex items-center gap-4 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted hover:text-brand-gold-dark transition-colors">
                Next project
                <ArrowRight size={16} strokeWidth={1.5} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </Link>
            ) : <div />}
          </div>

          {related.length > 0 && (
            <div className="mt-24">
              <h2 className="font-display text-3xl font-light text-brand-ink mb-10">More {project.category.toLowerCase()} projects</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
                {related.map((p, i) => <ProjectCard key={p.slug} project={p} delay={i * 0.06} />)}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <Reveal className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-8xl font-light mb-12 leading-tight">
            Your backyard could <br />
            <span className="text-brand-gold italic">be next.</span>
          </h2>
          <p className="font-sans text-lg text-brand-porcelain/80 max-w-2xl mx-auto mb-16 font-light">
            Tell us what you are imagining. Ask about suitable materials, the proposed scope and project examples like this one.
          </p>
          <Link to="/contact" className="btn-primary px-20">Let's Talk About Your Property</Link>
        </Reveal>
      </section>
    </div>
  );
}
