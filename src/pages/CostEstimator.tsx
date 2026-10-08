import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import Estimator from '../components/Estimator';
import Reveal from '../components/Reveal';

export default function CostEstimator() {
  // While the 3D deck designer is open inside the estimator it is the whole
  // page, with its own bar back to the estimate (Estimator reports it).
  const [studioOpen, setStudioOpen] = useState(false);
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How much does an interlocking patio cost in Barrie?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A premium interlocking patio in Barrie typically ranges from $35,000 to $75,000 depending on size, paver selection, site conditions such as slope or tear-out, and add-ons such as lighting or fire features. This estimator provides a planning range; final scope, site preparation, and commercial terms are confirmed directly for each project."
        }
      },
      {
        "@type": "Question",
        "name": "What does a composite deck cost in Simcoe County?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our 3D deck designer gives the one deck price on this site: it prices your exact size, height, stairs, railing and TimberTech collection from our price book. For example, a 20 × 15 ft (300 sq ft) attached deck 18 in off the ground in TimberTech EDGE Prime+ decking, with aluminum railing, one stair and a one-row picture-frame border, has a priced portion of about $32,200 before HST; the same deck 8 ft up as a walkout has a priced portion of about $46,100. Unpriced connections, installation and order-specific adjustments are confirmed by supplier quote or builder quote before a final quotation."
        }
      },
      {
        "@type": "Question",
        "name": "Do you charge for estimates?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The online estimator provides a planning-range breakdown that changes as you answer. Contact Golden Maple to confirm the current consultation, design, site-visit, and final-quote process for your project."
        }
      }
    ]
  };

  return (
    <>
      <SEO
        title="Landscaping Cost Estimator Barrie 2026 | Real Pricing | Golden Maple"
        description="Explore a planning-range estimate for your Simcoe County landscaping project. Adjust material and scope inputs, then contact Golden Maple to confirm current project terms."
        canonical="https://goldenmaplelandscaping.ca/cost-estimator"
        /* Purpose-built share card — every texted ?build= permalink and every
           social share of this page previews with this instead of the generic
           site-wide deck photo. Built by scripts/build-estimator-images.mjs;
           -v1 is cache-busting against the 1-year immutable /images/* header. */
        image="https://goldenmaplelandscaping.ca/images/og/cost-estimator-v1.jpg"
        schema={schema}
      />
      <div className={studioOpen ? undefined : 'pt-28 pb-32 bg-brand-nearblack min-h-screen text-brand-bonewhite'}>
        {!studioOpen && <h1 className="font-display text-3xl text-center px-4 mb-6">Plan your landscaping investment</h1>}
        <Estimator onStudioChange={setStudioOpen} />

        {/* SEO content */}
        {!studioOpen && (
        <Reveal className="container-custom max-w-4xl mt-16 px-4">
          <div className="prose prose-invert prose-brand max-w-none font-sans font-normal text-brand-bonewhite/85">
            <h2 className="font-display text-3xl text-brand-bonewhite mb-8">How we price landscaping in Barrie & Simcoe County</h2>
            <p>
              This calculator uses loaded supplier price data and quantity assumptions to produce a planning estimate for materials, labour and disposal. It does not fetch live supplier prices. Confirm current rates, site conditions, quantities and the written scope before committing to a project.
            </p>
            <h3 className="font-display text-xl text-brand-bonewhite mt-10 mb-4">Site preparation is project-specific</h3>
            <p>
              Ontario freeze-thaw conditions, drainage, soil, access, intended use, and local requirements can affect excavation and base preparation. The estimator is a planning tool; final site preparation is confirmed in the written project scope.
            </p>
            <p>
              Use the estimator to explore your intended scope. Availability, minimums, and final commercial terms are confirmed directly before a project is booked.
            </p>
            <h3 className="font-display text-xl text-brand-bonewhite mt-10 mb-4">Permacon material tiers, explained</h3>
            <ul className="space-y-2">
              <li><strong>Standard:</strong> Melville, Cassara, Vendome — Permacon's most-installed slabs. Clean, value-built, consistent across batches.</li>
              <li><strong>Elevated:</strong> Mondrian Plus, Wilfred, Rosebel — refined textures and modern profiles. Our most popular tier.</li>
              <li><strong>Premium:</strong> Mega Melville, Brooklyn, Metrik — large-format flagship and statement-finish slabs.</li>
            </ul>
            <h3 className="font-display text-xl text-brand-bonewhite mt-10 mb-4">Decks are designed in 3D, right in the estimator</h3>
            <p>
              Choose a composite deck and our <Link to="/deck-designer">3D deck designer</Link> opens right here, the one deck price on this site. It prices your exact size, height, stairs, railing and TimberTech collection. Add a deck to a full backyard and the designer prices it into your total: a starter deck at your size to begin with, then the exact deck you draw.
            </p>
            <h3 className="font-display text-xl text-brand-bonewhite mt-10 mb-4">From estimate to exact quote</h3>
            <p>
              The estimator starts as a planning range and changes as you refine inputs. Contact Golden Maple to confirm the current consultation, design, material-selection, and final-quote process.
            </p>
          </div>
        </Reveal>
        )}
      </div>
    </>
  );
}
