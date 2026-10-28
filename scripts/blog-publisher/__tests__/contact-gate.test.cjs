// scripts/blog-publisher/__tests__/contact-gate.test.cjs
//
// Pins the fix for 2026-09-28: auto-023 (HpbVsLimestoneScreeningsBarrie.tsx)
// reached main with "(705) 300-8015" in its CTA HTML. check-contact-
// centralization.py failed postbuild, and every production deploy after it
// failed until the page was fixed by hand.
//
// These cover the two halves that need no real repo files:
//   - renderContacts: what the injector emits in place of a hardcoded contact
//   - assertContactsCentralized: the pre-commit gate refuses a page that
//     still hardcodes one, and fails closed when the check cannot run
// The end-to-end injectDraft cases live in inject.test.cjs, because they
// write the real routes.ts and blogPosts.ts and node --test runs files in
// parallel.

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderContacts } = require('../inject.cjs');
const { assertContactsCentralized } = require('../contact-gate.cjs');

// Sentinels stand in for the business.ts values, so each assertion shows which
// publicContact field a match was routed to.
const STUB = { phoneDisplay: '<DISPLAY>', phoneTel: '<TEL>', email: '<EMAIL>' };

// Emit the literal the way buildTsx does, then evaluate it as the page would.
function render(html) {
  let used = 0;
  const code = renderContacts(JSON.stringify(html), () => { used++; });
  const value = new Function('publicContact', `return (${code});`)(STUB);
  return { code, value, used };
}

describe('renderContacts: contact details render from publicContact', () => {
  test('the auto-023 CTA: the phone number becomes publicContact.phoneDisplay', () => {
    const r = render('<p>call Golden Maple Landscaping at (705) 300-8015 or <a href="/book">book a site visit</a></p>');
    assert.equal(r.value, '<p>call Golden Maple Landscaping at <DISPLAY> or <a href="/book">book a site visit</a></p>');
    assert.ok(!/705/.test(r.code), 'no digits of the number may survive in the emitted code');
    assert.equal(r.used, 1);
  });

  test('every spelling the gate matches is replaced whole, "+1" and "(" included', () => {
    for (const spelt of ['(705) 300-8015', '705-300-8015', '705.300.8015', '7053008015', '+1 705 300 8015', '1-705-300-8015', '+1 (705) 300-8015']) {
      assert.equal(render(`<p>Call ${spelt} today.</p>`).value, '<p>Call <DISPLAY> today.</p>', spelt);
    }
    // A "1" that ends another number is not a country code.
    assert.equal(render('<p>Unit 21 (705) 300-8015</p>').value, '<p>Unit 21 <DISPLAY></p>');
  });

  test('the legacy and personal numbers render as the current public number', () => {
    assert.equal(render('<p>Call 705-790-3838 or (705) 500-3581.</p>').value, '<p>Call <DISPLAY> or <DISPLAY>.</p>');
  });

  test('the email, in any case, becomes publicContact.email', () => {
    assert.equal(render('<p>Email yorkis@goldenmaplelandscaping.ca or Yorkis@GoldenMapleLandscaping.ca.</p>').value,
      '<p>Email <EMAIL> or <EMAIL>.</p>');
  });

  test('tel: links take publicContact.phoneTel, their text takes phoneDisplay', () => {
    assert.equal(render('<a href="tel:+17053008015">(705) 300-8015</a>').value, '<a href="tel:<TEL>"><DISPLAY></a>');
    assert.equal(render('<a href="tel:705-300-8015">call</a>').value, '<a href="tel:<TEL>">call</a>');
    assert.equal(render('<a href="TEL: +1 (705) 790-3838">call</a>').value, '<a href="tel:<TEL>">call</a>');
  });

  test('mailto: links keep their query string', () => {
    assert.equal(render('<a href="mailto:yorkis@goldenmaplelandscaping.ca?subject=Patio">write</a>').value,
      '<a href="mailto:<EMAIL>?subject=Patio">write</a>');
  });

  test('a contact at either end of a literal leaves no stray empty strings', () => {
    const r = render('yorkis@goldenmaplelandscaping.ca');
    assert.equal(r.code, 'publicContact.email');
    assert.equal(render('(705) 300-8015 or yorkis@goldenmaplelandscaping.ca').code,
      'publicContact.phoneDisplay + " or " + publicContact.email');
  });

  test('an escaped quote next to a contact is not mistaken for an empty string', () => {
    assert.equal(render('<span title="yorkis@goldenmaplelandscaping.ca">x</span>').value, '<span title="<EMAIL>">x</span>');
  });

  test('other 705 numbers and a text without contacts are left alone', () => {
    const html = '<p>Barrie Building Services: 705-739-4220. Suite 21 has no phone.</p>';
    const r = render(html);
    assert.equal(r.code, JSON.stringify(html));
    assert.equal(r.used, 0);
  });
});

describe('assertContactsCentralized: the pre-commit gate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-contact-gate-'));
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  function page(name, body) {
    const p = path.join(dir, name);
    fs.writeFileSync(p, `export default function Page() {\n  return (\n${body}\n  );\n}\n`);
    return p;
  }

  test('refuses a page that hardcodes the phone number, naming file and line', () => {
    const bad = page('Bad.tsx', '    <div dangerouslySetInnerHTML={{ __html: "<p>call (705) 300-8015</p>" }} />');
    assert.throws(() => assertContactsCentralized([bad]), (err) => {
      assert.equal(err.code, 'CONTACT_GATE');
      assert.equal(err.findings.length, 1);
      assert.match(err.message, /hardcoded contact detail/);
      assert.match(err.message, /Bad\.tsx:3/);
      return true;
    });
  });

  test('refuses a page that hardcodes the email', () => {
    const bad = page('BadEmail.tsx', '    <a href="mailto:yorkis@goldenmaplelandscaping.ca">email</a>');
    assert.throws(() => assertContactsCentralized([bad]), { code: 'CONTACT_GATE' });
  });

  test('passes a page that reads the contact from publicContact', () => {
    const good = page('Good.tsx', '    <div dangerouslySetInnerHTML={{ __html: "<p>call " + publicContact.phoneDisplay + "</p>" }} />');
    assert.equal(assertContactsCentralized([good]).passed, true);
  });

  test('fails closed when the check cannot run', () => {
    const missing = path.join(dir, 'DoesNotExist.tsx');
    assert.throws(() => assertContactsCentralized([missing]), (err) => {
      assert.equal(err.code, 'CONTACT_GATE');
      assert.match(err.message, /refusing to publish unchecked/);
      return true;
    });
  });

  test('refuses to run without files instead of silently scanning all of src/', () => {
    assert.throws(() => assertContactsCentralized([]), /no files to check/);
  });
});

describe('cli.cjs reports a gate refusal like its other failures', () => {
  test('a CONTACT_GATE error is alerted under its own contact-gate stage', () => {
    const cliSrc = fs.readFileSync(path.join(__dirname, '..', 'cli.cjs'), 'utf8');
    assert.match(cliSrc, /e\.code === 'CONTACT_GATE' \? 'contact-gate:'/);
    assert.match(cliSrc, /telegram\.sendErrorAlert\(stage \+ draft\.slug, e\)/);
  });
});
