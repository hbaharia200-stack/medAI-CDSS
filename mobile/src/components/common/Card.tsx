import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { useGlowAnimation } from '../../hooks/useGlowAnimation';
import { useHoverAura } from '../../hooks/useHoverAura';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityHint?: string;
  /**
   * Opt-in "hover aura" for Expo Web. Lifts the card a few pixels and adds a
   * soft indigo edge glow on pointer hover.
   *
   * Deliberately off by default: most cards in the app are static containers and
   * a hover lift there would be noise. Only opt in the review/summary cards.
   *
   * The default appearance is byte-for-byte unchanged when this is false. On
   * native the hover handlers simply never fire, so iOS/Android are unaffected;
   * when the user prefers reduced motion the lift is dropped and only the
   * border/glow change remains.
   */
  hoverGlow?: boolean;
}

export function Card({ children, onPress, style, testID, accessibilityHint, hoverGlow }: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const { glowAnimatedStyle, onPressIn, onPressOut, onHoverIn, onHoverOut } = useGlowAnimation();
  const { auraStyle, handleHoverIn, handleHoverOut } = useHoverAura();
  const reducedMotion = useReducedMotion();

  const content = (
    <Animated.View style={[styles.card, glowAnimatedStyle, { backgroundColor: colors.neutral.surface }, style]}>
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onHoverIn={hoverGlow ? handleHoverIn : undefined}
        onHoverOut={hoverGlow ? handleHoverOut : undefined}
        style={({ pressed }) => [
          pressed && styles.pressed,
          hoverGlow ? auraStyle(colors.neutral.border, reducedMotion) : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  // Static card. It stays a plain View: the review cards are not controls, so
  // they must not gain a button role, a pointer cursor or a focus ring. The
  // hover signal is taken straight off the DOM node on web instead, which
  // keeps the card non-interactive and leaves native completely untouched.
  if (hoverGlow) {
    return (
      <HoverableCard
        testID={testID}
        style={[
          styles.card,
          { backgroundColor: colors.neutral.surface, borderColor: colors.neutral.border },
          auraStyle(colors.neutral.border, reducedMotion),
          style,
        ]}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
      >
        {children}
      </HoverableCard>
    );
  }

  return (
    <View testID={testID} style={[styles.card, { backgroundColor: colors.neutral.surface, borderColor: colors.neutral.border }, style]}>
      {children}
    </View>
  );
}

/**
 * A View that emits hover callbacks on Expo Web.
 *
 * React Native's `View` has no `onHoverIn`/`onHoverOut` (only `Pressable` does),
 * and using a Pressable here would wrongly make a static card behave like a
 * button. So on web we bind plain `mouseenter`/`mouseleave` listeners to the
 * underlying DOM node. On iOS/Android nothing is bound at all.
 */
function HoverableCard({
  children,
  style,
  testID,
  onHoverIn,
  onHoverOut,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  onHoverIn: () => void;
  onHoverOut: () => void;
}) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return undefined;
    node.addEventListener('mouseenter', onHoverIn);
    node.addEventListener('mouseleave', onHoverOut);
    return () => {
      node.removeEventListener('mouseenter', onHoverIn);
      node.removeEventListener('mouseleave', onHoverOut);
    };
  }, [onHoverIn, onHoverOut]);

  return (
    <View ref={ref} testID={testID} style={style}>
      {children}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      borderRadius: radii.lg,
      borderWidth: 1,
      padding: 16,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 0,
    },
    pressed: { opacity: 0.9 },
  });

export default Card;
