import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fonts, spacing } from '../theme/tokens';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/common/Button';
import { AlertBanner } from '../components/common/AlertBanner';
import { ScreenFade } from '../components/common/ScreenFade';
import { useTheme } from '../theme/ThemeProvider';
import { useCaseStore } from '../state/useCaseStore';
import { fetchMyProfile } from '../services/api/profileService';
import { useGlowAnimation } from '../hooks/useGlowAnimation';
import { FloatingLabelInput } from '../components/common/FloatingLabelInput';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { ApiError } from '../services/api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;
type SignInRole = 'nurse' | 'patient';

/**
 * Does this patient already have a case on the server?
 *
 * Used only to choose the landing screen. If the lookup fails (offline, or a
 * transient 5xx) we assume "no case yet" and show onboarding, which is the
 * safe fallback: a returning patient can always reach the Agent from the
 * account screen.
 */
async function patientHasCase(): Promise<boolean> {
  try {
    const profile = await fetchMyProfile();
    return !!profile.caseId;
  } catch {
    return false;
  }
}

export function SignInScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
    const { colors: c } = useTheme();
  const login = useCaseStore((s) => s.login);
  const backGlow = useGlowAnimation();
  const linkGlow = useGlowAnimation();

  const [role, setRole] = useState<SignInRole | null>(route.params?.role ?? null);
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isNurse = role === 'nurse';

  const selectRole = (nextRole: SignInRole) => {
    setRole(nextRole);
    setIdentifier('');
    setSecret('');
    setError(null);
  };

  const onLogin = async () => {
    const username = identifier.trim();
    setError(null);
    if (!role) { setError(t('auth.chooseRole')); return; }
    if (!username) { setError(isNurse ? t('auth.staffIdRequired') : t('auth.identifierRequired')); return; }
    if (!isNurse && !secret) { setError(t('auth.passwordRequired')); return; }
    setLoading(true);
    try {
      const success = await login(username, isNurse ? '' : secret, role);
      if (success) {
        const userRole = useCaseStore.getState().user?.role;
        // Role-aware landing.
        if (userRole === 'nurse') {
          navigation.replace('PatientQueue');
        } else {
          // A *returning* patient already has a case on the server. Sending
          // them back through Welcome → Location → BasicDetails made an
          // existing account re-do onboarding every sign-in. Ask the backend
          // whether there is already a case and go straight to the Agent,
          // which is the authenticated patient home.
          const hasCase = await patientHasCase();
          navigation.replace(hasCase ? 'MedAIAgent' : 'Welcome');
        }
      } else {
        setError(isNurse ? t('auth.nurseLoginFailed') : t('auth.loginFailed'));
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.userMessage);
      } else {
        setError(isNurse ? t('auth.nurseLoginFailed') : t('auth.loginFailed'));
      }
    }
    finally { setLoading(false); }
  };

  const roleTabs: Array<{ key: SignInRole; label: string }> = [
    { key: 'patient', label: t('auth.patient') },
    { key: 'nurse', label: t('auth.nurse') },
  ];

    return (
    <ScreenFade>
      <View style={{ flex: 1, backgroundColor: c.neutral.background, padding: spacing.md }}>
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md, alignSelf: 'flex-start', borderWidth: 1.5, borderColor: c.neutral.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, ...backGlow.glowAnimatedStyle }}
        onPressIn={backGlow.onPressIn}
        onPressOut={backGlow.onPressOut}
        onHoverIn={backGlow.onHoverIn}
        onHoverOut={backGlow.onHoverOut}
      >
        <Text style={{ ...fonts.bodyStrong, color: c.primary }}>{t('common.back')}</Text>
      </Pressable>
      <Text style={{ ...fonts.h1, color: c.neutral.text, marginBottom: spacing.md }}>{t('auth.signIn')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
        {roleTabs.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityState={{ selected: role === tab.key }}
            onPress={() => selectRole(tab.key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: role === tab.key ? c.primary : c.neutral.surface, borderWidth: 1, borderColor: role === tab.key ? c.primary : c.neutral.border }}
          >
            <Text style={{ ...fonts.bodyStrong, color: role === tab.key ? c.neutral.textOnPrimary : c.neutral.text }}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <AlertBanner text={error} variant="warning" /> : null}
      {role ? (
        <>
          <FloatingLabelInput
            label={isNurse ? t('auth.staffId') : t('auth.identifier')}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={isNurse ? t('auth.staffIdPlaceholder') : t('auth.identifierPlaceholder')}
            autoCapitalize="none"
            keyboardType={isNurse ? 'default' : 'email-address'}
            autoComplete={isNurse ? 'off' : 'username'}
            testID={isNurse ? 'signin-staffid' : 'signin-identifier'}
          />
          {!isNurse ? (
            <>
              <FloatingLabelInput
                label={t('auth.password')}
                value={secret}
                onChangeText={setSecret}
                placeholder={t('auth.passwordPlaceholder')}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                testID="signin-password"
              />

            </>
          ) : null}
        </>
      ) : null}
      <Button label={t('auth.signIn')} onPress={onLogin} loading={loading} disabled={!role} icon="🔑" />
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SignUp')} style={{ alignItems: 'center', marginTop: spacing.md, ...linkGlow.glowAnimatedStyle, borderWidth: 1, borderColor: 'transparent', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12 }}
        onPressIn={linkGlow.onPressIn}
        onPressOut={linkGlow.onPressOut}
        onHoverIn={linkGlow.onHoverIn}
        onHoverOut={linkGlow.onHoverOut}
      >
        <Text style={{ ...fonts.bodyStrong, color: c.primary }}>{t('auth.noAccountSignUp')}</Text>
      </Pressable>
    </View>
    </ScreenFade>
  );
}

export default SignInScreen;
