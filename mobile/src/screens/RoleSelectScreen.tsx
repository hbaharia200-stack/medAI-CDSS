import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, spacing } from '../theme/tokens';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../components/common/ScreenContainer';
import { Card } from '../components/common/Card';
import { AppHeader } from '../components/common/AppHeader';
import { useTheme, type ThemeColors } from '../theme/ThemeProvider';
import { useCaseStore } from '../state/useCaseStore';

/** Root screen — selects which of the two mobile apps to open. */
export function RoleSelectScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setRole = useCaseStore((s) => s.setRole);
  const setLanguage = useCaseStore((s) => s.setLanguage);

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <AppHeader />
      <View style={styles.header}>
        <Text style={styles.logo}>MedAI</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
      </View>

      <Text style={styles.title}>{t('role.title')}</Text>
      <View style={styles.cards}>
        <Card
          onPress={() => setRole('patient')}
          accessibilityHint={t('role.patientSubtitle')}
        >
          <Text style={styles.cardEmoji}>🧍</Text>
          <Text style={styles.cardTitle}>{t('role.patient')}</Text>
          <Text style={styles.cardSub}>{t('role.patientSubtitle')}</Text>
        </Card>

        <Card
          onPress={() => {
            setLanguage('en');
            setRole('nurse');
          }}
          accessibilityHint={t('role.nurseSubtitle')}
        >
          <Text style={styles.cardEmoji}>🧑‍⚕️</Text>
          <Text style={styles.cardTitle}>{t('role.nurse')}</Text>
          <Text style={styles.cardSub}>{t('role.nurseSubtitle')}</Text>
        </Card>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: spacing.xl },
    logo: { ...fonts.h1, color: c.primary },
    tagline: { ...fonts.body, color: c.neutral.textMuted, marginTop: 4 },
    title: { ...fonts.h2, marginBottom: spacing.md, color: c.neutral.text },
    controls: { gap: spacing.sm, marginBottom: spacing.md },
    cards: { gap: spacing.md, marginTop: spacing.lg },
    cardEmoji: { fontSize: 36 },
    cardTitle: { ...fonts.bodyLarge, marginTop: spacing.sm, color: c.neutral.text },
    cardSub: { ...fonts.body, color: c.neutral.textMuted, marginTop: 2 },
  });

export default RoleSelectScreen;