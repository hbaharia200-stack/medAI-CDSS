import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { AppHeader } from '../../components/common/AppHeader';
import { useCaseStore } from '../../state/useCaseStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Handoff'>;

interface VitalRow {
  label: string;
  value: string;
}

export function HandoffScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queue = useCaseStore((s) => s.queue);
  const selectedCaseId = useCaseStore((s) => s.selectedCaseId);
  const sendToDoctor = useCaseStore((s) => s.sendToDoctor);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const row = queue.find((q) => q.case.id === selectedCaseId);

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

  const c = row.case;
  const v = c.vitals;

  const vitalRows: VitalRow[] = v
    ? [
        v.temperatureC !== undefined
          ? { label: t('nurse.vitals.temperatureC'), value: `${v.temperatureC} ${t('nurse.vitals.unitC')}` }
          : null,
        v.bloodPressureSystolic !== undefined && v.bloodPressureDiastolic !== undefined
          ? {
              label: t('nurse.vitals.bpSystolic'),
              value: `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic} ${t('nurse.vitals.unitMmHg')}`,
            }
          : null,
        v.heartRate !== undefined
          ? { label: t('nurse.vitals.heartRate'), value: `${v.heartRate} ${t('nurse.vitals.unitBpm')}` }
          : null,
        v.respiratoryRate !== undefined
          ? { label: t('nurse.vitals.respiratoryRate'), value: `${v.respiratoryRate} ${t('nurse.vitals.unitBreaths')}` }
          : null,
        v.weightKg !== undefined
          ? { label: t('nurse.vitals.weightKg'), value: `${v.weightKg} ${t('nurse.vitals.unitKg')}` }
          : null,
      ].filter((r): r is VitalRow => r !== null)
    : [];

  const onSend = async () => {
    setSending(true);
    try {
      await sendToDoctor(c.id);
      setSent(true);
    } catch {
      setSent(false);
    } finally {
      setSending(false);
    }
  };

  const onNext = () => {
    navigation.popToTop();
  };

  return (
    <ScreenContainer>
      <AppHeader />
      <Text style={styles.title}>{t('nurse.handoff.title')}</Text>
      <Text style={styles.subtitle}>{t('nurse.handoff.subtitle')}</Text>

      {c.urgent ? (
        <AlertBanner text={t('nurse.handoff.urgentNote')} variant="emergency" />
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>{t('nurse.vitals.patient')}</Text>
        <Text style={styles.name}>{c.patient.name}</Text>
        <Text style={styles.meta}>
          {c.patient.age} · {c.patient.sex}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>{t('nurse.handoff.vitalsLabel')}</Text>
        {vitalRows.length === 0 ? (
          <Text style={styles.meta}>{t('nurse.vitals.validation')}</Text>
        ) : (
          vitalRows.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue}>{r.value}</Text>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>{t('nurse.handoff.symptomsLabel')}</Text>
        {c.symptoms.map((s) => (
          <View key={s.id} style={styles.row}>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.rowValue}>{s.label}</Text>
          </View>
        ))}
      </Card>

      {sent ? (
        <View style={styles.sent}>
          <Text style={styles.sentText}>✅ {t('nurse.handoff.sent')}</Text>
          <Button
            label={t('nurse.handoff.newPatient')}
            onPress={onNext}
            variant="outline"
            icon="→"
            testID="handoff-next"
          />
        </View>
      ) : (
        <Button
          label={t('nurse.handoff.sendToDoctor')}
          onPress={() => void onSend()}
          loading={sending}
          icon="🩺"
          testID="handoff-send"
        />
      )}
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
      marginBottom: 12,
    },
    card: { marginTop: 12 },
    sectionTitle: { ...fonts.bodyStrong, marginBottom: 8, color: c.neutral.text },
    name: { ...fonts.h3, color: c.neutral.text },
    meta: { ...fonts.body, color: c.neutral.textMuted, marginTop: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    rowLabel: { ...fonts.body, color: c.neutral.textMuted, flex: 1 },
    rowValue: { ...fonts.bodyStrong, color: c.neutral.text },
    dot: { color: c.primary, marginRight: 8 },
    sent: { marginTop: 20, gap: 12, alignItems: 'center' },
    sentText: { ...fonts.h3, color: c.confidenceHigh },
  });

export default HandoffScreen;
