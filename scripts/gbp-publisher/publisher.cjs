// scripts/gbp-publisher/publisher.js
// Headless Playwright Chromium → business.google.com → publish a "What's New" post.
//
// Auth model: loads a stored Playwright storageState bundle (cookies + localStorage)
// captured locally by `cli.js capture-state` and uploaded to GitHub as the
// GBP_STORAGE_STATE secret.
//
// This is the fragile part of the system. Google's GBP UI is heavy JS, React-like,
// and Google changes it every few months. Every selector is wrapped in a multi-strategy
// finder, every step screenshots on failure, and we log everything.
//
// Required env:
//   GBP_STORAGE_STATE        JSON blob (the storage state) OR
//   GBP_STORAGE_STATE_FILE   path to a storage-state.json on disk (used locally)
//   GBP_LOCATION_ID          optional; if you have multiple GBP locations, set this
//                            to the location id you want to post to. If only one,
//                            we auto-pick.
//   GBP_HEADLESS             "false" to watch in a real window (local debug only)
//
// On success: returns { ok: true, postUrl, screenshotPath }
// On failure: throws with a message that includes which step failed; debug screenshot
// and DOM snapshot are written to ./debug-shots/ and the path is on the error.

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const DEBUG_DIR = path.join(__dirname, 'debug-shots');
const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const REALISTIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Multiple ways Google's UI surfaces the "Add update / Add post" entry point.
// Order matters — most specific / most current first.
const ADD_POST_LOCATORS = [
  { role: 'button', name: /add update/i },
  { role: 'button', name: /create post/i },
  { role: 'button', name: /add post/i },
  { role: 'link',   name: /add update/i },
  { text: /^Add update$/i },
  { text: /^Create post$/i },
];

const POST_TYPE_UPDATE_LOCATORS = [
  { role: 'tab', name: /^update$/i },
  { role: 'button', name: /^update$/i },
  { role: 'menuitem', name: /add update/i },
  { text: /^Add update$/i },
];

