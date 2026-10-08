import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HERO_DEPTH } from '../data/heroDepth';
import { trackEngagement } from '../utils/analytics';

/**
 * Static home hero. One <img> in the prerendered HTML, no scroll-linked depth
 * layers. Copy and CTAs are the conversion pass; the picture stays a single
 * eager image so the heading can paint without the parallax pin.
 */
const SIZES = '(min-width: 1024px) 55vw, 100vw';

export default function HeroDepth() {
  return (
    <section className="home-hero bg-brand-nearblack">
      <Helmet>
        <link
          rel="preload"
          as="image"
          href={HERO_DEPTH.flat.src}
          imageSrcSet={HERO_DEPTH.flat.srcSet}
          imageSizes={SIZES}
          media="(min-width: 1024px)"
          fetchPriority="high"
        />
      </Helmet>
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
                loading="lazy"
                decoding="async"
                fetchPriority="low"
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
