import { useState } from 'react';
import { Target, X } from 'lucide-react';
import { cn } from '../utils/cn';

/**
 * "Where would you like to land?"
 *
 * Optional, and skipping is a first-class answer — this is asked so we can show
 * the customer what fits, not to qualify them. Once set, the estimate stops
 * being a verdict handed down and becomes a number they are steering toward,
 * with the calculator working for them instead of at them.
 *
 * Deliberately NOT asked before a project type is chosen: out of context it
 * reads as "how much can we get out of you", which is the opposite of the point.
 */

const PRESETS = [15000, 30000, 50000, 80000];

export default function BudgetTarget({
  value,
  onChange,
  onSkip,
}: {
  value: number | null;
  onChange: (v: number) => void;
  onSkip: () => void;
}) {
  const [custom, setCustom] = useState('');

  if (value !== null) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 rounded-2xl bg-brand-gold/8 border border-brand-gold/25">
        <Target size={15} className="text-brand-gold shrink-0" strokeWidth={1.75} />
        <span className="font-sans text-[12px] text-brand-bonewhite/80">Aiming for around</span>
        <span className="font-display text-xl text-brand-bone tabular-nums">
          ${value.toLocaleString()}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="ml-auto p-1.5 text-brand-muted hover:text-brand-bone transition-colors"
          aria-label="Clear budget target"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  const commitCustom = () => {
    const n = parseInt(custom.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(n) && n >= 1000) onChange(n);
  };

  return (
    <div className="px-5 py-5 rounded-2xl bg-brand-cream border border-brand-dim">
      <div className="flex items-center gap-2 mb-1.5">
        <Target size={15} className="text-brand-gold shrink-0" strokeWidth={1.75} />
        <span className="font-sans text-[13px] text-brand-bone">
          Have a number in mind? (optional)
        </span>
      </div>
      <p className="font-sans text-[11px] font-normal text-brand-bonewhite/70 mb-4 leading-relaxed">
        Tell us roughly what you'd like to land near and we'll show you what fits — and
        exactly what to change if your build comes in over.
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className="px-3.5 py-2 rounded-2xl border border-brand-dim bg-brand-cream-light hover:border-brand-gold/60 hover:bg-brand-midsurface transition-all duration-200 font-sans text-[12px] text-brand-bone tabular-nums"
          >
            ${(p / 1000).toFixed(0)}k
          </button>
        ))}
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-brand-dim bg-brand-cream-light focus-within:border-brand-gold/60 transition-colors">
          <span className="font-sans text-[12px] text-brand-muted">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onBlur={commitCustom}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitCustom(); } }}
            placeholder="Other"
            aria-label="Custom budget target"
            className="w-[68px] bg-transparent outline-none font-sans text-[12px] text-brand-bone placeholder:text-brand-muted tabular-nums"
          />
        </div>
        <button
          type="button"
          onClick={onSkip}
          className={cn(
            'px-3.5 py-2 rounded-2xl font-sans text-[12px] text-brand-muted',
            'hover:text-brand-bone transition-colors',
          )}
        >
          Not sure yet
        </button>
      </div>
    </div>
  );
}