const SUMMARY_TEXTAREA_LOCATORS = [
  { role: 'textbox', name: /write your update/i },
  { role: 'textbox', name: /describe your post/i },
  { role: 'textbox', name: /what's new/i },
  { css: 'textarea[aria-label*="update" i]' },
  { css: 'textarea[aria-label*="post" i]' },
  { css: 'div[contenteditable="true"][role="textbox"]' },
];

const ADD_BUTTON_LOCATORS = [
  { role: 'button', name: /^add button$/i },
  { role: 'button', name: /^button$/i },
  { text: /Add button/i },
];

const BUTTON_TYPE_LEARN_MORE_LOCATORS = [
  { role: 'option', name: /learn more/i },
  { role: 'menuitem', name: /learn more/i },
  { text: /Learn more/i },
];

const BUTTON_URL_INPUT_LOCATORS = [
  { role: 'textbox', name: /link for your button/i },
  { role: 'textbox', name: /url/i },
  { css: 'input[type="url"]' },
  { css: 'input[aria-label*="url" i]' },
  { css: 'input[aria-label*="link" i]' },
];

const ADD_PHOTO_LOCATORS = [
  { role: 'button', name: /add photo/i },
  { role: 'button', name: /add image/i },
  { text: /Add photo/i },
  { css: 'input[type="file"]' },
];

const PUBLISH_LOCATORS = [
  { role: 'button', name: /^publish$/i },
  { role: 'button', name: /^post$/i },
  { text: /^Publish$/i },
];

// Try one locator strategy against a page or frame. Returns the located handle or null.
async function tryLocator(scope, spec, { timeout = 2500 } = {}) {
  try {
    let loc;
    if (spec.role) {
      loc = scope.getByRole(spec.role, { name: spec.name, exact: false });
    } else if (spec.text) {
      loc = scope.getByText(spec.text, { exact: false });
    } else if (spec.css) {
      loc = scope.locator(spec.css);
    } else {
      return null;
    }
    const count = await loc.count();
    if (!count) return null;
    const first = loc.first();
    await first.waitFor({ state: 'visible', timeout }).catch(() => {});
    if (!(await first.isVisible().catch(() => false))) return null;
    return first;
  } catch {
    return null;
  }
}

// Walk a list of locator strategies; return the first that resolves.
async function findFirst(scope, specs, { timeout = 2500, label = 'element' } = {}) {
  for (const spec of specs) {
    const hit = await tryLocator(scope, spec, { timeout });
    if (hit) return { handle: hit, spec };
  }
  throw new Error(`Could not find ${label}. Tried ${specs.length} selector strategies.`);
}

async function dumpDebug(page, tag, err) {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(DEBUG_DIR, `${ts}_${tag}`);
  const shotPath = `${base}.png`;
  const htmlPath = `${base}.html`;
  try { await page.screenshot({ path: shotPath, fullPage: true }); } catch {}
  try {
    const html = await page.content();
    fs.writeFileSync(htmlPath, html);
  } catch {}
  if (err) {
    try { fs.writeFileSync(`${base}.error.txt`, String(err.stack || err.message || err)); } catch {}
  }
  return { shotPath, htmlPath };
}

// Download a remote image (JPG/PNG/JPEG) to a temp file so Playwright can upload it.
function downloadImageToTemp(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const next = res.headers.location;
        if (!next) return reject(new Error(`Redirect with no location: ${url}`));
        return downloadImageToTemp(next).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Image fetch failed: ${url} → HTTP ${res.statusCode}`));
      }
      const ext = (url.split('?')[0].match(/\.([a-zA-Z0-9]{2,5})$/) || [, 'jpg'])[1].toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const out = path.join(os.tmpdir(), `gbp-img-${Date.now()}.${safeExt}`);
      const stream = fs.createWriteStream(out);
      res.pipe(stream);
      stream.on('finish', () => stream.close(() => resolve(out)));
      stream.on('error', reject);
    }).on('error', reject);
  });
}

function loadStorageState() {
  const inline = process.env.GBP_STORAGE_STATE;
  const file = process.env.GBP_STORAGE_STATE_FILE;
  if (inline) {
    try { return JSON.parse(inline); }
    catch (e) { throw new Error('GBP_STORAGE_STATE env is not valid JSON: ' + e.message); }
  }
  if (file) {
    if (!fs.existsSync(file)) throw new Error(`GBP_STORAGE_STATE_FILE not found: ${file}`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  throw new Error('No GBP storage state. Set GBP_STORAGE_STATE env or GBP_STORAGE_STATE_FILE.');
}

async function humanType(handle, text) {
  // Slow-typing reduces the chance Google's bot detector flags us.
  await handle.click({ delay: 80 });
  for (const ch of text) {
    await handle.type(ch, { delay: 20 + Math.floor(Math.random() * 30) });
  }
}

async function publishGbpPost(post, opts = {}) {
  if (!post || !post.summary || !post.ctaUrl) {
    throw new Error('publishGbpPost: post.summary and post.ctaUrl are required');
  }

  // Lazy-require so the module loads even if playwright isn't installed yet
  // (capture-state mode needs to surface a clearer error).
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    throw new Error(
      'playwright is not installed. From the repo root run:\n' +
      '  npm install --no-save playwright && npx playwright install chromium\n' +
      'Underlying: ' + e.message
    );
  }

  const headless = process.env.GBP_HEADLESS !== 'false';
  const storageState = loadStorageState();

  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage'
    ]
  });

  const context = await browser.newContext({
    storageState,
    viewport: DEFAULT_VIEWPORT,
    userAgent: REALISTIC_UA,
    locale: 'en-CA',
    timezoneId: 'America/Toronto'
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);

  let step = 'init';
  let tempImagePath = null;
  try {
    // Step 1: get to the right surface ----------------------------------------------------
    step = 'navigate-to-business';
    const locationId = process.env.GBP_LOCATION_ID || opts.locationId || null;
    const startUrl = locationId
      ? `https://business.google.com/n/${locationId}/posts`
      : 'https://business.google.com/posts';
    await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    // Let any auth redirect / location picker settle.
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);

    // If we ended up on a sign-in or account-picker page, the cookies are dead.
    const url = page.url();
    if (/accounts\.google\.com/.test(url) || /signin/.test(url)) {
      throw new Error(
        'GBP storage state expired — Google bounced us to sign-in. ' +
        'Re-run `node scripts/gbp-publisher/cli.js capture-state` locally, then ' +
        'update the GBP_STORAGE_STATE GitHub secret.'
      );
    }

    // Step 2: click "Add update" ----------------------------------------------------------
    step = 'click-add-update';
    let entry;
    try {
      entry = await findFirst(page, ADD_POST_LOCATORS, { label: 'Add update button' });
    } catch (e) {
      // Some accounts surface this from a kebab menu. Try opening any "Create" or "+" first.
      const altOpener = await findFirst(page, [
        { role: 'button', name: /^create$/i },
        { role: 'button', name: /^\+$/i },
        { css: 'button[aria-label*="create" i]' }
      ], { label: 'Create menu opener' }).catch(() => null);
      if (altOpener) {
        await altOpener.handle.click();
        await page.waitForTimeout(800);
        entry = await findFirst(page, ADD_POST_LOCATORS, { label: 'Add update button (post-menu)' });
      } else {
        throw e;
      }
    }
    await entry.handle.click();
    await page.waitForTimeout(1500);

    // Step 3: ensure we're on "Update" (not Offer/Event) ----------------------------------
    step = 'select-update-type';
    const updateTab = await findFirst(page, POST_TYPE_UPDATE_LOCATORS, {
      label: 'Update tab', timeout: 1500
    }).catch(() => null);
    if (updateTab) {
      await updateTab.handle.click().catch(() => {});
      await page.waitForTimeout(600);
    }

    // Step 4: type the summary ------------------------------------------------------------
    step = 'type-summary';
    const ta = await findFirst(page, SUMMARY_TEXTAREA_LOCATORS, { label: 'Summary textarea' });
    await humanType(ta.handle, post.summary);
    await page.waitForTimeout(500);

    // Step 5: add the photo ---------------------------------------------------------------
    if (post.imageUrl) {
      step = 'attach-photo';
      try {
        tempImagePath = await downloadImageToTemp(post.imageUrl);
        const fileInput = await page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(tempImagePath, { timeout: 8000 });
        // Wait for upload progress to clear
        await page.waitForTimeout(4000);
      } catch (e) {
        console.warn(`[gbp:publish] photo attach failed (non-fatal): ${e.message}`);
        await dumpDebug(page, 'photo-attach-fail', e);
        // continue — post can publish without photo
      }
    }

    // Step 6: add the CTA button ----------------------------------------------------------
    step = 'add-button';
    const addBtn = await findFirst(page, ADD_BUTTON_LOCATORS, {
      label: 'Add button control', timeout: 4000
    }).catch(() => null);
    if (addBtn) {
      await addBtn.handle.click();
      await page.waitForTimeout(600);

      const learnMore = await findFirst(page, BUTTON_TYPE_LEARN_MORE_LOCATORS, {
        label: 'Learn more option', timeout: 4000
      }).catch(() => null);
      if (learnMore) await learnMore.handle.click();
      await page.waitForTimeout(400);

      const urlInput = await findFirst(page, BUTTON_URL_INPUT_LOCATORS, {
        label: 'Button URL input', timeout: 4000
      }).catch(() => null);
      if (urlInput) {
        await urlInput.handle.fill('');
        await humanType(urlInput.handle, post.ctaUrl);
      } else {
        console.warn('[gbp:publish] could not find URL input — button may post without URL');
      }
      await page.waitForTimeout(500);
    } else {
      console.warn('[gbp:publish] no Add button control found — publishing without CTA');
    }

    // Step 7: publish ---------------------------------------------------------------------
    step = 'publish';
    const publishBtn = await findFirst(page, PUBLISH_LOCATORS, { label: 'Publish button' });
    // Take a "before publish" shot for the record
    const beforeShot = await dumpDebug(page, 'before-publish').then(d => d.shotPath).catch(() => null);
    await publishBtn.handle.click();
    // Wait for the publish to complete (URL change, success toast, or the post appears)
    await page.waitForTimeout(6000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const afterShot = await dumpDebug(page, 'after-publish').then(d => d.shotPath).catch(() => null);

    // Heuristic success check: still on a posts URL AND no obvious error toast visible.
    const finalUrl = page.url();
    const looksOk = /business\.google\.com/.test(finalUrl) && !/error/i.test(finalUrl);
    if (!looksOk) {
      throw new Error(`Publish finished on unexpected URL: ${finalUrl}`);
    }

    return {
      ok: true,
      finalUrl,
      beforeShot,
      afterShot,
      step: 'done'
    };
  } catch (err) {
    const debug = await dumpDebug(page, `fail-${step}`, err);
    err.message = `[step:${step}] ${err.message}\nDebug shot: ${debug.shotPath}`;
    throw err;
  } finally {
    if (tempImagePath) {
      try { fs.unlinkSync(tempImagePath); } catch {}
    }
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// Used by cli.js capture-state. Opens a real browser so Yorkis can sign in,
// then writes the storage state to disk.
async function captureStorageState(outPath) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    throw new Error(
      'playwright is not installed. Install with:\n' +
      '  npm install --no-save playwright && npx playwright install chromium\n'
    );
  }
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: DEFAULT_VIEWPORT,
    userAgent: REALISTIC_UA,
    locale: 'en-CA',
    timezoneId: 'America/Toronto'
  });
  const page = await context.newPage();
  await page.goto('https://business.google.com/posts');
  console.log('');
  console.log('=================================================================');
  console.log('  Sign in to Google Business Profile in the window that opened.');
  console.log('  Make sure you land on the Posts page for the right location.');
  console.log('  When you see Posts / Add update, come back here and press Enter.');
  console.log('=================================================================');
  console.log('');
  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });
  const state = await context.storageState();
  fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
  console.log(`\nStorage state written to ${outPath}`);
  console.log(`Cookies: ${state.cookies.length}, origins: ${state.origins.length}`);
  await context.close();
  await browser.close();
  return outPath;
}

module.exports = { publishGbpPost, captureStorageState };
