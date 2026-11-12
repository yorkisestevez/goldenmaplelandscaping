import { useSyncExternalStore } from 'react';
import { trackMeasure } from '../../utils/analytics';
import { setHomeExposure } from '../../utils/behavior';
import { armsFor, pickArm, prerenderedArm, type HomeArm } from './composition';
import type { HomeSegment } from './intent';

/**
 * Which version of the homepage a visitor gets, and the record of it. A
 * visitor keeps the same arm for a segment across visits, so what they saw is
 * what any later enquiry is credited to.
 */
const ARM_STORAGE_KEY = 'gm_home_arm';

function readAssignments(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ARM_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The visitor's arm for a segment: the one they already have if it still exists, otherwise a weighted draw. */
function assignArm(segment: HomeSegment): HomeArm {
  const arms = armsFor(segment);
  const assignments = readAssignments();
  const kept = arms.find((arm) => arm.id === assignments[segment]);
  if (kept) return kept;
  const drawn = pickArm(arms, Math.random());
  try {
    window.localStorage.setItem(ARM_STORAGE_KEY, JSON.stringify({ ...assignments, [segment]: drawn.id }));
  } catch {
    // Storage blocked: the visitor gets an arm for this view and a fresh draw next time.
  }
  return drawn;
}

/** Fixed for as long as the homepage stays open, like the segment it belongs to. */
let pageArm: { segment: HomeSegment; arm: HomeArm } | null = null;

function armSnapshot(segment: HomeSegment): HomeArm {
  if (pageArm?.segment !== segment) pageArm = { segment, arm: assignArm(segment) };
  return pageArm.arm;
}

const subscribe = () => () => {};

/** The prerendered arm while prerendering and hydrating, then the visitor's own. */
export function useHomeArm(segment: HomeSegment): HomeArm {
  return useSyncExternalStore(subscribe, () => armSnapshot(segment), prerenderedArm);
}

export function releaseHomeArm(): void {
  pageArm = null;
}

/** Event names carry the segment and arm, so counts can be read per arm without any GA4 custom dimension. */
const eventName = (kind: 'view' | 'act', segment: HomeSegment, arm: HomeArm) => `home_${kind}_${segment}_${arm.id}`;

/**
 * Record that this visitor saw this version: once as an analytics event, and
 * in the session so every form they submit later carries it.
 */
export function recordHomeView(segment: HomeSegment): void {
  const arm = armSnapshot(segment);
  setHomeExposure(segment, arm.id);
  trackMeasure(eventName('view', segment, arm));
}

/** Record the first step toward an enquiry taken from the homepage in this view. */
export function recordHomeAction(segment: HomeSegment): void {
  trackMeasure(eventName('act', segment, armSnapshot(segment)));
}
