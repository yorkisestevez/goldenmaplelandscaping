import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Pickaxe, Package, Hammer, Trash2, Sparkles, Check, X } from 'lucide-react';
import AnimatedPrice from './ui/AnimatedPrice';

export interface BreakdownLine {
  low: number;
  high: number;
  detail?: string;
}

export interface BreakdownProps {
  excavation: BreakdownLine;
  materials: BreakdownLine;
  labour: BreakdownLine;
  disposal: BreakdownLine;
  restoration: BreakdownLine;
  totalLow: number;
  totalHigh: number;
  confidencePercent: number; // ±%
  brandName?: string;
  sqft?: number;
  city?: string;
  /** Slot rendered between the headline and the itemized lines. The workbench
   *  goes here: "you can change this" has to be visible immediately under the
   *  number, or the number reads as final. */
  belowHero?: ReactNode;
}

const fmt = (n: number) =>
  n >= 10000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

const LINES = [
  { key: 'excavation', label: 'Excavation & Site Prep', icon: Pickaxe },
  { key: 'materials',  label: 'Materials',              icon: Package },
  { key: 'labour',     label: 'Labour & Installation',  icon: Hammer },
  { key: 'disposal',   label: 'Disposal',               icon: Trash2 },
  { key: 'restoration',label: 'Restoration & Cleanup',  icon: Sparkles },
] as const;

const INCLUDES = [
  '12–16" base depth (ICPI spec)',
  'Polymeric sand joints',
  'Edge restraint + spikes',
  'Geotextile fabric',
  '5-year workmanship warranty',
  'Site protection & clean-up',
];

const EXCLUDES = [
  'Building permits',
  'Electrical work',
  'Irrigation systems',
  'Plant material & sodding',
  // Deliberately NOT "Engineered drawings" — for a wall over 1m the engine
  // already applies the 'structure' multiplier (sold in-app as "+25% ·
  // engineered") and Estimator.tsx tells the visitor engineering is baked
  // into the range. Listing it here as excluded contradicted that on the
  // same screen.
];

export default function EstimateBreakdown(props: BreakdownProps) {
  const lines = {
    excavation: props.excavation,
    materials: props.materials,
    labour: props.labour,
    disposal: props.disposal,
    restoration: props.restoration,
  };

  return (
    <div className="space-y-6">
      {/* Headline total — Apple-style hero card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="relative bg-gradient-to-b from-brand-gold/[0.12] via-brand-gold/[0.04] to-transparent border border-brand-gold/30 rounded-3xl p-10 md:p-14 text-center overflow-hidden shadow-[0_30px_80px_-30px_rgba(212,175,99,0.25)]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent" />
        <div className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-5">
          Your Estimated Investment
        </div>
        {/* Animated so that adjusting a lever in the workbench below reads as
            "I moved that", not "the machine recalculated". */}
        <AnimatedPrice
          low={props.totalLow}
          high={props.totalHigh}
          className="block font-display text-6xl md:text-[88px] text-brand-bone mb-4 leading-none tracking-tight"
          separatorClassName="text-brand-muted/60"
        />
        <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 rounded-full backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
          <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark">
            Confidence ±{props.confidencePercent}%
          </span>
        </div>
        {props.brandName && props.sqft ? (
          <p className="font-sans text-[14px] font-light text-brand-muted mt-6 leading-relaxed">
            Based on {props.sqft} sqft of <span className="text-brand-bone">{props.brandName}</span>
            {props.city ? <> in <span className="text-brand-bone">{props.city}</span></> : null}.
          </p>
        ) : null}
      </motion.div>

      {props.belowHero}

      <>
      {/* Itemized lines — deliberately NOT gated.
          These used to be blurred until a name and email were handed over. But
          understanding where your own money goes is the moment a number stops
          being something you were quoted and becomes something you own, and
          withholding it right there reads as "we're hiding something" in a
          trade where that suspicion is the default. The gate moved to saving
          the build (see EstimateLeadCapture) — something the customer wants
          AFTER they trust the number, rather than a wall in front of it. */}
      <div className="bg-brand-cream-light border border-brand-dim/60 rounded-3xl p-7 md:p-9">
        <h4 className="font-display text-2xl md:text-3xl text-brand-bone mb-6 tracking-tight">Where the money goes</h4>
        <div className="divide-y divide-white/[0.06]">
          {LINES.map(({ key, label, icon: Icon }, idx) => {
            const line = lines[key];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.07, type: 'spring', stiffness: 120, damping: 18 }}
                className="py-5 flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold-dark shrink-0">
                  <Icon size={16} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-4">
                    <span className="font-sans text-[14px] text-brand-bone">{label}</span>
                    <span className="font-display text-lg md:text-xl text-brand-gold-dark tabular-nums whitespace-nowrap tracking-tight">
                      {fmt(line.low)} – {fmt(line.high)}
                    </span>
                  </div>
                  {line.detail ? (
                    <p className="font-sans text-[12px] font-light text-brand-muted mt-1.5 leading-relaxed">
                      {line.detail}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Includes / Excludes */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-brand-cream-light border border-brand-dim/60 rounded-3xl p-7">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center">
              <Check size={14} className="text-brand-gold-dark" strokeWidth={2.5} />
            </div>
            <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark">
              What's Included
            </span>
          </div>
          <ul className="space-y-2.5">
            {INCLUDES.map(item => (
              <li key={item} className="font-sans text-[13px] font-light text-brand-bone flex gap-2.5 items-start">
                <span className="text-brand-gold-dark mt-2 w-1 h-1 rounded-full bg-brand-gold shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-brand-cream-light border border-brand-dim/60 rounded-3xl p-7">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-full bg-brand-cream border border-brand-dim/60 flex items-center justify-center">
              <X size={14} className="text-brand-muted" strokeWidth={2.5} />
            </div>
            <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-muted">
              Not Included
            </span>
          </div>
          <ul className="space-y-2.5">
            {EXCLUDES.map(item => (
              <li key={item} className="font-sans text-[13px] font-light text-brand-muted flex gap-2.5 items-start">
                <span className="mt-2 w-1 h-1 rounded-full bg-brand-muted/40 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      </>
    </div>
  );
}
