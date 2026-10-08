/**
 * Run once, on the first input or after `timeout` ms.
 * The wait is a real timer. requestIdleCallback's timeout is only a maximum,
 * so scheduling it immediately runs in the first quiet gap and pulls chat
 * and fonts back into the Lighthouse trace.
 */
export function onInteractOrIdle(run: () => void, timeout = 8000): () => void {
  if (typeof window === 'undefined') return () => {};
  let done = false;
  let idle = 0;
  let timer = 0;
  const start = () => {
    if (done) return;
    done = true;
    cleanup();
    run();
  };
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  const cleanup = () => {
    events.forEach((event) => window.removeEventListener(event, start));
    if (idle) window.cancelIdleCallback(idle);
    if (timer) window.clearTimeout(timer);
  };
  events.forEach((event) => window.addEventListener(event, start, { once: true, passive: true }));
  timer = window.setTimeout(() => {
    timer = 0;
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(start, { timeout: 1500 });
    else start();
  }, timeout);
  return cleanup;
}

/**
 * Run once, on the first input or when the browser is idle, whichever is first.
 * `timeout` caps the idle wait (requestIdleCallback's timeout). A visitor who
 * never touches the page still runs within that cap, so a tag scheduled here
 * is not interaction-only.
 */
export function onInteractOrSoon(run: () => void, timeout = 2500): () => void {
  if (typeof window === 'undefined') return () => {};
  let done = false;
  let idle = 0;
  let timer = 0;
  const start = () => {
    if (done) return;
    done = true;
    cleanup();
    run();
  };
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  const cleanup = () => {
    events.forEach((event) => window.removeEventListener(event, start));
    if (idle && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
    if (timer) window.clearTimeout(timer);
  };
  events.forEach((event) => window.addEventListener(event, start, { once: true, passive: true }));
  if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(start, { timeout });
  else timer = window.setTimeout(start, timeout);
  return cleanup;
}
