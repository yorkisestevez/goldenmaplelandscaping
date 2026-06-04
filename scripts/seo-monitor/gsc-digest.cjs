#!/usr/bin/env node
// scripts/seo-monitor/gsc-digest.cjs
//
// Weekly Search Console digest for goldenmaplelandscaping.ca.
// Pulls last-7-day impressions/clicks/avg-position per /resources/* URL
// from Google Search Console and Telegrams the operator.
//
// Setup (one-time, ~20 min):
//   1. Create a Google Cloud project + enable "Search Console API"
//   2. Create a service account, download the JSON key
//   3. In Search Console, add the service-account email
//      (xxx@xxx.iam.gserviceaccount.com) as a property user with Restricted
//      access on goldenmaplelandscaping.ca
//   4. Paste the FULL service-account JSON as the repo secret
//      GSC_SERVICE_ACCOUNT_JSON
//
// Run weekly via .github/workflows/seo-digest.yml (every Sat 14:00 UTC).
//
// Graceful: if GSC_SERVICE_ACCOUNT_JSON is unset, this script logs and exits
// 0 (does NOT crash the workflow). The workflow remains a no-op until the
// secret is set.

const crypto = require('crypto');
const https = require('https');

const SITE_URL = 'https://goldenmaplelandscaping.ca';
const GSC_PROPERTY = 'https://goldenmaplelandscaping.ca/';

// =============================================================================
// JWT signing for Google service-account auth (no external npm deps)
// =============================================================================

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signJwt(serviceAccount) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = base64url(signer.sign(serviceAccount.private_key));
  return `${signingInput}.${signature}`;
}

function postJson(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type': typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
        timeout: 30000,
      },
      (res) => {
        let result = '';
        res.on('data', (c) => (result += c));
        res.on('end', () => {
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${result.slice(0, 500)}`));
          try { resolve(JSON.parse(result)); } catch { resolve({ raw: result }); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
    req.write(data);
    req.end();
  });
}

async function getAccessToken(serviceAccount) {
  const jwt = signJwt(serviceAccount);
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`;
  const res = await postJson('oauth2.googleapis.com', '/token', body);
  if (!res.access_token) throw new Error('No access_token in OAuth response: ' + JSON.stringify(res).slice(0, 200));
  return res.access_token;
}

// =============================================================================
// GSC query — last 7 days per page
// =============================================================================

function ymd(d) { return d.toISOString().slice(0, 10); }

async function querySearchAnalytics(accessToken) {
  const now = new Date();
  const end = new Date(now.getTime() - 2 * 86400000);    // GSC has 2-day delay
  const start = new Date(end.getTime() - 7 * 86400000);

  const path = `/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/searchAnalytics/query`;
  const body = {
    startDate: ymd(start),
    endDate: ymd(end),
    dimensions: ['page'],
    rowLimit: 100,
  };
  const res = await postJson('searchconsole.googleapis.com', path, body, {
    Authorization: `Bearer ${accessToken}`,
  });
  return { rows: res.rows || [], startDate: body.startDate, endDate: body.endDate };
}

// =============================================================================
// Digest formatting + Telegram
// =============================================================================

function formatDigest({ rows, startDate, endDate }) {
  // Aggregates
  const totalImpressions = rows.reduce((a, r) => a + (r.impressions || 0), 0);
  const totalClicks = rows.reduce((a, r) => a + (r.clicks || 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0.00';

  // Top performers (by clicks)
  const top = [...rows]
    .filter((r) => r.keys?.[0]?.includes('/resources/'))
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 5);

  // Posts with impressions but 0 clicks (need title/description improvement)
  const lurking = rows
    .filter((r) => r.keys?.[0]?.includes('/resources/') && (r.impressions || 0) > 10 && (r.clicks || 0) === 0)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 3);

  const lines = [];
  lines.push(`📊 SEO Digest — ${startDate} → ${endDate}`);
  lines.push('');
  lines.push(`Site totals: ${totalClicks} clicks · ${totalImpressions} impressions · ${avgCtr}% CTR`);
  lines.push('');

  if (top.length) {
    lines.push(`Top /resources/ posts by clicks:`);
    for (const r of top) {
      const slug = r.keys[0].replace(/^.*\/resources\//, '/resources/');
      const ctr = r.impressions > 0 ? ((r.clicks / r.impressions) * 100).toFixed(1) : '0.0';
      lines.push(`  • ${r.clicks} clicks · ${r.impressions} imp · ${ctr}% · pos ${r.position?.toFixed(1)} — ${slug}`);
    }
    lines.push('');
  } else {
    lines.push('No /resources/ traffic yet this period.');
    lines.push('');
  }

  if (lurking.length) {
    lines.push(`Posts with impressions but 0 clicks (title/description need work):`);
    for (const r of lurking) {
      const slug = r.keys[0].replace(/^.*\/resources\//, '/resources/');
      lines.push(`  • ${r.impressions} imp · pos ${r.position?.toFixed(1)} — ${slug}`);
    }
  }

  return lines.join('\n');
}

async function telegramSend(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { console.warn('[seo-digest] no Telegram secrets'); return; }
  return new Promise((resolve) => {
    const data = `chat_id=${encodeURIComponent(chatId)}&text=${encodeURIComponent(text)}&disable_web_page_preview=true`;
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) },
        timeout: 15000,
      },
      () => resolve()
    );
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.write(data); req.end();
  });
}

// =============================================================================
// Entry
// =============================================================================

async function main() {
  const saJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.log('[seo-digest] GSC_SERVICE_ACCOUNT_JSON not set — skipping (this is fine; see scripts/seo-monitor/README.md for setup)');
    return;
  }

  let serviceAccount;
  try { serviceAccount = JSON.parse(saJson); }
  catch (e) { throw new Error('GSC_SERVICE_ACCOUNT_JSON is not valid JSON: ' + e.message); }
  if (!serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON missing private_key or client_email');
  }

  console.log(`[seo-digest] auth as ${serviceAccount.client_email}`);
  const token = await getAccessToken(serviceAccount);
  const data = await querySearchAnalytics(token);
  console.log(`[seo-digest] ${data.rows.length} rows from GSC (${data.startDate} → ${data.endDate})`);

  const digest = formatDigest(data);
  console.log('---\n' + digest + '\n---');
  await telegramSend(digest);
}

main().catch(async (e) => {
  console.error('[seo-digest] FAIL:', e.message);
  try { await telegramSend(`🚨 SEO digest FAILED: ${e.message}`); } catch {}
  process.exit(1);
});
