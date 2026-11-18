import { Shield, Award, Compass } from 'lucide-react';
import Reveal from '../../Reveal';
import ResponsiveImage from '../../ResponsiveImage';
import { BUSINESS, publicClaimCopy } from '../../../data/business';
import { OWNER_FACTS, ownerFact } from '../../../data/ownerFacts';
import { getProject, projectCoverFull } from '../../../data/projects';

const WhyGoldenMaple = () => {
  const years = ownerFact(OWNER_FACTS.yearsInBusiness);
  const standards = [
    { icon: Compass, title: 'Project-specific site preparation', body: 'Drainage, soil conditions, access, and final excavation/base depth are reviewed for the written scope of each project.' },
    { icon: Shield, title: 'Coverage on file', body: publicClaimCopy(BUSINESS.credentials.liabilityInsurance, ''), },
    { icon: Award, title: 'Written workmanship terms', body: publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, ''), },
  ].filter((item) => item.body);
  return (
    <section className="section-padding bg-brand-cream text-brand-ink overflow-hidden relative">
      <div className="container-custom relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div>
            <Reveal>
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-green-dark mb-10 block font-medium">
                The Golden Maple Standard
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light leading-tight mb-12 text-brand-ink">
                Why your neighbour's <br />
                <span className="text-brand-green-dark italic">patio is already sinking.</span>
              </h2>
            </Reveal>
            <div className="space-y-12">
              {standards.map((s, i) => (
                <Reveal key={s.title} delay={0.1 + i * 0.1} className="flex gap-8">
                  <div className="w-14 h-14 bg-brand-cream-light flex items-center justify-center rounded-2xl shrink-0 border border-brand-ink/10 shadow-sm">
                    <s.icon className="text-brand-green-dark" size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-light text-brand-ink mb-3">{s.title}</h3>
                    <p className="font-sans text-sm text-brand-ink-soft leading-relaxed font-light">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-brand-ink/10">
              <ResponsiveImage image={projectCoverFull(getProject('cobblestone-driveway')!)} sizes="(min-width: 1024px) 45vw, 100vw" aspect="fill" whenVisible className="w-full h-full object-cover" />
            </div>
            {years && (
              <div className="absolute -bottom-10 -left-10 bg-brand-green-dark p-8 hidden md:block rounded-2xl shadow-xl max-w-[220px]">
                <span className="font-display text-3xl font-light text-brand-porcelain block mb-2">{years}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyGoldenMaple;
