import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '../utils/cn';
import PriceDelta from './ui/PriceDelta';
import { ADD_ONS, PAVER_BRANDS, defaultPaverForTier, type PaverTier } from '../data/carrPrices';
import type { EstimateInput } from '../utils/estimateEngine';

/**
 * The result screen's control panel.
 *
 * The estimator used to end in a verdict: seven forward-only questions, then a
 * number, and the only way back was a "Refine my answers" link that dumped you
 * at step 6. This turns that dead end into a workbench — every lever that moves
 * the price is here, live, with its real dollar effect printed on it, and the
 * headline above animates as you pull them.
 *
 * Nothing here invents pricing. Every figure comes from `deltaFor()`, which is
 * a real re-run of the same engine that produces the final estimate.
 */

const TIER_LABELS: { id: PaverTier; label: string }[] = [
  { id: 'budget', label: 'Standard' },
  { id: 'mid', label: 'Elevated' },
  { id: 'premium', label: 'Premium' },
];

/** Site facts, not preferences — see the note on `conditions` below. */
const CONDITION_LABELS: { id: string; short: string }[] = [
  { id: 'access', short: 'Tight access' },
  { id: 'slope', short: 'Slope / grading' },
  { id: 'drainage', short: 'Drainage work' },
  { id: 'levels', short: 'Multiple levels' },
];

export interface WorkbenchProps {
  build: EstimateInput;
  /** Midpoint dollar movement for a hypothetical one-field change. */
  preview: (patch: Partial<EstimateInput>) => number;
  /** The full displayed range a hypothetical change would produce — same
   *  confidence-widening the headline uses, so a scenario card can never quote
   *  a range the headline wouldn't show if you clicked it. */
  totalFor: (patch: Partial<EstimateInput>) => { low: number; high: number };
  /** Size inputs are project-type specific, so the parent renders them. */
  sizeControl: ReactNode;
  /** Brand cards, likewise — null when the project has no material choice. */
  brandPicker?: ReactNode;
  onTier: (tier: PaverTier) => void;
  onToggleAddOn: (id: string) => void;
  onToggleCondition: (id: string) => void;
  /** Fired on every lever pull so GA4 can answer "are people actually tuning?" */
  onAdjust: (lever: string, direction: string) => void;
}

/**
 * Workbench section. On desktop everything is always open — the workbench IS
 * the point of the result screen. On mobile the four sections stack into a
 * multi-screen scroll, so each one collapses to its title + a one-line summary
 * of the current choice; the summary keeps a closed section from hiding what's
 * selected inside it.
 */
function Section({ title, hint, summary, open, onToggle, children }: {
  title: string;
  hint?: string;
  /** One-line state readout shown on mobile while collapsed. */
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pt-7 first:pt-0 border-t first:border-t-0 border-brand-gold/10">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        // Desktop: inert header (sections always open there).
        className="w-full flex items-start justify-between gap-3 text-left md:pointer-events-none"
      >
        <div className="min-w-0">
          <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark">{title}</div>
          {!open && summary ? (
            <div className="md:hidden font-sans text-[12px] text-brand-bonewhite/75 mt-1 truncate">{summary}</div>
          ) : null}
        </div>
        <ChevronDown
          size={16}
          className={cn('md:hidden text-brand-gold-dark/70 shrink-0 mt-0.5 transition-transform duration-200', open && 'rotate-180')}
          strokeWidth={1.75}
        />
      </button>
      <div className={cn(open ? 'block' : 'hidden', 'md:block')}>
        {hint ? (
          <p className="font-sans text-[11px] font-normal text-brand-bonewhite/70 mt-1.5 mb-4 leading-relaxed">{hint}</p>
        ) : <div className="mb-4" />}
        {children}
      </div>
    </div>
  );
}

const toK = (n: number) => `$${(n / 1000).toFixed(0)}k`;

