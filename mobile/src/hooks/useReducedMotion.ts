import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Tracks the browser/OS "reduce motion" preference.
 *
 * Used only by hover interactions: when the user has asked for reduced motion we
 * drop the lift/scale entirely and keep just the border + glow change, so
 * nothing moves. On native this always returns `false`, because a hover state
 * cannot occur there — this is what keeps iOS/Android from depending on hover.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    // Safari < 14 only has the deprecated addListener/removeListener pair.
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  return reduced;
}

export default useReducedMotion;
