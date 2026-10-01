import { useEffect, useRef, useState } from 'react';

export interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  /** IntersectionObserver root — the element intersections are measured
   *  against. Dashboard content scrolls inside AppLayout's inner fixed-height
   *  overflow-y-auto <main> (not the window), so reveal targets on those pages
   *  must pass that container (see useAppScrollRoot below); null = viewport. */
  root?: Element | null;
}

/**
 * Scroll-triggered reveal primitive (IntersectionObserver based — there is
 * no reliable cross-browser CSS-only equivalent, so this genuinely needs JS).
 *
 * Reveals once: when the observed element first intersects, `visible` flips
 * to `true` and stays true (scrolling back up never re-hides it).
 *
 * Respects `prefers-reduced-motion` — matches the same
 * `window.matchMedia('(prefers-reduced-motion: reduce)')` check already used
 * in AppLayout.tsx. Reduced-motion users get `visible === true` immediately
 * with no transition driven by the caller.
 */
export function useScrollReveal<T extends HTMLElement>(options?: ScrollRevealOptions) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect(); // reveal once; don't re-hide when scrolling back up
        }
      },
      {
        threshold: options?.threshold ?? 0.15,
        rootMargin: options?.rootMargin ?? '0px 0px -60px 0px',
        root: options?.root ?? null,
      }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [options?.threshold, options?.rootMargin, options?.root]);

  return { ref, visible };
}

/**
 * Shared reduced-motion reader so stagger delays can be suppressed for
 * reduced-motion users (zero stagger, not just zero transition length).
 * Kept in the same module as the hook to avoid a duplicate helper elsewhere.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** DOM id of the AppLayout inner scroll container (the <main> that hosts the
 *  routed dashboard pages). Page content scrolls inside this fixed-height
 *  overflow-y-auto element — not the window — so scroll-reveal observers on
 *  dashboard pages must use it as their IntersectionObserver root. */
export const APP_SCROLL_ROOT_ID = 'app-scroll-root';

/**
 * Resolves the AppLayout inner scroll container, for pages that render inside
 * <Outlet /> under AppLayout. Must be read in an effect, not during render:
 * AppLayout remounts <main key={pathname}> on every navigation, so a
 * render-time getElementById would grab the outgoing (soon-detached) node.
 * Returns null outside AppLayout (window-scrolling pages like the marketing
 * pages) → the hook then falls back to the viewport root.
 */
export function useAppScrollRoot(): Element | null {
  const [root, setRoot] = useState<Element | null>(null);
  useEffect(() => {
    setRoot(document.getElementById(APP_SCROLL_ROOT_ID));
  }, []);
  return root;
}
