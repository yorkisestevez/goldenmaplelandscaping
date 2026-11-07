import { Link } from 'react-router-dom';
import AuthorBio from './AuthorBio';
import { BUSINESS } from '../data/business';
import { FOUNDER } from '../data/founder';
import { BOOKING_WINDOW, PAGE_UPDATES, type PageUpdateKey } from '../data/pageUpdates';
import { displayDate, webPageNode } from '../utils/schema';

/** WebPage node for a page with an update record (src/data/pageUpdates.ts). */
export function pageUpdateNode(key: PageUpdateKey, path: string, name: string) {
  const update = PAGE_UPDATES[key];
  return webPageNode({ path, name, dateModified: update.updatedOn, reviewed: 'reviewedBy' in update });
}

/** Visible "Last updated: <date> · Reviewed by Yorkis Estevez" line; the review part only when recorded. */
export function LastUpdatedLine({ updatedOn, reviewed, className = '' }: { updatedOn: string; reviewed: boolean; className?: string }) {
  return (
    <p className={`font-sans text-[12px] tracking-[0.05em] text-brand-muted ${className}`}>
      Last updated: <time dateTime={updatedOn}>{displayDate(updatedOn)}</time>
      {reviewed && (
        <>
          {' · '}Reviewed by{' '}
          <Link to={FOUNDER.profilePath} className="text-brand-gold-dark hover:text-brand-bonewhite transition-colors">
            {FOUNDER.name}
          </Link>
        </>
      )}
    </p>
  );
}

/** Plain-text booking window (owner wording). */
export function BookingWindow({ className = '' }: { className?: string }) {
  return <p className={`font-sans text-[15px] text-brand-bonewhite font-light ${className}`}>{BOOKING_WINDOW}</p>;
}

/** Service-page freshness strip: last updated + reviewer, then the booking window. */
export function ServicePageFreshness({ updateKey, className = '' }: { updateKey: PageUpdateKey; className?: string }) {
  const update = PAGE_UPDATES[updateKey];
  return (
    <div className={`space-y-2 ${className}`}>
      <LastUpdatedLine updatedOn={update.updatedOn} reviewed={'reviewedBy' in update} />
      <BookingWindow />
    </div>
  );
}

/** Founder/reviewer block for service pages — the shared AuthorBio with confirmed founder facts only. */
export function ServiceReviewer({ updateKey }: { updateKey: PageUpdateKey }) {
  const reviewed = 'reviewedBy' in PAGE_UPDATES[updateKey];
  const bio = `${FOUNDER.name} is the ${FOUNDER.role} of ${BUSINESS.publicName.value} in Barrie, Ontario.${reviewed ? ` ${FOUNDER.name.split(' ')[0]} reviewed the scope and process on this page.` : ''}`;
  return (
    <div className="max-w-3xl mx-auto">
      <AuthorBio bio={bio} />
    </div>
  );
}
