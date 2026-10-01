import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/common/Button';
import { HealthcareCarousel } from '../components/HealthcareCarousel';
import { ScreenFade } from '../components/common/ScreenFade';
import { useTheme } from '../theme/ThemeProvider';
import { useCaseStore } from '../state/useCaseStore';
import { homeStyles } from './HomeScreen.styles';
import { useGlowAnimation } from '../hooks/useGlowAnimation';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
    const { colors, scheme, toggleTheme } = useTheme();
  const s = homeStyles(colors);
  const isAuth = useCaseStore((st) => st.isAuthenticated);
  const lang = useCaseStore((st) => st.language);

  const accountGlow = useGlowAnimation();
  const langGlow = useGlowAnimation();
  const themeGlow = useGlowAnimation();

  return (
    <ScreenFade>
      <View style={s.safe}>
      {/* Top Header: Account (left) + Language/Theme (right) */}
      <View style={s.header}>
                <Pressable
          accessibilityRole="button"
          accessibilityLabel={isAuth ? t('account.myAccount') : t('auth.signUp')}
          onPress={() => (isAuth ? navigation.navigate('MyAccount') : navigation.navigate('SignUp'))}
          style={[s.accountBtn, accountGlow.glowAnimatedStyle]}
          onPressIn={accountGlow.onPressIn}
          onPressOut={accountGlow.onPressOut}
          onHoverIn={accountGlow.onHoverIn}
          onHoverOut={accountGlow.onHoverOut}
          testID="home-account-link"
        >
          <Text style={s.accountIcon}>👤</Text>
          <Text style={s.accountText}>{isAuth ? t('account.myAccount') : t('auth.signUp')}</Text>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <View style={s.headerRight}>
                    <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('welcome.language')}
            onPress={() => useCaseStore.getState().setLanguage(lang === 'sw' ? 'en' : 'sw')}
            style={[s.langSegPill, lang === 'sw' && s.langSegActive, langGlow.glowAnimatedStyle]}
            onPressIn={langGlow.onPressIn}
            onPressOut={langGlow.onPressOut}
            onHoverIn={langGlow.onHoverIn}
            onHoverOut={langGlow.onHoverOut}
          >
            <Text style={[s.langSegLabel, lang === 'sw' && s.langSegActiveText]}>🌐 SW</Text>
            <Text style={[s.langSegLabel, lang === 'en' && s.langSegActiveText]}>| EN</Text>
          </Pressable>

                    <Pressable
            accessibilityRole="button"
            accessibilityLabel={scheme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
            onPress={toggleTheme}
            style={[s.themeSegPill, themeGlow.glowAnimatedStyle]}
            onPressIn={themeGlow.onPressIn}
            onPressOut={themeGlow.onPressOut}
            onHoverIn={themeGlow.onHoverIn}
            onHoverOut={themeGlow.onHoverOut}
          >
            <Text style={[s.themeSegLabel, scheme === 'light' && s.themeSegActiveText]}>☀️</Text>
            <Text style={[s.themeSegLabel, scheme === 'dark' && s.themeSegActiveText]}>🌙</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Content — scrollable so hero + ANZA actions never overflow on small screens */}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* MedAI Branding */}
        <View style={s.brand}>
          <View style={s.logoCircle}>
            <Text style={s.logoIcon}>🩺</Text>
          </View>
          <Text style={s.appName}>
            <Text style={{ color: colors.neutral.text }}>Med</Text>
            <Text style={{ color: colors.primary }}>AI</Text>
          </Text>
          <Text style={s.tagline}>{t('app.tagline')}</Text>
        </View>

        {/* Hero heading + subtitle */}
        <View style={s.clinicalCard}>
          <Text style={s.clinicalTitle}>
            {t('home.heroLine1')}
            {'\n'}
            <Text style={s.clinicalTitleHighlight}>{t('home.heroLine2')}</Text>
          </Text>
          <Text style={s.clinicalSubtitle}>{t('home.clinicalSubtitle')}</Text>
        </View>

        {/* Preventive-care photo carousel (below hero) */}
        <HealthcareCarousel />

        {/* Primary Actions */}
        <View style={s.actions}>
          <Button
            label={t('welcome.start')}
            onPress={() => {
              useCaseStore.getState().setRole('patient');
              if (isAuth) { navigation.navigate('LocationPermission'); } else { navigation.navigate('SignIn', { role: 'patient' }); }
            }}
            icon="→"
            testID="home-start"
          />
          <Button
            label={t('auth.signUp')}
            variant="outline"
            onPress={() => navigation.navigate('SignUp')}
            icon="👤"
            testID="home-signup"
          />
                    <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('SignIn', { role: 'patient' })}
                      style={s.linkBtn}
            testID="home-signin"
          >
            <Text style={s.linkText}>{t('auth.haveAccountSignIn')}</Text>
          </Pressable>
        </View>

        <Text style={s.footerTagline}>{t('home.footerTagline')}</Text>
            </ScrollView>
    </View>
    </ScreenFade>
  );
}

export default HomeScreen;