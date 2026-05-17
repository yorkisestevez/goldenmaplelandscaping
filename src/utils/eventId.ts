/**
 * One-shot event ID for browser↔server CAPI deduplication.
 *
 * Meta dedupes a Pixel event and a Conversions API event when they share
 * the same `eventID` (browser fbq) / `event_id` (server CAPI) AND fire
 * within the same window. We generate a UUID per form submit, pass it
 * to `fbq('track', 'Lead', {...}, {eventID})` AND ship it through the
 * Netlify form as a hidden field. The CAPI sender on the bridge uses
 * the same value, so Meta sees one logical event from two sources.
 */

export function genEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for ancient browsers — RFC4122 v4 from Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
