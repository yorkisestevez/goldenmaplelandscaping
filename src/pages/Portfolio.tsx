import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import Reveal from '../components/Reveal';
import ProjectCard from '../components/ProjectCard';
import PhotoGrid from '../components/PhotoGrid';
import { BUSINESS, canPublish } from '../data/business';
import {
  PROJECTS,
  PROJECT_CATEGORIES,
  categoryFromSlug,
  categorySlug,
  projectPhotos,
  type ProjectCategory,
} from '../data/projects';
import { cn } from '../utils/cn';

type View = 'projects' | 'photos';

export default function Portfolio() {
  const portfolioVerified = canPublish(BUSINESS.reviews.portfolio) && canPublish(BUSINESS.reviews.photoRights);
  const [searchParams, setSearchParams] = useSearchParams();

  // URL is the source of truth (?category=…&view=photos) but the FIRST render must
  // match the prerendered HTML, so state starts at the defaults and syncs after mount.
  const [category, setCategory] = useState<ProjectCategory | 'all'>('all');
  const [view, setView] = useState<View>('projects');
  useEffect(() => {
    setCategory(categoryFromSlug(searchParams.get('category')) ?? 'all');
    setView(searchParams.get('view') === 'photos' ? 'photos' : 'projects');
  }, [searchParams]);

  const update = (next: { category?: ProjectCategory | 'all'; view?: View }) => {
    const params = new URLSearchParams(searchParams);
    const c = next.category ?? category;
    const v = next.view ?? view;
    if (c === 'all') params.delete('category'); else params.set('category', categorySlug(c));
    if (v === 'projects') params.delete('view'); else params.set('view', v);
    setSearchParams(params, { replace: true });
  };

  const visibleProjects = category === 'all' ? PROJECTS : PROJECTS.filter((p) => p.category === category);
  const categoriesWithWork = PROJECT_CATEGORIES.filter((c) => PROJECTS.some((p) => p.category === c));
  const allPhotos = visibleProjects.flatMap((p) => projectPhotos(p).map((img) => ({ img, project: p })));

  const listSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Completed landscaping projects by Golden Maple Landscaping',
    itemListElement: PROJECTS.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BUSINESS.canonicalUrl}/portfolio/${p.slug}/`,
      name: p.title,
    })),
  };

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Landscaping Portfolio | Completed Projects in Barrie & Simcoe County"
        description="Photos from patios, walkways, retaining walls, driveways and decks Golden Maple Landscaping has completed around Barrie, Midhurst and Simcoe County."
        canonical="https://goldenmaplelandscaping.ca/portfolio"
        schema={portfolioVerified ? listSchema : undefined}
      />

      <section className="section-padding pt-40 md:pt-48">
        <div className="container-custom">
          <Reveal className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
              Completed work
            </span>
            <h1 className="font-display text-5xl md:text-8xl font-light text-brand-ink leading-[1.05] mb-10">
              Built in Barrie <br />
              <span className="italic text-brand-gold-dark">and Simcoe County.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
              Photos from projects we have completed around Barrie, Midhurst and Simcoe County. Filter by the kind of work you are planning, or browse every photo.
            </p>
          </Reveal>

          {!portfolioVerified ? (
            <Reveal className="max-w-3xl mx-auto mb-32">
              <div className="bg-brand-surface border-l-2 border-brand-gold p-10 rounded-[2px]">
                <h2 className="font-display text-3xl font-light text-brand-ink mb-4">Project photos are being prepared.</h2>
                <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
                  Ask us for examples that match your property and the work you are planning.
                </p>
                <Link to="/contact" className="btn-primary inline-block mt-10">Start a project conversation</Link>
              </div>
            </Reveal>
          ) : (
            <>
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-12">
                <div role="group" aria-label="Filter projects by category" className="flex flex-wrap gap-2">
                  {(['all', ...categoriesWithWork] as const).map((c) => {
                    const active = category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={active}
                        onClick={() => update({ category: c })}
                        className={cn(
                          'rounded-[2px] border px-4 py-2 font-sans text-[11px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60',
                          active
                            ? 'border-brand-black bg-brand-black text-brand-porcelain'
                            : 'border-brand-dim bg-brand-surface text-brand-ink hover:border-brand-gold-dark',
                        )}
                      >
                        {c === 'all' ? 'All work' : c}
                      </button>
                    );
                  })}
                </div>
                <div role="group" aria-label="View" className="inline-flex self-start rounded-[2px] border border-brand-dim bg-brand-surface p-1 md:self-auto">
                  {(['projects', 'photos'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={view === v}
                      onClick={() => update({ view: v })}
                      className={cn(
                        'rounded-[2px] px-4 py-2 font-sans text-[11px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60',
                        view === v ? 'bg-brand-black text-brand-porcelain' : 'text-brand-ink hover:text-brand-gold-dark',
                      )}
                    >
                      {v === 'projects' ? 'Projects' : 'All photos'}
                    </button>
                  ))}
                </div>
              </div>

              {visibleProjects.length === 0 ? (
                <p className="font-sans text-lg text-brand-muted font-light mb-32">
                  No {category === 'all' ? '' : `${category.toLowerCase()} `}projects published yet.
                </p>
              ) : view === 'projects' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14 mb-32">
                  {visibleProjects.map((project, idx) => (
                    <ProjectCard key={project.slug} project={project} delay={Math.min(idx, 5) * 0.06} />
                  ))}
                </div>
              ) : (
                <div className="mb-32">
                  <PhotoGrid
                    images={allPhotos.map((p) => p.img)}
                    variant="masonry"
                    lightboxLabel="Project photos"
                    captionFor={(_, i) => {
                      const p = allPhotos[i]?.project;
                      return p ? (
                        <span>
                          {p.title} · {p.town}, ON{' '}
                          <Link to={`/portfolio/${p.slug}`} className="ml-3 underline decoration-brand-gold/60 underline-offset-4 hover:text-brand-gold">
                            View project
                          </Link>
                        </span>
                      ) : null;
                    }}
                  />
                </div>
              )}
            </>
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
            Tell us what you are imagining. Ask about suitable materials, the proposed scope and project examples like the ones above.
          </p>
          <Link to="/contact" className="btn-primary px-20">Let's Talk About Your Property</Link>
        </Reveal>
      </section>
    </div>
  );
}
