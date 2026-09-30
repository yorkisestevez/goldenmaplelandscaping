/* Estimator funnel E2E against the dev server (default :3011).
 *
 * Run:  NODE_PATH=C:/Users/yorki/node_modules node scripts/site-optimizer/estimator-e2e.cjs
 * (Playwright is a global install at C:\Users\yorki\node_modules, not a repo dep.)
 *
 * Covers: chrome-less shell, receipt rail, precise invoice math (subtotal+HST=total
 * to the cent), disposal quantity detail, vault recording, NO repeat-pricing gate
 * (the estimator is fully unlocked since 2026-09-28: no email to price again, on
 * return visits or old vaults), the My-estimates drawer, ?type= prefill, the mobile
 * sticky bar, and the 3D deck designer inside the estimator: a deck opens the
 * designer here (and Back returns), ?type=deck links open it at their size, and a
 * full backyard's deck is priced by the designer into the totals (starter deck,
 * then "Use this deck in my estimate"). Selector notes (hard-won): project-type
 * cards are DIVs, not buttons — use text locators; input values do NOT appear in
 * innerText — read inputValue() off input[inputmode="numeric"]; the Claude-Preview
 * panel freezes AnimatePresence — headless Playwright only.
 */
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3011';
let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
};
const cents = s => Math.round(parseFloat(s.replace(/,/g, '')) * 100);
const invoice = body => {
  const m = body.match(/Subtotal\s*\$([\d,]+\.\d{2})[\s\S]*?HST \(13%\)\s*\$([\d,]+\.\d{2})[\s\S]*?Estimated total\s*\$([\d,]+\.\d{2})/);
  return m ? m.slice(1).map(cents) : null;
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

  const nums = invoice(body);
  if (nums) ok('invoice adds up to the cent', nums[0] + nums[1] === nums[2], `${nums[0]} + ${nums[1]} != ${nums[2]}`);
  else ok('invoice rows parseable', false);

  // ---- 2. Vault recorded, with no unlock state ----
  const vault1 = await page.evaluate(() => JSON.parse(localStorage.getItem('gm_estimator') || 'null'));
  ok('vault recorded 1 estimate', vault1 && vault1.estimates.length === 1, JSON.stringify(vault1)?.slice(0, 120));
  ok('vault holds no email or unlock', vault1 && !('email' in vault1) && !('unlockedAt' in vault1));

  // ---- 3. No repeat gate: price another project straight away ----
  await page.getByRole('button', { name: /Price Another Project/ }).click();
  await page.waitForTimeout(600);
  ok('second estimate needs no email', await page.locator('text=What are you looking to build?').isVisible());
  ok('no email field on the wizard', !(await page.locator('input[name="email"]').count()));
  ok('no unlock payload ever posted', !consoleLogs.some(l => l.includes('estimator-unlock payload')));

  // ---- 4. Reload: still no gate; drawer present ----
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  ok('no gate after reload', await page.locator('text=What are you looking to build?').isVisible());
  ok('My estimates drawer button', await page.locator('text=My estimates (1)').count() > 0);

  // ---- 5. An old vault (from the gated era, never unlocked) does not gate ----
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/cost-estimator/`, { waitUntil: 'networkidle' });
  await p2.evaluate(() => localStorage.setItem('gm_estimator', JSON.stringify({
    email: null, unlockedAt: null,
    estimates: [{ id: 'x', savedAt: new Date().toISOString(), permalink: 'http://x', projectType: 'patio', city: 'Barrie', sqft: 500, subtotalCents: 2062486 }],
  })));
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForTimeout(700);
  ok('return visit with an old vault is not gated', await p2.locator('text=What are you looking to build?').isVisible());
  ok('old vault estimate still listed', await p2.locator('text=My estimates (1)').count() > 0);

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

  // ---- 8. A deck opens the 3D designer inside the estimator; Back returns ----
  const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p5 = await ctx5.newPage();
  await p5.goto(`${BASE}/cost-estimator/`, { waitUntil: 'networkidle' });
  await p5.locator('text=Composite Deck').first().click();
  await p5.getByRole('button', { name: /^Continue/ }).first().click();
  await p5.locator('.deck-designer[data-embedded]').waitFor({ timeout: 30000 });
  ok('deck opens the designer on the estimator page', new URL(p5.url()).pathname.startsWith('/cost-estimator') && new URL(p5.url()).searchParams.get('studio') === 'deck', p5.url());
  ok('designer workspace rendered', await p5.locator('text=Draw your deck on your house.').count() > 0);
  ok('estimator bar over the designer', await p5.locator('[aria-label="Cost estimator"] >> text=Cost estimator · deck').count() > 0);
  ok('estimator frame steps aside', !(await p5.locator('header >> text=Cost Estimator').count()) && !(await p5.locator('text=Plan your landscaping investment').count()));
  await p5.waitForTimeout(1500);
  const barPrice = await p5.locator('.dd-estimator-price strong').innerText();
  ok('bar shows the live deck price', /^\$[\d,]+$/.test(barPrice), barPrice);
  await p5.goBack();
  await p5.waitForTimeout(800);
  ok('browser Back closes the designer', await p5.locator('text=What are you looking to build?').isVisible() && !(await p5.locator('.deck-designer').count()));
  await p5.getByRole('button', { name: /^Continue/ }).first().click();
  await p5.locator('.deck-designer[data-embedded]').waitFor({ timeout: 30000 });
  await p5.getByRole('button', { name: /Project types/ }).click();
  await p5.waitForTimeout(800);
  ok('bar Back returns to the estimator', await p5.locator('text=What are you looking to build?').isVisible());

  // ---- 9. ?type=deck (home-page quick estimator) opens the designer at its size ----
  const ctx6 = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p6 = await ctx6.newPage();
  await p6.goto(`${BASE}/cost-estimator/?type=deck&sqft=300`, { waitUntil: 'networkidle' });
  await p6.locator('.deck-designer[data-embedded]').waitFor({ timeout: 30000 });
  await p6.waitForTimeout(1200);
  // The designer's status line is visually quiet (not in innerText); read the DOM text and the size field.
  const b6 = await p6.evaluate(() => document.body.textContent);
  const width6 = await p6.locator('input[aria-label="Deck width"]').first().inputValue().catch(e => String(e).slice(0, 80));
  ok('?type=deck opens the designer at the handed-over size', b6.includes('Started from your cost estimate: a deck of about 300 sq ft (20 × 15 ft)') && width6 === '20', `width=${width6}`);
  ok('the size leaves the address once read', !new URL(p6.url()).searchParams.has('sqft') && new URL(p6.url()).searchParams.get('studio') === 'deck', p6.url());

  // ---- 10. Full backyard: the deck is priced by the designer, in the totals ----
  const ctx7 = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p7 = await ctx7.newPage();
  await p7.goto(`${BASE}/cost-estimator/`, { waitUntil: 'networkidle' });
  await p7.locator('text=Full Backyard (multiple)').first().click();
  await p7.getByRole('button', { name: /^Continue/ }).first().click();
  await p7.waitForTimeout(500);
  await p7.getByRole('button', { name: 'Patio / Interlock' }).click();
  await p7.getByRole('button', { name: 'Composite Deck' }).click();
  await p7.locator('[data-estimator-deck="starter"]').waitFor({ timeout: 30000 });
  const card = await p7.locator('[data-estimator-deck="starter"]').innerText();
  ok('deck card shows the designer starter price', /Starter deck/i.test(card) && /\$[\d,]+\.\d{2}/.test(card) && card.includes('included in this estimate'), card.replace(/\n/g, ' | ').slice(0, 200));
  const railDeck = await p7.locator('aside[aria-label="Live estimate"]').innerText();
  ok('receipt rail has the deck line', railDeck.includes('Deck (starter)'), railDeck.replace(/\n/g, ' | ').slice(0, 300));
  for (let i = 0; i < 4; i++) { await p7.getByRole('button', { name: /^Continue/ }).first().click(); await p7.waitForTimeout(450); }
  await p7.getByRole('button', { name: /See Estimate/ }).first().click();
  await p7.waitForTimeout(1600);
  const b7 = await p7.locator('body').innerText();
  ok('breakdown lists the deck', b7.includes('Composite Deck · starter deck'));
  const inv7 = invoice(b7);
  ok('invoice with the deck adds up to the cent', inv7 && inv7[0] + inv7[1] === inv7[2], JSON.stringify(inv7));
  const vault7 = await p7.evaluate(() => JSON.parse(localStorage.getItem('gm_estimator') || 'null'));
  ok('vault records the total with the deck', vault7 && inv7 && vault7.estimates[0]?.subtotalCents === inv7[0], `${vault7?.estimates[0]?.subtotalCents} vs ${inv7?.[0]}`);
  await p7.getByRole('button', { name: /Design your deck in 3D/ }).first().click();
  await p7.locator('.deck-designer[data-embedded]').waitFor({ timeout: 30000 });
  await p7.waitForTimeout(1200);
  ok('full backyard opens the designer in full mode', new URL(p7.url()).searchParams.get('studio') === 'full', p7.url());
  await p7.getByRole('button', { name: /Use this deck in my estimate/ }).click();
  await p7.locator('[data-estimator-deck="design"]').first().waitFor({ timeout: 30000 });
  const b7b = await p7.locator('body').innerText();
  ok('drawn deck replaces the starter in the estimate', b7b.includes('Composite Deck · your 3D design') && /your 3d deck design/i.test(b7b) && !b7b.includes('Composite Deck · starter deck'));
  const inv7b = invoice(b7b);
  ok('invoice with the drawn deck adds up to the cent', inv7b && inv7b[0] + inv7b[1] === inv7b[2], JSON.stringify(inv7b));

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
