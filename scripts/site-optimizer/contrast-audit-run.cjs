/* Programmatic WCAG contrast audit over site routes + estimator states.
 *
 * Run:  NODE_PATH=C:/Users/yorki/node_modules node scripts/site-optimizer/contrast-audit-run.cjs [route ...]
 * Default routes: / /cost-estimator/ /contact/ — pass extra routes as args.
 * Fails (exit 1) on any finding with ratio < 3.0 ("actually invisible" class).
 *
 * Injects the global visibility-audit skill's Canvas2D checker (oklch-aware,
 * alpha-composited). The estimator route additionally walks wizard states
 * (step 2, step 6 with the rail's skip button, the result invoice) because the
 * worst offenders historically only render mid-wizard.
 */
const { chromium } = require('playwright');
const { readFileSync } = require('fs');

const AUDIT_JS = readFileSync('C:/Users/yorki/.claude/skills/visibility-audit/contrast-audit.js', 'utf8');
const BASE = process.env.E2E_BASE || 'http://localhost:3011';
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/cost-estimator/', '/contact/'];

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  let totalCritical = 0;

  const audit = async (label) => {
    await page.evaluate(AUDIT_JS);
    const findings = await page.evaluate(() => {
      // aria-hidden subtrees are decoration by declaration (ghost watermarks
      // etc.) — remove them from the audit pass so deliberate ornament can't
      // fail the gate. Real content must never be aria-hidden.
      const removed = [];
      document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
        removed.push([el, el.parentNode, el.nextSibling]);
        el.remove();
      });
      const out = window.__auditOne();
      for (const [el, parent, next] of removed.reverse()) parent && parent.insertBefore(el, next);
      return out;
    });
    const critical = findings.filter(f => Number(f.ratio) < 3.0);
    console.log(`== ${label}: ${critical.length} critical (<3.0) of ${findings.length} findings`);
    for (const f of critical.slice(0, 12)) console.log('   ' + JSON.stringify(f).slice(0, 300));
    totalCritical += critical.length;
  };

  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await audit(route);

    if (route.startsWith('/cost-estimator')) {
      await page.locator('text=Patio / Interlock').first().click();
      await page.getByRole('button', { name: /^Continue/ }).click();
      await page.waitForTimeout(600);
      await audit('estimator step 2');
      for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: /^Continue/ }).click(); await page.waitForTimeout(350); }
      await audit('estimator step 6 (rail + skip)');
      await page.getByRole('button', { name: /See Estimate/ }).click();
      await page.waitForTimeout(1400);
      await audit('estimator result invoice');
    }
  }

  await browser.close();
  console.log(`\nTOTAL CRITICAL: ${totalCritical}`);
  process.exit(totalCritical > 0 ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
