import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, radii } from '../../theme/tokens';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';

export type AlertBannerVariant = 'info' | 'warning' | 'emergency';

const variantOf = (c: ThemeColors): Record<AlertBannerVariant, { bg: string; fg: string; icon: string }> => ({
  info: { bg: c.infoBg, fg: c.primaryDark, icon: 'ℹ️' },
  warning: { bg: c.warningBg, fg: c.confidenceMedium, icon: '⚠️' },
  emergency: { bg: c.dangerBg, fg: c.dangerDark, icon: '🚨' },
});

interface AlertBannerProps {
  text: string;
  variant?: AlertBannerVariant;
  onPress?: () => void;
}

export function AlertBanner({ text, variant = 'info', onPress }: AlertBannerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const s = variantOf(colors)[variant];
  return (
    <View
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={text}
      onTouchEnd={onPress}
      style={[styles.base, { backgroundColor: s.bg, borderColor: s.fg }]}
    >
      <Text style={styles.icon}>{s.icon}</Text>
      <Text style={[styles.text, { color: s.fg }]}>{text}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    icon: { fontSize: 16, marginRight: 8 },
    text: { ...fonts.bodyStrong, flex: 1, color: c.neutral.text },
  });

export default AlertBanner;