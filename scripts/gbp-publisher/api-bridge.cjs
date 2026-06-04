#!/usr/bin/env node
'use strict';

// scripts/gbp-publisher/api-bridge.cjs
//
// Thin wrapper the daily-mirror routine calls. Imports the Hermes Agent
// GBP publisher and shapes the routine's data into the publisher's expected
// {id, summary, cta_url, image_url, cta_action} schema, then returns a
// stable JSON envelope the routine can branch on.
//
// Used by ROUTINE.md step 3c (replacing the Chrome MCP composer flow when
// API mode is available). When API mode is unavailable, the routine falls
// back to the Chrome MCP path that's been proven working since 2026-06-04.
//
// CLI:
//   node scripts/gbp-publisher/api-bridge.cjs status
//   node scripts/gbp-publisher/api-bridge.cjs publish --slug=<blog-slug>
//
// Programmatic:
//   const bridge = require('./api-bridge.cjs');
//   const result = await bridge.publish({ slug, summary, ctaUrl, imageUrl });
//   // result: { ok: bool, mode: 'api'|'markdown_paste'|'error', post_id, post_url, error }

const path = require('node:path');
const fs = require('node:fs');

const HERMES_PUBLISHER = 'C:/Users/yorki/Hermes Agent/skills/gbp-publisher/publisher.js';

function loadHermes() {
  // Hermes publisher is out-of-tree relative to this repo. Resolve absolutely
  // and surface a clear error if it's missing — routine then falls back to
  // Chrome MCP composer.
  try {
    return require(HERMES_PUBLISHER);
  } catch (e) {
    const err = new Error(
      `Hermes GBP publisher not found at ${HERMES_PUBLISHER}.\n` +
      `Original error: ${e.message}\n` +
      `Routine should fall back to Chrome MCP composer (text+CTA only, no image).`
    );
    err.code = 'HERMES_NOT_FOUND';
    throw err;
  }
}

async function status() {
  try {
    const hermes = loadHermes();
    return hermes.status();
  } catch (e) {
    return {
      credentials_present: false,
      mode: 'error',
      error: e.message,
      code: e.code || 'unknown',
    };
  }
}

async function publish({ slug, summary, ctaUrl, imageUrl, ctaAction = 'LEARN_MORE' } = {}) {
  if (!slug || !summary || !ctaUrl) {
    return {
      ok: false,
      mode: 'error',
      error: 'api-bridge.publish requires {slug, summary, ctaUrl} at minimum',
    };
  }
  let hermes;
  try {
    hermes = loadHermes();
  } catch (e) {
    return {
      ok: false,
      mode: 'error',
      error: e.message,
      code: e.code || 'unknown',
    };
  }

  // Shape the routine's data into the publisher's expected schema. The
  // publisher accepts either `text` or `summary`; we use `summary` since that
  // matches the GBP localPost API field name and our generator.cjs output.
  const draft = {
    id: slug,
    summary,
    cta_url: ctaUrl,
    cta_action: ctaAction,
  };
  if (imageUrl) draft.image_url = imageUrl;

  try {
    const result = await hermes.postToGbp(draft);
    if (result.mode === 'api' && result.post_id) {
      return {
        ok: true,
        mode: 'api',
        post_id: result.post_id,
        post_url: result.post_url || null,
        raw: result.raw || null,
      };
    }
    if (result.mode === 'markdown_paste') {
      // Token missing or expired — routine should fall back to Chrome MCP path
      // (text+CTA only, no image). The paste file is written but we don't want
      // the routine to rely on it for v1.
      return {
        ok: false,
        mode: 'markdown_paste',
        paste_file: result.paste_file || null,
        error: 'API mode unavailable (token missing/expired). Fall back to Chrome MCP composer.',
      };
    }
    return {
      ok: false,
      mode: result.mode || 'error',
      error: 'Unexpected publisher result shape',
      raw: result,
    };
  } catch (e) {
    return {
      ok: false,
      mode: 'error',
      error: e.message,
    };
  }
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = {};
  for (const a of rest) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  (async () => {
    if (cmd === 'status') {
      const s = await status();
      console.log(JSON.stringify(s, null, 2));
      process.exit(s.mode === 'api' ? 0 : 1);
    }
    if (cmd === 'publish') {
      if (!flags.slug) {
        console.error('Missing --slug');
        process.exit(2);
      }
      // Pull the generator-shaped post body so the CLI matches what the
      // routine will pass programmatically.
      const generator = require('./generator.cjs');
      const blog = generator.loadBlogDraft(flags.slug);
      const post = await generator.generateGbpPost(blog);
      if (!post.validation?.ok) {
        console.error('Generator validation failed:', post.validation?.errors);
        process.exit(3);
      }
      const result = await publish({
        slug: post.slug,
        summary: post.summary,
        ctaUrl: post.ctaUrl,
        imageUrl: post.imageUrl,
        ctaAction: post.ctaType || 'LEARN_MORE',
      });
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    }
    console.error('Usage: api-bridge.cjs {status | publish --slug=<blog-slug>}');
    process.exit(2);
  })().catch((e) => {
    console.error('FAIL:', e.message);
    process.exit(1);
  });
}

module.exports = { publish, status };
