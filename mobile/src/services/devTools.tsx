// Manual dev connectivity toggle — lets the offline-first behaviour be tested
// without a device. Uses the module-level force setter in connectivity.ts.
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts, radii } from '../theme/tokens';
import { useTheme, type ThemeColors } from '../theme/ThemeProvider';
import { useCaseStore } from '../state/useCaseStore';
import { forceConnectivityForDev } from './connectivity';

export function DevNetToggle() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const connectivity = useCaseStore((s) => s.connectivity);
  const offline = connectivity === 'offline';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={offline ? t('offline.offline') : t('offline.synced')}
      onPress={() => forceConnectivityForDev(offline ? 'online' : 'offline')}
      style={[styles.pill, offline ? styles.off : styles.on]}
    >
      <Text style={styles.text}>{offline ? '⛔' : '📶'} Dev: {offline ? 'OFF' : 'ON'}</Text>
    </Pressable>
  );
}

export const Network = { Toggle: DevNetToggle };

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    pill: {
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
      flexDirection: 'row',
      alignItems: 'center',
    },
    on: { backgroundColor: c.confidenceHighBg },
    off: { backgroundColor: c.dangerBg },
    text: { ...fonts.captionStrong, fontSize: 12, color: c.neutral.text },
  });

export default Network;