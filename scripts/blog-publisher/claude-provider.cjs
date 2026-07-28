// claude-provider.cjs — drop-in replacement for the Gemini call in blog publishers.
//
// WHY: every blog publisher in the fleet (Golden Maple, Nudgel, TradeKit,
// Corte Inca) called generativelanguage.googleapis.com. As of 2026-07-28 the
// shared key has free-tier quota `limit: 0` on every model worth using, so all
// of them fail at the generate stage. This routes generation through the local
// Claude CLI instead — $0 on Yorkis's existing subscription, no API key, no quota.
//
// TRADE-OFF: Claude CLI lives on this machine, so the publisher must run locally
// rather than on GitHub runners. The box runs 24/7, so that's acceptable.
//
// Self-contained on purpose: each repo gets its own copy so it stays standalone.
// The only external requirement is the `claude` binary on PATH.

'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// A trivial prompt measured at 126s on this box, so a full 2000-word post needs
// real headroom. Long timeout beats a spurious failure on a weekly job.
const DEFAULT_TIMEOUT_MS = 900000; // 15 min

/**
 * Resolve the Claude binary.
 *
 * On Windows the extensionless `claude` is a shell script npm shim that spawn()
 * cannot execute directly — using it forces shell:true, which triggers a Node
 * deprecation warning and unescaped-argument concatenation. `claude.cmd` is the
 * real Windows entry point and runs with shell:false.
 */
function resolveClaudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform !== 'win32') return 'claude';
  const candidate = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'npm', 'claude.cmd',
  );
  return fs.existsSync(candidate) ? candidate : 'claude.cmd';
}

/**
 * Run a one-shot Claude CLI completion and return raw stdout text.
 *
 * The prompt goes in over STDIN, never argv: blog prompts run to several KB and
 * Windows truncates long command lines. Passing it as an argument is the single
 * most likely way for this to break silently on a big prompt.
 *
 * cwd is forced to the OS temp dir so Claude does not pick up the repo's
 * CLAUDE.md / project context, which would pollute the post and burn tokens.
 */
function claudeGenerate(prompt, opts = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    model = process.env.BLOG_CLAUDE_MODEL || null,
    bin = resolveClaudeBin(),
  } = opts;

  return new Promise((resolve, reject) => {
    const args = ['-p'];
    if (model) args.push('--model', model);

    // Node >=20 refuses to spawn .cmd/.bat with shell:false (CVE-2024-27980
    // mitigation) and throws EINVAL. Rather than re-enable shell:true — which
    // concatenates arguments unescaped — invoke cmd.exe directly with the
    // arguments passed as a real argv array.
    const isWinShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin);
    const cmd = isWinShim ? (process.env.COMSPEC || 'cmd.exe') : bin;
    const cmdArgs = isWinShim ? ['/d', '/s', '/c', bin, ...args] : args;

    const child = spawn(cmd, cmdArgs, {
      cwd: os.tmpdir(),
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* already gone */ }
      reject(new Error(`Claude CLI timeout after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });

    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Claude CLI failed to start (${bin}): ${e.message}`));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`Claude CLI exited ${code}: ${(err || out).slice(0, 500)}`));
      }
      const text = out.trim();
      if (!text) {
        return reject(new Error(`Claude CLI returned empty output. stderr: ${err.slice(0, 300)}`));
      }
      resolve(text);
    });

    child.stdin.on('error', () => { /* closed early; handled by close/error */ });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * Drop-in replacement for the publishers' `geminiPost(apiKey, body)`.
 *
 * The four repos' generate.cjs files have diverged (Nudgel wraps the call in a
 * retry loop, Golden Maple differs again), so patching call sites individually
 * would be four separate fragile edits. Instead this mimics Gemini's REQUEST and
 * RESPONSE shape exactly: it reads the prompt out of the Gemini request body and
 * returns a Gemini-shaped response object. Every existing call site — and the
 * existing `extractText()` — keeps working with no further changes.
 *
 * apiKey is accepted and ignored, so callers that still check for it don't break.
 */
async function geminiCompatPost(_apiKey, body, opts = {}) {
  const parts = body?.contents?.[0]?.parts || [];
  const prompt = parts.map((p) => p.text).filter(Boolean).join('\n');
  if (!prompt) {
    return { error: { message: 'claude-provider: no prompt text found in request body' } };
  }
  try {
    const text = await claudeGenerate(prompt, opts);
    return { candidates: [{ content: { parts: [{ text }] } }] };
  } catch (e) {
    // Gemini-shaped error so existing extractText() error handling still fires.
    return { error: { message: e.message } };
  }
}

module.exports = { claudeGenerate, geminiCompatPost, DEFAULT_TIMEOUT_MS };
