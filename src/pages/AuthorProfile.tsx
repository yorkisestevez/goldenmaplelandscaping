import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import SEO from '../components/SEO';
import ProjectCard from '../components/ProjectCard';
import { BUSINESS, canPublish, type BusinessFact } from '../data/business';
import { FOUNDER } from '../data/founder';
import { PROJECTS } from '../data/projects';
import { EDITORIAL_REVIEWS } from '../data/editorialReviews';
import { getBlogPost } from '../data/blogPosts';
import { FOUNDER_KNOWS_ABOUT, breadcrumb, graph, profilePage } from '../utils/schema';

/**
 * /about/yorkis-estevez — the founder's profile, the url of the #yorkis-estevez
 * Person entity and the target of every byline and "More about Yorkis" link.
 *
 * Only register-backed facts appear: role (confirmed 2026-09-27), credentials and
 * memberships only once confirmed with proof, projects only from the attested
 * portfolio register, reviewed articles only from editorialReviews.ts.
 */
const CREDENTIALS: { label: string; fact: BusinessFact<unknown> }[] = [
  { label: 'CMHA Certified Concrete Paver Installer', fact: BUSINESS.credentials.cmhaPaverInstaller },
  { label: 'Techo-Pro contractor program (Techo-Bloc)', fact: BUSINESS.credentials.techoPro },
  { label: 'Landscape Ontario member', fact: BUSINESS.memberships.landscapeOntario },
];

export default function AuthorProfile() {
  const publishable = canPublish(BUSINESS.founder);
  const credentials = CREDENTIALS.filter((c) => canPublish(c.fact));
  const portfolioVerified = canPublish(BUSINESS.reviews.portfolio) && canPublish(BUSINESS.reviews.photoRights);
  const projects = portfolioVerified ? PROJECTS.slice(0, 6) : [];
  const reviewed = EDITORIAL_REVIEWS.map((r) => ({ review: r, post: getBlogPost(r.slug) })).filter((x) => x.post);

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title={`${FOUNDER.name}, ${FOUNDER.role}`}
        description={`${FOUNDER.name} is the ${FOUNDER.role} of ${BUSINESS.publicName.value}, a Barrie hardscape and outdoor-living contractor working across Simcoe County.`}
        canonical={`https://goldenmaplelandscaping.ca${FOUNDER.profilePath}`}
        noindex={!publishable}
        schema={graph(
          profilePage(),
          breadcrumb([
            { name: 'Home', path: '/' },
            { name: 'About', path: '/about/' },
            { name: FOUNDER.name, path: `${FOUNDER.profilePath}/` },
          ]),
        )}
      />

      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-16 lg:gap-24 items-start mb-32">
            <div className="relative aspect-[3/4] max-w-md rounded-[2px] overflow-hidden border border-brand-dim/40 shadow-2xl">
              <img src={FOUNDER.portrait.src} alt={FOUNDER.portrait.alt} className="w-full h-full object-cover object-top" />
            </div>
            <div>
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
                {FOUNDER.role} · {BUSINESS.publicName.value}
              </span>
              <h1 className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-10">{FOUNDER.name}</h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-6 font-light">
                Yorkis leads Golden Maple Landscaping, a Barrie-based hardscape and outdoor-living contractor working across Simcoe County. He plans and builds patios, walkways, driveways, retaining walls and full backyards, with the attention on what sits under the surface: excavation, base, drainage and how a build handles an Ontario winter.
              </p>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-12 font-light">
                Every Golden Maple project starts with a site walk and a written scope that spells out the excavation, base, drainage and materials for that property, not a one-size-fits-all spec.
              </p>

              <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">What he focuses on</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                {FOUNDER_KNOWS_ABOUT.map((topic) => (
                  <li key={topic} className="flex items-start gap-4 font-sans text-[15px] text-brand-bonewhite font-light leading-snug">
                    <Check size={18} className="text-brand-gold-dark shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
                    <span>{topic}</span>
                  </li>
                ))}
              </ul>

              {credentials.length > 0 && (
                <>
                  <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">Credentials &amp; memberships</h2>
                  <ul className="space-y-3 mb-12">
                    {credentials.map((c) => (
                      <li key={c.label} className="font-sans text-[15px] text-brand-bonewhite font-light">
                        {c.label} <span className="text-brand-muted">· verified {c.fact.lastVerified}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/contact" className="btn-primary">Talk to Yorkis about your project</Link>
                <a href={BUSINESS.urls.instagram.value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold-dark transition-colors">
                  Job photos on Instagram <ArrowRight size={16} strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>

          {projects.length > 0 && (
            <section className="mb-32" aria-labelledby="founder-projects">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
                <h2 id="founder-projects" className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite leading-tight">Recent Golden Maple work</h2>
                <Link to="/portfolio" className="flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold-dark transition-colors">
                  Full portfolio <ArrowRight size={16} strokeWidth={1.5} />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
                {projects.map((p, i) => <ProjectCard key={p.slug} project={p} delay={i * 0.06} />)}
              </div>
            </section>
          )}

          <section className="max-w-4xl mx-auto mb-16" aria-labelledby="editorial-standards">
            <h2 id="editorial-standards" className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-8">Editorial standards</h2>
            <p className="font-sans text-base md:text-lg text-brand-muted leading-relaxed mb-6 font-light">
              Golden Maple's guides are drafted in-house and checked against the site's publication rules before they go live: no unverified ratings, credentials, warranties or one-size-fits-all specs. An article carries "Reviewed by {FOUNDER.name}" only after Yorkis has personally checked it for technical accuracy, and the date shows when.
            </p>
            {reviewed.length > 0 ? (
              <ul className="space-y-3">
                {reviewed.map(({ review, post }) => (
                  <li key={review.slug}>
                    <Link to={`/resources/${review.slug}`} className="font-sans text-[15px] text-brand-bonewhite underline decoration-brand-gold/50 underline-offset-4 hover:text-brand-gold-dark">
                      {post!.title}
                    </Link>
                    <span className="font-sans text-sm text-brand-muted"> · reviewed {review.reviewedOn}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Link to="/library" className="inline-flex items-center gap-4 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-bonewhite transition-colors">
                Browse the Outdoor Construction Library <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
