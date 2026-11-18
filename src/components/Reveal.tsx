import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  once?: boolean;
  className?: string;
};

/**
 * Above-the-fold content used to ship as opacity:0 until this component
 * hydrated. The wrapper now renders visible markup. The delay/y props stay so
 * existing call sites do not need a rewrite; they no longer hide content.
 */
export default function Reveal({ children, className }: RevealProps) {
  return <div className={className}>{children}</div>;
}
