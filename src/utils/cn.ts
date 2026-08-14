import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className joiner. Was duplicated inline in several components;
 *  import it from here instead of redeclaring. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
