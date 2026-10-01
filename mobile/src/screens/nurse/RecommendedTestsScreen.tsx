import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fonts, hitSlop, radii } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { AppHeader } from '../../components/common/AppHeader';
import { ScreenFade } from '../../components/common/ScreenFade';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { useCaseStore } from '../../state/useCaseStore';
import { useGlowAnimation } from '../../hooks/useGlowAnimation';
import type { RecommendedTestItem, RecommendedTestStatus } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'RecommendedTests'>;

function statusKey(status: RecommendedTestStatus): string {
  switch (status) {
    case 'ordered':
      return 'nurse.recommendedTests.statusOrdered';
    case 'in_progress':
      return 'nurse.recommendedTests.statusInProgress';
    case 'completed':
      return 'nurse.recommendedTests.statusCompleted';
    default:
      return 'nurse.recommendedTests.statusRecommended';
  }
}

export function RecommendedTestsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const items = useCaseStore((s) => s.recommendedTests);
  const refreshRecommendedTests = useCaseStore((s) => s.refreshRecommendedTests);
  const sendTestToPatient = useCaseStore((s) => s.sendTestToPatient);
  const completeRecommendedTest = useCaseStore((s) => s.completeRecommendedTest);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState(false);
  const backGlow = useGlowAnimation();

  useEffect(() => {
    setLoading(true);
    void refreshRecommendedTests().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderRow = ({ item }: { item: RecommendedTestItem }) => {
    const isExpanded = expandedId === item.id;
    const isSending = sendingId === item.id;
    const isDone = item.status === 'completed';
    // Both actions persist through the backend and then re-read the list, so what
    // the nurse sees is always the status stored in the database.
    const runStatus = async (action: () => Promise<void>) => {
      setSendingId(item.id);
      setUpdateError(false);
      try {
        await action();
      } catch {
        setUpdateError(true);
      } finally {
        setSendingId(null);
      }
    };
    return (
      <Card
        onPress={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
        accessibilityHint={t('nurse.recommendedTests.sendToPatient')}
        style={styles.row}
      >
        <View style={styles.rowMain}>
          {/* Primary label is the real patient name resolved by the API. The
              case reference stays available as secondary metadata. */}
          <Text style={styles.patientName}>{item.patientName}</Text>
          <Text style={styles.caseRef}>
            {t('nurse.recommendedTests.caseRef')} {item.caseId.slice(0, 8)}
          </Text>
          <Text style={styles.testName}>{item.testName}</Text>
          <View style={styles.rowBottom}>
            <Badge
              label={`${t('nurse.recommendedTests.source')}: ${item.recommendationSource === 'ai' ? t('nurse.recommendedTests.fromAI') : t('nurse.recommendedTests.fromDoctor')}`}
              variant="info"
            />
            <Badge
              label={t(statusKey(item.status))}
              variant={item.status === 'completed' ? 'high' : item.status === 'in_progress' ? 'medium' : 'neutral'}
            />
          </View>
        </View>
        {isExpanded ? (
          <View style={styles.expanded}>
            {isDone ? (
              <Badge label={t('nurse.recommendedTests.sentBadge')} variant="high" icon="✓" />
            ) : (
              <View style={styles.actions}>
                <Button
                  label={t('nurse.recommendedTests.startTest')}
                  onPress={() => void runStatus(() => sendTestToPatient(item.id))}
                  loading={isSending}
                  disabled={isSending}
                  icon="🧪"
                  testID={`start-test-${item.id}`}
                />
                <Button
                  label={t('nurse.recommendedTests.completeTest')}
                  onPress={() => void runStatus(() => completeRecommendedTest(item.id))}
                  loading={isSending}
                  disabled={isSending}
                  variant="outline"
                  icon="✓"
                  testID={`complete-test-${item.id}`}
                />
              </View>
            )}
            {updateError ? (
              <Text style={styles.error}>{t('nurse.recommendedTests.statusUpdateFailed')}</Text>
            ) : null}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <ScreenFade>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader />
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[styles.back, backGlow.glowAnimatedStyle]}
            onPressIn={backGlow.onPressIn}
            onPressOut={backGlow.onPressOut}
            onHoverIn={backGlow.onHoverIn}
            onHoverOut={backGlow.onHoverOut}
          >
            <Text style={styles.backText}>← {t('common.back')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('nurse.recommendedTests.title')}</Text>
          <Text style={styles.subtitle}>{t('nurse.recommendedTests.subtitle')}</Text>
              </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {loading ? '…' : t('nurse.recommendedTests.empty')}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </ScreenFade>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    header: { paddingHorizontal: 20, paddingTop: 12, gap: 6 },
            back: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: c.neutral.border,
      paddingHorizontal: 10,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 0,
    },
    backText: { ...fonts.bodyStrong, color: c.primary },
    title: { ...fonts.h2, fontSize: 21, lineHeight: 28, color: c.neutral.text },
    subtitle: { ...fonts.body, color: c.neutral.textMuted, marginTop: 2 },
    listContent: { padding: 20, gap: 12 },
        row: { gap: 6 },
    rowMain: { flex: 1 },
    patientName: { ...fonts.h3, color: c.neutral.text },
    caseRef: { ...fonts.caption, color: c.neutral.textMuted, marginTop: 1 },
    testName: { ...fonts.body, color: c.neutral.text, marginTop: 2 },
        rowBottom: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    expanded: { marginTop: 12, alignItems: 'flex-start', gap: 8 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    error: { ...fonts.caption, color: c.danger, marginTop: 4 },
    empty: { paddingVertical: 48, alignItems: 'center' },
    emptyText: { ...fonts.body, color: c.neutral.textMuted },
    dot: { fontSize: 12 },
  });

export default RecommendedTestsScreen;