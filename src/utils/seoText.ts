const BRAND = 'Golden Maple';
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 155;

const brandCount = (title: string) => title.match(/golden maple/gi)?.length ?? 0;

function fit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  const trimmed = (space >= 24 ? cut.slice(0, space) : cut).trim().replace(/[\s,;:&|–—-]+$/u, '').trim();
  return trimmed || cut.trim();
}

/** One brand, once, at or under 60 characters. A title that already names the brand is not given another. */
export function composeTitle(title: string, siteName: string): string {
  let unique = title.replace(/\s+/g, ' ').trim();
  const suffixes = [` | ${siteName}`, ` | ${BRAND}`];
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const suffix of suffixes) {
      if (unique.endsWith(suffix)) {
        unique = unique.slice(0, -suffix.length).trim();
        stripped = true;
      }
    }
  }
  unique = unique.replace(/[\s,;:&|–—-]+$/u, '').trim();
  if (!unique) return BRAND;
  if (brandCount(unique) >= 1) return fit(unique, TITLE_LIMIT);
  const withBrand = `${unique} | ${BRAND}`;
  if (withBrand.length <= TITLE_LIMIT) return withBrand;
  return fit(unique, TITLE_LIMIT);
}

/** Keep a description that already fits. Shorten a long one on a sentence or word boundary. */
export function composeDescription(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  if (text.length <= DESCRIPTION_LIMIT) return text;
  const window = text.slice(0, DESCRIPTION_LIMIT);
  const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentence >= 110) return window.slice(0, sentence + 1).trim();
  const space = window.lastIndexOf(' ');
  if (space >= 110) return window.slice(0, space).trim();
  return window.trim();
}
