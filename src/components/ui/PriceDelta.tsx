import { cn } from '../../utils/cn';

/**
 * "What will this option do to my number?" — answered before the user commits.
 *
 * Every figure here comes from `deltaFor()` in the pricing engine, which is a
 * real re-run of the same math the final estimate uses. That's the honesty
 * guarantee: a chip can never advertise a saving the estimate won't deliver.
 *
 * Below the noise floor we say "Included" rather than "+$0" — a rounding-error
 * delta dressed up as a price is worse than no number at all.
 */

/** Deltas under this are noise, not a price difference. */
const NOISE_FLOOR = 100;

export function formatDelta(mid: number): string {
  if (Math.abs(mid) < NOISE_FLOOR) return 'Included';
  const rounded = Math.round(Math.abs(mid) / 100) * 100;
  const sign = mid > 0 ? '+' : '−';
  return `${sign}$${rounded.toLocaleString()}`;
}

export const isNeutralDelta = (mid: number) => Math.abs(mid) < NOISE_FLOOR;

export default function PriceDelta({
  mid,
  className,
  /** Muted styling for unselected options; the selected one gets full contrast. */
  dimmed = false,
  /** Shown instead of "Included" when this option doesn't move the price —
   *  lets a card keep its descriptive hint ("+ tear-out", "Ground level")
   *  while still surrendering the slot to real money whenever there is any. */
  neutralLabel,
}: {
  mid: number;
  className?: string;
  dimmed?: boolean;
  neutralLabel?: string;
}) {
  const isNeutral = isNeutralDelta(mid);
  const isSaving = mid < 0;

  return (
    <span
      className={cn(
        'font-sans tabular-nums whitespace-nowrap',
        isNeutral
          ? dimmed ? 'text-brand-bonewhite/50' : 'text-brand-muted'
          : isSaving
            ? dimmed ? 'text-brand-success/70' : 'text-brand-success'
            : dimmed ? 'text-brand-gold-dark/70' : 'text-brand-gold-dark',
        className,
      )}
    >
      {isNeutral ? (neutralLabel ?? 'Included') : formatDelta(mid)}
    </span>
  );
}
