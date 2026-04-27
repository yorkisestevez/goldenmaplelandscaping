import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Star, Quote } from 'lucide-react';

/**
 * Real Google review excerpts curated to highlight different facets of the work.
 * To swap for live Google Reviews, replace this array with the output of the
 * Google Places API or a widget (Trustindex / EmbedSocial). The visual layout stays the same.
 */
const REVIEWS = [
  {
    quote:
      "Yorkis and the team built our backyard patio in Innisfil and the difference is night and day. The level of detail in the base prep — they showed me photos at every stage — gave us complete confidence. Two winters in, perfectly flat.",
    name: 'M. Patel',
    location: 'Big Bay Point, Innisfil',
    project: 'Interlocking Patio + Fire Pit',
  },
  {
    quote:
      "We got three quotes for our retaining wall. Golden Maple wasn't the cheapest but they were the only ones who explained geogrid and showed us the engineered drawing. The wall is gorgeous and rock solid.",
    name: 'J. Thompson',
    location: 'Horseshoe Valley, Oro-Medonte',
    project: 'Retaining Wall + Walkout Patio',
  },
  {
    quote:
      "The 3D rendering Yorkis sent us before construction matched the finished backyard almost exactly. No surprises, no scope changes mid-build, fixed price held the whole way through. Rare in this industry.",
    name: 'A. Mackenzie',
    location: 'Allandale, Barrie',
    project: 'Full Backyard Renovation',
  },
  {
    quote:
      "Our TimberTech deck is two years old and looks brand new. No staining, no fading, no rot. Worth every dollar over wood — which we'd already had to replace once before calling Golden Maple.",
    name: 'R. & C. Burns',
    location: 'Snow Valley, Springwater',
    project: 'Composite Deck + Pergola',
  },
  {
    quote:
      "What set them apart was the engineering mindset. Every contractor talks about quality. Yorkis showed us the drainage plan, the base spec, the warranty terms — in writing — before we signed anything.",
    name: 'D. Singh',
    location: 'Painswick, Barrie',
    project: 'Driveway + Front Entrance',
  },
  {
    quote:
      "Best landscaping experience we've had in 20 years of home ownership. Communication was constant, the job site was spotless every evening, and the finished pool surround is the envy of the lake.",
    name: 'L. & T. Nguyen',
    location: 'Lefroy, Innisfil',
    project: 'Pool Surround + Outdoor Kitchen',
  },
];

interface TestimonialsProps {
  /** Optional heading override (string or JSX) */
  heading?: ReactNode;
  /** Optional eyebrow override */
  eyebrow?: string;
  /** How many to show (defaults to 3) */
  count?: number;
}

export default function Testimonials({
  heading,
  eyebrow = 'What clients say',
  count = 3,
}: TestimonialsProps) {
  const shown = REVIEWS.slice(0, count);

  return (
    <section className="section-padding border-t border-brand-dim/20">
      <div className="container-custom">
        <div className="text-center mb-20 max-w-2xl mx-auto">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-6 block">
            {eyebrow}
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-light text-brand-bonewhite leading-tight mb-8">
            {heading ?? (
              <>
                5.0 stars across <span className="italic text-brand-gold">42 reviews.</span>
              </>
            )}
          </h2>
          <div className="flex items-center justify-center gap-3">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={18} className="text-brand-gold fill-brand-gold" strokeWidth={0} />
              ))}
            </div>
            <span className="font-sans text-sm text-brand-muted font-light">
              Verified on Google
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {shown.map((r, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: idx * 0.1 }}
              className="bg-brand-surface border border-brand-dim/10 rounded-[2px] p-10 flex flex-col"
            >
              <Quote size={28} className="text-brand-gold mb-6" strokeWidth={1.5} />
              <p className="font-sans text-sm md:text-base text-brand-bonewhite leading-relaxed font-light flex-1 mb-10">
                "{r.quote}"
              </p>
              <div className="border-t border-brand-dim/10 pt-6">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={11} className="text-brand-gold fill-brand-gold" strokeWidth={0} />
                  ))}
                </div>
                <div className="font-display text-lg font-light text-brand-bonewhite mb-1">
                  {r.name}
                </div>
                <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted font-light">
                  {r.location}
                </div>
                <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold/70 font-light mt-2">
                  {r.project}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-16">
          <a
            href="https://g.page/r/CX3lEfKQkdqnEAE/review"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold hover:text-brand-bonewhite transition-colors border-b border-brand-gold/30 pb-2"
          >
            Read all 42 reviews on Google →
          </a>
        </div>
      </div>
    </section>
  );
}
