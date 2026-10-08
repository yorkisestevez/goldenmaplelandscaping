import { readFileSync } from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import { slashPath } from '../src/utils/trailingSlash';

const SRC = path.resolve(__dirname, '../src');

/**
 * Rewrite internal absolute paths to the trailing-slash canonical Netlify
 * serves. `load` replaces the module source so the prerendered hrefs and the
 * hydrated router agree. Apostrophes in copy are left alone.
 */
export function trailingSlashLinks(): Plugin {
  return {
    name: 'gm-trailing-slash-links',
    enforce: 'pre',
    load(id) {
      const file = id.split('?')[0];
      if (!file.startsWith(SRC) || !/\.[cm]?tsx?$/.test(file)) return null;
      if (file.endsWith(`${path.sep}trailingSlash.ts`)) return null;
      const code = readFileSync(file, 'utf8');
      let next = rewritePaths(code);
      if (next === code) return null;
      if (next.includes('__gmSlash(') && !code.includes('__gmSlash(')) {
        const rel = path
          .relative(path.dirname(file), path.join(SRC, 'utils/trailingSlash'))
          .replace(/\\/g, '/')
          .replace(/\.ts$/, '');
        const spec = rel.startsWith('.') ? rel : `./${rel}`;
        next = `import { __gmSlash } from '${spec}';\n${next}`;
      }
      return next;
    },
  };
}

function rewritePaths(code: string): string {
  let next = code.replace(/(`)(\/[^`\\]*)\1/g, (match, _q: string, raw: string) => {
    if (!raw.startsWith('/') || raw.startsWith('//')) return match;
    if (raw.includes('${')) return `__gmSlash(\`${raw}\`)`;
    const slashed = slashPath(raw);
    return slashed === raw ? match : `\`${slashed}\``;
  });
  next = next.replace(/href=\\"(\/[^"\\]*)\\"/g, (match, raw: string) => {
    const slashed = slashPath(raw);
    return slashed === raw ? match : `href=\\"${slashed}\\"`;
  });
  next = next.replace(/\]\((\/[^)\s]+)\)/g, (match, raw: string) => {
    const slashed = slashPath(raw);
    return slashed === raw ? match : `](${slashed})`;
  });
  next = next.replace(/(["'])(\/[A-Za-z0-9_./?=&%#~:+-]*)\1/g, (match, q: string, raw: string) => {
    if (!raw.startsWith('/') || raw.startsWith('//')) return match;
    const slashed = slashPath(raw);
    return slashed === raw ? match : `${q}${slashed}${q}`;
  });
  return next;
}
