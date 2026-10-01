import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { fonts } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { IntakeSummaryCards } from '../../components/patient/IntakeSummaryCards';
import { AlertBanner } from '../../components/common/AlertBanner';
import { ProgressSteps } from '../../components/common/ProgressSteps';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { AppHeader } from '../../components/common/AppHeader';
import { useCaseStore } from '../../state/useCaseStore';
import { ApiError } from '../../services/api/client';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ReviewConfirm'>;

/**
 * Turns a submit failure into a message the patient can act on.
 *
 * The backend returns a stable, non-sensitive `error` code for every
 * field-level rejection. Those are mapped to a specific line ("check your
 * phone number") instead of the old single generic "some information could not
 * be accepted" banner, so the patient knows WHICH field to fix.
 *
 * The backend's raw message is never shown verbatim: it can contain values the
 * patient typed, and stack traces are never surfaced at all.
 */
const FIELD_ERROR_KEYS: Record<string, string> = {
  invalid_sex: 'review.fieldSex',
  invalid_age: 'review.fieldAge',
  required_field_missing: 'review.fieldRequired',
  chief_complaint_required: 'review.fieldComplaint',
  invalid_symptoms: 'review.fieldSymptoms',
  invalid_follow_up_answers: 'review.fieldFollowUps',
  invalid_location: 'review.fieldLocation',
  duplicate_patient: 'review.fieldPhone',
  weak_password: 'review.fieldPassword',
};

function describeError(cause: unknown, t: (key: string) => string): string {
  if (cause instanceof ApiError) {
    if (cause.code === 'network_unavailable' || (cause.status ?? 0) >= 500) {
      return t('review.backendUnavailable');
    }
    if (cause.code === 'offline_submit') return t('review.offlineSubmit');
    if (cause.code === 'auth_storage_unavailable') return t('review.storageUnavailable');
    if (cause.status === 401 || cause.code === 'invalid_token') return t('review.signInRequired');

    if (cause.status === 422) {
      // Prefer the specific field message when the backend named one.
      const fieldKey = cause.code ? FIELD_ERROR_KEYS[cause.code] : undefined;
      if (fieldKey) return t(fieldKey);
      // A 422 with no recognised code is still a validation problem; keep the
      // generic wording rather than inventing a reason.
      return t('review.validationFailed');
    }
    return t('review.submitFailed');
  }

  if (cause instanceof Error) {
    if (cause.message === 'details.required') return t('review.fieldRequired');
    if (cause.message === 'review.symptomsRequired') return t('review.symptomsRequired');
  }
  return t('review.submitFailed');
}

export function ReviewConfirmScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const submitIntake = useCaseStore((s) => s.submitIntake);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submittingRef = useRef(false);

  const onSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await submitIntake();
      navigation.navigate('MedAIAgent');
    } catch (cause) {
      setError(describeError(cause, t));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader />
      <ProgressSteps current={3} />
      <Text style={styles.title}>{t('review.title')}</Text>
      <Text style={styles.subtitle}>{t('review.subtitle')}</Text>

      {error ? <AlertBanner text={error} variant="warning" /> : null}
      <IntakeSummaryCards onEdit={(target) => navigation.navigate(target)} />

      <Button
        label={t('review.submit')}
        onPress={() => void onSubmit()}
        loading={submitting}
        icon="📨"
        testID="review-submit"
      />
      <Button
        label={t('common.back')}
        variant="outline"
        onPress={() => navigation.goBack()}
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
  });

export default ReviewConfirmScreen;
