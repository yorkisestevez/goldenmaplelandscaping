import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import SEO from '../../components/SEO';
import { BUSINESS, canPublish } from '../../data/business';
import { getBlogPost, type BlogPostMeta } from '../../data/blogPosts';
import { reviewFor } from '../../data/editorialReviews';
import { FOUNDER } from '../../data/founder';
import { LIBRARY_SECTIONS, entriesIn, getLibrarySection } from '../../data/library';
import { breadcrumb, collectionPage, graph } from '../../utils/schema';

/** /library/:section — one Library topic (src/data/library.ts). */
export default function LibrarySection() {
  const { section: sectionSlug } = useParams();
  const section = getLibrarySection(sectionSlug);
  if (!section) return <Navigate to="/library" replace />;

  const posts = entriesIn(section.slug)
    .map((e) => getBlogPost(e.slug))
    .filter((p): p is BlogPostMeta => Boolean(p));
  const path = `/library/${section.slug}/`;
  const showReviews = canPublish(BUSINESS.founder);

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title={`${section.h1} | Barrie & Simcoe County`}
        description={section.description}
        canonical={`https://goldenmaplelandscaping.ca${path}`}
        schema={graph(
          collectionPage({
            path,
            name: section.h1,
            description: section.description,
            items: posts.map((p) => ({ name: p.title, path: `/resources/${p.slug}/` })),
          }),
          breadcrumb([
            { name: 'Home', path: '/' },
            { name: 'Library', path: '/library/' },
            { name: section.title, path },
          ]),
        )}
      />

      <section className="section-padding pt-48">
        <div className="container-custom">
          <Link to="/library" className="inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-bonewhite transition-colors mb-12">
            ← Outdoor Construction Library
          </Link>
          <div className="max-w-4xl mb-20">
            <h1 className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-10">{section.h1}</h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">{section.intro}</p>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
            {posts.map((post) => {
              const review = showReviews ? reviewFor(post.slug) : undefined;
              return (
                <li key={post.slug}>
                  <Link to={`/resources/${post.slug}`} className="group block h-full">
                    <div className="bg-brand-surface border border-brand-dim/40 rounded-[2px] p-10 h-full flex flex-col hover:border-brand-gold/60 transition-colors duration-500">
                      <div className="flex flex-wrap items-center gap-4 mb-5">
                        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark font-medium">{post.category}</span>
                        <span className="flex items-center gap-1 font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted">
                          <Clock size={10} strokeWidth={1.5} aria-hidden="true" /> {post.readTime}
                        </span>
                        {review && (
                          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-green-dark">Reviewed by {FOUNDER.name}</span>
                        )}
                      </div>
                      <h2 className="font-display text-2xl font-light text-brand-bonewhite mb-4 leading-tight group-hover:text-brand-gold-dark transition-colors">{post.title}</h2>
                      <p className="font-sans text-sm text-brand-muted font-light leading-relaxed flex-1">{post.excerpt}</p>
                      <div className="mt-6 flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark group-hover:gap-5 transition-all">
                        Read the guide <ArrowRight size={14} strokeWidth={1.5} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <nav aria-label="Related services">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Put it into practice</h2>
              <ul className="space-y-4">
                {section.services.map((s) => (
                  <li key={s.to}>
                    <Link to={s.to} className="group flex items-center justify-between gap-6 bg-brand-surface px-8 py-6 rounded-[2px] border border-brand-dim/40 font-sans text-[15px] text-brand-bonewhite hover:border-brand-gold/60 transition-colors">
                      <span>{s.label}</span>
                      <ArrowRight size={16} strokeWidth={1.5} className="text-brand-gold-dark shrink-0 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Other Library sections">
              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">More from the Library</h2>
              <ul className="flex flex-wrap gap-3">
                {LIBRARY_SECTIONS.filter((s) => s.slug !== section.slug).map((s) => (
                  <li key={s.slug}>
                    <Link to={`/library/${s.slug}`} className="block font-sans text-[13px] text-brand-bonewhite border border-brand-dim/60 bg-brand-surface px-5 py-3 rounded-[2px] hover:border-brand-gold/60 transition-colors">
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </section>
    </div>
  );
}
