import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyConsent, readStoredConsent, type ConsentChoice } from '../utils/analytics';

/**
 * Accept / decline for Google Consent Mode v2. Ontario visitors get a simple
 * choice. The banner is fixed so it does not shift page content. A stored
 * choice is applied in the document head before gtag config; this only shows
 * when there is no choice yet.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(readStoredConsent() === null);
  }, []);

  if (!open) return null;

  const choose = (choice: ConsentChoice) => {
    applyConsent(choice);
    setOpen(false);
  };

  return (
    <div
      className="gm-consent"
      role="dialog"
      aria-label="Cookie choices"
    >
      <p>
        We use cookies to measure visits and ads. Accept to allow analytics and advertising cookies, or decline to leave them off.{' '}
        <Link to="/privacy">Privacy policy</Link>
      </p>
      <div className="gm-consent-actions">
        <button type="button" className="gm-consent-decline" onClick={() => choose('denied')}>
          Decline
        </button>
        <button type="button" className="gm-consent-accept" onClick={() => choose('granted')}>
          Accept
        </button>
      </div>
    </div>
  );
}
