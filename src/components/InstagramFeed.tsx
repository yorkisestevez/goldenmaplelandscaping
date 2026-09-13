import { ArrowRight, Heart, Instagram } from 'lucide-react';
import { BUSINESS } from '../data/business';
import { INSTAGRAM_ACCOUNT, INSTAGRAM_POSTS } from '../data/instagram';
import { trackEngagement } from '../utils/analytics';
import { cn } from '../utils/cn';
import ResponsiveImage from './ResponsiveImage';
import Reveal from './Reveal';

export interface InstagramFeedProps {
  limit?: number;
  className?: string;
}

/**
 * "Latest from the job site" — build-time JSON, no runtime fetch. Renders nothing
 * when the feed is empty so the site never depends on a fetch having run.
 */
export default function InstagramFeed({ limit = 8, className }: InstagramFeedProps) {
  const posts = INSTAGRAM_POSTS.slice(0, limit);
  if (posts.length === 0) return null;
  const handle = INSTAGRAM_ACCOUNT.username ?? 'goldenmaplelandscaping.ca';
  const profileUrl = INSTAGRAM_ACCOUNT.url ?? BUSINESS.urls.instagram.value;

  return (
    <section className={cn('section-padding bg-brand-nearblack', className)} aria-labelledby="instagram-heading">
      <div className="container-custom">
        <div className="mb-12 flex flex-col justify-between gap-6 border-t border-brand-dim pt-10 md:flex-row md:items-end">
          <div>
            <p className="mb-4 font-sans text-[10px] font-medium uppercase tracking-[0.22em] text-brand-gold-dark">On Instagram</p>
            <h2 id="instagram-heading" className="font-display text-4xl font-light text-brand-ink md:text-6xl">
              Latest from the job site.
            </h2>
            <p className="mt-4 max-w-md font-sans text-sm font-light leading-relaxed text-brand-muted">
              Progress photos and finished work, posted as projects wrap up.
            </p>
          </div>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEngagement('outbound_click', 'instagram_header')}
            className="home-project-link self-start md:self-auto"
          >
            <Instagram size={15} aria-hidden="true" /> @{handle}
          </a>
        </div>

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3" aria-label="Recent Instagram posts">
          {posts.map((post, i) => (
            <li key={post.id}>
              <Reveal delay={Math.min(i, 7) * 0.04}>
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEngagement('outbound_click', 'instagram_feed')}
                  aria-label={`${post.caption || 'Instagram post'} — view on Instagram`}
                  className="group relative block overflow-hidden rounded-[2px] border border-brand-dim/40 bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  <ResponsiveImage
                    image={post.image}
                    sizes="(min-width: 640px) 25vw, 50vw"
                    aspect="1/1"
                    className="transition-transform duration-700 motion-safe:group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 flex flex-col justify-end bg-brand-black/75 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    <span className="mb-2 flex items-center gap-2 font-sans text-xs text-brand-porcelain">
                      <Heart size={14} strokeWidth={1.5} aria-hidden="true" /> {post.likeCount}
                    </span>
                    {post.caption && (
                      <span className="line-clamp-2 font-sans text-xs font-light leading-snug text-brand-porcelain">{post.caption}</span>
                    )}
                  </div>
                </a>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal className="mt-12 text-center">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEngagement('outbound_click', 'instagram_follow')}
            className="btn-ghost inline-flex items-center gap-3"
          >
            Follow @{handle} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
