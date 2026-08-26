import { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * The size input — the single biggest driver of the estimate.
 *
 * It used to be a bare `<input type="range">` with a 3px track: no way to type
 * an exact figure, no steppers, and a hit target far under the 44px minimum. On
 * a phone you physically could not set the number that most determines your
 * price, which is a strange thing to ask someone to feel in control of.
 *
 * Four ways in, because people arrive knowing their size with wildly different
 * precision: drag it, nudge it, type it, or pick a plain-language preset.
 */

export interface SizePreset {
  label: string;
  value: number;
  /** Something real to picture, for people who genuinely don't know their sqft. */
  hint?: string;
}

export default function SizeControl({
  label,
  value,
  min,
  max,
  step = 10,
  unit,
  presets,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  presets?: SizePreset[];
  onChange: (v: number) => void;
  /** Fired when the user settles on a value — for analytics, not per-pixel drag. */
  onCommit?: (v: number) => void;
}) {
  const id = useId();
  const [typed, setTyped] = useState(String(value));

  // Keep the text field in sync when the value moves from anywhere else
  // (slider, steppers, presets, or a gap-coach lever being applied).
  useEffect(() => { setTyped(String(value)); }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = (n: number) => { onChange(clamp(n)); onCommit?.(clamp(n)); };

  const commitTyped = () => {
    const n = parseInt(typed.replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) { setTyped(String(value)); return; }
    commit(n);
  };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <label htmlFor={id} className="font-sans text-[13px] text-brand-bone">{label}</label>

        {/* Type it. Previously impossible — there was no way to enter an exact figure. */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => commit(value - step)}
            disabled={value <= min}
            aria-label={`Decrease ${label}`}
            className="w-11 h-11 rounded-2xl border border-brand-dim bg-brand-cream-light flex items-center justify-center text-brand-gold-dark hover:border-brand-gold/60 hover:bg-brand-midsurface disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Minus size={15} strokeWidth={2} />
          </button>
          <div className="flex items-baseline gap-1.5 px-3 py-2 rounded-2xl border border-brand-dim bg-brand-cream-light focus-within:border-brand-gold/60 transition-colors">
            <input
              type="text"
              inputMode="numeric"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onBlur={commitTyped}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitTyped(); e.currentTarget.blur(); } }}
              aria-label={`${label} in ${unit}`}
              className="w-[68px] bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 font-display text-2xl text-brand-gold-dark tabular-nums text-right"
            />
            <span className="font-sans text-[12px] text-brand-muted whitespace-nowrap">{unit}</span>
          </div>
          <button
            type="button"
            onClick={() => commit(value + step)}
            disabled={value >= max}
            aria-label={`Increase ${label}`}
            className="w-11 h-11 rounded-2xl border border-brand-dim bg-brand-cream-light flex items-center justify-center text-brand-gold-dark hover:border-brand-gold/60 hover:bg-brand-midsurface disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Drag it. The track is padded to a 44px touch target while staying
          visually slim — `touch-action: none` stops a drag turning into a
          page scroll on mobile, which made the old slider nearly unusable. */}
      <div className="relative py-3 -my-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          onPointerUp={() => onCommit?.(value)}
          onKeyUp={() => onCommit?.(value)}
          className="gm-size-slider w-full h-2 rounded-full appearance-none outline-none cursor-pointer touch-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          style={{ background: `linear-gradient(to right, var(--color-brand-gold) ${pct}%, var(--color-brand-cream) ${pct}%)` }}
        />
      </div>

      {presets && presets.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-4">
          {presets.map(p => {
            const active = value === p.value;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => commit(p.value)}
                aria-pressed={active}
                title={p.hint}
                className={cn(
                  'px-3.5 py-2 rounded-2xl border transition-all duration-200 text-left',
                  active
                    ? 'bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold'
                    : 'bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface',
                )}
              >
                <span className="font-sans text-[12px] text-brand-bone">{p.label}</span>
                {p.hint ? (
                  <span className="block font-sans text-[10px] font-normal text-brand-bonewhite/60 mt-0.5">{p.hint}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
