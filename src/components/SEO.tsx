import { Helmet } from 'react-helmet-async';
import { BUSINESS } from '../data/business';
import { canonicalUrl as toCanonical } from '../utils/schema';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  schema?: object;
  image?: string;
  noindex?: boolean;
}

const BRAND = 'Golden Maple';
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 155;

/** One brand, once, at or under 60 characters. Strips a trailing brand the page already added. */
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
  const suffix = ` | ${BRAND}`;
  const room = TITLE_LIMIT - suffix.length;
  if (unique.length > room) {
    const cut = unique.slice(0, room);
    const space = cut.lastIndexOf(' ');
    unique = (space >= 24 ? cut.slice(0, space) : cut).trim();
  }
  unique = unique.replace(/[\s,;:&|–—-]+$/u, '').trim();
  if (!unique) return BRAND;
  return `${unique}${suffix}`;
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

export default function SEO({ title, description, canonical, schema, image, noindex }: SEOProps) {
  const siteName = BUSINESS.publicName.value;
  const fullTitle = composeTitle(title, siteName);
  const metaDescription = composeDescription(description);
  const defaultImage = 'https://goldenmaplelandscaping.ca/images/projects/Golden%20Maple%20deck%20and%20walkway.jpg';
  // Netlify's `pretty_urls = true` serves prerendered routes at trailing-slash
  // URLs. Canonicals must match the final 200 URL exactly; otherwise Google
  // sees sitemap URL -> 301 -> page whose canonical points back across the
  // redirect, creating duplicate/alternate-canonical indexing exclusions.
  const canonicalUrl = canonical ? toCanonical(canonical) : undefined;

  // The business entity is NOT emitted here — root.tsx declares #business once
  // for every route. `schema` is page-level only and should reference it.
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={image || defaultImage} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image || defaultImage} />

      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
}
