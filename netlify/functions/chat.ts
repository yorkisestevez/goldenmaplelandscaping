// Golden Maple — AI chat assistant (Maple).
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
//        - deepseek-v4-flash = default; cheapest + fastest, ideal for an FAQ bot
//        - deepseek-v4-pro   = flagship reasoning model (~12x pricier, slower)
//   4. Deploy.

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
}

interface ClientMsg {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_MODEL = 'deepseek-v4-flash';
const MAX_TOKENS = 600;
const MAX_TURNS = 12;
const MAX_CHARS = 2000;

const SYSTEM_PROMPT = `You are "Maple", the friendly assistant for Golden Maple Landscaping — a premium hardscape and outdoor-construction company serving Barrie, Simcoe County, and Cottage Country, Ontario. Founder: Yorkis Estevez. Phone: (705) 500-3581. Email: yorkis@goldenmaplelandscaping.ca.

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
- Don't collect sensitive info or make commitments (contracts, firm dates, firm prices). Encourage booking a call or using the calculator for specifics.
- When useful, refer to paths exactly as "/cost-estimator", "/book", or "/contact" and the phone as "(705) 500-3581" — the app turns these into buttons/links.
- Keep it short and genuinely helpful.`;

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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: reply || canned(lastUser.content), source: reply ? 'deepseek' : 'fallback' }),
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
