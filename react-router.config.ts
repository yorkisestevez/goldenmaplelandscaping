import type { Config } from '@react-router/dev/config';
import { getAutoCombos } from './src/data/serviceLocations';

export default {
  appDirectory: 'src',
  // Static SPA (no runtime SSR) + build-time prerender of every route.
  ssr: false,
  async prerender({ getStaticPaths }) {
    // All static (non-param) routes come from the route config automatically.
    const staticPaths = getStaticPaths();
    // Dynamic /services/:slug — 28 service×location combos (excludes the 4 hand-built Barrie pages).
    const serviceCombos = getAutoCombos().map((c) => `/services/${c.slug}`);
    // Dynamic /locations/:slug — the 4 auto location landings.
    const autoLocations = ['orillia', 'wasaga-beach', 'midland', 'collingwood'].map(
      (s) => `/locations/${s}`,
    );
    // NOTE: /portfolio/:slug is left to SPA fallback for now (low SEO value; add later).
    return [...staticPaths, ...serviceCombos, ...autoLocations];
  },
} satisfies Config;
