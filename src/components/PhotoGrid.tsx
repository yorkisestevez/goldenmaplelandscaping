import type { ReactNode } from 'react';
import type { ImageRef } from '../data/portfolioImages';
import { cn } from '../utils/cn';
import Lightbox, { useLightbox } from './Lightbox';
import ResponsiveImage from './ResponsiveImage';
import Reveal from './Reveal';

export interface PhotoGridProps {
  images: ImageRef[];
  /** masonry = CSS columns, native aspect; uniform = 4:3 grid. */
  variant?: 'masonry' | 'uniform';
  sizes?: string;
  captionFor?: (img: ImageRef, i: number) => ReactNode;
  lightboxLabel?: string;
  className?: string;
}

const DEFAULT_SIZES = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

/** Clickable photo grid that owns its own lightbox. Tiles are real buttons. */
export default function PhotoGrid({
  images,
  variant = 'masonry',
  sizes = DEFAULT_SIZES,
  captionFor,
  lightboxLabel = 'Project photos',
  className,
}: PhotoGridProps) {
  const lb = useLightbox(images.length);
  if (images.length === 0) return null;

  const tile = (img: ImageRef, i: number) => (
    <button
      type="button"
      onClick={() => lb.open(i)}
      aria-label={`Open photo ${i + 1} of ${images.length}: ${img.alt}`}
      className="group block w-full overflow-hidden rounded-[2px] border border-brand-dim/40 bg-brand-surface text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
    >
      <ResponsiveImage
        image={img}
        sizes={sizes}
        aspect={variant === 'uniform' ? '4/3' : 'native'}
        className="transition-transform duration-700 motion-safe:group-hover:scale-[1.02]"
      />
    </button>
  );

  return (
    <>
      {variant === 'masonry' ? (
        <div className={cn('columns-1 gap-4 sm:columns-2 lg:columns-3', className)}>
          {images.map((img, i) => (
            <Reveal key={`${img.src}-${i}`} delay={Math.min(i, 6) * 0.05} className="mb-4 break-inside-avoid">
              {tile(img, i)}
            </Reveal>
          ))}
        </div>
      ) : (
        <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
          {images.map((img, i) => (
            <Reveal key={`${img.src}-${i}`} delay={Math.min(i, 6) * 0.05}>
              {tile(img, i)}
            </Reveal>
          ))}
        </div>
      )}
      <Lightbox
        images={images}
        index={lb.index}
        onClose={lb.close}
        onIndexChange={lb.setIndex}
        captionFor={captionFor}
        label={lightboxLabel}
      />
    </>
  );
}
