import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HERO_DEPTH } from '../data/heroDepth';
import { trackEngagement } from '../utils/analytics';

/**
 * Static home hero. One <img> in the prerendered HTML, no scroll-linked depth
 * layers. The picture is the mobile LCP element, so it is eager and
 * fetchpriority=high at every viewport. React hoists one imagesrcset preload
 * into <head> for that img; a second link would download the picture twice.
 */
const SIZES = '(min-width: 1024px) 55vw, 100vw';

export default function HeroDepth() {
  return (
    <section className="home-hero bg-brand-nearblack">
      <div className="container-custom w-full">
        <div className="home-hero-grid">
          <div className="home-hero-copy max-w-xl">
            <p className="text-[10px] md:text-[11px] tracking-[0.2em] uppercase text-brand-gold-dark font-medium mb-8">
              Barrie &amp; Simcoe County · Residential landscape construction
            </p>
            <h1 className="font-display font-normal text-brand-ink mb-8">
              Interlock, walls<br />and decks<br /><span className="italic text-brand-gold-dark">built to live on.</span>
            </h1>
            <p className="text-base text-brand-muted leading-relaxed max-w-md mb-7">
              Golden Maple builds interlocking patios and driveways, retaining walls, and composite decks for homeowners in Barrie and Simcoe County. Yorkis Estevez, founder and lead builder, writes the scope for your property before the crew starts.
            </p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link to="/contact" onClick={() => trackEngagement('cta_click', 'home_start_project')} className="btn-primary gap-5">
                Get my estimate <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#selected-work" className="home-project-link hidden sm:inline-flex" onClick={() => trackEngagement('cta_click', 'home_selected_work')}>
                See the work <ArrowRight size={15} aria-hidden="true" />
              </a>
              <Link to="/book" className="home-project-link" onClick={() => trackEngagement('cta_click', 'home_book_call')}>
                Book a call <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/deck-designer" className="home-project-link" onClick={() => trackEngagement('cta_click', 'home_deck_designer')}>
                Design your deck <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <p className="hidden md:block text-xs text-brand-muted mt-9">Interlock <span className="mx-2 text-brand-gold-dark">/</span> Walls <span className="mx-2 text-brand-gold-dark">/</span> Decks</p>
          </div>

          <figure className="min-w-0">
            <div className="home-hero-frame">
              <img
                src={HERO_DEPTH.flat.src}
                srcSet={HERO_DEPTH.flat.srcSet}
                sizes={SIZES}
                alt={HERO_DEPTH.alt}
                width={HERO_DEPTH.width}
                height={HERO_DEPTH.height}
                decoding="async"
                fetchPriority="high"
                className="home-hero-layer home-hero-flat"
              />
            </div>
            <figcaption className="home-hero-caption">
              <span>Outdoor living concept</span><span>Stone · timber · open air</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
