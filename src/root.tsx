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
        'https://www.instagram.com/goldenmaplelandscaping',
        'https://www.homestars.com/companies/2982995-golden-maple-landscaping',
        'https://www.yelp.com/biz/golden-maple-landscaping-barrie-4',
        'https://www.yellowpages.ca/bus/Ontario/Barrie/Golden-Maple-Landscaping/102788299.html',
      ],
      // Real Google Business Profile aggregate + reviews (verified 2026-07-01 from the
      // public Maps listing). NOTE: true Google count is 8 — not the 42 claimed elsewhere.
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '5.0',
        reviewCount: '8',
      },
      review: [
        {
          '@type': 'Review',
          author: { '@type': 'Person', name: 'Rio Sheri' },
          datePublished: '2025-10',
          reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
          reviewBody:
            "We couldn't be happier with the work Yorkis and team from Golden Maple Landscaping did for us! They completely redid our stairs and walkway, and the results are absolutely beautiful. The craftsmanship is top-notch.",
        },
        {
          '@type': 'Review',
          author: { '@type': 'Person', name: 'Cory Walker' },
          datePublished: '2026-03',
          reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
          reviewBody:
            'Golden Maple Landscaping did an outstanding job. From the first conversation to the final walkthrough, everything was handled professionally and with real attention to detail.',
        },
        {
          '@type': 'Review',
          author: { '@type': 'Person', name: 'Joseph Perri' },
          datePublished: '2026-03',
          reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
          reviewBody:
            'Golden Maple Landscaping was excellent to work with. I hired them to complete a patio project, and they went above and beyond expectations.',
        },
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
        <meta name="theme-color" content="#F3EEE3" />
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

  // The cost estimator runs as a full-screen app: its page ships its own
  // minimal top bar, and the global navbar/footer/chat would fight the
  // wizard's sticky bars for attention (Layout already hid the mobile dock
  // there — this completes that thought).
  const bareApp = location.pathname.startsWith('/cost-estimator');

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
