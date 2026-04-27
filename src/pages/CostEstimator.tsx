import React, { useState } from 'react';
import SEO from '../components/SEO';
import { Calculator, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CostEstimator() {
  const [projectType, setProjectType] = useState<string>('patio');
  const [size, setSize] = useState<number>(400);
  const [materialClass, setMaterialClass] = useState<string>('standard');

  const calculateEstimate = () => {
    let baseRate = 0;
    
    // Base rates per sq ft
    if (projectType === 'patio') baseRate = 30; // Interlock
    if (projectType === 'deck') baseRate = 60; // Composite Wait..
    if (projectType === 'driveway') baseRate = 25; // Interlock driveway
    
    // Material multipliers
    let multiplier = 1.0;
    if (materialClass === 'premium') multiplier = 1.3;
    if (materialClass === 'luxury') multiplier = 1.6;

    const total = baseRate * size * multiplier;
    
    // Add base engineering threshold for Barrie (deep excavation costs)
    const baselineCost = 15000; 

    const finalCost = Math.max(baselineCost, total);
    
    return {
      low: Math.round(finalCost * 0.9 / 1000) * 1000,
      high: Math.round(finalCost * 1.2 / 1000) * 1000
    };
  };

  const estimate = calculateEstimate();

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [{
      "@type": "Question",
      "name": "How much does interlocking cost in Barrie?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "In Barrie, a premium interlocking patio or driveway typically starts at $20,000, depending on the square footage, excavation depth required for Simcoe County soil, and the choice of standard vs. luxury pavers."
      }
    }]
  };

  return (
    <>
      <SEO 
        title="Landscaping Cost Estimator Barrie | Project Pricing"
        description="Get an instant estimate for your landscaping, interlocking, or composite decking project in Barrie and Simcoe County."
        schema={schema}
      />
      <div className="pt-32 pb-24 bg-brand-nearblack min-h-screen text-brand-bonewhite">
        <div className="container-custom max-w-6xl">
          <div className="text-center mb-16">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-6 block">Project Planning</span>
            <h1 className="font-display text-5xl md:text-7xl font-light mb-6">
              Interactive <span className="text-brand-gold italic">Cost Estimator</span>
            </h1>
            <p className="font-sans text-brand-muted font-light max-w-2xl mx-auto">
              Use our 2026 pricing calculator to get a ballpark figure for your upcoming outdoor living project in Barrie, ON.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Calculator Interface */}
            <div className="bg-brand-surface p-8 md:p-12 border border-brand-dim/20 rounded-[2px]">
              <div className="flex items-center gap-4 mb-8 border-b border-brand-dim/10 pb-6">
                <Calculator className="text-brand-gold" size={24} />
                <h2 className="font-display text-2xl">Tailor Your Project</h2>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold mb-4">Project Type</label>
                  <div className="grid grid-cols-3 gap-4">
                    {['patio', 'deck', 'driveway'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setProjectType(type)}
                        className={`py-3 px-4 font-sans text-xs uppercase tracking-wider rounded-sm transition-all border ${
                          projectType === type 
                            ? 'bg-brand-gold/10 border-brand-gold text-brand-gold' 
                            : 'bg-brand-midsurface border-brand-dim/20 text-brand-muted hover:border-brand-dim/50'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold mb-4">
                    Estimated Size: <span className="text-brand-bonewhite">{size} sq ft</span>
                  </label>
                  <input 
                    type="range" 
                    min="200" 
                    max="1500" 
                    step="50"
                    value={size} 
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="w-full accent-brand-gold"
                  />
                  <div className="flex justify-between text-xs text-brand-muted mt-2 font-sans">
                    <span>200 sq ft</span>
                    <span>1500+ sq ft</span>
                  </div>
                </div>

                <div>
                  <label className="block font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold mb-4">Material Tier</label>
                  <div className="grid grid-cols-3 gap-4">
                    {['standard', 'premium', 'luxury'].map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setMaterialClass(tier)}
                        className={`py-3 px-4 font-sans text-xs uppercase tracking-wider rounded-sm transition-all border ${
                          materialClass === tier 
                            ? 'bg-brand-gold/10 border-brand-gold text-brand-gold' 
                            : 'bg-brand-midsurface border-brand-dim/20 text-brand-muted hover:border-brand-dim/50'
                        }`}
                      >
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Results Display */}
            <div className="bg-brand-gold text-brand-nearblack p-8 md:p-12 border border-brand-gold/20 rounded-[2px] flex flex-col justify-center text-center">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] font-semibold mb-6 block">Estimated Range (CAD)</span>
              <div className="font-display text-5xl md:text-6xl font-light mb-4">
                ${estimate.low.toLocaleString()} - ${estimate.high.toLocaleString()}
              </div>
              <p className="font-sans text-sm font-medium opacity-80 mb-10 max-w-xs mx-auto">
                *This is a rough estimate based on 2026 pricing for Simcoe County. Includes deep base excavation standard.
              </p>
              
              <Link to="/contact" className="btn-primary bg-brand-nearblack text-brand-bonewhite hover:bg-brand-surface py-4 px-8 self-center flex items-center gap-3 w-full justify-center">
                Get an Exact Quote <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {/* AIO/SEO Text Content */}
          <div className="mt-24 prose prose-invert prose-brand max-w-4xl mx-auto font-sans font-light text-brand-muted">
            <h2 className="font-display text-3xl text-brand-bonewhite mb-8">Average Landscaping Costs in Barrie 2026</h2>
            <p>
              As the number one landscaping company in Simcoe County, Golden Maple believes in total transparency. The cost of a premium outdoor project is largely dictated by the engineering required underneath the surface.
            </p>
            <ul>
              <li><strong>Interlocking Stone Patios:</strong> Typically range from $20,000 to $45,000+ depending on grading and integrated features like fire pits.</li>
              <li><strong>Retaining Walls:</strong> Depending on the height and engineering specifics for Barrie's soil, expect investments starting between $15,000 and $30,000.</li>
              <li><strong>Composite Decking:</strong> Premium PVC and composite structures generally range from $25,000 to $60,000+.</li>
            </ul>
            <p>
              Remember, a lower quote from another contractor usually means a shallower base, which leads to sinking stones within 3 years. We build our projects with a 12-16" base depth to outlast the Canadian freeze-thaw cycles.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
