// scripts/gbp-publisher/telegram.js
// Env-driven Telegram helpers for GBP publish success / failure / no-op pings.
// Reads TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID from env.

const fs = require('fs');
const https = require('https');

function escapeMd(s) {
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, ch => '\\' + ch);
}

function tgRequest(method, payload, isFormData = false, contentType = null) {
  return new Promise((resolve, reject) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return reject(new Error('TELEGRAM_BOT_TOKEN env var missing'));
    const body = isFormData ? payload : JSON.stringify(payload);
    const headers = isFormData
      ? { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body) }
      : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };

    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers,
      timeout: 30000
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

async function sendMessage(text, { parseMode = 'MarkdownV2' } = {}) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID env var missing');
  return tgRequest('sendMessage', {
    chat_id: Number(chatId) || chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true
  });
}

async function sendPhoto(photoPath, caption, { parseMode = 'MarkdownV2' } = {}) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID env var missing');
  if (!fs.existsSync(photoPath)) throw new Error(`Photo not found: ${photoPath}`);

  const boundary = '----telegrambdry' + Math.random().toString(36).slice(2);
  const fileBuf = fs.readFileSync(photoPath);
  const filename = photoPath.split(/[/\\]/).pop();

  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\n${parseMode}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\n` +
    `Content-Type: image/png\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, fileBuf, tail]);

  return tgRequest('sendPhoto', body, true, `multipart/form-data; boundary=${boundary}`);
}

function buildSuccessCaption(post) {
  const title = escapeMd(post.title || '(untitled)');
  const slug = escapeMd(post.slug || '?');
  const chars = post.validation?.charCount || (post.summary || '').length;
  return [
    `✅ *GBP post published*`,
    ``,
    `*${title}*`,
    `*Slug:* \`${slug}\``,
    `*Summary:* ${chars} chars`,
    `*Linked to:* ${escapeMd(post.ctaUrl)}`,
    ``,
    `Screenshot above shows the post after publishing\\.`,
  ].join('\n');
}

function buildFailureMessage(stage, post, error) {
  const title = escapeMd(post?.title || '(no post)');
  const slug = escapeMd(post?.slug || '?');
  const errMsg = escapeMd((error?.message || String(error || 'unknown')).slice(0, 600));
  return [
    `❌ *gm\\-gbp\\-publisher failed*`,
    ``,
    `*Stage:* ${escapeMd(stage)}`,
    `*Blog:* ${title} \\(\`${slug}\`\\)`,
    ``,
    `*Error:*`,
    `\`\`\`${errMsg}\`\`\``,
    ``,
    `If the error mentions storage state expired:`,
    `1\\. Pull main locally`,
    `2\\. Run \`node scripts/gbp-publisher/cli\\.js capture\\-state\``,
    `3\\. \`gh secret set GBP_STORAGE_STATE < scripts/gbp\\-publisher/storage\\-state\\.json\``,
  ].join('\n');
}

function buildIdleMessage() {
  return `ℹ️ *gm\\-gbp\\-publisher* — nothing to mirror today \\(no new blog posts in the last 7 days that haven't already been posted\\)\\.`;
}

function buildManualAttachCaption(post) {
  // Image upload to GBP composer is structurally blocked through Chrome MCP
  // (Wiz framework gates on event.isTrusted, no input[type=file] in DOM). Two
  // adversarial workflow verdicts confirmed it. So the routine posts text+CTA
  // automatically, then nudges Yorkis to drag this image into the live post
  // manually — takes ~30 seconds, perfect attach quality, no fragile infra.
  const slug = escapeMd(post.slug || '?');
  const title = escapeMd(post.title || '');
  return [
    `📎 *Drop this into the live GBP post when you have 30s*`,
    ``,
    `*Post:* ${title}`,
    `*Slug:* \`${slug}\``,
    ``,
    `1\\. Open the Posts modal in your GBP panel`,
    `2\\. Tap the post that just went up \\(top of the list\\)`,
    `3\\. Edit → drag this image into the photo slot → save`,
    ``,
    `_Image upload via the routine is blocked by Google's Wiz framework \\(isTrusted gate\\) — this is the cleanest workaround until we build a Playwright\\-CDP arm\\._`,
  ].join('\n');
}

async function sendManualAttachNudge(post, imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) {
    // Image fetch failed earlier — just send the text nudge so Yorkis knows the
    // post is live and can pick a project photo himself.
    return sendMessage([
      `📎 *Post is live without image*`,
      ``,
      `*Post:* ${escapeMd(post.title || '')}`,
      `*Slug:* \`${escapeMd(post.slug || '?')}\``,
      ``,
      `Hero image fetch failed \\(blog deploy lag?\\)\\. Pick any project photo and drag it into the live post when you can\\.`,
    ].join('\n'));
  }
  return sendPhoto(imagePath, buildManualAttachCaption(post));
}

async function sendSuccessWithScreenshot(post, screenshotPath) {
  const caption = buildSuccessCaption(post);
  if (screenshotPath && fs.existsSync(screenshotPath)) {
    return sendPhoto(screenshotPath, caption);
  }
  return sendMessage(caption);
}

async function sendFailureWithScreenshot(stage, post, error, screenshotPath) {
  const caption = buildFailureMessage(stage, post, error);
  if (screenshotPath && fs.existsSync(screenshotPath)) {
    return sendPhoto(screenshotPath, caption).catch(() => sendMessage(caption));
  }
  return sendMessage(caption);
}

module.exports = {
  sendMessage,
  sendPhoto,
  sendSuccessWithScreenshot,
  sendFailureWithScreenshot,
  sendManualAttachNudge,
  buildIdleMessage,
  buildManualAttachCaption,
  escapeMd
};
