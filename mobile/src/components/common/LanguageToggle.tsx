import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radii, touchTarget } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../../i18n';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { useCaseStore } from '../../state/useCaseStore';

interface LanguageToggleProps {
  compact?: boolean;
}

/** Segmented SW/EN toggle — writes the choice to i18n + AsyncStorage. */
export function LanguageToggle({ compact = false }: LanguageToggleProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const language = useCaseStore((s) => s.language);
  const setLanguage = useCaseStore((s) => s.setLanguage);

  const options: Array<{ key: AppLanguage; label: string }> = [
    { key: 'sw', label: 'Kiswahili' },
    { key: 'en', label: 'English' },
  ];

  return (
    <View accessibilityRole="radiogroup" style={styles.container}>
      {options.map((opt) => {
        const active = language === opt.key;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${opt.label}${t('welcome.language')}`}
            onPress={() => setLanguage(opt.key)}
            style={[styles.seg, active && styles.segActive, compact && styles.segCompact]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: c.neutral.border,
      borderRadius: radii.md,
      padding: 4,
    },
    seg: {
      flex: 1,
      minHeight: touchTarget - 8,
      borderRadius: radii.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    segCompact: { minHeight: 36 },
    segActive: { backgroundColor: c.neutral.surface },
    label: { ...fonts.body, color: c.neutral.textMuted },
    labelActive: { color: c.primary, ...fonts.bodyStrong },
  });

export default LanguageToggle;