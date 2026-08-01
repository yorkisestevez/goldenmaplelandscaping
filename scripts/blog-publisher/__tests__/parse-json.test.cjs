// scripts/blog-publisher/__tests__/parse-json.test.cjs
//
// Run via: node --test scripts/blog-publisher/__tests__/*.test.cjs
//
// Pins the 2026-08-01 fleet bug. Every project's generate.cjs stripped a
// ```json fence only when BOTH the opening AND closing fence were present:
//
//     const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
//     if (fence) s = fence[1].trim();
//     return JSON.parse(s);
//
// The Claude CLI routinely opens a fence despite the prompt forbidding it, and
// on long posts the closing fence is often absent. Then JSON.parse ran on the
// literal '```json\n{...' and threw. Nudgel hit this on EVERY run — its blog
// published zero posts. GM and TradeKit only passed on a coin flip.
//
// The `unclosed fence` case below is the exact shape captured from the real
// failing Nudgel run, not a hypothetical.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { parseJson } = require('../generate.cjs');

const BODY = '{\n  "title": "9 ADHD Focus Techniques That Actually Stick",\n  "category": "Focus",\n  "readTime": "9 min"\n}';

describe('parseJson: fence handling', () => {
  test('bare JSON', () => {
    assert.equal(parseJson(BODY).category, 'Focus');
  });

  test('fully fenced ```json block', () => {
    assert.equal(parseJson('```json\n' + BODY + '\n```').category, 'Focus');
  });

  test('fenced with no language tag', () => {
    assert.equal(parseJson('```\n' + BODY + '\n```').category, 'Focus');
  });

  // THE REGRESSION — this is what actually killed the Nudgel blog.
  test('UNCLOSED ```json fence — the 2026-08-01 fleet failure', () => {
    assert.equal(parseJson('```json\n' + BODY).category, 'Focus');
  });

  test('unclosed fence with no language tag', () => {
    assert.equal(parseJson('```\n' + BODY).category, 'Focus');
  });

  test('prose preamble around the object', () => {
    assert.equal(parseJson("Here's the JSON you asked for:\n" + BODY + '\nLet me know!').category, 'Focus');
  });

  test('leading/trailing whitespace', () => {
    assert.equal(parseJson('\n\n  ' + BODY + '  \n\n').category, 'Focus');
  });

  test('still throws on genuinely unparseable output', () => {
    // Truncation mid-object must remain a loud failure, not a silent half-post.
    assert.throws(() => parseJson('```json\n{ "title": "half a post'));
    assert.throws(() => parseJson('I cannot help with that request.'));
  });
});
