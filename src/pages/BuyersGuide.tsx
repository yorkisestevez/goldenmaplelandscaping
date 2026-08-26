import SEO from '../components/SEO';
import { Shield, Hammer, Droplet, Sun, CheckCircle } from 'lucide-react';

export default function BuyersGuide() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://goldenmaplelandscaping.ca/buyers-guide"
    },
    "headline": "How to Hire a Landscaper in Barrie: The 2026 Simcoe County Buyer's Guide",
    "description": "The ultimate guide to hiring a hardscape contractor in Barrie, ON. Learn about base depths, materials like interlock vs. composite, and what to ask your landscaper.",
    "author": {
      "@type": "Organization",
      "name": "Golden Maple Landscaping"
    }
  };

  return (
    <>
      <SEO 
        title="2026 Landscaping Buyer's Guide | Barrie & Simcoe County"
        description="The ultimate guide to hiring a hardscape contractor in Barrie, ON. Learn about base depths, materials like interlock vs. composite, and what to ask your landscaper."
        canonical="https://goldenmaplelandscaping.ca/buyers-guide"
        schema={schema}
      />
      <div className="pt-32 pb-24 bg-brand-nearblack min-h-screen text-brand-bonewhite">
        <div className="container-custom max-w-4xl">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">The 2026 Edition</span>
          <h1 className="font-display text-5xl md:text-7xl font-light mb-12">
            The Simcoe County <span className="text-brand-gold-dark italic">Buyer's Guide</span>
          </h1>
          
          <div className="prose prose-invert prose-brand max-w-none font-sans font-light text-brand-muted leading-relaxed">
            <p className="text-lg md:text-xl mb-12 text-brand-bonewhite">
              Hiring a landscaper in Barrie or Simcoe County is a major investment. With our harsh freeze-thaw cycles, choosing the wrong contractor can lead to sunken patios, shifting retaining walls, and costly repairs within just a few years. This guide is designed to empower you with the exact knowledge you need to hire the best landscape company near you.
            </p>

            <h2 className="font-display text-3xl font-light text-brand-bonewhite mt-16 mb-8 border-b border-brand-dim/20 pb-4">
              1. The Engineering Standard for Barrie, ON
            </h2>
            <p>
              In Simcoe County, the ground expands and contracts significantly due to the winter frost. A standard 6-inch base is simply not enough for interlocking stone or retaining walls.
            </p>
            <div className="bg-brand-surface p-8 rounded-sm my-8 border border-brand-dim/20">
              <h3 className="text-brand-gold-dark font-display text-xl mb-4">The Golden Maple Standard vs. Industry Average</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-4">
                  <Shield className="text-brand-gold shrink-0 mt-1" size={20} />
                  <span><strong>Base Depth:</strong> The industry average is 6-8 inches. We dig 12-16 inches to ensure total immunity to frost heave.</span>
                </li>
                <li className="flex items-start gap-4">
                  <Shield className="text-brand-gold shrink-0 mt-1" size={20} />
                  <span><strong>Base Material:</strong> Many use cheap granular A. We use high-performance bedding (HPB) or clear stone for superior drainage and structural integrity.</span>
                </li>
              </ul>
            </div>

            <h2 className="font-display text-3xl font-light text-brand-bonewhite mt-16 mb-8 border-b border-brand-dim/20 pb-4">
              2. Material Comparisons for 2026
            </h2>
            <p>What is the best material for your patio or deck in Barrie? Let's break it down.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8">
              <div className="bg-brand-surface p-8 border border-brand-dim/20">
                <h4 className="text-brand-bonewhite font-display text-2xl mb-4">Interlocking Stone</h4>
                <p className="text-sm mb-4">Highly durable, versatile designs. Permeable options available for better water management.</p>
                <div className="text-xs text-brand-gold-dark uppercase tracking-widest">Lifespan: 30+ Years</div>
              </div>
              <div className="bg-brand-surface p-8 border border-brand-dim/20">
                <h4 className="text-brand-bonewhite font-display text-2xl mb-4">Composite Decking</h4>
                <p className="text-sm mb-4">Zero maintenance, resistant to rot and splintering. Ideal for elevated spaces.</p>
                <div className="text-xs text-brand-gold-dark uppercase tracking-widest">Lifespan: 25+ Years</div>
              </div>
            </div>

            <h2 className="font-display text-3xl font-light text-brand-bonewhite mt-16 mb-8 border-b border-brand-dim/20 pb-4">
              3. 5 Questions to Ask Your Landscaper
            </h2>
            <ol className="list-decimal pl-6 space-y-6">
              <li>
                <strong className="text-brand-bonewhite">Are you WSIB covered and do you carry liability insurance?</strong><br />
                Never hire a contractor without at least $2M in liability insurance ($5M is preferred).
              </li>
              <li>
                <strong className="text-brand-bonewhite">What is your warranty on sink and settlement?</strong><br />
                A 1-year warranty is a red flag. Expect at least 3-5 years on craftsmanship. Golden Maple offers a localized 5-year sink and settlement warranty.
              </li>
              <li>
                <strong className="text-brand-bonewhite">Can you provide 3D CAD designs before building?</strong><br />
                Visual clarity prevents expensive misunderstandings later.
              </li>
              <li>
                <strong className="text-brand-bonewhite">How deep will you excavate the base?</strong><br />
                If they say less than 10-12 inches for a patio in Barrie, look elsewhere.
              </li>
              <li>
                <strong className="text-brand-bonewhite">Will the owner be on-site during construction?</strong><br />
                Quality control often drops when subcontractors run the site. At Golden Maple, the owner is present on every project.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
