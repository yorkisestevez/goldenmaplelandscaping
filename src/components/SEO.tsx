import { Helmet } from 'react-helmet-async';
import { BUSINESS, publicContact, publicPostalAddress, publicServiceAreas } from '../data/business';

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
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  const defaultImage = 'https://goldenmaplelandscaping.ca/images/projects/Golden%20Maple%20deck%20and%20walkway.jpg';
  // Netlify's `pretty_urls = true` serves prerendered routes at trailing-slash
  // URLs. Canonicals must match the final 200 URL exactly; otherwise Google
  // sees sitemap URL -> 301 -> page whose canonical points back across the
  // redirect, creating duplicate/alternate-canonical indexing exclusions.
  const canonicalUrl = canonical
    ? canonical === 'https://goldenmaplelandscaping.ca/' || canonical.endsWith('/')
      ? canonical
      : `${canonical}/`
    : undefined;

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LandscapeService',
    name: BUSINESS.publicName.value,
    image: `${BUSINESS.canonicalUrl}/images/projects/Golden%20Maple%20deck%20and%20walkway.jpg`,
    '@id': `${BUSINESS.canonicalUrl}/#business`,
    url: BUSINESS.canonicalUrl,
    telephone: publicContact.phoneTel,
    email: publicContact.email,
    address: publicPostalAddress(),
    openingHoursSpecification: BUSINESS.hours.value.map((hours) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.days,
      opens: hours.opens,
      closes: hours.closes,
    })),
    sameAs: [
      BUSINESS.urls.facebook.value,
      BUSINESS.urls.instagram.value,
      BUSINESS.urls.homeStars.value,
      BUSINESS.urls.yelp.value,
    ],
    areaServed: publicServiceAreas.map((name) => ({ '@type': 'City', name })),
  };

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={image || defaultImage} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image || defaultImage} />

      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      <script type="application/ld+json">
        {JSON.stringify(localBusinessSchema)}
      </script>

      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
}
