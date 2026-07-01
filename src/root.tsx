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
import SiteChrome from './components/Layout';
import { initAnalytics, trackPageView } from './utils/analytics';
import { initAttributionCapture } from './utils/utmCapture';
import { initBehaviorCapture } from './utils/behavior';

// Canonical business entity — ported verbatim from the PR #39 index.html #business
// node so it prerenders into the <head> of every page (visible to non-JS AI crawlers).
const businessGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['LocalBusiness', 'HomeAndConstructionBusiness', 'GeneralContractor'],
      '@id': 'https://goldenmaplelandscaping.ca/#business',
      name: 'Golden Maple Landscaping',
      description:
        'Premium hardscape and interlocking contractor in Barrie & Simcoe County, Ontario. Engineered paver patios, driveways, retaining walls, composite decks and outdoor-living builds on a 12-16 inch base for the Ontario freeze-thaw cycle.',
      url: 'https://goldenmaplelandscaping.ca/',
      image:
        'https://goldenmaplelandscaping.ca/images/projects/Golden%20Maple%20deck%20and%20walkway.jpg',
      logo: 'https://goldenmaplelandscaping.ca/logo-mark.png',
      founder: { '@type': 'Person', name: 'Yorkis Estevez' },
      foundingDate: '2020',
      telephone: '+17055003581',
      email: 'yorkis@goldenmaplelandscaping.ca',
      priceRange: '$$$',
      currenciesAccepted: 'CAD',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Barrie',
        addressRegion: 'ON',
        postalCode: 'L4N',
        addressCountry: 'CA',
      },
      geo: { '@type': 'GeoCoordinates', latitude: 44.3894, longitude: -79.6903 },
      areaServed: [
        { '@type': 'City', name: 'Barrie' },
        { '@type': 'City', name: 'Innisfil' },
        { '@type': 'City', name: 'Oro-Medonte' },
        { '@type': 'City', name: 'Springwater' },
        { '@type': 'City', name: 'Orillia' },
        { '@type': 'City', name: 'Wasaga Beach' },
        { '@type': 'City', name: 'Midland' },
        { '@type': 'City', name: 'Collingwood' },
      ],
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '08:00',
          closes: '18:00',
        },
      ],
      sameAs: [
        'https://www.facebook.com/GoldenMaplegroup',
        'https://www.homestars.com/companies/2982995-golden-maple-landscaping',
        'https://www.yelp.com/biz/golden-maple-landscaping-barrie-4',
        'https://www.yellowpages.ca/bus/Ontario/Barrie/Golden-Maple-Landscaping/102788299.html',
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
        <meta name="theme-color" content="#0C120E" />
        <meta name="msvalidate.01" content="F7FE7E3677ED01FC13ECAF1154E928B8" />
        {gscToken ? <meta name="google-site-verification" content={gscToken} /> : null}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/favicon-180.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <Meta />
        <Links />
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

  return (
    <HelmetProvider>
      <SiteChrome>
        <Outlet />
      </SiteChrome>
    </HelmetProvider>
  );
}
