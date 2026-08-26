import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '../../utils/cn';

/**
 * Tween a number instead of snapping to it.
 *
 * The estimator's headline used to jump instantly between values, which reads
 * as "the machine recalculated" rather than "I moved that." Watching the number
 * travel is what connects a control to its consequence — so this is load-bearing
 * for the feeling of authorship, not decoration.
 *
 * Interruptible: a change mid-flight continues from wherever the number
 * currently is rather than snapping back to the old value first.
 */
export function useCountUp(target: number, duration = 550): number {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Respect the OS setting, and skip the work entirely when nothing moved.
    if (reduceMotion || currentRef.current === target) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    const from = currentRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — commits fast, settles gently. Reads as responsive
      // rather than floaty, which matters when the user is dragging a slider.
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      currentRef.current = value;
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        currentRef.current = target;
        setDisplay(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, reduceMotion]);

  return display;
}

const toK = (n: number) => `$${(n / 1000).toFixed(0)}k`;

const toDollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-CA')}`;

/** Whole-dollar variant for tight spots (sticky bars) — same tween. */
export function AnimatedDollars({ cents, className }: { cents: number; className?: string }) {
  const animated = useCountUp(cents);
  return (
    <span className={cn('tabular-nums', className)}>
      <span aria-hidden="true">{toDollars(animated)}</span>
      <span className="sr-only">{toDollars(cents)}</span>
    </span>
  );
}

const toMoney = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * An exact dollars-and-cents figure, animated. The takeoff engine prices to
 * the cent, and showing the cents is the point — it reads as a real invoice,
 * not a guess. Same interruptible tween as the range version.
 */
export function AnimatedMoney({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  const animated = useCountUp(cents);

  return (
    <span className={cn('tabular-nums', className)}>
      <span aria-hidden="true">{toMoney(Math.round(animated))}</span>
      <span className="sr-only">{toMoney(cents)}</span>
    </span>
  );
}

/**
 * The headline range, animated. Renders the same `$Xk – $Yk` shape the
 * estimator has always used — only the transition between values is new.
 */
export default function AnimatedPrice({
  low,
  high,
  className,
  separatorClassName,
}: {
  low: number;
  high: number;
  className?: string;
  separatorClassName?: string;
}) {
  const animatedLow = useCountUp(low);
  const animatedHigh = useCountUp(high);

  return (
    <span className={cn('tabular-nums', className)}>
      {/* The animated figures are decorative motion over a value screen readers
          should hear once, settled — announcing every frame would be noise. */}
      <span aria-hidden="true">
        {toK(animatedLow)}
        <span className={cn('mx-3 font-light', separatorClassName)}>–</span>
        {toK(animatedHigh)}
      </span>
      <span className="sr-only">
        {toK(low)} to {toK(high)}
      </span>
    </span>
  );
}
