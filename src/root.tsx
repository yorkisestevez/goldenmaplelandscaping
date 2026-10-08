import { type ReactNode, useEffect } from 'react';
import { ConsentBanner } from './components/ConsentBanner';
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
import { siteGraph } from './utils/schema';

// Canonical entity graph for all routes: #website, the ONE typed #business node
// and (when publishable) the #yorkis-estevez Person. Pages reference these ids
// instead of re-declaring the business — see src/utils/schema.ts.
const businessGraph = siteGraph();

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              '</script><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter:wght@300;400;500;600&display=swap" media="print" onload="this.media=\'all\'" /><script>',
          }}
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter:wght@300;400;500;600&display=swap"
          />
        </noscript>
        <Meta />
        <Links />
        {/* Static Google tag so Ads Goals scanners see AW-10839158941 without waiting for JS hydrate.
            Consent defaults to denied, then upgrades when a stored choice is granted, before config.
            Both tags use send_page_view:false so the SPA sends one page_view per destination. */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-1BRTV91W3Z" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});try{if(localStorage.getItem('gm-consent')==='granted'){gtag('consent','update',{ad_storage:'granted',analytics_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});}}catch(e){}gtag('js',new Date());gtag('config','G-1BRTV91W3Z',{send_page_view:false});gtag('config','AW-10839158941',{send_page_view:false});",
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
      <ConsentBanner />
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
