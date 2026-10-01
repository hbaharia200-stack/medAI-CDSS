import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radii, touchTarget } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { ProgressSteps } from '../../components/common/ProgressSteps';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { AppHeader } from '../../components/common/AppHeader';
import { useCaseStore } from '../../state/useCaseStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'FollowUpQuestions'>;

export function FollowUpQuestionsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const questions = useCaseStore((s) => s.followUpQuestions);
  const answers = useCaseStore((s) => s.followUpAnswers);
  const addFollowUpAnswer = useCaseStore((s) => s.addFollowUpAnswer);
  const [index, setIndex] = useState(0);

  if (questions.length === 0) {
    return (
      <ScreenContainer>
        <Text style={fonts.h1}>{t('followup.title')}</Text>
        <Button label={t('common.continue')} onPress={() => navigation.navigate('ReviewConfirm')} />
      </ScreenContainer>
    );
  }

  const question = questions[index];
  const hasAnswer = answers.some((a) => a.questionId === question.id);

  const answer = (value: boolean | number | null) => {
    addFollowUpAnswer({
      questionId: question.id,
      question: t(question.question),
      answer: value,
    });
  };

  const advance = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      navigation.navigate('ReviewConfirm');
    }
  };

  const answered = (value: boolean | number | null) =>
    hasAnswer &&
    answers.find((a) => a.questionId === question.id)?.answer === value;

  return (
    <ScreenContainer>
      <AppHeader />
      <ProgressSteps current={2} />
      <Text style={styles.counter}>
        {index + 1} {t('followup.questionOf')} {questions.length}
      </Text>
      <View style={styles.dots} accessibilityRole="progressbar">
        {questions.map((q, i) => (
          <View
            key={q.id}
            style={[styles.dot, i <= index ? styles.dotDone : null, i === index && styles.dotActive]}
          />
        ))}
      </View>
      <Text style={styles.question}>{t(question.question)}</Text>

      {question.type === 'yesno' ? (
        <View style={styles.answers}>
          {[
            { label: t('followup.yes'), value: true },
            { label: t('followup.no'), value: false },
            { label: t('followup.notSure'), value: null },
          ].map((opt) => (
            <Button
              key={String(opt.label)}
              label={answered(opt.value) ? `✓ ${opt.label}` : opt.label}
              variant={answered(opt.value) ? 'primary' : 'outline'}
              onPress={() => {
                answer(opt.value);
                setTimeout(advance, 120);
              }}
              testID={`followup-${opt.value === null ? 'notsure' : opt.value ? 'yes' : 'no'}`}
            />
          ))}
        </View>
      ) : (
        <View style={styles.scaleWrap}>
          <View style={styles.scaleRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const isCurrent = answered(n);
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} — ${n <= 2 ? t('followup.scaleLow') : n >= 4 ? t('followup.scaleHigh') : ''}`}
                  onPress={() => {
                    answer(n);
                    setTimeout(advance, 120);
                  }}
                  style={[styles.scaleBtn, isCurrent && styles.scaleBtnActive]}
                >
                  <Text style={[styles.scaleNum, isCurrent && styles.scaleNumActive]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleEdge}>{t('followup.scaleLow')}</Text>
            <Text style={styles.scaleEdge}>{t('followup.scaleHigh')}</Text>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        {hasAnswer ? (
          <Button
            label={index + 1 < questions.length ? t('common.continue') : t('followup.done')}
            onPress={advance}
            icon="→"
          />
        ) : null}
        {index > 0 ? (
          <Button
            label={t('common.back')}
            variant="outline"
            onPress={() => setIndex(index - 1)}
          />
        ) : (
          <Button
            label={t('common.back')}
            variant="outline"
            onPress={() => navigation.goBack()}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    counter: { ...fonts.captionStrong, color: c.neutral.textMuted, marginTop: 12 },
    dots: { flexDirection: 'row', gap: 6, marginTop: 6 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.neutral.border,
    },
    dotDone: { backgroundColor: c.primary },
    dotActive: { backgroundColor: c.primary, width: 20 },
    question: { ...fonts.h1, marginTop: 8, marginBottom: 24, color: c.neutral.text },
    answers: { gap: 12 },
    scaleWrap: { marginTop: 8 },
    scaleRow: { flexDirection: 'row', gap: 8 },
    scaleBtn: {
      flex: 1,
      minHeight: touchTarget + 8,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scaleBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    scaleNum: { ...fonts.h2, color: c.neutral.textMuted },
    scaleNumActive: { color: c.neutral.textOnPrimary },
    scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    scaleEdge: { ...fonts.captionStrong, fontSize: 13, color: c.neutral.textMuted },
    footer: { marginTop: 32, gap: 10 },
  });

export default FollowUpQuestionsScreen;
