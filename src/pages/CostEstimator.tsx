import SEO from '../components/SEO';
import Estimator from '../components/Estimator';
import Reveal from '../components/Reveal';

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
          "text": "A premium interlocking patio in Barrie typically ranges from $25,000 to $55,000 depending on size, the Permacon paver chosen (Melville, Cassara, Mondrian Plus, Mega Melville, Brooklyn, and more), site conditions like slope or tear-out, and any add-ons like lighting or fire features. There is no job minimum — small walkways and front entrances price out at their real scope. Every build goes on a 12–16\" base for true freeze-thaw durability, whatever the size."
        }
      },
      {
        "@type": "Question",
        "name": "What does a composite deck cost in Simcoe County?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "TimberTech AZEK Prime+ composite decking typically lands around $58/sqft installed; TimberTech AZEK Vintage around $68/sqft. A typical 300-sqft deck ranges $30,000–$60,000 depending on the TimberTech line, railing, and substructure."
        }
      },
      {
        "@type": "Question",
        "name": "Do you charge for estimates?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our online estimator is free and shows ballpark pricing within ±10–25%. To get exact numbers we offer a free estimate request by phone, or a $99 on-site design session that's credited back when you book your project."
        }
      }
    ]
  };

  return (
    <>
      <SEO
        title="Landscaping Cost Estimator Barrie 2026 | Real Pricing | Golden Maple"
        description="Get a real ballpark for your landscaping project in Simcoe County — no job minimum, any size. Pick your Permacon paver line and TimberTech finish, see your price range free, then unlock the itemized breakdown with your name and email."
        canonical="https://goldenmaplelandscaping.ca/cost-estimator"
        schema={schema}
      />
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
              We install hardscape on a 12–16" open-graded base — twice as deep as most competitors. That depth is what survives Ontario freeze-thaw cycles. A shallower base might shave a few thousand off the upfront price, but stones start sinking inside three years. We won't build that way at any size, which is why the estimator prices the real base into every project — a 60 sqft front entrance included.
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
              The estimator above gets you within ±10–25%. A free estimate request confirms scope and timeline. A $99 design session — credited back if you proceed — gets you to ±5% with material samples and a layout sketch in hand.
            </p>
          </div>
        </Reveal>
      </div>
    </>
  );
}
