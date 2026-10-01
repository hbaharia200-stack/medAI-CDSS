import { useCallback, useMemo, useRef } from 'react';
import { Animated, Platform, type ViewStyle } from 'react-native';

/**
 * The "hover aura" interaction used by the patient review/summary cards.
 *
 * Visual intent: the card keeps its existing navy/neutral background and gains a
 * soft indigo edge glow on hover. It is a *glow around the edges*, never a
 * purple fill — the surface colour is never touched.
 *
 * Web-only. On iOS/Android the hover handlers never fire, so native never
 * depends on a pointer. When the user prefers reduced motion the lift/scale is
 * dropped and only the border + glow change survives (a colour change is not
 * motion), so nothing is ever translated or scaled for them.
 */

/** Violet-900 outer shadow and an indigo/blue inner bloom. */
const AURA_SHADOW_LIGHT =
  '0 8px 28px rgba(76, 29, 149, 0.20), 0 0 22px rgba(59, 130, 246, 0.10)';
const AURA_SHADOW_DARK =
  '0 8px 30px rgba(3, 8, 26, 0.60), 0 0 24px rgba(99, 102, 241, 0.16)';

/** Indigo-400 at ~40% for the brighter border on hover. */
const AURA_BORDER_LIGHT = 'rgba(99, 102, 241, 0.40)';
const AURA_BORDER_DARK = 'rgba(129, 140, 248, 0.42)';

/** Indigo-600 for native (shadowColor has no alpha layering). */
const AURA_NATIVE_SHADOW = '#4C1D95';

const HOVER_DURATION = 220;

export function useHoverAura() {
  const progress = useRef(new Animated.Value(0)).current;
  // Resolved once per render from the theme so the animated styles pick up the
  // light/dark scheme without needing a separate hook.
  const isDark = useMemo(
    () => Platform.OS === 'web'
      ? typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
      : false,
    [],
  );

  const handleHoverIn = useCallback(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: HOVER_DURATION,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const handleHoverOut = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: HOVER_DURATION,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  /**
   * Animated style for the hovered card. `reducedMotion` drops the transform
   * while keeping the border/glow, so the affordance is still discoverable.
   */
  const auraStyle = useCallback(
    (restBorderColor: string, reducedMotion: boolean): ViewStyle => {
      const borderColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [restBorderColor, isDark ? AURA_BORDER_DARK : AURA_BORDER_LIGHT],
      }) as unknown as string;

      // Only animate the lift when motion is allowed; otherwise the transform
      // is simply never applied, so the card cannot move.
      const transform = reducedMotion
        ? []
        : [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] }) },
          ];

      const base: ViewStyle = {
        borderColor,
        transform,
      };

      if (Platform.OS === 'web') {
        // RN 0.76+ / RNW render a real CSS box-shadow, which lets us layer the
        // two-part aura exactly instead of approximating it with shadow*.
        return {
          ...base,
          boxShadow: isDark ? AURA_SHADOW_DARK : AURA_SHADOW_LIGHT,
          // Fade the glow in and out with the same 220ms curve as the lift.
          transitionProperty: 'box-shadow, border-color, transform',
          transitionDuration: `${HOVER_DURATION}ms`,
          transitionTimingFunction: 'ease',
        } as ViewStyle;
      }

      return {
        ...base,
        shadowColor: AURA_NATIVE_SHADOW,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 18,
        shadowOpacity: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.28],
        }) as unknown as number,
      };
    },
    [progress, isDark],
  );

  return { auraStyle, handleHoverIn, handleHoverOut, progress };
}

export default useHoverAura;
