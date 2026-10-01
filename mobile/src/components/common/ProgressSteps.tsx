import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, radii, spacing } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';

const STEPS = ['details', 'symptom', 'followup', 'review'] as const;

/** Horizontal progress indicator for the patient intake flow (one main task per screen). */
export function ProgressSteps({ current }: { current: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${t('common.continue')} ${current + 1}/${STEPS.length}`}
      style={styles.container}
    >
      {STEPS.map((_, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={index} style={styles.item}>
            <View
              style={[
                styles.circle,
                done && styles.circleDone,
                active && styles.circleActive,
              ]}
            >
              <Text
                style={[
                  styles.circleText,
                  (done || active) && styles.circleTextActive,
                ]}
              >
                {done ? '✓' : index + 1}
              </Text>
            </View>
            {index < STEPS.length - 1 ? (
              <View style={[styles.line, done && styles.lineDone]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    circle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleDone: { backgroundColor: c.confidenceHigh, borderColor: c.confidenceHigh },
    circleActive: { backgroundColor: c.primary, borderColor: c.primary },
    circleText: { ...fonts.captionStrong, color: c.neutral.textMuted },
    circleTextActive: { color: c.neutral.textOnPrimary },
    line: {
      flex: 1,
      minWidth: 18,
      height: 2,
      backgroundColor: c.neutral.border,
      marginHorizontal: 4,
    },
    lineDone: { backgroundColor: c.confidenceHigh },
  });

export default ProgressSteps;