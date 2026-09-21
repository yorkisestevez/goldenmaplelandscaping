import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  cubicBezier,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { HERO_DEPTH } from '../data/heroDepth';
import { trackEngagement } from '../utils/analytics';

/**
 * Home hero with a pinned depth push-in.
 *
 * At rest it is the editorial split: copy on the left, a framed picture on the
 * right. Scrolling pins the hero; the frame opens out to the full viewport while
 * the picture's three depth layers (sky and maples / the yard / the grasses up
 * close) scale at different rates
 * about the dining table, so it reads as walking into the backyard. A closing
 * line lands on a dark panel, then the page carries on.
 *
 * How the hand-off from "framed card" to "full bleed" stays seamless: the layer
 * stack is ALWAYS viewport-sized. At rest it is just clipped down to the frame
 * and slid so the table sits at the frame's centre. Opening the frame is only a
 * clip-path and a translate — the picture never re-crops, so nothing jumps.
 *
 * Everything that decides LAYOUT is CSS behind STAGE_QUERY (see .home-hero-stage
 * in index.css), so the server-rendered page is already correct and hydration
 * moves nothing. JS only measures the frame and drives transforms. Below the
 * breakpoint, on short windows, or with reduced motion, this is a plain static
 * hero showing the flat picture, and the layer files are never downloaded.
 */

// Keep in sync with the @media block for .home-hero-stage in src/index.css.
const STAGE_QUERY = '(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)';
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const FOCAL = `${HERO_DEPTH.focal.x * 100}% ${HERO_DEPTH.focal.y * 100}%`;

const easeOpen = cubicBezier(0.65, 0, 0.35, 1);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

type Frame = { top: number; right: number; bottom: number; left: number; width: number; height: number };

