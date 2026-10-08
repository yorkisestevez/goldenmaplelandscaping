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
  return `${pathname}/${rest}`;
}

export function __gmSlash(path: string): string {
  return slashPath(path);
}
