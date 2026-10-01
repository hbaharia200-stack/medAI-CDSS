import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { useCaseStore } from '../../state/useCaseStore';

export type IntakeSummaryEditTarget = 'BasicDetails' | 'SymptomChat' | 'FollowUpQuestions';

interface IntakeSummaryCardsProps {
  onEdit: (target: IntakeSummaryEditTarget) => void;
}

/**
 * Shared three-card intake summary (Name/Age/Sex/Phone, Symptoms,
 * Additional answers). Rendered by ReviewConfirmScreen and MedAIAgentScreen
 * from the same useCaseStore source so both stay in sync.
 */
export function IntakeSummaryCards({ onEdit }: IntakeSummaryCardsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const draft = useCaseStore((s) => s.draft);
  const symptoms = useCaseStore((s) => s.symptoms);
  const followUpAnswers = useCaseStore((s) => s.followUpAnswers);

  const answerLabel = (answer: boolean | number | null) => {
    if (answer === null) return t('followup.notSure');
    if (typeof answer === 'boolean') return answer ? t('review.rowAnswerYes') : t('review.rowAnswerNo');
    return `${answer}/5`;
  };

  const sexLabel =
    draft.sex === 'M' ? `♂ ${t('details.male')}` : draft.sex === 'F' ? `♀ ${t('details.female')}` : '—';

  const detailRows: Array<{ label: string; value: string }> = [
    { label: t('review.name'), value: draft.name },
    { label: t('review.age'), value: draft.age },
    { label: t('review.sex'), value: sexLabel },
    { label: t('review.phone'), value: draft.phone },
  ];

  return (
    <View>
      <Card hoverGlow>
        <Text style={styles.sectionTitle}>{t('review.name')}</Text>
        {detailRows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
        <View style={styles.spacer} />
        <Button
          label={t('review.edit')}
          variant="outline"
          onPress={() => onEdit('BasicDetails')}
          testID="summary-edit-details"
        />
      </Card>

      <Card hoverGlow style={styles.card}>
        <Text style={styles.sectionTitle}>{t('review.symptoms')}</Text>
        {symptoms.length === 0 ? (
          <Text style={styles.empty}>{t('symptom.emptyWarning')}</Text>
        ) : (
          symptoms.map((s) => (
            <View key={s.id} style={styles.symptomRow}>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.rowValue}>{s.label}</Text>
            </View>
          ))
        )}
        <View style={styles.spacer} />
        <Button
          label={t('review.edit')}
          variant="outline"
          onPress={() => onEdit('SymptomChat')}
          testID="summary-edit-symptoms"
        />
      </Card>

      <Card hoverGlow style={styles.card}>
        <Text style={styles.sectionTitle}>{t('review.followUps')}</Text>
        {followUpAnswers.length === 0 ? (
          <Text style={styles.empty}>{t('followup.notSure')}</Text>
        ) : (
          followUpAnswers.map((a) => (
            <View key={a.questionId} style={styles.symptomRow}>
              <Text style={[styles.rowValue, styles.flexText]}>{a.question}</Text>
              <Text style={styles.rowAnswer}>{answerLabel(a.answer)}</Text>
            </View>
          ))
        )}
        <View style={styles.spacer} />
        <Button
          label={t('review.edit')}
          variant="outline"
          onPress={() => onEdit('FollowUpQuestions')}
          testID="summary-edit-answers"
        />
      </Card>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: { marginTop: 12 },
    sectionTitle: { ...fonts.bodyStrong, marginBottom: 10, color: c.neutral.text },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    rowLabel: { ...fonts.caption, fontSize: 13, color: c.neutral.textMuted },
    rowValue: { ...fonts.body, color: c.neutral.text },
    rowAnswer: { ...fonts.bodyStrong, color: c.primaryDark },
    symptomRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    flexText: { flex: 1, marginRight: 8 },
    dot: { ...fonts.body, color: c.primary, marginRight: 8 },
    empty: { ...fonts.body, color: c.neutral.textMuted },
    spacer: { height: 12 },
  });

export default IntakeSummaryCards;
