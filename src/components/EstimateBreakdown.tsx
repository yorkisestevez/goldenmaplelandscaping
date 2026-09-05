import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Pickaxe, Package, Hammer, Trash2, Sparkles, Check, X } from 'lucide-react';
import AnimatedPrice, { AnimatedMoney } from './ui/AnimatedPrice';
import type { PreciseResult } from '../utils/estimateEngine';
import { BUSINESS, publicClaimCopy } from '../data/business';

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
  /** The takeoff engine's "most likely" invoice. When present the card renders
   *  invoice-style: exact category figures, subtotal, HST, grand total — with
   *  the widened range demoted to secondary context. */
  precise?: PreciseResult | null;
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

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LINES = [
  { key: 'excavation', label: 'Excavation & Site Prep', icon: Pickaxe },
  { key: 'materials',  label: 'Materials & Delivery',   icon: Package },
  { key: 'labour',     label: 'Labour & Installation',  icon: Hammer },
  { key: 'disposal',   label: 'Disposal',               icon: Trash2 },
  { key: 'restoration',label: 'Restoration & Cleanup',  icon: Sparkles },
] as const;

const INCLUDES = [
  'Site preparation allowance; confirm depth and materials in the written scope',
  'Polymeric sand joints',
  'Edge restraint + spikes',
  'Geotextile fabric',
  publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms are available.'),
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

/** Quantity-rich sub-copy for takeoff-priced categories — the receipt should
 *  read like a contractor ordered the job, because one effectively did. */
function detailFor(
  key: (typeof LINES)[number]['key'],
  fallback: string | undefined,
  precise: PreciseResult | null | undefined,
): string | undefined {
  // Presentation policy only: legacy engine detail strings are snapshot-pinned,
  // but their certification/base promises are not approved public business facts.
  if (key === 'labour') return 'Installation labour allowance; confirm crew qualifications and written scope.';
  if (key === 'excavation') return 'Site preparation allowance; final excavation depth is project-specific.';
  const q = precise?.quantities;
  if (!q) return key === 'materials' ? 'Materials allowance for the selected scope; confirm specifications before contracting.' : fallback;
  if (key === 'materials') {
    const parts = [
      `${q.aggregateTonnes} tonnes base & bedding aggregate`,
      `${q.polySandBags} bag${q.polySandBags === 1 ? '' : 's'} jointing sand`,
      `${q.skids} pallet${q.skids === 1 ? '' : 's'} + ${q.deliveryLoads} truck load${q.deliveryLoads === 1 ? '' : 's'} delivered`,
    ];
    return parts.join(', ');
  }
  if (key === 'disposal') {
    return `${q.bins} × 14-yd bin${q.bins === 1 ? '' : 's'}, tear-out and excavation spoil hauled off`;
  }
  return fallback;
}

export default function EstimateBreakdown(props: BreakdownProps) {
  const lines = {
    excavation: props.excavation,
    materials: props.materials,
    labour: props.labour,
    disposal: props.disposal,
    restoration: props.restoration,
  };
  const p = props.precise;

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
          {p ? 'Your Estimate' : 'Your Estimated Investment'}
        </div>
        {/* Animated so that adjusting a lever in the workbench below reads as
            "I moved that", not "the machine recalculated". */}
        {p ? (
          <>
            <AnimatedMoney
              cents={p.subtotalCents}
              className="block font-display text-5xl md:text-[80px] text-brand-bone mb-2 leading-none tracking-tight"
            />
            <div className="font-sans text-[12px] text-brand-muted mb-4">
              + HST · priced from your answers
            </div>
          </>
        ) : (
          <AnimatedPrice
            low={props.totalLow}
            high={props.totalHigh}
            className="block font-display text-6xl md:text-[88px] text-brand-bone mb-4 leading-none tracking-tight"
            separatorClassName="text-brand-muted/60"
          />
        )}
        <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 rounded-full backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
          <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark">
            Confidence ±{props.confidencePercent}%
          </span>
        </div>
        {p ? (
          <p className="font-sans text-[13px] font-light text-brand-muted mt-4 leading-relaxed">
            Site unknowns could land it <span className="text-brand-bone tabular-nums">{fmt(props.totalLow)}–{fmt(props.totalHigh)}</span> — answers tighten it.
          </p>
        ) : null}
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
            const preciseCents = p ? p.perCategoryCents[key] : null;
            const detail = detailFor(key, line.detail, p);
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
                      {preciseCents !== null ? money(preciseCents) : <>{fmt(line.low)} – {fmt(line.high)}</>}
                    </span>
                  </div>
                  {detail ? (
                    <p className="font-sans text-[12px] font-light text-brand-muted mt-1.5 leading-relaxed">
                      {detail}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Invoice footer — subtotal / HST / total, to the cent. */}
        {p ? (
          <div className="mt-2 pt-5 border-t border-brand-dim/60">
            {p.addOnsCents > 0 && (
              <div className="flex justify-between items-baseline gap-4 py-1.5">
                <span className="font-sans text-[13px] text-brand-bone">Selected add-ons</span>
                <span className="font-display text-[15px] text-brand-gold-dark tabular-nums">{money(p.addOnsCents)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline gap-4 py-1.5">
              <span className="font-sans text-[13px] text-brand-bone">Subtotal</span>
              <span className="font-display text-[15px] text-brand-bone tabular-nums">{money(p.subtotalCents)}</span>
            </div>
            <div className="flex justify-between items-baseline gap-4 py-1.5">
              <span className="font-sans text-[13px] text-brand-muted">HST (13%)</span>
              <span className="font-display text-[15px] text-brand-muted tabular-nums">{money(p.hstCents)}</span>
            </div>
            <div className="flex justify-between items-baseline gap-4 pt-3 mt-2 border-t border-brand-gold/30">
              <span className="font-sans text-[14px] font-medium text-brand-bone">Estimated total</span>
              <AnimatedMoney cents={p.grandTotalCents} className="font-display text-2xl text-brand-gold-dark whitespace-nowrap" />
            </div>
            <p className="font-sans text-[11px] font-light text-brand-muted mt-4 leading-relaxed">
              This is the same math we bring to your site visit — the final quote is confirmed
              on-site after measurement.
              {p.allowances.length > 0 ? ' Items outside the paver takeoff are carried as planning allowances.' : ''}
            </p>
          </div>
        ) : null}
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
