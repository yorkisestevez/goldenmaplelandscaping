import { FOUNDER } from '../data/founder';

/**
 * The "About the Author" block that closes every article — E-E-A-T signal for
 * Google and AI engines.
 *
 * This exists because the block used to be copy-pasted into each post with the
 * image path hardcoded, so the founder photo could only ever be changed 18
 * times by hand (and half the posts were missed entirely). One component, one
 * FOUNDER import: the face is now identical across all 36 posts by construction.
 *
 * scripts/blog-publisher/inject.cjs emits <AuthorBio> for newly generated posts,
 * so this can't drift back.
 */
export default function AuthorBio({ bio }: { bio: string }) {
  return (
    <div className="not-prose mt-16 mb-8 p-6 rounded-2xl border border-brand-gold/20 bg-brand-surface/40">
      <div className="flex items-start gap-4">
        <img
          src={FOUNDER.avatar.src}
          alt={FOUNDER.avatar.alt}
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          className="w-16 h-16 rounded-full object-cover border border-brand-gold/30 shrink-0"
        />
        <div>
          <div className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark mb-2">About the Author</div>
          <p className="font-sans text-sm text-brand-bonewhite font-light leading-relaxed mb-0">{bio}</p>
        </div>
      </div>
    </div>
  );
}
