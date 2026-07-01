import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  schema?: object;
  image?: string;
}

export default function SEO({ title, description, canonical, schema, image }: SEOProps) {
  const siteName = 'Golden Maple Landscaping';
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  const defaultImage = 'https://goldenmaplelandscaping.ca/images/projects/Golden%20Maple%20deck%20and%20walkway.jpg';

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LandscapeService",
    "name": "Golden Maple Landscaping",
    "image": "https://goldenmaplelandscaping.ca/images/projects/Golden%20Maple%20deck%20and%20walkway.jpg",
    "@id": "https://goldenmaplelandscaping.ca/#business",
    "url": "https://goldenmaplelandscaping.ca",
    "telephone": "+1-705-500-3581",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Barrie",
      "addressRegion": "ON",
      "postalCode": "L4N",
      "addressCountry": "CA"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 44.3894,
      "longitude": -79.6903
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
      ],
      "opens": "08:00",
      "closes": "18:00"
    },
    "sameAs": [
      "https://www.facebook.com/GoldenMaplegroup",
      "https://www.homestars.com/companies/2982995-golden-maple-landscaping",
      "https://www.yelp.com/biz/golden-maple-landscaping-barrie-4"
    ],
    "areaServed": [
      { "@type": "City", "name": "Barrie" },
      { "@type": "City", "name": "Innisfil" },
      { "@type": "City", "name": "Oro-Medonte" },
      { "@type": "City", "name": "Springwater" },
      { "@type": "City", "name": "Orillia" },
      { "@type": "City", "name": "Wasaga Beach" },
      { "@type": "City", "name": "Midland" },
      { "@type": "City", "name": "Collingwood" }
    ]
  };

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      
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

      {canonical && <link rel="canonical" href={canonical} />}
      
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
