import { type ReactNode, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from 'react-router';
// Global styles: Tailwind v4 + the @theme brand tokens live here. In RR7 framework
// mode this side-effect import is what makes Vite emit the stylesheet and <Links/>
// link it — without it the whole site renders unstyled. (Regression from the
// main.tsx -> root.tsx migration; main.tsx used to carry this import.)
import './index.css';
import SiteChrome from './components/Layout';
import { initAnalytics, trackPageView } from './utils/analytics';
import { initAttributionCapture } from './utils/utmCapture';
import { initBehaviorCapture } from './utils/behavior';
import { BUSINESS, canPublish, publicContact, publicPostalAddress, publicGbpServiceAreas } from './data/business';

// Canonical business entity for all routes. Publication status lives in
// src/data/business.ts; unverified review data intentionally never enters schema.
const businessGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['LocalBusiness', 'HomeAndConstructionBusiness', 'GeneralContractor'],
      '@id': `${BUSINESS.canonicalUrl}/#business`,
      name: BUSINESS.publicName.value,
      description: `${BUSINESS.publicName.value}: discuss ${BUSINESS.services.value.join(', ')}. Confirm project scope and availability for your address.`,
      url: `${BUSINESS.canonicalUrl}/`,
      image: `${BUSINESS.canonicalUrl}/logo-mark.png`,
      logo: `${BUSINESS.canonicalUrl}/logo-mark.png`,
      ...(canPublish(BUSINESS.founder) ? { founder: { '@type': 'Person', name: BUSINESS.founder.value.name } } : {}),
      ...(canPublish(BUSINESS.foundingYear) ? { foundingDate: BUSINESS.foundingYear.value } : {}),
      telephone: publicContact.phoneTel,
      email: publicContact.email,
      priceRange: '$$$',
      currenciesAccepted: 'CAD',
      address: publicPostalAddress(),
      areaServed: publicGbpServiceAreas.map((name) => ({ '@type': 'City', name })),
      ...(canPublish(BUSINESS.hours) ? { openingHoursSpecification: BUSINESS.hours.value.map((hours) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: hours.days,
        opens: hours.opens,
        closes: hours.closes,
      })) } : {}),
      sameAs: [
        BUSINESS.urls.facebook.value,
        BUSINESS.urls.instagram.value,
        BUSINESS.urls.homeStars.value,
        BUSINESS.urls.yelp.value,
        BUSINESS.urls.yellowPages.value,
      ],
    },
  ],
};

const gscToken = import.meta.env.VITE_SEARCH_CONSOLE_TOKEN as string | undefined;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#F7F5F0" />
        <meta name="msvalidate.01" content="F7FE7E3677ED01FC13ECAF1154E928B8" />
        {gscToken ? <meta name="google-site-verification" content={gscToken} /> : null}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/favicon-180.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <Meta />
        <Links />
        {/* Static Google tag so Ads Goals scanners see AW-10839158941 without waiting for JS hydrate. send_page_view stays false. */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-1BRTV91W3Z" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-1BRTV91W3Z',{send_page_view:false});gtag('config','AW-10839158941');",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(businessGraph) }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const location = useLocation();

  // Client-only analytics + attribution init (was in App.tsx).
  useEffect(() => {
    initAttributionCapture();
    initBehaviorCapture();
    initAnalytics();
  }, []);

  // GA4 + Meta Pixel page_view + scroll-to-top on route change.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  // The cost estimator runs as a full-screen app: its page ships its own
  // minimal top bar, and the global navbar/footer/chat would fight the
  // wizard's sticky bars for attention (Layout already hid the mobile dock
  // there — this completes that thought).
  const bareApp = location.pathname.startsWith('/cost-estimator') || location.pathname.startsWith('/deck-designer');

  return (
    <HelmetProvider>
      {bareApp ? (
        <main>
          <Outlet />
        </main>
      ) : (
        <SiteChrome>
          <Outlet />
        </SiteChrome>
      )}
    </HelmetProvider>
  );
}