export default function HeroDepth() {
  const stageRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [layersReady, setLayersReady] = useState(true);

  // Frame insets inside the pinned viewport, and the stack offset that centres
  // the table in the frame. Motion values so the scroll transforms read them live.
  const insetTop = useMotionValue(0);
  const insetRight = useMotionValue(0);
  const insetBottom = useMotionValue(0);
  const insetLeft = useMotionValue(0);
  const restX = useMotionValue(0);
  const restY = useMotionValue(0);

  useEffect(() => {
    const pin = pinRef.current;
    const box = frameRef.current;
    if (!pin || !box) return;
    const media = window.matchMedia(STAGE_QUERY);

    const measure = () => {
      if (!media.matches) {
        setFrame(null);
        return;
      }
      const p = pin.getBoundingClientRect();
      const f = box.getBoundingClientRect();
      const next: Frame = {
        top: f.top - p.top,
        left: f.left - p.left,
        right: p.right - f.right,
        bottom: p.bottom - f.bottom,
        width: p.width,
        height: p.height,
      };
      insetTop.set(next.top);
      insetRight.set(next.right);
      insetBottom.set(next.bottom);
      insetLeft.set(next.left);
      // Table at the frame's centre — clamped so the viewport-sized stack can
      // never slide far enough to leave a bare edge inside the frame.
      restX.set(clamp(next.left + f.width / 2 - HERO_DEPTH.focal.x * p.width, next.left + f.width - p.width, next.left));
      restY.set(clamp(next.top + f.height / 2 - HERO_DEPTH.focal.y * p.height, next.top + f.height - p.height, next.top));
      setFrame(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pin);
    ro.observe(box);
    media.addEventListener('change', measure);
    return () => {
      ro.disconnect();
      media.removeEventListener('change', measure);
    };
  }, [insetTop, insetRight, insetBottom, insetLeft, restX, restY]);

  // The three layers decode at different moments; shown one by one, the yard
  // floats on bare parchment until the sky arrives. Hold them and fade in as one.
  // Starts true so the prerendered page (and a no-JS visitor) still sees them.
  useEffect(() => {
    const imgs = Array.from(frameRef.current?.querySelectorAll<HTMLImageElement>('.home-hero-depth') ?? []);
    const pending = imgs.filter((img) => !(img.complete && img.naturalWidth > 0));
    if (pending.length === 0) return;
    setLayersReady(false);
    let left = pending.length;
    const done = () => { if (--left <= 0) setLayersReady(true); };
    pending.forEach((img) => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    return () => pending.forEach((img) => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
    });
  }, []);

  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start start', 'end end'] });
  // A light spring takes the steps out of wheel scrolling without feeling laggy.
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.35 });

  const open = useTransform(progress, [0, 0.55], [0, 1], { ease: easeOpen });
  const closed = useTransform(open, (v) => 1 - v);
  const clipTop = useTransform([closed, insetTop], ([c, i]: number[]) => c * i);
  const clipRight = useTransform([closed, insetRight], ([c, i]: number[]) => c * i);
  const clipBottom = useTransform([closed, insetBottom], ([c, i]: number[]) => c * i);
  const clipLeft = useTransform([closed, insetLeft], ([c, i]: number[]) => c * i);
  const clipPath = useMotionTemplate`inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
  const stackX = useTransform([closed, restX], ([c, x]: number[]) => c * x);
  const stackY = useTransform([closed, restY], ([c, y]: number[]) => c * y);

  // The push-in: nearer layers grow faster. Every layer scales about the table.
  // Far and yard stay close: the gap between them is what uncovers the painted-out
  // strip beside the house, and past ~6% that strip is wide enough to read as a smudge.
  const farScale = useTransform(progress, [0, 1], [1, 1.06]);
  const yardScale = useTransform(progress, [0, 1], [1, 1.12]);
  const nearScale = useTransform(progress, [0, 1], [1.02, 1.38]);
  const nearY = useTransform(progress, [0, 1], ['0%', '5%']);

  const copyOpacity = useTransform(progress, [0.02, 0.2], [1, 0]);
  const copyY = useTransform(progress, [0.02, 0.2], [0, -36]);
  const closingOpacity = useTransform(progress, [0.56, 0.8], [0, 1]);
  const closingY = useTransform(progress, [0.56, 0.8], [28, 0]);
  // Faded-out controls must not stay clickable or tabbable: the opening CTA is
  // still in the DOM under the full-bleed picture, and the closing one exists
  // from the first frame.
  const [copyLive, setCopyLive] = useState(true);
  const [closingLive, setClosingLive] = useState(false);
  useMotionValueEvent(copyOpacity, 'change', (v) => setCopyLive(v > 0.5));
  useMotionValueEvent(closingOpacity, 'change', (v) => setClosingLive(v > 0.5));

  return (
    <section ref={stageRef} className="home-hero home-hero-stage bg-brand-nearblack">
      <div ref={pinRef} className="home-hero-pin">
        <div className="container-custom w-full">
          <div className="home-hero-grid">
            <motion.div className="home-hero-copy max-w-xl" inert={!copyLive} style={frame ? { opacity: copyOpacity, y: copyY } : undefined}>
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
            </motion.div>

            <figure className="min-w-0">
              <div ref={frameRef} className="home-hero-frame">
                <motion.div
                  className="home-hero-window"
                  style={frame ? { top: -frame.top, right: -frame.right, bottom: -frame.bottom, left: -frame.left, clipPath } : undefined}
                >
                  <motion.div
                    className="home-hero-stack"
                    data-ready={layersReady}
                    style={frame ? { top: 0, left: 0, width: frame.width, height: frame.height, x: stackX, y: stackY } : undefined}
                  >
                    {/* Static hero. The blank source means a staged desktop never downloads it. */}
                    <picture>
                      <source media={STAGE_QUERY} srcSet={BLANK} />
                      <img
                        src={HERO_DEPTH.flat.src}
                        srcSet={HERO_DEPTH.flat.srcSet}
                        sizes="(min-width: 1024px) 55vw, 100vw"
                        alt={HERO_DEPTH.alt}
                        width={HERO_DEPTH.width}
                        height={HERO_DEPTH.height}
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        className="home-hero-layer home-hero-flat"
                      />
                    </picture>
                    {/* Depth layers. The blank source means a phone never downloads them. */}
                    <picture>
                      <source media={`not all and ${STAGE_QUERY}`} srcSet={BLANK} />
                      <motion.img
                        src={HERO_DEPTH.bg.src} srcSet={HERO_DEPTH.bg.srcSet} sizes="100vw" alt="" aria-hidden="true"
                        loading="eager" decoding="async"
                        className="home-hero-layer home-hero-depth"
                        style={frame ? { scale: farScale, transformOrigin: FOCAL } : undefined}
                      />
                    </picture>
                    <picture>
                      <source media={`not all and ${STAGE_QUERY}`} srcSet={BLANK} />
                      <motion.img
                        src={HERO_DEPTH.mid.src} srcSet={HERO_DEPTH.mid.srcSet} sizes="100vw" alt={HERO_DEPTH.alt}
                        loading="eager" decoding="async" fetchPriority="high"
                        className="home-hero-layer home-hero-depth"
                        style={frame ? { scale: yardScale, transformOrigin: FOCAL } : undefined}
                      />
                    </picture>
                    <picture>
                      <source media={`not all and ${STAGE_QUERY}`} srcSet={BLANK} />
                      <motion.img
                        src={HERO_DEPTH.fg.src} srcSet={HERO_DEPTH.fg.srcSet} sizes="100vw" alt="" aria-hidden="true"
                        loading="eager" decoding="async"
                        className="home-hero-layer home-hero-depth"
                        style={frame ? { scale: nearScale, y: nearY, transformOrigin: FOCAL } : undefined}
                      />
                    </picture>
                  </motion.div>
                </motion.div>
              </div>
              <motion.figcaption className="home-hero-caption" style={frame ? { opacity: copyOpacity } : undefined}>
                <span>Outdoor living concept</span><span>Stone · timber · open air</span>
              </motion.figcaption>
            </figure>
          </div>
        </div>

        <motion.div
          className="home-hero-closing"
          inert={!closingLive}
          style={frame ? { opacity: closingOpacity, y: closingY } : undefined}
        >
          <div className="container-custom w-full">
            <p className="text-[11px] tracking-[0.3em] uppercase text-brand-gold font-medium mb-6">Stone · timber · open air</p>
            <p className="home-hero-closing-line font-display font-light text-brand-porcelain">
              Built from the <span className="italic text-brand-gold">ground up.</span>
            </p>
            <Link to="/contact" onClick={() => trackEngagement('cta_click', 'home_hero_depth_cta')} className="btn-primary gap-5 mt-10">
              Start your project <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
