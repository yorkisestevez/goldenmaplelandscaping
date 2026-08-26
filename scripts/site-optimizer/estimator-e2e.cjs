/* Estimator funnel E2E — 25 checks against the dev server (default :3011).
 *
 * Run:  NODE_PATH=C:/Users/yorki/node_modules node scripts/site-optimizer/estimator-e2e.cjs
 * (Playwright is a global install at C:\Users\yorki\node_modules, not a repo dep.)
 *
 * Covers: chrome-less shell, receipt rail, precise invoice math (subtotal+HST=total
 * to the cent), disposal quantity detail, vault recording, the repeat-pricing gate,
 * email unlock + persistence, the My-estimates drawer, ?type= prefill, and the
 * mobile sticky bar. Selector notes (hard-won): project-type cards are DIVs, not
 * buttons — use text locators; input values do NOT appear in innerText — read
 * inputValue() off input[inputmode="numeric"]; the Claude-Preview panel freezes
 * AnimatePresence — headless Playwright only.
 */
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3011';
let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const consoleLogs = [];
  page.on('console', m => consoleLogs.push(m.text()));

  // ---- 1. Full funnel: patio with details ----
  await page.goto(`${BASE}/cost-estimator/`, { waitUntil: 'networkidle' });
  ok('chrome-less: no global navbar', !(await page.locator('nav >> text=Portfolio').count()));
  ok('estimator top bar present', await page.locator('header >> text=Cost Estimator').count() > 0);

  await page.locator('text=Patio / Interlock').first().click();
  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.waitForTimeout(600);

  ok('receipt rail visible from step 2', await page.locator('aside[aria-label="Live estimate"]').isVisible());
  const railText = await page.locator('aside[aria-label="Live estimate"]').innerText();
  ok('rail shows cents figure', /\$[\d,]+\.\d{2}/.test(railText), railText.slice(0, 80));

  await page.locator('text=Old concrete').first().click();
  await page.locator('text=Hot tub going on it').first().click();
  await page.locator('text=Gentle curves').first().click();
  await page.waitForTimeout(300);
  for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: /^Continue/ }).click(); await page.waitForTimeout(450); }
  await page.getByRole('button', { name: /See Estimate/ }).click();
  await page.waitForTimeout(1600);

  const body = await page.locator('body').innerText();
  ok('precise headline with cents', /\$[\d,]+\.\d{2}/.test(body));
  ok('HST line present', body.includes('HST (13%)'));
  ok('Estimated total row', body.includes('Estimated total'));
  ok('Subtotal row', body.includes('Subtotal'));
  ok('bins detail (concrete adds bins)', /\d+ × 14-yd bin/.test(body), body.match(/[^\n]*14-yd[^\n]*/)?.[0]);
  ok('quantity detail: tonnes', /tonnes base & bedding aggregate/.test(body));
  ok('site-visit honesty line', body.includes('same math we bring to your site visit'));

  const nums = body.match(/Subtotal\s*\$([\d,]+\.\d{2})[\s\S]*?HST \(13%\)\s*\$([\d,]+\.\d{2})[\s\S]*?Estimated total\s*\$([\d,]+\.\d{2})/);
  if (nums) {
    const [sub, hst, tot] = nums.slice(1).map(s => Math.round(parseFloat(s.replace(/,/g, '')) * 100));
    ok('invoice adds up to the cent', sub + hst === tot, `${sub} + ${hst} != ${tot}`);
  } else ok('invoice rows parseable', false);

  // ---- 2. Vault recorded ----
  const vault1 = await page.evaluate(() => JSON.parse(localStorage.getItem('gm_estimator') || 'null'));
  ok('vault recorded 1 estimate', vault1 && vault1.estimates.length === 1, JSON.stringify(vault1)?.slice(0, 120));
  ok('vault not yet unlocked', vault1 && vault1.unlockedAt === null);

  // ---- 3. Repeat gate ----
  await page.getByRole('button', { name: /Price Another Project/ }).click();
  await page.waitForTimeout(600);
  ok('unlock gate shown on 2nd run', await page.locator('text=Price as many projects as you like').isVisible());
  await page.fill('input[name="email"]', 'e2e-test@example.com');
  await page.getByRole('button', { name: /Unlock unlimited estimates/ }).click();
  await page.waitForTimeout(700);
  ok('gate cleared after email', await page.locator('text=What are you looking to build?').isVisible());
  ok('dev unlock payload logged', consoleLogs.some(l => l.includes('estimator-unlock payload')));
  const vault2 = await page.evaluate(() => JSON.parse(localStorage.getItem('gm_estimator') || 'null'));
  ok('vault unlocked with email', vault2 && vault2.unlockedAt !== null && vault2.email === 'e2e-test@example.com');

  // ---- 4. Unlock persists across reload; drawer present ----
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  ok('no gate after reload (unlocked)', !(await page.locator('text=Price as many projects as you like').count()));
  ok('My estimates drawer button', await page.locator('text=My estimates (1)').count() > 0);

  // ---- 5. Fresh visitor with 1 estimate, NOT unlocked, gates on return ----
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/cost-estimator/`, { waitUntil: 'networkidle' });
  await p2.evaluate(() => localStorage.setItem('gm_estimator', JSON.stringify({
    email: null, unlockedAt: null,
    estimates: [{ id: 'x', savedAt: new Date().toISOString(), permalink: 'http://x', projectType: 'patio', city: 'Barrie', sqft: 500, subtotalCents: 2062486 }],
  })));
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForTimeout(700);
  ok('return visit gates immediately', await p2.locator('text=Price as many projects as you like').isVisible());
  const gatedBody = await p2.locator('body').innerText();
  ok('gate shows prior estimate value', gatedBody.includes('$20,624.86'));

  // ---- 6. Prefill link lands step 2 with sqft applied ----
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p3 = await ctx3.newPage();
  await p3.goto(`${BASE}/cost-estimator/?type=patio&sqft=740&city=barrie`, { waitUntil: 'networkidle' });
  await p3.waitForTimeout(800);
  const b3 = await p3.locator('body').innerText();
  ok('prefill lands on size step', b3.includes("What's there right now?") || b3.includes('What’s there right now?'), b3.slice(0, 200));
  // Multiple numeric inputs exist on step 2 (budget "Other" comes first in DOM);
  // assert that SOME numeric/range input carries the prefilled value.
  const sqftVals = await p3.evaluate(() =>
    [...document.querySelectorAll('input')].map(i => i.value));
  ok('prefill sqft applied (740)', sqftVals.includes('740'), `values: ${JSON.stringify(sqftVals)}`);

  // ---- 7. Mobile: sticky bar shows precise dollars ----
  const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p4 = await ctx4.newPage();
  await p4.goto(`${BASE}/cost-estimator/`, { waitUntil: 'networkidle' });
  await p4.locator('text=Patio / Interlock').first().click();
  await p4.waitForTimeout(300);
  await p4.getByRole('button', { name: /^Continue/ }).last().click();
  await p4.waitForTimeout(700);
  const sticky = await p4.locator('div.md\\:hidden.fixed').innerText().catch(() => '');
  ok('mobile sticky shows precise dollars + HST tag', /\$[\d,]+/.test(sticky) && sticky.includes('+HST'), sticky.replace(/\n/g, ' | '));

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
