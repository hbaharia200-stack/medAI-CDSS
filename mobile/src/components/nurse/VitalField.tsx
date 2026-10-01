import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, noOutline, radii, touchTarget } from '../../theme/tokens';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';

export type VitalFieldStatus = 'abnormal' | 'severe';

interface VitalFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  hint: string; // normal-range hint, e.g. "60–100 is typical"
  keyboardType?: 'decimal-pad' | 'number-pad';
  testID?: string;
  /** Rule-based guardrail status of the typed value (from utils/vitalRanges). */
  status?: VitalFieldStatus;
}

/** Large numeric vitals input with a normal-range hint shown as the nurse types. */
export function VitalField({
  label,
  value,
  onChangeText,
  unit,
  hint,
  keyboardType = 'decimal-pad',
  testID,
  status,
}: VitalFieldProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;
  const active = focused || hovered;

  useEffect(() => {
    // Clinical accent (abnormal/severe) always wins — never animate toward the
    // decorative primary glow when a status is present.
    Animated.timing(glowAnim, {
      toValue: !status && active ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [status, active, glowAnim]);

  const animatedBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.neutral.border, colors.primary],
  });
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  const accent =
    status === 'severe'
      ? colors.danger
      : status === 'abnormal'
        ? colors.confidenceMedium
        : undefined;
  const hintColor = status ? accent : colors.neutral.textMuted;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
        <Animated.View
          style={[
            styles.inputRow,
            {
              borderColor: status ? accent : animatedBorderColor,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 10,
              shadowOpacity: glowOpacity,
            },
          ]}
        >
          <TextInput
            testID={testID}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType={keyboardType}
            accessibilityLabel={label}
            placeholder="—"
            placeholderTextColor={colors.neutral.textMuted}
            style={[styles.input, noOutline]}
          />
          <Text style={styles.unit}>{unit}</Text>
        </Animated.View>
      </Pressable>
      <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    field: { marginBottom: 14 },
    label: { ...fonts.bodyStrong, marginBottom: 6, color: c.neutral.text },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.neutral.surface,
      borderWidth: 1.5,
      borderColor: c.neutral.border,
      borderRadius: radii.lg,
      paddingHorizontal: 14,
    },
    input: {
      flex: 1,
      minHeight: touchTarget,
      fontSize: 22,
      fontWeight: '800',
      color: c.neutral.text,
      paddingVertical: 8,
    },
    unit: { ...fonts.body, color: c.neutral.textMuted },
    hint: { ...fonts.caption, fontSize: 13, color: c.neutral.textMuted, marginTop: 4 },
  });

export default VitalField;