import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { fonts, spacing } from '../theme/tokens';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/common/Button';
import { AlertBanner } from '../components/common/AlertBanner';
import { ScreenFade } from '../components/common/ScreenFade';
import { useTheme } from '../theme/ThemeProvider';
import { useCaseStore } from '../state/useCaseStore';
import { useGlowAnimation } from '../hooks/useGlowAnimation';
import { RoleCard, Field } from './SignUpScreen.fields';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { ApiError } from '../services/api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;
type RoleChoice = 'patient' | 'nurse' | null;

export function SignUpScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const register = useCaseStore((s) => s.register);
  const setRole = useCaseStore((s) => s.setRole);
  const role = useCaseStore((s) => s.role);
  const [choice, setChoice] = useState<RoleChoice>(null);
  // Patient no longer fills a generic sign-up form here: the account details
  // (full name, phone, password) are collected in the staged intake on
  // BasicDetails, and submitIntake() registers the account at Review/Confirm.
  // Choosing Patient therefore opens the existing location step directly.
  const [pendingPatientLocation, setPendingPatientLocation] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
      const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const backGlow = useGlowAnimation();
  const linkGlow = useGlowAnimation();

  const onPatientPress = () => {
    setRole('patient');
    setPendingPatientLocation(true);
  };

  // The patient routes are role-gated in the navigator, so the jump to
  // Location waits until the store role has been applied and the screen is
  // actually registered. Nurse keeps the existing registration form below.
  useEffect(() => {
    if (pendingPatientLocation && role === 'patient') {
      setPendingPatientLocation(false);
      navigation.navigate('LocationPermission');
    }
  }, [pendingPatientLocation, role, navigation]);


  const onRegister = async () => {
    setError(null);
    if (!name.trim()) { setError(t('auth.nameRequired')); return; }
    if (!phone.trim()) { setError(t('auth.phoneRequired')); return; }
    if (!email.trim()) { setError(t('auth.emailRequired')); return; }
    if (choice === 'nurse' && !staffId.trim()) { setError(t('auth.staffIdRequired')); return; }
    if (choice === 'patient' && password.length < 4) { setError(t('auth.passwordShort')); return; }
    if (choice === 'patient' && password !== confirmPassword) { setError(t('auth.passwordMismatch')); return; }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        phone: phone.trim(),
        role: choice ?? 'patient',
        email: email.trim(),
        staffId: choice === 'nurse' ? staffId.trim() : undefined,
        password: choice === 'patient' ? password : undefined,
      });
      navigation.navigate(choice === 'nurse' ? 'PatientQueue' : 'LocationPermission');
    } catch (caught) { setError(caught instanceof ApiError ? caught.userMessage : t('common.error')); }
    finally { setLoading(false); }
  };

    return (
    <ScreenFade>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.neutral.background }} contentContainerStyle={{ flexGrow: 1, padding: spacing.md }}>
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md, ...backGlow.glowAnimatedStyle }}
        onPressIn={backGlow.onPressIn}
        onPressOut={backGlow.onPressOut}
        onHoverIn={backGlow.onHoverIn}
        onHoverOut={backGlow.onHoverOut}
      >
        <Text style={{ ...fonts.bodyStrong, color: c.primary }}>{t('common.back')}</Text>
      </Pressable>
      <Text style={{ ...fonts.h1, color: c.neutral.text, marginBottom: spacing.md }}>{t('auth.signUp')}</Text>
      {!choice ? (
        <View>
          <Text style={{ ...fonts.h3, color: c.neutral.text, marginBottom: spacing.md }}>{t('auth.chooseRole')}</Text>
          <RoleCard icon="🧍" title={t('auth.patient')} desc={t('auth.patientDesc')} onPress={onPatientPress} />
          <RoleCard icon="🧑‍⚕️" title={t('auth.nurse')} desc={t('auth.nurseDesc')} onPress={() => setChoice('nurse')} />
        </View>
      ) : (
        <View>
          {error ? <AlertBanner text={error} variant="warning" /> : null}
          <Field label={t('auth.fullName')} value={name} onChangeText={setName} placeholder={t('auth.fullNamePlaceholder')} />
          <Field label={t('auth.phoneNumber')} value={phone} onChangeText={setPhone} placeholder="0712 345 678" keyboardType="phone-pad" />
          <Field label={t('auth.email')} value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" />
          {choice === 'nurse' ? <Field label={t('auth.staffId')} value={staffId} onChangeText={setStaffId} placeholder={t('auth.staffIdPlaceholder')} /> : null}
          {choice === 'patient' ? <Field label={t('auth.password')} value={password} onChangeText={setPassword} placeholder={t('auth.passwordPlaceholder')} secureTextEntry /> : null}
          {choice === 'patient' ? <Field label={t('auth.confirmPassword')} value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('auth.confirmPasswordPlaceholder')} secureTextEntry /> : null}
                    <Button label={t('auth.signUp')} onPress={() => void onRegister()} loading={loading} icon="📝" />
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SignIn', { role: choice ?? 'patient' })} style={{ alignItems: 'center', marginTop: spacing.md, ...linkGlow.glowAnimatedStyle }}
            onPressIn={linkGlow.onPressIn}
            onPressOut={linkGlow.onPressOut}
            onHoverIn={linkGlow.onHoverIn}
            onHoverOut={linkGlow.onHoverOut}
          >
            <Text style={{ ...fonts.bodyStrong, color: c.primary }}>{t('auth.haveAccountSignIn')}</Text>
                    </Pressable>
        </View>
      )}
      </ScrollView>
      </ScreenFade>
  );
}

export default SignUpScreen;
