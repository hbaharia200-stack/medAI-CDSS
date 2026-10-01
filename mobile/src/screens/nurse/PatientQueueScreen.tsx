import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fonts, radii, hitSlop } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { AppHeader } from '../../components/common/AppHeader';
import { ScreenFade } from '../../components/common/ScreenFade';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { useCaseStore } from '../../state/useCaseStore';
import { useGlowAnimation } from '../../hooks/useGlowAnimation';
import type { QueueCase } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientQueue'>;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  return `${mins}m`;
}

export function PatientQueueScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queue = useCaseStore((s) => s.queue);
  const queueLastUpdated = useCaseStore((s) => s.queueLastUpdated);
  const refreshQueue = useCaseStore((s) => s.refreshQueue);
  const loadCachedQueue = useCaseStore((s) => s.loadCachedQueue);
  const selectedCaseId = useCaseStore((s) => s.selectedCaseId);
  const selectCase = useCaseStore((s) => s.selectCase);
  const refreshRecommendedTests = useCaseStore((s) => s.refreshRecommendedTests);
  const recommendedTests = useCaseStore((s) => s.recommendedTests);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const backGlow = useGlowAnimation();
  const recommendedBtnGlow = useGlowAnimation();

  // Only doctor-approved assignments contribute to the Recommended Tests badge.
  const pendingTestsCount = recommendedTests.filter((rt) => rt.status !== 'completed').length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError(false);
    const results = await Promise.allSettled([refreshQueue(), refreshRecommendedTests()]);
    setLoadError(results.some((result) => result.status === 'rejected'));
    setRefreshing(false);
  }, [refreshQueue, refreshRecommendedTests]);

  useEffect(() => {
    void loadCachedQueue().then(onRefresh);
  }, [loadCachedQueue, onRefresh]);

  // Urgent pinned to top, then by arrival time.
  const sorted = useMemo(
    () =>
      [...queue].sort((a, b) => {
        if (a.case.urgent !== b.case.urgent) return a.case.urgent ? -1 : 1;
        return (
          new Date(a.case.createdAt).getTime() - new Date(b.case.createdAt).getTime()
        );
      }),
    [queue],
  );

  const selectPatient = (row: QueueCase) => {
    selectCase(selectedCaseId === row.case.id ? null : row.case.id);
  };

  const renderRow = ({ item }: { item: QueueCase }) => (
    <Card
      onPress={() => selectPatient(item)}
      accessibilityHint={t('nurse.queue.viewDetails')}
      style={item.case.urgent ? styles.rowUrgent : undefined}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowIdentity}>
          <Text style={styles.name}>{item.case.patient.name}</Text>
          <Text selectable style={styles.meta}>#{item.case.id}</Text>
          <Text style={styles.meta}>
            {item.case.patient.age} · {item.case.patient.sex}
          </Text>
          <Text style={styles.meta}>
            {t('nurse.queue.arrived')} {timeAgo(item.case.createdAt)}
          </Text>
        </View>
        <View style={styles.rowRight}>
          {item.case.urgent ? (
            <Badge label={t('nurse.queue.urgentBadge')} variant="urgent" />
          ) : null}
        </View>
      </View>
      <Text style={styles.complaint}>{item.case.chiefComplaint}</Text>
      <View style={styles.caseStatus}>
        <Badge label={t(`nurse.queue.status.${item.case.status}`, { defaultValue: item.case.status.replaceAll('_', ' ') })} variant="info" />
      </View>
      {selectedCaseId === item.case.id ? (
        <Text style={styles.complaint}>{item.case.symptoms.map((symptom) => symptom.label).join(', ')}</Text>
      ) : null}
      {/* "View details" opens the dedicated Patient Details screen, which reads
          the real case from the backend. Previously this row was only a hint
          that expanded inline in the queue. */}
      <Pressable
        onPress={() => navigation.navigate('NursePatientDetails', { caseId: item.case.id })}
        accessibilityRole="button"
        accessibilityLabel={`${t('nurse.queue.viewDetails')}: ${item.case.patient.name}`}
        hitSlop={hitSlop}
        style={({ pressed }) => [styles.viewDetails, pressed && styles.viewDetailsPressed]}
        testID={`view-details-${item.case.id}`}
      >
        <Text style={styles.tapHint}>▶ {t('nurse.queue.viewDetails')}</Text>
      </Pressable>
    </Card>
  );

    return (
    <ScreenFade style={{ flex: 1 }}>
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
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={styles.title}
            >
              {t('nurse.queue.title')}
            </Text>
            <Text style={styles.subtitle}>{t('nurse.queue.subtitle')}</Text>
          </View>
          <View style={styles.headerActions}>
                        <Pressable
              onPress={() => navigation.navigate('RecommendedTests')}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('nurse.recommendedTests.navLabel')}
              style={[styles.recommendedBtn, recommendedBtnGlow.glowAnimatedStyle]}
              onPressIn={recommendedBtnGlow.onPressIn}
              onPressOut={recommendedBtnGlow.onPressOut}
              onHoverIn={recommendedBtnGlow.onHoverIn}
              onHoverOut={recommendedBtnGlow.onHoverOut}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={styles.recommendedBtnText}
              >
                {t('nurse.recommendedTests.navLabel')}
              </Text>
              {pendingTestsCount > 0 ? (
                <Text style={styles.recommendedBadge}>{pendingTestsCount}</Text>
              ) : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.lastUpdated}>
            {queueLastUpdated
              ? `${t('nurse.queue.lastUpdated')} ${timeAgo(queueLastUpdated)}`
              : ''}
          </Text>
        </View>
      </View>

      <Text style={styles.assignmentNote}>{t('nurse.queue.assignmentNote')}</Text>
      {loadError ? <Text accessibilityRole="alert" style={styles.errorText}>{t('nurse.queue.loadError')}</Text> : null}
      <FlatList
        data={sorted}
        keyExtractor={(q) => q.case.id}
        renderItem={renderRow}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('nurse.queue.empty')}</Text>
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
    header: { paddingHorizontal: 20, paddingTop: 12 },
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'nowrap',
    },
    headerText: { flex: 1, flexShrink: 1, marginRight: 8, minWidth: 0 },
    title: { ...fonts.h2, fontSize: 20, lineHeight: 28, color: c.neutral.text },
    subtitle: { ...fonts.body, color: c.neutral.textMuted, marginTop: 4 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
        recommendedBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.surface,
      paddingHorizontal: 8,
      paddingVertical: 10,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 0,
    },
    recommendedBtnText: { ...fonts.captionStrong, color: c.primary, fontSize: 12, flexShrink: 1 },
    recommendedBadge: {
      minWidth: 22,
      height: 22,
      lineHeight: 22,
      borderRadius: 11,
      paddingHorizontal: 5,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '800',
      color: c.neutral.textOnPrimary,
      backgroundColor: c.primary,
      overflow: 'hidden',
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    lastUpdated: {
      ...fonts.caption,
      fontSize: 12,
      color: c.neutral.textMuted,
      flex: 1,
    },
    listContent: { padding: 20, gap: 12 },
    rowUrgent: {
      borderLeftWidth: 4,
      borderLeftColor: c.danger,
      backgroundColor: c.dangerBg,
    },
    rowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    rowIdentity: { flex: 1 },
    name: { ...fonts.h3, color: c.neutral.text },
    meta: { ...fonts.caption, fontSize: 13, color: c.neutral.textMuted, marginTop: 2 },
    rowRight: { alignItems: 'center', gap: 6 },
    caseStatus: { marginTop: 8 },
    assignmentNote: { ...fonts.caption, paddingHorizontal: 20, marginTop: 12, color: c.neutral.textMuted },
    errorText: { ...fonts.body, paddingHorizontal: 20, marginTop: 12, color: c.danger },
    complaint: { ...fonts.body, marginTop: 8, color: c.neutral.text },
    viewDetails: {
      alignSelf: 'flex-start',
      minHeight: 36,
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 4,
      marginTop: 4,
    },
    viewDetailsPressed: { opacity: 0.7 },
    tapHint: { ...fonts.captionStrong, color: c.primary, marginTop: 10 },
    empty: { paddingVertical: 48, alignItems: 'center' },
    emptyText: { ...fonts.body, color: c.neutral.textMuted },
  });

export default PatientQueueScreen;
