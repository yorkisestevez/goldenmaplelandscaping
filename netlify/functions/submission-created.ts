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

const BRIDGE_ATTEMPTS = 3;

function isHoneypot(data: Record<string, string> | undefined): boolean {
  if (!data) return false;
  return ['bot-field', 'bot_field'].some((key) => String(data[key] ?? '').trim() !== '');
}

async function postBridge(
  url: string,
  secret: string,
  body: string,
): Promise<{ statusCode: number; body: string }> {
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  let lastDetail = 'unknown';

  for (let attempt = 1; attempt <= BRIDGE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Signature': sig,
        },
        body,
      });
      if (res.ok) return { statusCode: 200, body: 'ok' };
      const text = await res.text().catch(() => '');
      lastDetail = `${res.status}: ${text}`;
      console.error(`bridge returned ${res.status} (attempt ${attempt}/${BRIDGE_ATTEMPTS}): ${text}`);
      // Retry 5xx and 429. Permanent 4xx should not burn the remaining attempts.
      if (res.status < 500 && res.status !== 429) {
        return { statusCode: 502, body: `bridge error: ${res.status}` };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastDetail = msg;
      console.error(`bridge fetch failed (attempt ${attempt}/${BRIDGE_ATTEMPTS}): ${msg}`);
    }

    if (attempt < BRIDGE_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  return { statusCode: 502, body: `bridge unreachable after ${BRIDGE_ATTEMPTS} attempts: ${lastDetail}` };
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
  if (isHoneypot(payload.data)) {
    console.log(`skipping honeypot submission for ${payload.form_name}`);
    return { statusCode: 200, body: 'ignored honeypot' };
  }

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

  return postBridge(bridgeUrl, bridgeSecret, JSON.stringify(flat));
};
