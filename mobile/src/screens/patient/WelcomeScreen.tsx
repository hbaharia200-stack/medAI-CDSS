import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, spacing } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { Button } from '../../components/common/Button';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScreenContainer scroll={false} contentStyle={styles.content}>
      <AppHeader />

      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🩺</Text>
        </View>
        {/* Fix 8: simplified soft-shape illustration (rounded blob + two icon circles + trust shield) */}
        <View style={styles.illustrationBlob}>
          <View style={styles.illustrationShield}>
            <Text style={styles.illustrationShieldText}>✅</Text>
          </View>
          <View style={styles.illustrationIconLeft}>
            <Text style={styles.illustrationIcon}>🩺</Text>
          </View>
          <View style={styles.illustrationIconRight}>
            <Text style={styles.illustrationIcon}>🧑‍⚕️</Text>
          </View>
        </View>
        {/* Fix 1a: two-tone wordmark — "Med" in normal text, "AI" in accent blue */}
        <Text style={styles.appName}>
          <Text style={{ color: colors.neutral.text }}>Med</Text>
          <Text style={{ color: colors.primary }}>AI</Text>
        </Text>

        {/* Fix 1: two-line headline on dark background (no light card) */}
        <Text style={styles.headlineLine}>{t('home.headlineFirst')}</Text>
        <Text style={styles.headlineLineAccent}>{t('home.headlineSecond')}</Text>

        <Text style={styles.subtitle}>{t('home.body')}</Text>
      </View>

      <View style={styles.footer}>
        {/* Fix 3: primary = Anza, right-arrow; secondary = Jisajili, person icon */}
        <Button
          label={t('welcome.start')}
          onPress={() => navigation.navigate('LocationPermission')}
          icon="→"
          testID="welcome-start"
        />
        <Button
          label={t('auth.signUp')}
          variant="outline"
          onPress={() => navigation.navigate('SignUp')}
          icon="👤"
          testID="welcome-signup"
        />
        {/* "Already have an account? Sign in" */}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('SignIn', { role: 'patient' })}
          style={styles.signInLink}
          testID="welcome-signin"
        >
          <Text style={styles.signInLinkText}>{t('auth.haveAccountSignIn')}</Text>
        </Pressable>

        {/* Fix 6: footer tagline */}
        <Text style={styles.tagline}>{t('home.footerTagline')}</Text>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { justifyContent: 'space-between' },
    hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xl },
    logoCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    logoEmoji: { fontSize: 40 },
    appName: { ...fonts.captionStrong, marginTop: spacing.sm },
    headlineLine: { ...fonts.h1, color: c.neutral.text, textAlign: 'center', lineHeight: 36 },
    headlineLineAccent: { ...fonts.h1, color: c.primary, textAlign: 'center', lineHeight: 36 },
    subtitle: {
      ...fonts.bodyLarge,
      color: c.neutral.textMuted,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    footer: { paddingBottom: spacing.sm },
    signInLink: { alignItems: 'center', paddingVertical: 12 },
    signInLinkText: { ...fonts.bodyStrong, color: c.primary, fontSize: 15 },
    tagline: { ...fonts.caption, fontSize: 13, color: c.neutral.textMuted, textAlign: 'center', marginTop: spacing.md },
    // Fix 8: simplified soft-shape illustration
    illustrationBlob: {
      width: 180,
      height: 100,
      backgroundColor: c.confidenceLowBg,
      borderRadius: 50,
      borderBottomLeftRadius: 60,
      borderBottomRightRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      opacity: 0.6,
    },
    illustrationShield: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.confidenceHighBg,
      alignItems: 'center',
      justifyContent: 'center',
      top: 8,
    },
    illustrationShieldText: { fontSize: 14 },
    illustrationIconLeft: {
      position: 'absolute',
      left: 24,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    illustrationIconRight: {
      position: 'absolute',
      right: 24,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    illustrationIcon: { fontSize: 22 },

  });

export default WelcomeScreen;
