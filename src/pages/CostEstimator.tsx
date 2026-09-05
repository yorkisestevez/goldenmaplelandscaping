import { Link } from 'react-router-dom';
import { Phone, ArrowLeft } from 'lucide-react';
import SEO from '../components/SEO';
import Estimator from '../components/Estimator';
import Reveal from '../components/Reveal';
import { publicContact } from '../data/business';

/** The estimator renders chrome-less (root.tsx skips SiteChrome) — this slim
 *  bar is its entire app frame: a way home, and a way to call. */
function EstimatorTopBar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-brand-burgundy/95 backdrop-blur-md border-b border-brand-gold/20">
      <div className="max-w-[1280px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 min-w-0 group">
          <img src="/logo-mark.png" alt="Golden Maple Landscaping" className="h-9 w-auto shrink-0" />
          <span className="hidden sm:flex flex-col leading-tight">
            <span className="font-display text-[15px] text-brand-porcelain tracking-wide">Golden Maple</span>
            <span className="font-sans text-[9px] uppercase tracking-[0.3em] text-brand-porcelain-soft">Cost Estimator</span>
          </span>
          <span className="sm:hidden font-sans text-[11px] uppercase tracking-[0.2em] text-brand-porcelain-soft inline-flex items-center gap-1.5">
            <ArrowLeft size={13} /> Back to site
          </span>
        </Link>
        <a
          href={`tel:${publicContact.phoneTel}`}
          aria-label={`Call Golden Maple at ${publicContact.phoneDisplay}`}
          className="inline-flex items-center gap-2 font-sans text-[12px] text-brand-porcelain hover:text-brand-gold transition-colors whitespace-nowrap"
        >
          <span className="w-8 h-8 rounded-full border border-brand-gold/40 flex items-center justify-center text-brand-gold">
            <Phone size={13} />
          </span>
          <span className="hidden md:inline tabular-nums">{publicContact.phoneDisplay}</span>
        </a>
      </div>
    </header>
  );
}

export default function CostEstimator() {
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
          "text": "TimberTech AZEK Prime+ decking runs about $58/sqft for the deck itself, AZEK Vintage about $68/sqft. All-in with substructure, footings, railing and disposal, a 300-sqft ground-level deck lands around $19,500–$30,500; elevated walkout builds in Vintage with difficult access, slope, or drainage work can reach $50,000–$60,000."
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
      <EstimatorTopBar />
      <div className="pt-24 pb-32 bg-brand-nearblack min-h-screen text-brand-bonewhite">
        <h1 className="font-display text-3xl text-center px-4 mb-6">Plan your landscaping investment</h1>
        <Estimator />

        {/* SEO content */}
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
            <h3 className="font-display text-xl text-brand-bonewhite mt-10 mb-4">From estimate to exact quote</h3>
            <p>
              The estimator starts as a planning range and changes as you refine inputs. Contact Golden Maple to confirm the current consultation, design, material-selection, and final-quote process.
            </p>
          </div>
        </Reveal>
      </div>
    </>
  );
}
