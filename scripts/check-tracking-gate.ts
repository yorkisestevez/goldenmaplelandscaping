// Tracking gate — run via `npm run lint`.
// Our own runs (local builds, CI e2e on 127.0.0.1, headless captures of the live
// site) made up most of GA4's traffic in October 2026 and fired test leads.
// Only a real visitor on the live host may reach GA4, Ads, Meta or Clarity.

import assert from 'node:assert/strict';
import { BUSINESS } from '../src/data/business';
import { NO_TRACK_KEY, decideTracking, isTrackedVisit, noTrackParam, type TrackingStorage } from '../src/utils/trackingGate';

let checks = 0;
const ok = (value: boolean, message: string) => {
  assert.equal(value, true, message);
  checks++;
};

const liveHost = new URL(BUSINESS.canonicalUrl).hostname;
const visitor = { hostname: liveHost, webdriver: false, optedOut: false, testOptIn: false };

ok(isTrackedVisit(visitor), 'a real visitor on the live host is tracked');
ok(isTrackedVisit({ ...visitor, hostname: `www.${liveHost}` }), 'the www host is tracked');
for (const hostname of ['127.0.0.1', 'localhost', '6aa0b7cd7e91fc1960289e1d--goldenmaple.netlify.app', 'goldenmaplelandscaping-ca.translate.goog', '']) {
  ok(!isTrackedVisit({ ...visitor, hostname }), `${hostname || '(no host)'} is not tracked`);
}
ok(!isTrackedVisit({ ...visitor, webdriver: true }), 'an automated browser on the live host is not tracked');
ok(!isTrackedVisit({ ...visitor, optedOut: true }), 'a browser opted out with ?notrack=1 is not tracked');
// The e2e spec that checks real tag behaviour opts in explicitly; nothing else does.
ok(isTrackedVisit({ hostname: '127.0.0.1', webdriver: true, optedOut: true, testOptIn: true }), 'the test opt-in overrides every gate');

ok(noTrackParam('?notrack=1') === true, '?notrack=1 opts out');
ok(noTrackParam('?utm_source=x&notrack=0') === false, '?notrack=0 opts back in');
ok(noTrackParam('?notrack=yes') === null, 'other values leave the stored choice alone');
ok(noTrackParam('') === null, 'no parameter leaves the stored choice alone');

// The decision reads and stores the parameter; storage can be missing or throw (private mode, blocked site data).
const memory = (initial: Record<string, string> = {}): TrackingStorage & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
};
const throwing: TrackingStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
const env = { hostname: liveHost, webdriver: false, testOptIn: false, search: '', storage: memory() };

ok(decideTracking(env), 'a real visitor with nothing stored is tracked');
const optingOut = memory();
ok(!decideTracking({ ...env, search: '?notrack=1', storage: optingOut }), '?notrack=1 stops tracking on that page');
ok(optingOut.data[NO_TRACK_KEY] === '1', '?notrack=1 is remembered');
ok(!decideTracking({ ...env, storage: optingOut }), 'a remembered opt-out stops tracking on later pages');
ok(decideTracking({ ...env, search: '?notrack=0', storage: optingOut }) && !(NO_TRACK_KEY in optingOut.data), '?notrack=0 clears it');
ok(!decideTracking({ ...env, search: '?notrack=1', storage: throwing }), 'storage that throws still honours ?notrack=1 for the page');
ok(decideTracking({ ...env, storage: throwing }), 'storage that throws leaves a real visitor tracked');
ok(decideTracking({ ...env, storage: null }), 'no storage at all leaves a real visitor tracked');
ok(!decideTracking({ ...env, hostname: '127.0.0.1' }), 'a test host is not tracked whatever is stored');

console.log(`check-tracking-gate: ${checks} checks passed`);
