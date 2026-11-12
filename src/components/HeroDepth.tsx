import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { heroFor } from '../data/homeHeroVariants';
import { trackEngagement } from '../utils/analytics';
import { heroBootScript } from './home/heroBoot';
import type { HomeSegment } from './home/intent';

/**
 * Static home hero. One <img> in the prerendered HTML, no scroll-linked depth
 * layers. The picture is the mobile LCP element, so it is eager and
 * fetchpriority=high at every viewport. React hoists one imagesrcset preload
 * into <head> for that img; a second link would download the picture twice.
 * That preload is always the default picture, so a visitor who gets a service
 * hero on a hard load fetches both. Accepted: it costs them one extra image and
 * keeps the default page, which most visitors and every crawler get, at its best.
 *
 * The prerender always emits the default hero. For a visitor whose interest is
 * known, the inline script at the end rewrites the `data-hero` nodes before
 * first paint, and React then renders the same variant once it has hydrated.
 * Those nodes carry suppressHydrationWarning because, for that visitor, the
 * DOM is deliberately ahead of the markup React hydrates against.
 */
const SIZES = '(min-width: 1024px) 55vw, 100vw';

export default function HeroDepth({ segment = 'default' }: { segment?: HomeSegment }) {
  const hero = heroFor(segment);
  return (
    <section className="home-hero bg-brand-nearblack">
      <div className="container-custom w-full">
        <div className="home-hero-grid">
          <div className="home-hero-copy max-w-xl">
            <p data-hero="eyebrow" suppressHydrationWarning className="text-[10px] md:text-[11px] tracking-[0.2em] uppercase text-brand-gold-dark font-medium mb-8">
              {hero.eyebrow}
            </p>
            <h1 className="font-display font-normal text-brand-ink mb-8">
              <span data-hero="l1" suppressHydrationWarning>{hero.headline[0]}</span><br />
              <span data-hero="l2" suppressHydrationWarning>{hero.headline[1]}</span><br />
              <span data-hero="l3" suppressHydrationWarning className="italic text-brand-gold-dark">{hero.headline[2]}</span>
            </h1>
            <p data-hero="sub" suppressHydrationWarning className="text-base text-brand-muted leading-relaxed max-w-sm mb-7">
              {hero.subhead}
            </p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link to="/contact" onClick={() => trackEngagement('cta_click', 'home_start_project')} className="btn-primary gap-5">
                Get my estimate <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#selected-work" className="home-project-link hidden sm:inline-flex" onClick={() => trackEngagement('cta_click', 'home_selected_work')}>
                See the work <ArrowRight size={15} aria-hidden="true" />
              </a>
            </div>
            <p className="hidden md:block text-xs text-brand-muted mt-9">Patios &amp; interlock <span className="mx-2 text-brand-gold-dark">/</span> Decks <span className="mx-2 text-brand-gold-dark">/</span> Landscape design</p>
          </div>

          <figure className="min-w-0">
            <div className="home-hero-frame">
              <img
                data-hero="img"
                suppressHydrationWarning
                src={hero.image.src}
                srcSet={hero.image.srcSet}
                sizes={SIZES}
                alt={hero.image.alt}
                width={hero.image.width}
                height={hero.image.height}
                decoding="async"
                fetchPriority="high"
                className="home-hero-layer home-hero-flat"
              />
            </div>
            <figcaption className="home-hero-caption">
              <span data-hero="cap1" suppressHydrationWarning>{hero.caption[0]}</span>
              <span data-hero="cap2" suppressHydrationWarning>{hero.caption[1]}</span>
            </figcaption>
          </figure>
        </div>
      </div>
      <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: heroBootScript() }} />
    </section>
  );
}
