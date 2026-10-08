import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HERO_DEPTH } from '../data/heroDepth';
import { trackEngagement } from '../utils/analytics';

/**
 * Static home hero. The picture is one <img> in the prerendered HTML so it can
 * paint without the scroll-linked depth layers (those were the mobile LCP
 * element and the desktop layout shift). Desktop and mobile share this frame.
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
          fetchPriority="high"
        />
      </Helmet>
      <div className="container-custom w-full">
        <div className="home-hero-grid">
          <div className="home-hero-copy max-w-xl">
            <p className="text-[10px] md:text-[11px] tracking-[0.2em] uppercase text-brand-gold-dark font-medium mb-8">
              Outdoor living · Barrie & Simcoe County
            </p>
            <h1 className="font-display font-normal text-brand-ink mb-8">
              The backyard<br />you’ve always<br /><span className="italic text-brand-gold-dark">pictured.</span>
            </h1>
            <p className="text-base text-brand-muted leading-relaxed max-w-sm mb-7">
              Thoughtfully planned patios, decks and outdoor spaces. Built around your home, and the way you want to live.
            </p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link to="/contact" onClick={() => trackEngagement('cta_click', 'home_start_project')} className="btn-primary gap-5">
                Start your project <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#selected-work" className="home-project-link hidden sm:inline-flex" onClick={() => trackEngagement('cta_click', 'home_selected_work')}>
                See the details <ArrowRight size={15} aria-hidden="true" />
              </a>
            </div>
            <p className="hidden md:block text-xs text-brand-muted mt-9">Patios & interlock <span className="mx-2 text-brand-gold-dark">/</span> Decks <span className="mx-2 text-brand-gold-dark">/</span> Landscape design</p>
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
                loading="eager"
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