export default function EstimateWorkbench({
  build, preview, totalFor, sizeControl, brandPicker,
  onTier, onToggleAddOn, onToggleCondition, onAdjust,
}: WorkbenchProps) {
  const { tier, addOns, conditions } = build;

  // Mobile collapse state — Size open by default (the biggest lever), the
  // rest closed with summaries. Ignored at md+ where everything renders open.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ size: true });
  const toggleSection = (id: string) =>
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

  const currentPaver = PAVER_BRANDS.find(p => p.id === build.paverBrandId);
  const tierLabel = TIER_LABELS.find(t => t.id === tier)?.label ?? tier;
  const conditionCount = Object.values(conditions).filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
      className="bg-brand-cream-light border border-brand-gold/25 rounded-3xl p-7 md:p-9"
    >
      <div className="flex items-start gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-brand-gold/10 border border-brand-gold/25 flex items-center justify-center text-brand-gold-dark shrink-0">
          <SlidersHorizontal size={16} strokeWidth={1.75} />
        </div>
        <div>
          <h4 className="font-display text-2xl md:text-3xl text-brand-bone tracking-tight leading-none mb-1.5">
            Adjust your build
          </h4>
          <p className="font-sans text-[12px] font-normal text-brand-bonewhite/75 leading-relaxed">
            Change anything here and the number above moves with it. Every figure is what
            it actually costs — not a percentage you have to do maths on.
          </p>
        </div>
      </div>

      <div className="space-y-7">
        <Section title="Size & scope" open={!!openSections.size} onToggle={() => toggleSection('size')}>
          {sizeControl}
        </Section>

        {/* Whole outcomes side by side, not just deltas. Seeing "$24k / $28k /
            $33k" is a different act from reading "+$4,100" — it's choosing
            between three finished projects, which is the most direct form of
            control the page can offer. */}
        <Section
          title="Material"
          hint="Your exact build, priced three ways. This is usually the biggest lever you control."
          summary={`${tierLabel}${currentPaver ? ` · ${currentPaver.product}` : ''}`}
          open={!!openSections.material}
          onToggle={() => toggleSection('material')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {TIER_LABELS.map(t => {
              const isCurrent = tier === t.id;
              // Tier changes auto-swap the brand, so preview both together or
              // the advertised range won't match what happens on click.
              const patch = { tier: t.id, paverBrandId: defaultPaverForTier(t.id).id };
              const scenario = totalFor(patch);
              const d = preview(patch);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { if (!isCurrent) { onTier(t.id); onAdjust('tier', t.id); } }}
                  aria-pressed={isCurrent}
                  className={cn(
                    'px-4 py-3.5 rounded-2xl border text-left transition-all duration-200',
                    isCurrent
                      ? 'bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]'
                      : 'bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="font-sans text-[12px] text-brand-bone">{t.label}</span>
                    {isCurrent ? (
                      <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-brand-gold-dark">Current</span>
                    ) : null}
                  </div>
                  <div className="font-display text-[17px] text-brand-bone tabular-nums leading-none mb-1.5">
                    {toK(scenario.low)} – {toK(scenario.high)}
                  </div>
                  <PriceDelta
                    mid={isCurrent ? 0 : d}
                    neutralLabel={isCurrent ? 'Your build' : 'Same price'}
                    dimmed={!isCurrent}
                    className="text-[11px]"
                  />
                </button>
              );
            })}
          </div>
          {brandPicker ? <div className="mt-5">{brandPicker}</div> : null}
        </Section>

        <Section
          title="Add-ons"
          hint="Optional extras. Add or drop them freely — nothing is locked in."
          summary={addOns.length === 0 ? 'None selected' : `${addOns.length} selected`}
          open={!!openSections.addons}
          onToggle={() => toggleSection('addons')}
        >
          <div className="flex flex-wrap gap-2.5">
            {ADD_ONS.map(a => {
              const isOn = addOns.includes(a.id);
              const d = preview({
                addOns: isOn ? addOns.filter(x => x !== a.id) : [...addOns, a.id],
              });
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onToggleAddOn(a.id); onAdjust('addon', isOn ? `remove_${a.id}` : `add_${a.id}`); }}
                  aria-pressed={isOn}
                  className={cn(
                    'flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 rounded-2xl border transition-all duration-200',
                    isOn
                      ? 'bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold'
                      : 'bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface',
                  )}
                >
                  <span className={cn(
                    'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                    isOn ? 'bg-brand-gold border-brand-gold' : 'border-brand-gold/50',
                  )}>
                    {isOn ? <Check size={11} className="text-brand-black" strokeWidth={3} /> : null}
                  </span>
                  <span className="font-sans text-[12px] text-brand-bone">{a.label}</span>
                  {/* On: what it's contributing. Off: what adding it would cost. */}
                  <PriceDelta mid={isOn ? -d : d} className="text-[11px]" dimmed={!isOn} />
                </button>
              );
            })}
          </div>
        </Section>

        {/* These are facts about the yard, not options to shop on. They stay
            editable because people genuinely misjudge them on a first pass —
            but nothing in this UI ever *suggests* switching one off to save
            money, because that would manufacture a number the site visit
            would immediately contradict. */}
        <Section
          title="Site conditions"
          hint="Only tick what's actually true of your yard. These change the real work, so they change the real price."
          summary={conditionCount === 0 ? 'None reported' : `${conditionCount} reported`}
          open={!!openSections.conditions}
          onToggle={() => toggleSection('conditions')}
        >
          <div className="flex flex-wrap gap-2.5">
            {CONDITION_LABELS.map(c => {
              const isOn = !!conditions[c.id];
              const d = preview({ conditions: { ...conditions, [c.id]: !isOn } });
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onToggleCondition(c.id); onAdjust('condition', isOn ? `off_${c.id}` : `on_${c.id}`); }}
                  aria-pressed={isOn}
                  className={cn(
                    'flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 rounded-2xl border transition-all duration-200',
                    isOn
                      ? 'bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold'
                      : 'bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface',
                  )}
                >
                  <span className={cn(
                    'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                    isOn ? 'bg-brand-gold border-brand-gold' : 'border-brand-gold/50',
                  )}>
                    {isOn ? <Check size={11} className="text-brand-black" strokeWidth={3} /> : null}
                  </span>
                  <span className="font-sans text-[12px] text-brand-bone">{c.short}</span>
                  <PriceDelta mid={isOn ? -d : d} className="text-[11px]" dimmed={!isOn} />
                </button>
              );
            })}
          </div>
        </Section>
      </div>
    </motion.div>
  );
}
