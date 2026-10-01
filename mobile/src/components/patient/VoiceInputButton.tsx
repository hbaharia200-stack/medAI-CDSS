import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radii, spacing } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

const CANNED_TRANSCRIPTS = [
  'Naumwa na kichwa na nina homa',
  'I have a headache and a fever',
];

/**
 * Voice input button — MOCK for this phase. Modern waveform design.
 * The real STT service will replace the CANNED_TRANSCRIPTS selection.
 */
export function VoiceInputButton({ onTranscript, disabled = false }: VoiceInputButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [state, setState] = useState<'idle' | 'listening' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state !== 'listening') {
      wave1.setValue(0);
      wave2.setValue(0);
      wave3.setValue(0);
      return;
    }
    const animate = () => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(wave1, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(wave1, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(wave2, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(wave2, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(wave3, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(wave3, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start(() => {
        if (state === 'listening') animate();
      });
    };
    animate();
  }, [state]);

  const press = () => {
    if (state === 'listening' || disabled) return;
    setState('listening');
    timer.current = setTimeout(() => {
      const text = CANNED_TRANSCRIPTS[Math.floor(Math.random() * CANNED_TRANSCRIPTS.length)];
      setState('done');
      onTranscript(text);
      setTimeout(() => setState('idle'), 700);
    }, 1200);
  };

  const label = t(state === 'listening' ? 'symptom.voiceListening' : 'symptom.voiceHint');

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={press}
        disabled={disabled || state === 'listening'}
        style={[styles.button, state === 'listening' && styles.buttonActive]}
      >
        {state === 'listening' ? (
          <View style={styles.waveform}>
            <Animated.View style={[styles.bar, { opacity: wave1, transform: [{ scaleY: wave1.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]} />
            <Animated.View style={[styles.bar, { opacity: wave2, transform: [{ scaleY: wave2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]} />
            <Animated.View style={[styles.bar, { opacity: wave3, transform: [{ scaleY: wave3.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]} />
          </View>
        ) : state === 'done' ? (
          <Text style={styles.icon}>✓</Text>
        ) : (
          <View style={styles.orbInner}>
            <Text style={styles.icon}>🎤</Text>
          </View>
        )}
      </Pressable>
      <Text style={styles.hint}>{label}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { alignItems: 'center' },
    button: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    buttonActive: { backgroundColor: c.danger },
    orbInner: { alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 28, color: c.neutral.textOnPrimary },
    waveform: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32 },
    bar: { width: 4, height: 24, borderRadius: 2, backgroundColor: '#FFFFFF' },
    hint: { ...fonts.caption, fontSize: 13, color: c.neutral.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  });

export default VoiceInputButton;