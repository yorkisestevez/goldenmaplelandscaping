// Resolves a swatch filename (from MATERIAL_TIERS colours) to its bundled,
// content-hashed URL. Every file in src/assets/swatches is REAL manufacturer
// product photography or a real board photo — see scripts/swatches.json.

const files: Record<string, string> = import.meta.glob('../assets/swatches/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byName: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!, url as string])
);

/** filename (e.g. "tt-primeplus-coconut-husk.jpg") -> bundled url, or '' if missing. */
export const swatchUrl = (filename?: string): string => (filename ? byName[filename] || '' : '');
