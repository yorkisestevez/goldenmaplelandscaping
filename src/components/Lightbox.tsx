import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ImageRef } from '../data/portfolioImages';
import ResponsiveImage from './ResponsiveImage';

export function useLightbox(count: number) {
  const [index, setIndex] = useState<number | null>(null);
  const open = useCallback((i: number) => setIndex(i), []);
  const close = useCallback(() => setIndex(null), []);
  const next = useCallback(() => setIndex((i) => (i === null || count === 0 ? i : (i + 1) % count)), [count]);
  const prev = useCallback(() => setIndex((i) => (i === null || count === 0 ? i : (i - 1 + count) % count)), [count]);
  return { index, isOpen: index !== null, open, close, next, prev, setIndex };
}

export interface LightboxProps {
  images: ImageRef[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  captionFor?: (img: ImageRef, i: number) => ReactNode;
  label?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
const SWIPE_PX = 60;

/**
 * Dependency-free lightbox: portal, dialog semantics, keyboard (Esc / ← / → / Tab
 * trap), focus restore, body scroll lock, drag-to-swipe via motion. Only mounted
 * while open, so it never renders during prerender.
 */
export default function Lightbox({ images, index, onClose, onIndexChange, captionFor, label = 'Photo viewer' }: LightboxProps) {
  const reduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const isOpen = index !== null && images.length > 0;
  const count = images.length;

  const go = useCallback(
    (delta: number) => {
      if (index === null || count === 0) return;
      onIndexChange((index + delta + count) % count);
    },
    [index, count, onIndexChange],
  );

  // Focus management + scroll lock + keyboard, only while open.
  useEffect(() => {
    if (!isOpen) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => dialogRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
      if (e.key === 'Tab' && dialogRef.current) {
        const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (nodes.length === 0) { e.preventDefault(); return; }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === dialogRef.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [isOpen, onClose, go]);

  // Warm the neighbours so arrow keys feel instant.
  useEffect(() => {
    if (!isOpen || index === null || count < 2) return;
    for (const i of [(index + 1) % count, (index - 1 + count) % count]) {
      const im = new Image();
      im.src = images[i].src;
    }
  }, [isOpen, index, count, images]);

  if (typeof document === 'undefined') return null;
  const current = isOpen && index !== null ? images[index] : null;
  const dur = reduced ? 0 : 0.2;

  return createPortal(
    <AnimatePresence>
      {current && index !== null && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur }}
          className="fixed inset-0 z-[60] flex flex-col bg-brand-black/95"
          onClick={onClose}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="flex h-full w-full flex-col outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 md:px-6">
              <span aria-live="polite" className="font-sans text-xs uppercase tracking-[0.25em] text-brand-porcelain-soft">
                {index + 1} / {count}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close photo viewer"
                className="flex h-11 w-11 items-center justify-center rounded-full text-brand-porcelain transition-colors hover:bg-brand-porcelain/10"
              >
                <X size={22} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 md:px-16">
              {count > 1 && (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className="absolute left-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-brand-porcelain transition-colors hover:bg-brand-porcelain/10 md:left-4"
                >
                  <ChevronLeft size={26} strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
              <motion.div
                key={current.src}
                drag={count > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -SWIPE_PX) go(1);
                  else if (info.offset.x > SWIPE_PX) go(-1);
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: dur }}
                className="flex max-h-full max-w-full cursor-grab items-center justify-center active:cursor-grabbing"
              >
                <ResponsiveImage
                  image={current}
                  sizes="100vw"
                  aspect="fill"
                  fit="contain"
                  draggable={false}
                  className="max-h-[78vh] w-auto max-w-full select-none object-contain"
                />
              </motion.div>
              {count > 1 && (
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className="absolute right-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-brand-porcelain transition-colors hover:bg-brand-porcelain/10 md:right-4"
                >
                  <ChevronRight size={26} strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="px-6 pb-6 pt-3 text-center font-sans text-sm font-light text-brand-porcelain">
              {captionFor ? captionFor(current, index) : current.alt}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
