import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radii, touchTarget } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { FloatingLabelInput } from '../../components/common/FloatingLabelInput';
import { Button } from '../../components/common/Button';
import { ProgressSteps } from '../../components/common/ProgressSteps';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { AppHeader } from '../../components/common/AppHeader';
import { useCaseStore } from '../../state/useCaseStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'BasicDetails'>;

export function BasicDetailsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const draft = useCaseStore((s) => s.draft);
  const updateDraft = useCaseStore((s) => s.updateDraft);
  const [attempted, setAttempted] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const age = parseInt(draft.age, 10);
  const valid =
    draft.name.trim().length > 0 &&
    !Number.isNaN(age) &&
    age > 0 &&
    draft.sex !== null &&
    draft.phone.trim().length >= 7 &&
    password.length >= 4 &&
    password === confirmPassword;

  // Field-level errors appear after the first continue attempt — clearer for
  // low-literacy users than a single generic banner.
  const errors = {
    name: attempted && draft.name.trim().length === 0 ? t('details.errName') : null,
    age:
      attempted && (draft.age.trim() === '' || Number.isNaN(age) || age <= 0)
        ? t('details.errAge')
        : null,
    sex: attempted && draft.sex === null ? t('details.errSex') : null,
    phone: attempted && draft.phone.trim().length < 7 ? t('details.errPhone') : null,
    password: attempted && password.length < 4 ? t('auth.passwordShort') : null,
    confirmPassword: attempted && password !== confirmPassword ? t('auth.passwordMismatch') : null,
  };

  const onContinue = () => {
    setAttempted(true);
    if (!valid) return;
    updateDraft({ password });
    navigation.navigate('SymptomChat');
  };

  return (
    <ScreenContainer>
      <AppHeader />
      <ProgressSteps current={0} />

      <Text style={styles.title}>{t('details.title')}</Text>
      <Text style={styles.subtitle}>{t('details.description')}</Text>

      <FloatingLabelInput
        label={t('details.name')}
        value={draft.name}
        onChangeText={(v) => updateDraft({ name: v })}
        placeholder={t('details.namePlaceholder')}
        autoComplete="name"
        error={errors.name}
        testID="details-name"
      />

      <View style={styles.row}>
        <View style={[styles.flexField]}>
          <FloatingLabelInput
            label={t('details.age')}
            value={draft.age}
            onChangeText={(v) => updateDraft({ age: v.replace(/[^0-9]/g, '') })}
            placeholder={t('details.agePlaceholder')}
            keyboardType="number-pad"
            maxLength={3}
            error={errors.age}
            testID="details-age"
          />
        </View>

        <View style={[styles.flexField]}>
          <FloatingLabelInput
            label={t('details.phone')}
            value={draft.phone}
            onChangeText={(v) => updateDraft({ phone: v })}
            placeholder={t('details.phonePlaceholder')}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={errors.phone}
            testID="details-phone"
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('details.sex')}</Text>
        <View style={styles.segRow} accessibilityRole="radiogroup">
          {(['M', 'F'] as const).map((key) => {
            const active = draft.sex === key;
            const hasError = Boolean(errors.sex);
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={key === 'M' ? t('details.male') : t('details.female')}
                onPress={() => updateDraft({ sex: key })}
                style={[
                  styles.seg,
                  {
                    borderColor: active
                      ? colors.primary
                      : hasError
                        ? colors.danger
                        : colors.neutral.border,
                    backgroundColor: active ? colors.primaryLight : colors.neutral.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segLabel,
                    { color: active ? colors.primaryDark : colors.neutral.textMuted },
                  ]}
                >
                  {key === 'M' ? `♂ ${t('details.male')}` : `♀ ${t('details.female')}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {errors.sex ? <Text style={styles.fieldError}>{errors.sex}</Text> : null}
      </View>

      <FloatingLabelInput
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        secureTextEntry
        autoComplete="password"
        error={errors.password}
        testID="details-password"
      />

      <FloatingLabelInput
        label={t('auth.confirmPassword')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder={t('auth.confirmPasswordPlaceholder')}
        secureTextEntry
        autoComplete="password"
        error={errors.confirmPassword}
        testID="details-confirm-password"
      />



      <View style={styles.spacer} />
      <Button
        label={t('common.continue')}
        onPress={onContinue}
        icon="→"
        testID="details-continue"
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('SignIn', { role: 'patient' })}
        style={styles.signInLink}
      >
        <Text style={styles.signInLinkText}>{t('auth.haveAccountSignIn')}</Text>
      </Pressable>
      <Button
        label={t('common.back')}
        onPress={() => navigation.goBack()}
        variant="outline"
        testID="details-back"
      />
    </ScreenContainer>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    title: { ...fonts.h1, color: c.neutral.text },
    subtitle: {
      ...fonts.bodyLarge,
      color: c.neutral.textMuted,
      marginTop: 4,
      marginBottom: 16,
    },
    field: { marginBottom: 16 },
    flexField: { flex: 1 },
    row: { flexDirection: 'row', gap: 12 },
    label: { ...fonts.bodyStrong, marginBottom: 6, color: c.neutral.text },
    input: {
      minHeight: touchTarget,
      borderWidth: 1.5,
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      fontSize: 18,
      backgroundColor: c.neutral.surface,
      color: c.neutral.text,
    },
    fieldError: { ...fonts.caption, fontSize: 13, color: c.danger, marginTop: 4 },
    segRow: { flexDirection: 'row', gap: 12 },
    seg: {
      flex: 1,
      minHeight: touchTarget,
      borderWidth: 1.5,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segLabel: { ...fonts.bodyStrong },
    pwToggleRow: { marginTop: -8, marginBottom: 16 },
    pwToggle: { ...fonts.bodyStrong, color: c.primary, fontSize: 14 },
    signInLink: { alignItems: 'center', paddingVertical: 12 },
    signInLinkText: { ...fonts.bodyStrong, color: c.primary, fontSize: 15 },
    spacer: { flex: 1, minHeight: 24 },
  });

export default BasicDetailsScreen;
