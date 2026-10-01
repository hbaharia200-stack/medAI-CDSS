import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, radii, spacing } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { useCaseStore } from '../../state/useCaseStore';

/**
 * Persistent, non-blocking status pill shown on every screen.
 * Never a blocking error modal for connectivity issues.
 */
export function OfflineIndicator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const connectivity = useCaseStore((s) => s.connectivity);

  const config = {
    synced: { text: t('offline.synced'), bg: colors.confidenceHighBg, fg: colors.confidenceHigh, icon: '✓' },
    syncing: { text: t('offline.syncing'), bg: colors.infoBg, fg: colors.primary, icon: '⟳' },
    offline: { text: t('offline.offline'), bg: colors.warningBg, fg: colors.confidenceMedium, icon: '·' },
  }[connectivity === 'offline' ? 'offline' : connectivity === 'syncing' ? 'syncing' : 'synced'];

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.pill, { backgroundColor: config.bg }]}
    >
      <Text style={[styles.dot, { color: config.fg }]}>{config.icon}</Text>
      <Text style={[styles.text, { color: config.fg }]}>{config.text}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    pill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: 4,
    },
    dot: { fontSize: 14, fontWeight: '900', marginRight: 6 },
    text: { ...fonts.captionStrong, fontSize: 13 },
  });

export default OfflineIndicator;