import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, hitSlop } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { VitalField } from '../../components/nurse/VitalField';
import { UrgentFlagToggle } from '../../components/nurse/UrgentFlagToggle';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { AppHeader } from '../../components/common/AppHeader';
import {
  checkBloodPressure,
  checkHeartRate,
  checkRespiratoryRate,
  checkTemperature,
  hasUrgentVitals,
  type VitalCheck,
} from '../../utils/vitalRanges';
import type { VitalFieldStatus } from '../../components/nurse/VitalField';
import { useCaseStore } from '../../state/useCaseStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'VitalsEntry'>;

const EMPTY = {
  temperatureC: '',
  bpSystolic: '',
  bpDiastolic: '',
  heartRate: '',
  respiratoryRate: '',
  weightKg: '',
};

export function VitalsEntryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queue = useCaseStore((s) => s.queue);
  const selectedCaseId = useCaseStore((s) => s.selectedCaseId);
  const submitVitals = useCaseStore((s) => s.submitVitals);
  const toggleUrgentRow = useCaseStore((s) => s.toggleUrgent);

  const [values, setValues] = useState({ ...EMPTY });
  const [urgent, setUrgent] = useState(false);
  const [justFlagged, setJustFlagged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const row = queue.find((q) => q.case.id === selectedCaseId);

  const set = (key: keyof typeof EMPTY) => (text: string) =>
    setValues((v) => ({ ...v, [key]: text }));

  const num = (key: keyof typeof EMPTY): number | undefined => {
    const raw = values[key].trim();
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  // Map rule-based VitalCheck onto the VitalField visual status.
  const statusOf = (check: VitalCheck): VitalFieldStatus | undefined =>
    check.urgent
      ? 'severe'
      : check.status === 'high' || check.status === 'low'
        ? 'abnormal'
        : undefined;

  // Rule-based guardrails (utils/vitalRanges) — NOT AI logic.
  const checks = {
    temperature: checkTemperature(num('temperatureC')),
    bloodPressure: checkBloodPressure(num('bpSystolic'), num('bpDiastolic')),
    heartRate: checkHeartRate(num('heartRate')),
    respiratoryRate: checkRespiratoryRate(num('respiratoryRate')),
  };
  const severeDetected = hasUrgentVitals({
    temperatureC: num('temperatureC'),
    bloodPressureSystolic: num('bpSystolic'),
    bloodPressureDiastolic: num('bpDiastolic'),
    heartRate: num('heartRate'),
    respiratoryRate: num('respiratoryRate'),
  });

  const onSave = async () => {
    const filled = Object.keys(values).filter(
      (k) => (values as Record<string, string>)[k].trim() !== '',
    );
    if (filled.length === 0) {
      setError(t('nurse.vitals.validation'));
      return;
    }
    setError(null);
    setSaving(true);
    const vitals = {
      temperatureC: values.temperatureC ? parseFloat(values.temperatureC) : undefined,
      bloodPressureSystolic: values.bpSystolic ? parseInt(values.bpSystolic, 10) : undefined,
      bloodPressureDiastolic: values.bpDiastolic ? parseInt(values.bpDiastolic, 10) : undefined,
      heartRate: values.heartRate ? parseInt(values.heartRate, 10) : undefined,
      respiratoryRate: values.respiratoryRate ? parseInt(values.respiratoryRate, 10) : undefined,
      weightKg: values.weightKg ? parseFloat(values.weightKg) : undefined,
      recordedAt: new Date().toISOString(),
    };
    try {
      // Rule-based escalation: severe vitals always travel with the urgent flag.
      await submitVitals(vitals, urgent || severeDetected);
      navigation.navigate('Handoff');
    } catch {
      setError(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (!row) {
    return (
      <ScreenContainer>
        <AlertBanner text={t('common.error')} variant="warning" />
        <Button
          label={t('common.back')}
          variant="outline"
          onPress={() => navigation.goBack()}
        />
      </ScreenContainer>
    );
  }

  const patient = row.case.patient;

  return (
    <ScreenContainer>
      <AppHeader />
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.back}>← {t('common.back')}</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{t('nurse.vitals.title')}</Text>
      <Text style={styles.subtitle}>{t('nurse.vitals.subtitle')}</Text>

      <View style={styles.patientLine}>
        <Text style={styles.patientName}>{patient.name}</Text>
        <Text style={styles.patientMeta}>
          {patient.age} · {patient.sex}
        </Text>
        {row.case.urgent || urgent ? (
          <Badge label={t('nurse.queue.urgentBadge')} variant="urgent" icon="🚨" />
        ) : null}
      </View>

      {error ? <AlertBanner text={error} variant="warning" /> : null}

      <View style={styles.grid}>
        <VitalField
          label={`${t('nurse.vitals.temperatureC')} (°C)`}
          value={values.temperatureC}
          onChangeText={set('temperatureC')}
          unit={t('nurse.vitals.unitC')}
          hint={t('nurse.vitals.temperatureHint')}
          testID="vitals-temp"
          status={statusOf(checks.temperature)}
        />
        <VitalField
          label={t('nurse.vitals.bpSystolic')}
          value={values.bpSystolic}
          onChangeText={set('bpSystolic')}
          unit={t('nurse.vitals.unitMmHg')}
          keyboardType="number-pad"
          hint={t('nurse.vitals.bpHint')}
          testID="vitals-bp-sys"
          status={statusOf(checks.bloodPressure)}
        />
        <VitalField
          label={t('nurse.vitals.bpDiastolic')}
          value={values.bpDiastolic}
          onChangeText={set('bpDiastolic')}
          unit={t('nurse.vitals.unitMmHg')}
          keyboardType="number-pad"
          hint={t('nurse.vitals.bpHint')}
          testID="vitals-bp-dia"
          status={statusOf(checks.bloodPressure)}
        />
        <VitalField
          label={t('nurse.vitals.heartRate')}
          value={values.heartRate}
          onChangeText={set('heartRate')}
          unit={t('nurse.vitals.unitBpm')}
          keyboardType="number-pad"
          hint={t('nurse.vitals.heartRateHint')}
          testID="vitals-hr"
          status={statusOf(checks.heartRate)}
        />
        <VitalField
          label={t('nurse.vitals.respiratoryRate')}
          value={values.respiratoryRate}
          onChangeText={set('respiratoryRate')}
          unit={t('nurse.vitals.unitBreaths')}
          keyboardType="number-pad"
          hint={t('nurse.vitals.respiratoryRateHint')}
          testID="vitals-rr"
          status={statusOf(checks.respiratoryRate)}
        />
        <VitalField
          label={t('nurse.vitals.weightKg')}
          value={values.weightKg}
          onChangeText={set('weightKg')}
          unit={t('nurse.vitals.unitKg')}
          hint={t('nurse.vitals.weightHint')}
          testID="vitals-weight"
        />
      </View>

      {severeDetected && !(urgent || row.case.urgent) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nurse.vitals.severeWarning')}
          onPress={() => {
            setUrgent(true);
            setJustFlagged(true);
            if (selectedCaseId && !row.case.urgent) toggleUrgentRow(selectedCaseId);
          }}
        >
          <AlertBanner text={t('nurse.vitals.severeWarning')} variant="emergency" />
        </Pressable>
      ) : null}
      {justFlagged && (urgent || row.case.urgent) ? (
        <AlertBanner text={t('nurse.vitals.urgentConfirmed')} variant="warning" />
      ) : null}

      <UrgentFlagToggle
        value={urgent || row.case.urgent}
        onChange={(v) => {
          setUrgent(v);
          setJustFlagged(false);
          if (selectedCaseId && v !== row.case.urgent) toggleUrgentRow(selectedCaseId);
        }}
        label={t('nurse.vitals.urgent')}
        hint={t('nurse.vitals.urgentHint')}
      />

      <View style={styles.spacer} />
      <Button
        label={t('nurse.vitals.saveAndContinue')}
        onPress={() => void onSave()}
        loading={saving}
        icon="📋"
        testID="vitals-save"
      />
    </ScreenContainer>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    headerRow: { marginBottom: 8 },
    back: { ...fonts.bodyStrong, color: c.primary },
    title: { ...fonts.h1, color: c.neutral.text },
    subtitle: { ...fonts.body, color: c.neutral.textMuted, marginTop: 4 },
    patientLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    patientName: { ...fonts.h3, color: c.neutral.text },
    patientMeta: { ...fonts.body, color: c.neutral.textMuted },
    grid: { marginTop: 16 },
    spacer: { flex: 1, minHeight: 24 },
  });

export default VitalsEntryScreen;
