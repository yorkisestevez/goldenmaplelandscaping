/** Internal path with a trailing slash, matching Netlify pretty_urls canonicals. */
export function slashPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const hash = path.indexOf('#');
  const query = path.indexOf('?');
  let end = path.length;
  if (hash >= 0) end = Math.min(end, hash);
  if (query >= 0) end = Math.min(end, query);
  const pathname = path.slice(0, end);
  const rest = path.slice(end);
  if (pathname === '/' || pathname.endsWith('/')) return path;
  // Netlify function URLs and files (including .webmanifest) are not pages.
  if (pathname.startsWith('/.netlify/')) return path;
  if (/\.[a-z0-9]+$/i.test(pathname)) return path;
  // Image files and filename stems are assets. The hero concatenates
  // `/images/concepts/backyard-hero-depth` with `-flat-v1-768.webp`; a trailing
  // slash turns that into a directory that 404s the LCP image and its preload.
  if (pathname === '/images' || pathname.startsWith('/images/')) return path;
  return `${pathname}/${rest}`;
}

/**
 * Compare a page's pathname with an internal path, with or without trailing slashes. The build rewrites quoted
 * internal paths in modules to their slashed form ('/contact' becomes '/contact/', buildTools/trailingSlashLinks.ts),
 * but the prerender renders each page at its unslashed path while the browser is at the slashed one: a plain
 * comparison then differs between the prerendered HTML and the first client render, and React throws the page away
 * (#418). This module is not rewritten, so these compare the paths as written.
 */
export function samePath(pathname: string, path: string): boolean {
  return slashPath(pathname) === slashPath(path);
}

/** True on `path` itself and every page under it, with or without trailing slashes (see samePath). */
export function underPath(pathname: string, path: string): boolean {
  return slashPath(pathname).startsWith(slashPath(path));
}

export function __gmSlash(path: string): string {
  return slashPath(path);
}
