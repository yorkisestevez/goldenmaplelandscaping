import { createContext, useContext } from 'react';
import type { HomeSegment } from './intent';

export interface HomeIntent {
  segment: HomeSegment;
  /** Estimator location key the visitor priced or read about, if known. */
  city: string | null;
}

const HomeIntentContext = createContext<HomeIntent>({ segment: 'default', city: null });

export const HomeIntentProvider = HomeIntentContext.Provider;

/** What the homepage knows about this visitor. Blocks that adapt read it; the rest ignore it. */
export function useHomeIntent(): HomeIntent {
  return useContext(HomeIntentContext);
}
