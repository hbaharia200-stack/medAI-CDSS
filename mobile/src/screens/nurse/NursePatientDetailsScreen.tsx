import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Phone, User, Stethoscope, FlaskConical, AlertTriangle } from 'lucide-react-native';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { AlertBanner } from '../../components/common/AlertBanner';
import { AppHeader } from '../../components/common/AppHeader';
import { ScreenFade } from '../../components/common/ScreenFade';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { getNursePatientDetail, type NursePatientDetail } from '../../services/api/caseService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'NursePatientDetails'>;

/** Shown wherever the backend holds no value — never a fabricated default. */
const NOT_RECORDED = '—';

function formatDateTime(value?: string | null): string {
  if (!value) return NOT_RECORDED;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function sexLabel(sex: string | null | undefined, male: string, female: string): string {
  if (sex === 'M' || sex === 'MALE') return male;
  if (sex === 'F' || sex === 'FEMALE') return female;
  return NOT_RECORDED;
}

function formatAnswer(answer: boolean | number | null | undefined, t: (key: string) => string): string {
  if (answer === null || answer === undefined) return t('followup.notSure');
  if (typeof answer === 'boolean') return answer ? t('review.rowAnswerYes') : t('review.rowAnswerNo');
  return `${answer}/5`;
}

function formatVitals(
  vitals: Record<string, number | string | null>,
  t: (key: string) => string,
): string {
  const parts: string[] = [];
  const add = (key: string, value: number | string | null | undefined, unit: string) => {
    if (value === null || value === undefined) return;
    parts.push(`${key}: ${value}${unit}`);
  };
  add('Temp', vitals.temperatureC, ' °C');
  add(
    'BP',
    vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic
      ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
      : null,
    ' mmHg',
  );
  add(t('nurse.details.pulse'), vitals.heartRate, ' bpm');
  add('SpO2', vitals.oxygenSaturation, '%');
  add(t('nurse.details.weight'), vitals.weightKg, ' kg');
  return parts.length ? parts.join(' · ') : t('nurse.details.noVitals');
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.infoRow}>
      {icon}
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

/**
 * Nurse "View details" -> Patient Details.
 *
 * Everything shown here is read from `GET /api/nurses/me/queue/<caseId>`.
 * Nothing is cached locally, duplicated into the queue, or invented: a field the
 * backend does not hold renders as "not recorded".
 */
export function NursePatientDetailsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const caseId = route.params.caseId;

  const [detail, setDetail] = useState<NursePatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const payload = await getNursePatientDetail(caseId);
      setDetail(payload);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patient = detail?.patient;
  const tests = detail?.tests ?? [];
  const vitals = detail?.vitals;
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader />
      <ScreenFade>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(); }}
            />
          }
        >
          <Button
            label={t('common.back')}
            variant="outline"
            onPress={() => navigation.goBack()}
            icon={<ChevronLeft size={20} color={colors.primary} strokeWidth={2.5} />}
            testID="patient-details-back"
          />

          <Text style={styles.title} testID="patient-details-title">
            {patient?.name ?? t('nurse.details.title')}
          </Text>
          {detail?.urgent ? (
            <View style={styles.urgentRow}>
              <AlertTriangle size={16} color={colors.danger} strokeWidth={2.5} />
              <Text style={styles.urgentText}>{t('nurse.details.urgent')}</Text>
            </View>
          ) : null}

          {failed ? <AlertBanner text={t('nurse.details.loadError')} variant="warning" /> : null}

          {/* PATIENT PROFILE */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('nurse.details.profile')}</Text>
            <InfoRow icon={<User size={16} color={colors.neutral.textMuted} />} label={t('review.name')} value={patient?.name ?? NOT_RECORDED} />
            <InfoRow label={t('review.age')} value={patient?.age != null ? String(patient.age) : NOT_RECORDED} />
            <InfoRow label={t('review.sex')} value={sexLabel(patient?.sex, t('details.male'), t('details.female'))} />
            <InfoRow icon={<Phone size={16} color={colors.neutral.textMuted} />} label={t('review.phone')} value={patient?.phone ?? NOT_RECORDED} />
            {/* Safe, non-reversible case reference for reading out at triage. */}
            <InfoRow label={t('nurse.details.reference')} value={detail?.caseReference ?? NOT_RECORDED} />
          </Card>
          {/* CURRENT CASE */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('nurse.details.currentCase')}</Text>
            <InfoRow label={t('nurse.details.complaint')} value={detail?.chiefComplaint ?? NOT_RECORDED} />

            <Text style={styles.subLabel}>{t('review.symptoms')}</Text>
            {(detail?.symptoms ?? []).length === 0 ? (
              <Text style={styles.empty}>{NOT_RECORDED}</Text>
            ) : (
              (detail?.symptoms ?? []).map((symptom, index) => (
                <View key={symptom.id ?? index} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>
                    {symptom.label ?? NOT_RECORDED}
                    {symptom.severity != null ? ` · ${t('nurse.details.severity')} ${symptom.severity}/5` : ''}
                    {symptom.durationDays != null ? ` · ${symptom.durationDays}d` : ''}
                  </Text>
                </View>
              ))
            )}

            <Text style={styles.subLabel}>{t('review.followUps')}</Text>
            {(detail?.followUpAnswers ?? []).length === 0 ? (
              <Text style={styles.empty}>{NOT_RECORDED}</Text>
            ) : (
              (detail?.followUpAnswers ?? []).map((answer, index) => (
                <View key={answer.questionId ?? index} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>
                    {answer.question ?? NOT_RECORDED} — {formatAnswer(answer.answer, t)}
                  </Text>
                </View>
              ))
            )}

            <Text style={styles.subLabel}>{t('nurse.details.vitals')}</Text>
            {!vitals ? (
              <Text style={styles.empty}>{t('nurse.details.noVitals')}</Text>
            ) : (
              <Text style={styles.body}>{formatVitals(vitals, t)}</Text>
            )}

            <View style={styles.statusRow}>
              <Badge
                label={detail?.status ?? t('nurse.details.notRecorded')}
                variant={detail?.urgent ? 'urgent' : 'medium'}
              />
            </View>
            <InfoRow label={t('nurse.details.arrivedAt')} value={formatDateTime(detail?.createdAt)} />
          </Card>

          {/* DOCTOR / WORKFLOW — only genuinely assigned values */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('nurse.details.workflow')}</Text>
            <InfoRow
              icon={<Stethoscope size={16} color={colors.neutral.textMuted} />}
              label={t('nurse.details.doctor')}
              value={detail?.assignedDoctor ?? t('nurse.details.unassigned')}
            />
            <InfoRow label={t('nurse.details.nurse')} value={detail?.assignedNurse ?? t('nurse.details.unassigned')} />

            <Text style={styles.subLabel}>{t('nurse.details.tests')}</Text>
            {tests.length === 0 ? (
              <Text style={styles.empty}>{t('nurse.details.noTests')}</Text>
            ) : (
              tests.map((test) => (
                <View key={test.id} style={styles.testRow}>
                  <FlaskConical size={16} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.bulletText}>{test.testName ?? test.name ?? NOT_RECORDED}</Text>
                  <Badge label={test.status ?? t('nurse.details.notRecorded')} variant="medium" />
                </View>
              ))
            )}

            {/* OPTIONAL CASE CONTEXT — only when the patient actually shared it. */}
            {detail?.location ? (
              <>
                <Text style={styles.subLabel}>{t('nurse.details.location')}</Text>
                <View style={styles.testRow}>
                  <MapPin size={16} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.bulletText}>
                    {detail.location.latitude?.toFixed(4)}, {detail.location.longitude?.toFixed(4)}
                  </Text>
                </View>
              </>
            ) : null}
          </Card>
        </ScrollView>
      </ScreenFade>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20, gap: 12, paddingBottom: 40 },
    title: { ...fonts.h1, color: c.neutral.text, marginTop: 4 },
    card: { marginTop: 4 },
    sectionTitle: { ...fonts.bodyStrong, color: c.neutral.text, marginBottom: 10 },
    subLabel: { ...fonts.captionStrong, color: c.neutral.textMuted, marginTop: 14, marginBottom: 6 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    infoLabel: { ...fonts.caption, color: c.neutral.textMuted, minWidth: 96 },
    infoValue: { ...fonts.body, color: c.neutral.text, flex: 1, textAlign: 'right' },
    bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    bullet: { ...fonts.body, color: c.primary, marginRight: 8 },
    bulletText: { ...fonts.body, color: c.neutral.text, flex: 1 },
    testRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    body: { ...fonts.body, color: c.neutral.text },
    empty: { ...fonts.body, color: c.neutral.textMuted },
    statusRow: { flexDirection: 'row', marginTop: 12, marginBottom: 10 },
    urgentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    urgentText: { ...fonts.bodyStrong, color: c.danger },
  });

export default NursePatientDetailsScreen;
