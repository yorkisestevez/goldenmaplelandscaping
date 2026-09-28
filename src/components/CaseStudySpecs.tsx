import ResponsiveImage from './ResponsiveImage';
import { CARD_SIZES, CONSTRUCTION_STAGES, type Attested, type CaseStudy } from '../data/projects';
import { portfolioImage } from '../data/portfolioImages';
import { budgetRangeLabel } from '../data/projectBudgets';

const STAGE_LABEL: Record<(typeof CONSTRUCTION_STAGES)[number], string> = {
  before: 'Before',
  excavation: 'Excavation',
  base: 'Base',
  bedding: 'Bedding',
  laying: 'Laying',
  finished: 'Finished',
};

/**
 * Renders a project's attested build record (src/data/projects.ts `caseStudy`).
 * Only fields that exist are shown, each one owner-attested and lint-checked
 * (scripts/check-case-studies.ts). Renders nothing for projects without one.
 */
export default function CaseStudySpecs({ caseStudy }: { caseStudy?: CaseStudy }) {
  if (!caseStudy) return null;

  const rows: [string, Attested<unknown> | undefined, (v: never) => string][] = [
    ['The problem', caseStudy.problem, (v: string) => v],
    ['Area', caseStudy.areaSqFt, (v: number) => `${v.toLocaleString('en-CA')} sq ft`],
    ['Excavation depth', caseStudy.excavationDepthIn, (v: number) => `${v} in`],
    ['Base', caseStudy.base, (v: string) => v],
    ['Bedding', caseStudy.bedding, (v: string) => v],
    ['Pavers', caseStudy.paverProduct, (v: { brand: string; product: string }) => `${v.brand} ${v.product}`],
    ['Drainage', caseStudy.drainage, (v: string) => v],
    ['Time on site', caseStudy.durationDays, (v: number) => `${v} working day${v === 1 ? '' : 's'}`],
    ['Budget bracket', caseStudy.budgetBracket, (v: Parameters<typeof budgetRangeLabel>[0]) => budgetRangeLabel(v)],
  ];
  const shown = rows.filter(([, fact]) => fact);
  const phases = [...(caseStudy.phasePhotos ?? [])].sort((a, b) => CONSTRUCTION_STAGES.indexOf(a.stage) - CONSTRUCTION_STAGES.indexOf(b.stage));
  if (shown.length === 0 && phases.length === 0) return null;

  const attesters = [...new Set(shown.map(([, f]) => f!.attestedBy))];
  const latest = shown.map(([, f]) => f!.attestedOn).sort().pop();

  return (
    <section className="mt-16 mb-6" aria-labelledby="build-record">
      <h2 id="build-record" className="font-display text-3xl font-light text-brand-ink mb-8">How this project was built</h2>
      {shown.length > 0 && (
        <>
          <dl className="grid grid-cols-1 md:grid-cols-2 border-t border-brand-dim">
            {shown.map(([label, fact, format]) => (
              <div key={label} className="flex flex-col gap-1 py-5 pr-6 border-b border-brand-dim">
                <dt className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark">{label}</dt>
                <dd className="font-sans text-base text-brand-ink font-light">{format(fact!.value as never)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 font-sans text-xs text-brand-muted">
            Build details recorded by {attesters.join(', ')}{latest ? `, ${latest}` : ''}. Every site is different; your scope is written for your property.
          </p>
        </>
      )}
      {phases.length > 0 && (
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {phases.map((photo) => (
            <figure key={photo.id}>
              <div className="overflow-hidden rounded-[2px] border border-brand-dim/40 bg-brand-surface">
                <ResponsiveImage image={portfolioImage(photo.id, 'card', photo.alt)} sizes={CARD_SIZES} aspect="4/3" />
              </div>
              <figcaption className="mt-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark">{STAGE_LABEL[photo.stage]}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
