import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SEO from '../../components/SEO';
import { FOUNDER } from '../../data/founder';
import { LIBRARY_SECTIONS, entriesIn } from '../../data/library';
import { breadcrumb, collectionPage, graph } from '../../utils/schema';

/** /library — the Outdoor Construction Library hub (src/data/library.ts). */
export default function LibraryHub() {
  const description = 'Golden Maple\'s Outdoor Construction Library: how patios, retaining walls and driveways are built for Barrie soil, water and frost, plus materials, permits and costs.';
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="Outdoor Construction Library | Barrie & Simcoe County Hardscape Guides"
        description={description}
        canonical="https://goldenmaplelandscaping.ca/library"
        schema={graph(
          collectionPage({
            path: '/library/',
            name: 'Outdoor Construction Library',
            description,
            items: LIBRARY_SECTIONS.map((s) => ({ name: s.h1, path: `/library/${s.slug}/` })),
          }),
          breadcrumb([
            { name: 'Home', path: '/' },
            { name: 'Library', path: '/library/' },
          ]),
        )}
      />

      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="max-w-4xl mb-24">
            <h1 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">Outdoor Construction Library</h1>
            <p className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-12">
              Barrie hardscape, <br />
              <span className="italic text-brand-gold-dark">explained from the base up.</span>
            </p>
            <p className="font-sans text-lg text-brand-muted leading-relaxed mb-6 font-light">
              What goes under a patio, why walls fail, what a driveway base has to carry, and how Simcoe County's water, frost and soil change all of it. Guides are grouped by topic, and each topic links to the service pages that put it into practice.
            </p>
            <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">
              Guides marked "Reviewed by {FOUNDER.name}" have been checked by him for technical accuracy.{' '}
              <Link to={FOUNDER.profilePath} className="text-brand-bonewhite underline decoration-brand-gold/50 underline-offset-4 hover:text-brand-gold-dark">Editorial standards</Link>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {LIBRARY_SECTIONS.map((section) => (
              <Link key={section.slug} to={`/library/${section.slug}`} className="group block h-full">
                <div className="bg-brand-surface border border-brand-dim/40 rounded-[2px] p-10 h-full flex flex-col hover:border-brand-gold/60 transition-colors duration-500">
                  <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark mb-5">{entriesIn(section.slug).length} guides</span>
                  <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-5 leading-tight group-hover:text-brand-gold-dark transition-colors">{section.title}</h2>
                  <p className="font-sans text-sm text-brand-muted font-light leading-relaxed flex-1">{section.description}</p>
                  <div className="mt-8 flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark group-hover:gap-5 transition-all">
                    Open section <ArrowRight size={14} strokeWidth={1.5} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <Link to="/resources" className="inline-flex items-center gap-4 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-bonewhite transition-colors">
            All articles, newest first <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </div>
      </section>
    </div>
  );
}
