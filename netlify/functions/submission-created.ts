// Drop into: golden-maple-landscaping/netlify/functions/submission-created.ts
//
// Netlify auto-fires this on every form submission (no config needed beyond
// the file existing). It sees the full payload including hidden UTM fields
// captured by src/utils/utmCapture.ts.

import crypto from 'node:crypto';

interface NetlifySubmission {
  form_name: string;
  data: Record<string, string>;
  created_at: string;
  ip: string;
  user_agent: string;
  referrer?: string;
  site_url?: string;
}

interface NetlifyEvent {
  body: string;
  headers: Record<string, string>;
}

export const handler = async (event: NetlifyEvent) => {
  const bridgeUrl = process.env.GM_CRM_BRIDGE_URL;
  const bridgeSecret = process.env.GM_CRM_BRIDGE_SECRET;
  if (!bridgeUrl || !bridgeSecret) {
    console.error('GM_CRM_BRIDGE_URL or GM_CRM_BRIDGE_SECRET not set in Netlify env');
    return { statusCode: 500, body: 'bridge not configured' };
  }

  let submission: { payload: NetlifySubmission };
  try {
    submission = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'invalid json' };
  }

  const { payload } = submission;
  // payload.data carries every form field including the hidden `event_id`
  // (browser-generated UUID for Meta CAPI dedup). The spread preserves it.
  const flat = {
    form_name: payload.form_name,
    ...payload.data,
    netlify_created_at: payload.created_at,
    netlify_ip: payload.ip,
    netlify_user_agent: payload.user_agent,
    netlify_referrer: payload.referrer || '',
  };

  const body = JSON.stringify(flat);
  const sig = crypto.createHmac('sha256', bridgeSecret).update(body).digest('hex');

  try {
    const res = await fetch(bridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Signature': sig,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`bridge returned ${res.status}: ${text}`);
      return { statusCode: 502, body: `bridge error: ${res.status}` };
    }
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`bridge fetch failed: ${msg}`);
    return { statusCode: 502, body: `bridge unreachable: ${msg}` };
  }
};
