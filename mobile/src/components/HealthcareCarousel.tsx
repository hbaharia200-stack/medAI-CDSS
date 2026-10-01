import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWindowDimensions, FlatList, StyleSheet, View, Animated, Image, Text } from 'react-native';
import { spacing } from '../theme/tokens';
import { useTheme, type ThemeColors } from '../theme/ThemeProvider';
import { PREVENTIVE_ITEMS, nextPingPongStep } from './healthcare/preventiveItems';

const ROTATE_MS = 4000;
const FADE_DURATION = 600;

/**
 * Preventive-care photo carousel — real JPGs, ping-pong order:
 *   1→2→3→4→5→6→7→6→5→4→3→2→1→2…  (bounces at both ends, never wraps 7→1)
 *
 * - Auto-advances every 4s, one photo at a time
 * - Smooth crossfade on each advance
 * - Manual swipe supported (still respects the ping-pong direction on the next tick)
 * - 7 dot indicators, current photo highlighted
 * - No card wrapper around the carousel itself — each photo is its own
 *   rounded card, since real photography reads better with a defined edge
 *   than the old transparent-background illustrations did
 */
export function HealthcareCarousel() {
  const { colors } = useTheme();
  const { width: winWidth } = useWindowDimensions();
  const slideWidth = winWidth - spacing.md * 2;
  const s = carouselStyles(colors, slideWidth);
  const [index, setIndex] = useState(0);
  const directionRef = useRef<1 | -1>(1);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoCycle = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setIndex((prev) => {
        const { index: next, direction } = nextPingPongStep(prev, directionRef.current, PREVENTIVE_ITEMS.length);
        directionRef.current = direction;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, ROTATE_MS);
  }, []);

  useEffect(() => {
    startAutoCycle();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoCycle]);

  useEffect(() => {
    fadeAnim.setValue(0.25);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: FADE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [index, fadeAnim]);

  const onMomentumEnd = (e: any) => {
    const offset = e.nativeEvent?.contentOffset?.x ?? 0;
    const newIndex = Math.round(offset / slideWidth);
    if (newIndex >= 0 && newIndex < PREVENTIVE_ITEMS.length && newIndex !== index) {
      // Keep the ping-pong direction consistent with where the user swiped to,
      // so the next auto-tick continues from here instead of jumping back.
      directionRef.current = newIndex > index ? 1 : -1;
      setIndex(newIndex);
    }
  };

  return (
    <View style={s.container}>
      <Animated.View style={[s.illustrationArea, { opacity: fadeAnim }]}>
        <FlatList
          ref={flatListRef}
          data={PREVENTIVE_ITEMS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          getItemLayout={(_, i) => ({ length: slideWidth, offset: slideWidth * i, index: i })}
          keyExtractor={(item) => String(item.order)}
          renderItem={({ item }) => (
            <View style={s.slide}>
              <View style={s.photoCard}>
                {item.source ? (
                  <Image source={item.source} style={s.photo} resizeMode="cover" accessibilityLabel={item.accessibilityLabel} />
                ) : (
                  <View style={[s.photo, s.photoFallback]}>
                    <Text style={s.photoFallbackText}>{item.accessibilityLabel}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      </Animated.View>

      <View style={s.dots}>
        {PREVENTIVE_ITEMS.map((item, i) => (
          <View key={item.order} style={[s.dot, i === index && s.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const carouselStyles = (c: ThemeColors, slideWidth: number) =>
  StyleSheet.create({
    container: { marginTop: spacing.sm, alignItems: 'center' },
    illustrationArea: { width: slideWidth, height: 268, overflow: 'hidden', backgroundColor: 'transparent' },
    slide: { width: slideWidth, height: 268, alignItems: 'center', justifyContent: 'center' },
    photoCard: {
      width: '100%',
      height: '100%',
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: (c as any).border ?? c.neutral.border,
      backgroundColor: (c as any).surface ?? 'transparent',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    photoFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    photoFallbackText: {
      color: c.neutral.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.neutral.border,
    },
    dotActive: {
      backgroundColor: c.primary,
      width: 20,
    },
  });

export default HealthcareCarousel;