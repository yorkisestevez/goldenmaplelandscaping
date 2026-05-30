// scripts/blog-publisher/telegram.cjs
// Env-driven: reads TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID from the environment.

const https = require('https');

function escapeMd(s) {
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, ch => '\\' + ch);
}

function tgPost(method, payload) {
  return new Promise((resolve, reject) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return reject(new Error('TELEGRAM_BOT_TOKEN env var missing'));
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000
    }, (res) => {
      let result = '';
      res.on('data', c => result += c);
      res.on('end', () => {
        try { resolve(JSON.parse(result)); } catch { resolve({ raw: result }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Telegram timeout')); });
    req.write(body); req.end();
  });
}

async function sendMessage(text, { chatId = null, parseMode = 'MarkdownV2' } = {}) {
  const dest = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!dest) throw new Error('TELEGRAM_CHAT_ID env var missing');
  return tgPost('sendMessage', {
    chat_id: Number(dest) || dest,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: false
  });
}

function buildPrPreview(draft, prUrl) {
  const v = draft.validation || {};
  const okMark = v.ok ? '✅' : '⚠️';
  const wordStat = v.wordCount ? `${v.wordCount}w` : '?w';
  const linkStat = v.linkCount ? `${v.linkCount} links` : '0 links';
  const issuesLine = v.ok ? '' : `\n*Issues:* ${escapeMd(v.errors.slice(0, 3).join(' · '))}`;

  const title = escapeMd(draft.title);
  const seoTitle = escapeMd(draft.seoTitle);
  const seoDesc = escapeMd(draft.seoDescription);
  const slug = escapeMd(draft.slug);
  const cat = escapeMd(draft.category);
  const sectionCount = (draft.sections || []).length;
  const faqCount = (draft.faqs || []).length;
  const queueRemaining = typeof draft.queueRemaining === 'number' ? draft.queueRemaining : null;
  const queueLine = (queueRemaining !== null && queueRemaining <= 4)
    ? `\n🟡 *Topic queue running low:* only ${queueRemaining} left \\- refill \`topics\\.json\` soon\\.`
    : '';

  return [
    `${okMark} *New blog draft \\- PR open*`,
    ``,
    `*${title}*`,
    ``,
    `*Will publish to:* \`/resources/${slug}\``,
    `*Category:* ${cat}`,
    `*Stats:* ${escapeMd(wordStat)} · ${sectionCount} sections · ${faqCount} FAQs · ${escapeMd(linkStat)}`,
    `*SEO Title:* ${seoTitle}`,
    `*SEO Desc:* _${seoDesc}_${issuesLine}${queueLine}`,
    ``,
    `📱 *Approve* \\(tap to open PR, then Merge\\):`,
    escapeMd(prUrl),
    ``,
    `Closing the PR rejects this draft\\. Next Monday picks a fresh topic\\.`,
  ].join('\n');
}

async function sendPrPreview(draft, prUrl) {
  return sendMessage(buildPrPreview(draft, prUrl));
}

async function sendErrorAlert(stage, error) {
  const txt = `❌ *gm\\-blog\\-publisher failed*\n\n*Stage:* ${escapeMd(stage)}\n*Error:* ${escapeMd(error.message || String(error))}`;
  return sendMessage(txt);
}

module.exports = { sendMessage, sendPrPreview, sendErrorAlert };
