/**
 * The founder's likeness — the single source of truth.
 *
 * Why this file exists: before it, About, the home Manifesto, and every blog
 * post hardcoded their own founder image path. Each past swap only ever landed
 * on some of them, so the site shipped FOUR visually different men all captioned
 * "Yorkis Estevez" wearing three different brand marks. Import from here; never
 * hardcode a founder path again. Swapping the photo sitewide is now a one-line
 * change to `SOURCE` plus regenerating the derivatives.
 *
 * Both derivatives come from ONE source photo so the face is identical
 * everywhere — that is the entire point:
 *   portrait — home Manifesto AND /about, in a 3:4 frame with object-top
 *   avatar   — 36 blog author bios + schema Person.image; 192px, ~6 KB, so the
 *              64px circle doesn't pull a 221 KB portrait on every article
 *
 * A transparent cutout derivative existed briefly for the /about floating-panel
 * layout. It was dropped 2026-08-27: the source is a tight head-and-shoulders
 * crop, so the cut-out read as a floating head and the body clipped at the frame
 * edges. /about now uses the same framed portrait as the Manifesto. If a cutout
 * is ever wanted again, it needs a wider source photo, not more matting.
 *
 * Produced by scripts/build-founder-images.mjs (rembg u2net_human_seg + sharp,
 * fully local). The -v1 suffix is cache-busting against netlify.toml's 1-year
 * immutable /images/* header — NEVER overwrite a versioned file in place;
 * regenerate as -v2 and update here.
 *
 * Honest caveat: this is an AI-generated portrait carrying no Golden Maple
 * branding, kept because it is the identity already on the most pages. The
 * estimator's "no AI on customer pages" policy (see estimatorImages.ts) is the
 * standard to aim at — replacing this with a real photograph of Yorkis is a
 * one-line change here plus a rerun of the build script.
 */

import { BUSINESS } from './business';

const ORIGIN = BUSINESS.canonicalUrl;

const NAME = BUSINESS.founder.value.name;
const ROLE = BUSINESS.founder.value.role;

export const FOUNDER = {
  name: NAME,
  role: ROLE,

  /** Home Manifesto + /about — bordered 3:4 portrait. */
  portrait: {
    src: '/images/projects/yorkis-founder-headshot-v1.jpg',
    alt: `${NAME}, ${ROLE} of ${BUSINESS.publicName.value}`,
  },

  /** Blog author bios — small square, rendered as a 64px circle. */
  avatar: {
    src: '/images/projects/yorkis-founder-avatar-v1.webp',
    alt: `${NAME}, ${ROLE} of ${BUSINESS.publicName.value}`,
  },
} as const;

/**
 * Absolute URL for JSON-LD. Both Person nodes (root.tsx `founder`,
 * BlogPostLayout `author`) named Yorkis with no image until this existed —
 * which is what lets Google and AI engines tie a face to the author entity.
 */
// Do not associate a synthetic likeness with a Person's real photographic identity.
// Kept as an optional export for existing schema consumers; JSON.stringify omits it.
export const FOUNDER_IMAGE_URL: string | undefined = undefined;
