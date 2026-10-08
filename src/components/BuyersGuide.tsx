import { BUSINESS, publicClaimCopy } from '../data/business';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import LeadForm from './LeadForm';

const BuyersGuide = () => {
  return (
    <section id="buyers-guide" className="section-padding bg-brand-nearblack">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* TIER 1: FREE DOWNLOAD */}
          <div className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 blur-3xl -mr-16 -mt-16 group-hover:bg-brand-gold/10 transition-colors duration-700" />
            
            <div className="relative z-10">
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block font-normal">
                Planning guide
              </span>
              <h3 className="font-display text-4xl font-light text-brand-bonewhite mb-8 leading-tight">
                The Outdoor Living <br />
                <span className="italic">Buyers Guide</span>
              </h3>
              
              <ul className="space-y-6 mb-12">
                {[
                  "What to expect from the design-build process",
                  "Material comparisons: interlock, natural stone, porcelain",
                  "How to budget for a $40K–$90K+ project",
                  "Questions to ask every contractor",
                  publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, ''),
                ].filter(Boolean).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-4 font-sans text-sm text-brand-muted font-light leading-relaxed">
                    <CheckCircle2 size={18} className="text-brand-gold-dark shrink-0 mt-0.5" strokeWidth={1.5} />
                    {item}
                  </li>
                ))}
              </ul>

              <LeadForm
                formName="guide-download"
                source="buyers_guide_download"
                idPrefix="guide-download"
                submitLabel="Download the guide"
                intro="The PDF downloads on the next page. We do not email it unless you ask."
              />
            </div>
          </div>

          {/* TIER 2: FREE ESTIMATE */}
          <div className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 blur-3xl -mr-16 -mt-16 group-hover:bg-brand-gold/10 transition-colors duration-700" />
            
            <div className="relative z-10">
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block font-normal">
                Project estimate
              </span>
              <h3 className="font-display text-4xl font-light text-brand-bonewhite mb-6 leading-tight">
                Request a <br />
                <span className="italic">Project Estimate</span>
              </h3>
              <p className="font-sans text-sm text-brand-muted mb-10 leading-relaxed font-light">Tell us about your project and we will follow up about next steps.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 mb-8 text-[11px] text-brand-bonewhite uppercase tracking-wider font-normal">
                {[
                  "Rough budget range",
                  "Timing for this season or next",
                  "Town and project type",
                  "A written scope before work starts"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle2 size={14} className="text-brand-gold-dark" strokeWidth={2} />
                    {item}
                  </div>
                ))}
              </div>

              <LeadForm
                formName="estimate-request"
                source="estimate_request"
                idPrefix="estimate-request"
                submitLabel="Send my request"
              />
            </div>
          </div>

        </div>

        {/* TIER 3: DESIGN PACKAGE BAR */}
        <div className="mt-12 bg-brand-cream-light rounded-[2px] p-8 md:p-12 overflow-hidden relative group border border-brand-gold/40 shadow-[0_18px_50px_-30px_rgba(33,30,21,0.4)]">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-40" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-10 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="px-6 py-2 border border-brand-gold/40 rounded-full font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark bg-brand-gold/10">
                Serious Buyers
              </div>
              <div>
                <h4 className="font-display text-3xl text-brand-ink mb-2 font-light">Book a <span className="italic text-brand-green-dark">Design Package</span></h4>
                <p className="font-sans text-brand-muted text-sm font-light">
                  A design package is a written plan before construction. The fee and the drawings you receive are in that agreement.
                </p>
              </div>
            </div>
            <Link
              to="/contact"
              className="bg-brand-gold text-brand-black font-sans text-[11px] font-normal uppercase tracking-[0.25em] py-4 px-10 rounded-[2px] hover:bg-brand-gold-dark hover:translate-y-[-2px] transition-all duration-500 whitespace-nowrap shadow-xl"
            >
              Tell Us Your Budget
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
};

export default BuyersGuide;
