import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { fonts, radii, hitSlop } from '../../theme/tokens';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';

interface UrgentFlagToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}

/**
 * One-tap urgent flag. Accessible from both the queue row and the vitals screen.
 * Featured style: high contrast red when active.
 */
export function UrgentFlagToggle({ value, onChange, label, hint }: UrgentFlagToggleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={hitSlop}
      onPress={() => onChange(!value)}
      style={[styles.container, value && styles.containerActive]}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.label, value && styles.labelActive]}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.danger, false: colors.neutral.border }}
        thumbColor={colors.neutral.surface}
      />
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.neutral.surface,
      borderWidth: 1.5,
      borderColor: c.neutral.border,
      borderRadius: radii.md,
      padding: 12,
    },
    containerActive: { borderColor: c.danger, backgroundColor: c.dangerBg },
    textWrap: { flex: 1, marginRight: 10 },
    label: { ...fonts.bodyStrong, color: c.neutral.text },
    labelActive: { color: c.dangerDark },
    hint: { ...fonts.caption, fontSize: 13, color: c.neutral.textMuted, marginTop: 2 },
  });

export default UrgentFlagToggle;