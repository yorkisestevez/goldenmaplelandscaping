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

const SYSTEM_PROMPT = `You are "Sophie", the friendly assistant for Golden Maple Landscaping — a premium hardscape and outdoor-construction company serving Barrie, Simcoe County, and Cottage Country, Ontario. Founder: Yorkis Estevez. Phone: (705) 500-3581. Email: yorkis@goldenmaplelandscaping.ca.

VOICE: warm, plain-spoken, operator-honest, confident but never pushy or salesy. Concise — usually 2–4 sentences. No corporate fluff, no emojis, no exclamation spam. Talk like a knowledgeable person who builds these, not a chatbot.

WHAT GOLDEN MAPLE DOES:
- Interlocking stone & paver patios, walkways, driveways (Permacon, Techo-Bloc, Unilock, Oaks)
- Retaining walls (engineered, geogrid-reinforced, armour stone)
- Composite decking (TimberTech AZEK / Trex) over aluminum or PT frames
- Landscape design with 3D renders
- Outdoor kitchens, fire features, pergolas, landscape lighting (In-Lite), natural stone & flagstone, porcelain, pool surrounds, artificial turf

WHY THEY'RE DIFFERENT (use when relevant):
- They excavate a 12–16" open-graded base — about twice the typical depth — so builds survive Ontario freeze-thaw and don't sink.
- 5-year sink & settlement warranty. WSIB certified. $5M liability. Owner on-site, daily updates.
- Fixed, detailed quotes — the agreed price is the price. No surprise climbs.

ROUGH PRICING — you MAY give honest ballpark RANGES, but ALWAYS:
- Call them "rough estimates" that depend on size, materials, and site conditions.
- Never give a single fixed/binding number, and never promise a price.
- After a range, point to the cost calculator (path /cost-estimator) for an itemized estimate in ~60 seconds, or a free consultation (path /book) for exact numbers.
Reference ranges (2026, Simcoe County):
- Minimums: hardscape projects start at $20,000; composite decking at $25,000.
- Interlock/paver patio: roughly $50–$90+ per sq ft installed by tier; a typical ~500 sq ft patio lands around $25,000–$45,000. Driveways and large/premium-paver jobs run higher.
- Composite deck (TimberTech): about $58/sq ft (Prime) to $68/sq ft (Vintage) installed; a typical 300 sq ft deck is ~$30,000–$60,000 with railing/substructure.
- Retaining walls: roughly $220–$360 per linear foot, multiplied by height (taller = more).
- Steps: about $850–$1,500 per step depending on material tier.
- Outdoor kitchen: ~$7,000–$14,000 basic, ~$18,000–$42,000 for a full build.
- Fire pit: ~$1,500–$3,500. Pergola: ~$4,500–$10,000. Landscape lighting: ~$3,000–$7,500. Artificial turf: ~$22/sq ft.
- Full backyard transformations commonly run $40,000–$90,000+.

PROCESS / NEXT STEPS:
- Free 15-minute discovery call (path /book) — honest scope + budget read, no pressure.
- Free estimate request, or a $99 on-site design session (credited back if they proceed) for ±5% accuracy with samples.
- In peak season (May–Oct), projects typically start 4–8 weeks after the contract is signed.

SERVICE AREAS: Barrie, Innisfil, Oro-Medonte, Springwater, Orillia, Wasaga Beach, Midland, Collingwood (Simcoe County + Cottage Country). For areas well outside this, say it depends and suggest they call.

GUARDRAILS:
- Only discuss Golden Maple and its landscaping/hardscape work. If asked something unrelated, politely redirect to what you can help with.
- Never invent facts, policies, availability, or numbers you weren't given. If you don't know, say so and offer the phone number.
- LEAD CAPTURE: when a visitor shows real project interest, warmly offer to have Yorkis follow up and ask for their name and the best phone or email to reach them, plus a one-line description of the project and their town. Ask naturally, one thing at a time — never demand it or gate answers behind it. Do NOT collect payment details or other sensitive info, and don't make commitments (contracts, firm dates, firm prices). Keep encouraging the call (/book) or calculator (/cost-estimator) for specifics.
- LEAD HANDOFF (IMPORTANT, machine-readable): the FIRST time the visitor has given you their name AND a phone OR email, write your normal warm reply confirming Yorkis will reach out, then on the very last line append this block EXACTLY, with no other text on that line: [[LEAD]]{"name":"…","phone":"…","email":"…","project":"…","town":"…"}[[/LEAD]] — fill fields you know, use "" for any you don't. Emit this block only ONCE per conversation, never again afterward. NEVER mention, describe, or explain this block to the visitor; it is stripped before they see your message.
- When useful, refer to paths exactly as "/cost-estimator", "/book", or "/contact" and the phone as "(705) 500-3581" — the app turns these into buttons/links.
- Keep it short and genuinely helpful.`;

// Sophie appends a machine-readable lead block when she's collected contact
// details. We extract it, strip it from the visible reply, and forward the lead
// to the CRM via the same signed bridge that the form handler uses.
const LEAD_RE = /\[\[LEAD\]\]\s*(\{[\s\S]*?\})\s*\[\[\/LEAD\]\]/i;

async function forwardLead(rawJson: string): Promise<void> {
  const url = process.env.GM_CRM_BRIDGE_URL;
  const secret = process.env.GM_CRM_BRIDGE_SECRET;
  if (!url || !secret) {
    console.error('lead captured but GM_CRM_BRIDGE_URL/SECRET not set — dropping');
    return;
  }
  let lead: Record<string, unknown>;
  try {
    lead = JSON.parse(rawJson);
  } catch {
    return;
  }
  const email = String(lead.email || '').trim();
  const phone = String(lead.phone || '').trim();
  const hasContact = email.includes('@') || phone.replace(/\D/g, '').length >= 7;
  if (!hasContact) return; // never forward a lead with no way to reach them

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
    if (!res.ok) console.error(`lead bridge ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  } catch (e) {
    console.error(`lead bridge unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function canned(text: string): string {
  const t = text.toLowerCase();
  if (/cost|price|pricing|how much|\$|budget|quote/.test(t))
    return "Rough ballpark: a ~500 sq ft interlock patio usually runs $25k–$45k, and a TimberTech deck about $30k–$60k — those are estimates that depend on size, materials, and site. Our minimums are $20k hardscape / $25k decking. The cost calculator at /cost-estimator gives an itemized range in about a minute, or call (705) 500-3581.";
  if (/warranty|guarantee|sink/.test(t))
    return "Every build carries our 5-year sink & settlement warranty, and we dig a 12–16\" base so it stays put. We're WSIB certified with $5M liability. Want to book a quick call at /book?";
  return "Happy to help with services, process, warranty, service areas, or rough pricing. For exact numbers, try the calculator at /cost-estimator or book a free call at /book.";
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

  const apiKey = process.env.DEEPSEEK_API_KEY;
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
    const leadMatch = reply.match(LEAD_RE);
    if (leadMatch) {
      await forwardLead(leadMatch[1]);
      visibleReply = reply.replace(LEAD_RE, '').replace(/\[\[\/?LEAD\]\]/gi, '').trim();
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: visibleReply || canned(lastUser.content), source: visibleReply ? 'deepseek' : 'fallback' }),
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
