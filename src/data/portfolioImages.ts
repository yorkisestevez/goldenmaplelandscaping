/**
 * Typed accessor over the GENERATED portfolio manifest.
 *
 * `src/data/portfolioManifest.json` is written by `scripts/build-portfolio-images.mjs`
 * from the attested allowlist in `scripts/portfolio-sources.mjs`. Never hand-edit it.
 * Because `PortfolioImageId` is the literal union of manifest keys, a typo or a
 * removed image fails `tsc --noEmit` inside `npm run lint` before anything ships.
 */
import manifest from './portfolioManifest.json';

export type PortfolioImageId = keyof typeof manifest;

/** Everything an <img> needs for a responsive, CLS-free render. */
export interface ImageRef {
  src: string;
  srcSet: string;
  width: number;
  height: number;
  alt: string;
}

interface ManifestVariant {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

interface ManifestEntry {
  project: string;
  masterSha: string;
  version: number;
  card: ManifestVariant;
  full: ManifestVariant;
  bytes: Record<string, number>;
}

const entries = manifest as Record<PortfolioImageId, ManifestEntry>;

/** `sizes` for 3-up / 2-up / 1-up card grids. */
export const CARD_SIZES = '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw';
/** `sizes` for a full-width detail cover. */
export const FULL_SIZES = '(min-width: 1400px) 1336px, 100vw';

export function portfolioImage(id: PortfolioImageId, variant: 'card' | 'full', alt: string): ImageRef {
  const v = entries[id][variant];
  return { src: v.src, srcSet: v.srcset, width: v.width, height: v.height, alt };
}

export function portfolioProjectOf(id: PortfolioImageId): string {
  return entries[id].project;
}

/** True only for photos that passed the owner-attested register (portfolio) or the Instagram bake. */
export function isOwnedPhoto(src: string): boolean {
  return src.startsWith('/images/portfolio/') || src.startsWith('/images/instagram/');
}

export const PORTFOLIO_IMAGE_IDS = Object.keys(entries) as PortfolioImageId[];
