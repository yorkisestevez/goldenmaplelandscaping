/**
 * React Router's <Scripts> emits a modulepreload for every route import.
 * Those links are hoisted into <head> ahead of the stylesheet, so a mobile
 * browser fetches the JS graph before CSS and the hero text. The entry
 * module script still loads the graph; the hints are what compete.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'build/client';
const link = /<link\s+rel="modulepreload"[^>]*>/g;

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

let files = 0;
let removed = 0;
for (const path of htmlFiles(root)) {
  const html = readFileSync(path, 'utf8');
  const count = html.match(link)?.length ?? 0;
  if (!count) continue;
  writeFileSync(path, html.replace(link, ''));
  files += 1;
  removed += count;
}
const left = htmlFiles(root).reduce((sum, path) => sum + (readFileSync(path, 'utf8').match(link)?.length ?? 0), 0);
if (left) throw new Error(`${left} modulepreload links remain`);
console.log(`modulepreload stripped from ${files} pages (${removed} links).`);
