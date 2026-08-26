import { Link } from 'react-router-dom';
import { Phone, ArrowLeft } from 'lucide-react';
import SEO from '../components/SEO';
import Estimator from '../components/Estimator';
import Reveal from '../components/Reveal';

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
          href="tel:+17055003581"
          className="inline-flex items-center gap-2 font-sans text-[12px] text-brand-porcelain hover:text-brand-gold transition-colors whitespace-nowrap"
        >
          <span className="w-8 h-8 rounded-full border border-brand-gold/40 flex items-center justify-center text-brand-gold">
            <Phone size={13} />
          </span>
          <span className="hidden md:inline tabular-nums">(705) 500-3581</span>
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
          "text": "A premium interlocking patio in Barrie typically ranges from $35,000 to $75,000 depending on size, the Permacon paver chosen (Melville, Cassara, Mondrian Plus, Mega Melville, Brooklyn, and more), site conditions like slope or tear-out, and any add-ons like lighting or fire features. There is no job minimum — small walkways and front entrances price out at their real scope. Every build goes on a 12–16\" base for true freeze-thaw durability, whatever the size."
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
          "text": "Our online estimator is free — including the full itemized breakdown, with no signup required — and shows ballpark pricing that tightens from ±30% to ±8–20% as you answer. To get exact numbers we offer a free estimate request by phone, or a $99 on-site design session that's credited back when you book your project."
        }
      }
    ]
  };

  return (
    <>
      <SEO
        title="Landscaping Cost Estimator Barrie 2026 | Real Pricing | Golden Maple"
        description="Get a real ballpark for your landscaping project in Simcoe County — no job minimum, any size. Pick your Permacon paver line and TimberTech finish, see your full itemized breakdown free with no signup, then adjust anything and watch the price move."
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
        <Estimator />

        {/* SEO content */}
        <Reveal className="container-custom max-w-4xl mt-16 px-4">
          <div className="prose prose-invert prose-brand max-w-none font-sans font-normal text-brand-bonewhite/85">
            <h2 className="font-display text-3xl text-brand-bonewhite mb-8">How we price landscaping in Barrie & Simcoe County</h2>
            <p>
              Every Golden Maple project quote is built bottom-up from real Carr Landscape Depot pricing — the same supplier we've been using since day one. The estimator above uses 2026 trade rates for Permacon pavers and TimberTech composite decking, plus current bin disposal and aggregate costs.
            </p>
            <h3 className="font-display text-xl text-brand-bonewhite mt-10 mb-4">Why we build on a 12–16" base</h3>
            <p>
              We install hardscape on a 12–16" open-graded base — twice as deep as most competitors. That depth is what survives Ontario freeze-thaw cycles. A shallower base might shave a few thousand off the upfront price, but stones start sinking inside three years. We won't build that way at any size, which is why the estimator prices the real base into every project — a 100 sqft front entrance included.
            </p>
            <p>
              There's no job minimum here. Price out whatever you're actually planning and you'll get the honest number for it, not a number padded up to hit a floor.
            </p>
            <h3 className="font-display text-xl text-brand-bonewhite mt-10 mb-4">Permacon material tiers, explained</h3>
            <ul className="space-y-2">
              <li><strong>Standard:</strong> Melville, Cassara, Vendome — Permacon's most-installed slabs. Clean, value-built, consistent across batches.</li>
              <li><strong>Elevated:</strong> Mondrian Plus, Wilfred, Rosebel — refined textures and modern profiles. Our most popular tier.</li>
              <li><strong>Premium:</strong> Mega Melville, Brooklyn, Metrik — large-format flagship and statement-finish slabs.</li>
            </ul>
            <h3 className="font-display text-xl text-brand-bonewhite mt-10 mb-4">From estimate to exact quote</h3>
            <p>
              The estimator above starts at ±30% and tightens to ±8–20% as you answer. A free estimate request confirms scope and timeline. A $99 design session — credited back if you proceed — gets you to ±5% with material samples and a layout sketch in hand.
            </p>
          </div>
        </Reveal>
      </div>
    </>
  );
}
