// Golden Maple — AI chat assistant (Sophie).
// Netlify auto-discovers this at /.netlify/functions/chat (no config needed).
//
// Calls DeepSeek (OpenAI-compatible Chat Completions API) with a grounded,
// guard-railed system prompt. Reads DEEPSEEK_API_KEY (required) and
// DEEPSEEK_MODEL (optional) from Netlify env. If the key is missing it degrades
// to a safe canned reply rather than erroring, so the widget always answers.
//
// SET UP (operator):
//   1. Get a key at platform.deepseek.com → API Keys.
//   2. Netlify → Site settings → Environment variables → add DEEPSEEK_API_KEY.
//   3. (optional) DEEPSEEK_MODEL to override the default below.
//        - deepseek-chat     = default; fast non-thinking model (V3), ideal for an FAQ bot
//        - deepseek-reasoner = thinking model (R1); slower + pricier, overkill here
//   4. Deploy.

import crypto from 'node:crypto';
import { BUSINESS, publicContact } from '../../src/data/business';

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
}

interface ClientMsg {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_MODEL = 'deepseek-chat';
const MAX_TOKENS = 600;
const MAX_TURNS = 12;
const MAX_CHARS = 2000;

const SYSTEM_PROMPT = `You are "Sophie", the friendly assistant for ${BUSINESS.publicName.value}. Founder contact: ${BUSINESS.founder.value.name}. Phone: ${publicContact.phoneDisplay}. Email: ${publicContact.email}.

VOICE: warm, plain-spoken, concise and helpful. Usually 2–4 sentences. No invented certainty.

BUSINESS FACTS AND PUBLICATION LIMITS:
- The central business configuration is the source of truth. Previously published claims are not automatically verified.
- Topics visitors may ask about include ${BUSINESS.services.value.join(', ')}. Confirm the precise scope and municipality with the team rather than asserting every service is offered everywhere.
- Do not assert a minimum investment or no minimum, free property visits, a design fee or credit, formal financing, insurance amount, WSIB status, credentials, manufacturer authorization, review ratings, universal warranty coverage, base depths, permit responsibility, subcontractor policy, availability or start dates. These need owner confirmation.
- Do not promise that every project carries a five-year warranty. Ask the team for the written terms applicable to the project.
- Pricing is project-specific. Refer to /cost-estimator for an indicative itemized estimate, not a binding quote. Do not invent or repeat legacy price ranges.
- Use /book or /contact for a discussion. Do not characterize the appointment as free or paid before its terms are confirmed.
- Ask the visitor's town and have the team confirm current service coverage.

GUARDRAILS:
- Only discuss Golden Maple and its landscaping/hardscape work. If asked something unrelated, politely redirect to what you can help with.
- Never invent facts, policies, availability, or numbers you weren't given. If you don't know, say so and offer the phone number.
- LEAD CAPTURE: when a visitor shows real project interest, warmly offer to have Yorkis follow up and ask for their name and the best phone or email to reach them, plus a one-line description of the project and their town. Ask naturally, one thing at a time — never demand it or gate answers behind it. Do NOT collect payment details or other sensitive info, and don't make commitments (contracts, firm dates, firm prices). Keep encouraging the call (/book) or calculator (/cost-estimator) for specifics.
- LEAD HANDOFF (IMPORTANT, machine-readable): the FIRST time the visitor has given you their name AND a phone OR email, write your normal warm reply confirming Yorkis will reach out, then on the very last line append this block EXACTLY, with no other text on that line: [[LEAD]]{"name":"…","phone":"…","email":"…","project":"…","town":"…"}[[/LEAD]] — fill fields you know, use "" for any you don't. Emit this block only ONCE per conversation, never again afterward. NEVER mention, describe, or explain this block to the visitor; it is stripped before they see your message.
- When useful, refer to paths exactly as "/cost-estimator", "/book", or "/contact" and the phone as "${publicContact.phoneDisplay}" — the app turns these into buttons/links.
- Keep it short and genuinely helpful.`;

// Sophie appends a machine-readable lead block when she's collected contact
// details. We extract it, strip it from the visible reply, and forward the lead
// to the CRM via the same signed bridge that the form handler uses.
const LEAD_RE = /\[\[LEAD\]\]\s*(\{[\s\S]*?\})\s*\[\[\/LEAD\]\]/i;

/**
 * Forwards a captured lead to the CRM bridge. Returns true only when the
 * bridge accepted it — the caller uses this to tell the browser a lead was
 * actually created, so it can fire the matching GA4/Meta/Ads client events
 * (the same way a form submit does). Without this signal, chat-widget leads
 * land in the CRM but never appear as a `generate_lead` event in GA4.
 */
async function forwardLead(rawJson: string): Promise<boolean> {
  const url = process.env.GM_CRM_BRIDGE_URL;
  const secret = process.env.GM_CRM_BRIDGE_SECRET;
  if (!url || !secret) {
    console.error('lead captured but GM_CRM_BRIDGE_URL/SECRET not set — dropping');
    return false;
  }
  let lead: Record<string, unknown>;
  try {
    lead = JSON.parse(rawJson);
  } catch {
    return false;
  }
  const email = String(lead.email || '').trim();
  const phone = String(lead.phone || '').trim();
  const hasContact = email.includes('@') || phone.replace(/\D/g, '').length >= 7;
  if (!hasContact) return false; // never forward a lead with no way to reach them

  const payload = {
    form_name: 'sophie-chat',
    source: 'website-chatbot',
    name: String(lead.name || '').trim(),
    email,
    phone,
    project: String(lead.project || '').trim(),
    town: String(lead.town || '').trim(),
  };
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bridge-Signature': sig },
      body,
    });
    if (!res.ok) {
      console.error(`lead bridge ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`lead bridge unreachable: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

function canned(text: string): string {
  const t = text.toLowerCase();
  if (/cost|price|pricing|how much|\$|budget|quote/.test(t))
    return `Pricing depends on your scope, materials and site conditions. The calculator at /cost-estimator provides an indicative itemized estimate, not a binding quote. Contact ${publicContact.phoneDisplay} to confirm project requirements and any minimum investment.`;
  if (/warranty|guarantee|sink/.test(t))
    return `Warranty coverage and construction specifications must be confirmed in your written project terms. Contact ${publicContact.phoneDisplay} or use /book to discuss the work and request the applicable documentation.`;
  return `Happy to help you outline your project. Service coverage, consultation terms and availability need confirmation with the team. Use /contact or call ${publicContact.phoneDisplay}.`;
}

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'method not allowed' };
  }

  let messages: ClientMsg[] = [];
  try {
    const parsed = JSON.parse(event.body || '{}');
    messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid json' }) };
  }

  // Sanitize → valid alternating sequence ending on a user turn.
  const cleaned: ClientMsg[] = [];
  for (const m of messages) {
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') continue;
    const content = m.content.trim().slice(0, MAX_CHARS);
    if (!content) continue;
    if (cleaned.length && cleaned[cleaned.length - 1].role === m.role) {
      cleaned[cleaned.length - 1] = { role: m.role, content }; // collapse same-role
    } else {
      cleaned.push({ role: m.role, content });
    }
  }
  while (cleaned.length && cleaned[0].role === 'assistant') cleaned.shift();
  const convo = cleaned.slice(-MAX_TURNS);
  const lastUser = convo.length ? convo[convo.length - 1] : null;
  if (!lastUser || lastUser.role !== 'user') {
    return { statusCode: 400, body: JSON.stringify({ error: 'no user message' }) };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  // No key configured → safe canned reply (keeps the widget useful pre-setup).
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: canned(lastUser.content), source: 'fallback' }),
    };
  }

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.4,
        stream: false,
        // OpenAI-style: system prompt as the first message. DeepSeek caches the
        // repeated prefix automatically (cache-hit pricing) — no special field.
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...convo],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`deepseek ${res.status}: ${detail.slice(0, 300)}`);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: canned(lastUser.content), source: 'fallback' }),
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = (data.choices?.[0]?.message?.content || '').trim();

    // Extract + forward any lead Sophie captured, then strip the block (and any
    // stray markers) so the visitor never sees the machine payload.
    let visibleReply = reply;
    let leadCaptured = false;
    const leadMatch = reply.match(LEAD_RE);
    if (leadMatch) {
      leadCaptured = await forwardLead(leadMatch[1]);
      visibleReply = reply.replace(LEAD_RE, '').replace(/\[\[\/?LEAD\]\]/gi, '').trim();
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply: visibleReply || canned(lastUser.content),
        source: visibleReply ? 'deepseek' : 'fallback',
        leadCaptured,
      }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`chat function error: ${msg}`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: canned(lastUser.content), source: 'fallback' }),
    };
  }
};
