import { lazy, Suspense, type ComponentType } from 'react';
import type { BlockId } from './composition';
import InstantEstimate from './blocks/InstantEstimate';
import SelectedWork from './blocks/SelectedWork';
import ServicesGrid from './blocks/ServicesGrid';
import WhyGoldenMaple from './blocks/WhyGoldenMaple';
import GoogleReviews from './blocks/GoogleReviews';
import HomeFaq from './blocks/HomeFaq';
import FinalCTA from './blocks/FinalCTA';

/** Below-the-fold components that were already code-split on the old homepage. */
const deferred = (load: () => Promise<{ default: ComponentType }>): ComponentType => {
  const Lazy = lazy(load);
  return () => (
    <Suspense fallback={null}>
      <Lazy />
    </Suspense>
  );
};

/**
 * One component per block id; a new id in BLOCK_IDS fails the build until it is mapped.
 * "pain-points" is supplied by src/pages/Home.tsx, where its ledger-approved copy has to live.
 */
export const BLOCKS: Record<Exclude<BlockId, 'pain-points'>, ComponentType> = {
  'instant-estimate': InstantEstimate,
  'selected-work': SelectedWork,
  process: deferred(() => import('../Process')),
  services: ServicesGrid,
  founder: deferred(() => import('../Manifesto')),
  why: WhyGoldenMaple,
  reviews: GoogleReviews,
  instagram: deferred(() => import('../InstagramFeed')),
  faq: HomeFaq,
  'buyers-guide': deferred(() => import('../BuyersGuide')),
  'final-cta': FinalCTA,
};
