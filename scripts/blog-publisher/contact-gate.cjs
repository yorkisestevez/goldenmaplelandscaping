// scripts/blog-publisher/contact-gate.cjs
// Pre-commit gate. Runs the contact check postbuild runs
// (scripts/check-contact-centralization.py) on the files the injector wrote,
// and throws if any of them hardcodes a phone number or email that must come
// from src/data/business.ts.
//
// 2026-09-28: auto-023 reached main with "(705) 300-8015" in its CTA HTML.
// postbuild failed on it, so every "Deploy to Netlify on main" run after it
// failed and production stayed on the previous deploy. inject.cjs now renders
// those details from publicContact; this gate catches anything it misses,
// e.g. a number in a title or heading, before it can be committed.
//
// Fails closed: if the check cannot run, the post does not publish.

const { spawnSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CHECK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-contact-centralization.py');

function assertContactsCentralized(files) {
  // With no file arguments the script scans all of src/, which is a different
  // question (is main clean?) from the one this gate answers.
  if (!files || files.length === 0) throw new Error('contact gate: no files to check');

  const r = spawnSync('python3', [CHECK_SCRIPT, ...files], { cwd: REPO_ROOT, encoding: 'utf8' });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* handled below */ }
  if (report && report.passed === true && r.status === 0) return report;

  let message;
  if (report && Array.isArray(report.findings) && report.findings.length) {
    const lines = report.findings.slice(0, 5).map((f) => `  ${f.file.replace(/\\/g, '/')}:${f.line}  ${f.excerpt}`);
    message =
      `contact gate: ${report.findings.length} hardcoded contact detail(s) outside src/data/business.ts. ` +
      `Render them from publicContact, or link to /book or /contact.\n${lines.join('\n')}`;
  } else {
    const why = (r.error && r.error.message) || (r.stderr || '').trim().slice(0, 300) || `exit ${r.status}`;
    message = `contact gate: could not run check-contact-centralization.py (${why}), refusing to publish unchecked`;
  }
  const err = new Error(message);
  err.code = 'CONTACT_GATE';
  err.findings = (report && report.findings) || [];
  throw err;
}

module.exports = { assertContactsCentralized };
