import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts, radii, spacing, hitSlop } from '../../theme/tokens';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { useCaseStore } from '../../state/useCaseStore';

/**
 * Compact, reusable top header for every screen.
 *  - Left:  small pill with a globe + two-letter language code (tappable to swap).
 *  - Right: circular sun/moon button (tappable to toggle light/dark theme).
 *
 * Replaces the old ad-hoc stacked LanguageToggle / ThemeToggle blocks that were
 * previously only present on Welcome/RoleSelect.
 *
 * The language pill renders on all screens (including the nurse console) so a
 * nurse can switch back to Swahili. The nurse role still defaults to English
 * on entry via setLanguage('en') in RoleSelectScreen.
 */
export function AppHeader({ showLanguageToggle = true }: { showLanguageToggle?: boolean }) {
  // showLanguageToggle is kept for backwards compatibility — the language pill
  // now always renders (nurse screens pass no prop) so nurses can switch
  // between English and Swahili. A `false` value is ignored.
  void showLanguageToggle;
  const { t } = useTranslation();
  const { scheme, colors, toggleTheme } = useTheme();
  const language = useCaseStore((s) => s.language);
  const setLanguage = useCaseStore((s) => s.setLanguage);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isDark = scheme === 'dark';
  const langCode = language === 'en' ? 'EN' : 'SW';

  const toggleLanguage = () => setLanguage(language === 'en' ? 'sw' : 'en');

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('welcome.language')}
        hitSlop={hitSlop}
        onPress={toggleLanguage}
        style={[
          styles.langPill,
          { backgroundColor: colors.neutral.surface, borderColor: colors.neutral.border },
        ]}
      >
        <Text style={styles.globe}>🌐</Text>
        <Text style={[styles.langCode, { color: colors.primary }]}>{langCode}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
        hitSlop={hitSlop}
        onPress={toggleTheme}
        style={[
          styles.themeCircle,
          { backgroundColor: colors.neutral.surface, borderColor: colors.neutral.border },
        ]}
      >
        <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      alignSelf: 'stretch',
    },
    containerEnd: {
      justifyContent: 'flex-end',
    },
    langPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    globe: { fontSize: 15 },
    langCode: { ...fonts.captionStrong, fontSize: 13 },
    themeCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeIcon: { fontSize: 18 },
  });

export default AppHeader;
