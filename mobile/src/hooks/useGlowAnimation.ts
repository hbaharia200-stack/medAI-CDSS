import { useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Extracts the press-glow animation that Card.tsx originally performed inline.
 *
 * Returns an animated style object (border color + shadow opacity interpolating
 * toward colors.primary) plus four handlers. onPressIn/onPressOut drive the glow
 * for touch devices; onHoverIn/onHoverOut call the same animateGlow(1)/animateGlow(0)
 * so mouse users on web get the same effect. On touch-only devices the hover
 * events simply never fire — this is safe everywhere.
 */
export function useGlowAnimation(restBorderColor?: string) {
  const { colors } = useTheme();
  const glow = useRef(new Animated.Value(0)).current;
  const rest = restBorderColor ?? colors.neutral.border;

  const animateGlow = (toValue: number) => {
    Animated.timing(glow, {
      toValue,
      duration: 160,
      useNativeDriver: false,
    }).start();
  };

  const animatedStyle: ViewStyle = {
    borderColor: glow.interpolate({
      inputRange: [0, 1],
      outputRange: [rest, colors.primary],
    }) as unknown as string,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) as unknown as number,
  };

  return {
    glowAnimatedStyle: animatedStyle,
    onPressIn: () => animateGlow(1),
    onPressOut: () => animateGlow(0),
    onHoverIn: () => animateGlow(1),
    onHoverOut: () => animateGlow(0),
  };
}

export default useGlowAnimation;