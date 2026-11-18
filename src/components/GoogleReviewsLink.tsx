import { OWNER_FACTS, googleReviewBadge, ownerLink } from '../data/ownerFacts';

/** Link out to Google. No stars, count, or excerpt until those slots are filled. */
export default function GoogleReviewsLink({
  className = '',
  prefix,
}: {
  className?: string;
  prefix?: string;
}) {
  const href = ownerLink(OWNER_FACTS.googleReviewsUrl);
  if (!href) return null;
  const badge = googleReviewBadge();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {prefix ? `${prefix} ` : ''}
      {badge ?? 'Read our Google reviews'}
    </a>
  );
}
