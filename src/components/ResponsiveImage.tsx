import type { ImgHTMLAttributes } from 'react';
import type { ImageRef } from '../data/portfolioImages';
import { cn } from '../utils/cn';

type NativeImgProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'sizes' | 'width' | 'height' | 'alt' | 'loading' | 'decoding'
>;

export interface ResponsiveImageProps extends NativeImgProps {
  image: ImageRef;
  /** Required: forces a per-placement decision so the browser picks the right candidate. */
  sizes: string;
  /** Exactly ONE per route. React 19 prerender emits an `imagesrcset` preload for it. */
  priority?: boolean;
  /**
   * 'native' wraps in a box with the image's own aspect ratio (zero CLS);
   * 'fill' renders a bare <img> and lets the parent size it (e.g. `.home-hero-photo`);
   * '4/3' etc. wraps in a fixed-ratio box and crops with object-fit.
   */
  aspect?: 'native' | 'fill' | `${number}/${number}`;
  fit?: 'cover' | 'contain';
  /** object-position, e.g. '50% 65%'. */
  position?: string;
  wrapperClassName?: string;
}

/**
 * The one <img> wrapper for register-backed photos (portfolio + Instagram).
 * Always emits width/height so space is reserved even in 'fill' mode; lazy by
 * default so React's SSR preloader only picks up the single `priority` image.
 */
export default function ResponsiveImage({
  image,
  sizes,
  priority = false,
  aspect = 'native',
  fit = 'cover',
  position,
  wrapperClassName,
  className,
  style,
  referrerPolicy = 'no-referrer',
  ...rest
}: ResponsiveImageProps) {
  const img = (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      referrerPolicy={referrerPolicy}
      className={cn(
        aspect === 'fill' ? undefined : 'h-full w-full',
        fit === 'contain' ? 'object-contain' : 'object-cover',
        className,
      )}
      style={position ? { objectPosition: position, ...style } : style}
      {...rest}
    />
  );

  if (aspect === 'fill') return img;

  const ratio = aspect === 'native' ? `${image.width} / ${image.height}` : aspect.replace('/', ' / ');
  return (
    <div className={cn('overflow-hidden', wrapperClassName)} style={{ aspectRatio: ratio }}>
      {img}
    </div>
  );
}
