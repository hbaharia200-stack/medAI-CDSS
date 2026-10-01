import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, radii } from '../../theme/tokens';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import type { ConfidenceLevel } from '../../types';

export type BadgeVariant = 'high' | 'medium' | 'low' | 'urgent' | 'info' | 'neutral';

const variantOf = (c: ThemeColors): Record<BadgeVariant, { bg: string; fg: string; border: string }> => ({
  high: { bg: c.confidenceHighBg, fg: c.confidenceHigh, border: c.confidenceHigh },
  medium: { bg: c.confidenceMediumBg, fg: c.confidenceMedium, border: c.confidenceMedium },
  low: { bg: c.confidenceLowBg, fg: c.confidenceLow, border: c.confidenceLow },
  urgent: { bg: c.dangerBg, fg: c.danger, border: c.danger },
  info: { bg: c.infoBg, fg: c.primary, border: c.primary },
  neutral: { bg: c.confidenceLowBg, fg: c.neutral.textMuted, border: c.neutral.border },
});

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: string;
  confidence?: ConfidenceLevel;
  testID?: string;
}

/** Maps a ConfidenceLevel to a BadgeVariant (High/Medium/Low + urgent). */
export function confidenceToVariant(level: ConfidenceLevel): BadgeVariant {
  if (level === 'High') return 'high';
  if (level === 'Medium') return 'medium';
  return 'low';
}

export function Badge({ label, variant = 'neutral', icon, confidence, testID }: BadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const resolved = confidence ? confidenceToVariant(confidence) : variant;
  const s = variantOf(colors)[resolved];
  return (
    <View
      testID={testID}
      style={[styles.base, { backgroundColor: s.bg, borderColor: s.border }]}
    >
      {icon ? <Text style={[styles.icon, { color: s.fg }]}>{icon}</Text> : null}
      <Text style={[styles.label, { color: s.fg }]}>{label}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    icon: { fontSize: 13, marginRight: 4 },
    label: { ...fonts.captionStrong, fontSize: 13, color: c.neutral.text },
  });

export default Badge;