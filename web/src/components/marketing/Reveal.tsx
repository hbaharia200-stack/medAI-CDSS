import type { CSSProperties, ReactNode } from 'react';
import { usePrefersReducedMotion, useScrollReveal } from '../../hooks/useScrollReveal';

interface RevealProps {
  children: ReactNode;
  /** Extra classes for the reveal wrapper (layout-neutral by default). */
  className?: string;
  /** Stagger offset in ms — applied only when visible AND motion is allowed. */
  delayMs?: number;
  threshold?: number;
  rootMargin?: string;
  /** IntersectionObserver root — pass the AppLayout inner scroll container
   *  (useAppScrollRoot()) for pages that scroll inside it; null = viewport. */
  root?: Element | null;
}

/**
 * Scroll-triggered reveal wrapper (opacity + translateY only — the element
 * keeps its normal space before revealing, so no layout shift/jump).
 *
 * Reveal-once semantics come from `useScrollReveal` (observer disconnects
 * after the first intersect). Stagger delays are suppressed for
 * reduced-motion users (zero stagger, not just zero transition length).
 */
export default function Reveal({ children, className = '', delayMs = 0, threshold, rootMargin, root }: RevealProps) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>({ threshold, rootMargin, root });
  const reduced = usePrefersReducedMotion();

  const style: CSSProperties | undefined =
    !reduced && delayMs > 0 ? { transitionDelay: visible ? `${delayMs}ms` : '0ms' } : undefined;

  return (
    <div ref={ref} style={style} className={`scroll-reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
