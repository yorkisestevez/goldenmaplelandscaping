/** Sophie's mark: an "S" laid in a paver diamond, with a maple leaf growing out of its top stroke.
 *  Inline SVG so the launcher costs no image request; the stroke follows `currentColor`. */
export default function SophieMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <rect x="7" y="7" width="18" height="18" rx="4.5" transform="rotate(45 16 16)" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.4" />
      <path
        d="M20.4 11.1c-1.1-1.5-2.9-2.3-4.8-2.1-2.4.3-4 1.9-3.7 3.8.3 2 2.4 2.7 4.3 3.2 2 .5 4.1 1.2 4.3 3.3.2 2-1.6 3.7-4.1 3.9-1.9.2-3.8-.6-5-2.1"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.4 11.1c.9-2.9 3.3-4.6 6-4.6.3 2.6-1.1 5.1-3.8 6-.9.3-1.7 0-2.2-1.4z"
        fill="var(--color-brand-gold)"
      />
      <path d="M20.6 11.4l3.4-3" stroke="var(--color-brand-black)" strokeOpacity="0.55" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}
