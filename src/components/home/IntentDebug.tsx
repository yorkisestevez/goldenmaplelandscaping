import { useEffect, useState } from 'react';
import { HOME_SERVICES, type HomeSegment } from './intent';
import { refreshIntent, type IntentSnapshot } from './intentStore';

/**
 * `?gm_debug=1` shows why the homepage chose what it chose: the segment on
 * screen, the segment the visitor's history points to, and the scores behind
 * it. For the owner and for testing; never rendered otherwise.
 */
export default function IntentDebug({ segment }: { segment: HomeSegment }) {
  const [snapshot, setSnapshot] = useState<IntentSnapshot | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('gm_debug') !== '1') return;
    setEnabled(true);
    setSnapshot(refreshIntent());
  }, []);

  if (!enabled) return null;
  return (
    <aside data-home-debug className="fixed left-3 top-24 z-[80] w-56 rounded-2xl bg-brand-black p-4 font-sans text-xs text-brand-porcelain shadow-xl">
      <p className="mb-2 font-semibold">Homepage intent</p>
      <p>Showing: <strong data-debug="showing">{segment}</strong></p>
      <p className="mb-2">History says: <strong data-debug="scored">{snapshot?.segment ?? 'unavailable'}</strong></p>
      {snapshot && HOME_SERVICES.map((service) => (
        <p key={service} className="flex justify-between"><span>{service}</span><span>{snapshot.scores[service].toFixed(1)}</span></p>
      ))}
    </aside>
  );
}
