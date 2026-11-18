import type { Config } from '@react-router/dev/config';
import { getAutoCombos } from './src/data/serviceLocations';
import { PROJECTS } from './src/data/projects';
import { LIBRARY_SECTIONS } from './src/data/library';

export default {
  appDirectory: 'src',
  // Scan route dependencies before serving React; late optimizer reloads can mix hook runtimes on a cold start.
  future: { unstable_optimizeDeps: true },
  // Static SPA (no runtime SSR) + build-time prerender of every route.
  ssr: false,
  async prerender({ getStaticPaths }) {
    // All static (non-param) routes come from the route config automatically.
    const staticPaths = getStaticPaths().filter((p) => !p.includes('*'));
    // Dynamic /services/:slug — 36 service×location combos (excludes the 4 hand-built Barrie pages).
    const serviceCombos = getAutoCombos().map((c) => `/services/${c.slug}`);
    // Dynamic /locations/:slug — the 6 auto location landings.
    const autoLocations = ['orillia', 'wasaga-beach', 'midland', 'collingwood', 'bradford-west-gwillimbury', 'newmarket', 'alliston', 'angus', 'keswick', 'thornton', 'elmvale', 'stayner'].map(
      (s) => `/locations/${s}`,
    );
    // Dynamic /portfolio/:slug — one route per attested project (src/data/projects.ts).
    const projects = PROJECTS.map((p) => `/portfolio/${p.slug}`);
    // Dynamic /library/:section — one hub per Library topic (src/data/library.ts).
    const librarySections = LIBRARY_SECTIONS.map((s) => `/library/${s.slug}`);
    return [...staticPaths, '/404', ...serviceCombos, ...autoLocations, ...projects, ...librarySections];
  },
} satisfies Config;
