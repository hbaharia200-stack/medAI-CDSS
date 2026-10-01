import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, spacing } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { AppHeader } from '../../components/common/AppHeader';
import { useCaseStore } from '../../state/useCaseStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirmation'>;

export function ConfirmationScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const receipt = useCaseStore((s) => s.submittedReceipt);
  const connectivity = useCaseStore((s) => s.connectivity);

  const onContinueWithAgent = () => {
    navigation.navigate('MedAIAgent');
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <AppHeader />
      <View style={styles.center}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkEmoji}>✅</Text>
        </View>
        <Text style={styles.title}>{t('confirmation.title')}</Text>
        <Text style={styles.subtitle}>{t('confirmation.message')}</Text>

        {receipt ? (
          <Card style={styles.receipt}>
            <View>
              <Text style={styles.receiptLabel}>{t('confirmation.queueNumberLabel')}</Text>
              <Text style={styles.queueNumber} testID="confirmation-queue">
                {receipt.queueNumber}
              </Text>
            </View>
            <View style={styles.divider} />
            <View>
              <Text style={styles.receiptLabel}>{t('confirmation.estimatedWait')}</Text>
              <Text style={styles.wait}>
                {receipt.estimatedWaitMinutes} {t('confirmation.minutesShort')}
              </Text>
            </View>
          </Card>
        ) : null}

        <Text style={styles.note}>{t('confirmation.reviewingNote')}</Text>

        {connectivity === 'offline' ? (
          <View style={styles.queuedPill}>
            <Text style={styles.queuedText}>{t('offline.queued')}</Text>
          </View>
        ) : null}
      </View>

      <Button
        label={t('confirmation.continueWithAgent')}
        onPress={onContinueWithAgent}
        testID="confirmation-new"
      />
    </ScreenContainer>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { justifyContent: 'space-between' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    checkCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.confidenceHighBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    checkEmoji: { fontSize: 40 },
    title: { ...fonts.h1, textAlign: 'center', color: c.neutral.text },
    subtitle: { ...fonts.bodyLarge, color: c.neutral.textMuted, textAlign: 'center', marginTop: 6 },
    receipt: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.lg,
      alignSelf: 'stretch',
    },
    divider: { width: 1, height: 44, backgroundColor: c.neutral.border, marginHorizontal: spacing.lg },
    receiptLabel: { ...fonts.caption, fontSize: 13, color: c.neutral.textMuted },
    queueNumber: { ...fonts.h2, color: c.primary, marginTop: 2 },
    wait: { ...fonts.h2, marginTop: 2, color: c.neutral.text },
    note: {
      ...fonts.body,
      color: c.neutral.textMuted,
      textAlign: 'center',
      marginTop: spacing.lg,
      marginHorizontal: spacing.md,
    },
    queuedPill: {
      backgroundColor: c.warningBg,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 6,
      marginTop: spacing.md,
    },
    queuedText: { ...fonts.captionStrong, color: c.confidenceMedium },
  });

export default ConfirmationScreen;