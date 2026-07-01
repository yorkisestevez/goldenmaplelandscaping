import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: 'src',
  // Static SPA (no runtime SSR) + build-time prerender of a route list.
  ssr: false,
  async prerender() {
    // PHASE 1: prerender the 4 known-SSR-safe hand-built service pages to prove
    // content + schema land in static HTML on the REAL app. Unlisted routes fall
    // back to client-side SPA (no worse than today). Phase 2 expands this list to
    // all ~70 routes (pulled from serviceLocations.ts + sitemap.xml).
    return [
      '/services/interlocking-barrie',
      '/services/retaining-walls-barrie',
      '/services/composite-decking-barrie',
      '/services/landscape-design-barrie',
    ];
  },
} satisfies Config;
