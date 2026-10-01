import React, { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';

interface ScreenFadeProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Wraps a screen's content and animates opacity 0→1 + translateY 12→0 on every
 * screen focus. Works on both native (where native-stack's slide_from_right is
 * also active) and web (where native-stack transitions don't render — this
 * gives a consistent enter animation everywhere).
 */
export function ScreenFade({ children, style }: ScreenFadeProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useFocusEffect(
    React.useCallback(() => {
      opacity.setValue(0);
      translateY.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <Animated.View
      style={[
        { opacity, transform: [{ translateY }] },
        { flex: 1, backgroundColor: colors.neutral.background },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default ScreenFade;