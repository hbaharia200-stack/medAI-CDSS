import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radii, touchTarget } from '../../theme/tokens';

export function ThemeToggle() {
  const { t } = useTranslation();
  const { scheme, colors, toggleTheme } = useTheme();
  const isDark = scheme === 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(isDark ? 'theme.switchToLight' : 'theme.switchToDark')}
      onPress={toggleTheme}
      style={[styles.toggle, { backgroundColor: colors.neutral.surface, borderColor: colors.neutral.border }]}
    >
      <Text style={styles.icon}>{isDark ? '☀️' : '🌙'}</Text>
      <Text style={[styles.label, { color: colors.neutral.text }]}>
        {t(isDark ? 'theme.light' : 'theme.dark')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    minHeight: touchTarget,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 6,
  },
  label: {
    ...fonts.bodyStrong,
    fontSize: 13,
  },
  icon: {
    fontSize: 14,
  },
});

export default ThemeToggle;
