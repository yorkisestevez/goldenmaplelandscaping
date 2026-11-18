import { Helmet } from 'react-helmet-async';
import { BUSINESS } from '../data/business';
import { canonicalUrl as toCanonical } from '../utils/schema';
import { composeDescription, composeTitle } from '../utils/seoText';

export { composeDescription, composeTitle };

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  schema?: object;
  image?: string;
  noindex?: boolean;
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
