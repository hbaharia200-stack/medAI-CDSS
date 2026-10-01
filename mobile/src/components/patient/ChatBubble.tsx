import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radii } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import type {
  AgentCondition,
  AgentCostEstimate,
  AgentHospital,
} from '../../services/api/agentService';

/** The structured parts of one AI reply, as stored on a chat message. */
export interface AgentResponsePayload {
  possibleConditions?: AgentCondition[];
  costEstimate?: AgentCostEstimate;
  hospital?: AgentHospital;
  askFeedback?: boolean;
  disclaimer?: string;
  onRate?: (rating: number) => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  meta?: string;
  response?: AgentResponsePayload;
}

interface ChatBubbleProps {
  message: ChatMessage;
}

/**
 * Formats a whole number with thousands separators so a TZS estimate is
 * readable at a glance (e.g. 150000 -> "150,000").
 */
function formatAmount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUser = message.role === 'user';
  const response = message.response;
  const conditions = response?.possibleConditions ?? [];
  const cost = response?.costEstimate;
  const hospital = response?.hospital;

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.sender, !isUser && styles.senderAssistant]}>{isUser ? t('symptom.you') : 'MedAI'}</Text>
        <Text style={[styles.text, !isUser && styles.textAssistant]}>{message.text}</Text>

        {/* Possible conditions. Kept in its own dark/navy box so it does NOT
            read as part of the navy AI card. `displayName` is the localized,
            patient-facing label; `code` is never shown. */}
        {conditions.length > 0 ? (
          <View style={styles.conditionsBox}>
            <Text style={styles.conditionsTitle}>{t('agent.possibleConditions')}</Text>
            {conditions.map((condition, index) => (
              <View key={condition.code || `${condition.displayName}-${index}`} style={styles.conditionRow}>
                <Text style={styles.conditionName} numberOfLines={2}>
                  {condition.displayName || condition.name || ''}
                </Text>
                <Text style={styles.conditionPercent}>{condition.confidencePercent}%</Text>
              </View>
            ))}
            <Text style={styles.conditionsNote}>{t('agent.conditionsNote')}</Text>
          </View>
        ) : null}

        {/* Estimated cost — only ever present when real pricing is configured. */}
        {cost ? (
          <View style={styles.innerBox}>
            <Text style={styles.innerTitle}>{t('agent.estimatedCost')}</Text>
            <Text style={styles.innerLine}>
              {cost.currency} {formatAmount(cost.low)} – {formatAmount(cost.high)}
            </Text>
            <Text style={styles.innerNote}>{t('agent.costIsEstimate')}</Text>
          </View>
        ) : null}

        {/* Nearby facility + travel time — only when the location service
            resolved a real place and a real route. */}
        {hospital ? (
          <View style={styles.innerBox}>
            <Text style={styles.innerTitle}>{t('agent.nearestFacility')}</Text>
            <Text style={styles.innerLine}>{hospital.name}</Text>
            {hospital.distanceKm !== undefined ? (
              <Text style={styles.innerNote}>
                {t('agent.distanceAway', { km: hospital.distanceKm })}
              </Text>
            ) : null}
            {hospital.estimatedTravelMinutes !== undefined ? (
              <Text style={styles.innerNote}>
                {t('agent.travelTime', { minutes: hospital.estimatedTravelMinutes })}
              </Text>
            ) : null}
            {hospital.mapUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  void Linking.openURL(hospital.mapUrl as string);
                }}
                style={styles.mapLink}
              >
                <Text style={styles.mapLinkText}>{t('agent.openDirections')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {response?.disclaimer ? <Text style={styles.disclaimer}>{response.disclaimer}</Text> : null}

        {/* Service quality. Asked by the server at the end of the journey only,
            and recorded only when the patient actually taps a star. */}
        {response?.askFeedback ? (
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackQuestion}>{t('agent.feedbackQuestion')}</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={t('agent.feedbackRateLabel', { value })}
                  onPress={() => response.onRate?.(value)}
                  style={styles.star}
                  testID={`agent-rate-${value}`}
                >
                  <Text style={styles.starText}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {message.meta ? <Text style={styles.meta}>{message.meta}</Text> : null}
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { marginBottom: 10, flexDirection: 'row' },
    rowUser: { justifyContent: 'flex-end' },
    rowAssistant: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '88%',
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    // Patient bubbles stay blue.
    bubbleUser: {
      backgroundColor: c.primary,
      borderBottomRightRadius: radii.sm,
    },
    // AI bubbles use the MedAI hero/brand navy.
    bubbleAssistant: {
      backgroundColor: c.aiCard.background,
      borderColor: c.aiCard.border,
      borderWidth: 1,
      borderBottomLeftRadius: radii.sm,
    },
    sender: { ...fonts.captionStrong, fontSize: 12, color: c.neutral.textMuted, marginBottom: 4 },
    senderAssistant: { color: c.aiCard.accent },
    text: { ...fonts.body, color: c.neutral.textOnPrimary, fontSize: 16, lineHeight: 23 },
    textAssistant: { color: c.aiCard.text },
    meta: { ...fonts.caption, fontSize: 12, color: c.primaryDark, marginTop: 6 },

    // The conditions box deliberately keeps a dark/navy appearance rather than
    // inheriting the navy card, so it reads as "data" inside the reply.
    conditionsBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: radii.md,
      backgroundColor: c.neutral.background,
      borderWidth: 1,
      borderColor: c.neutral.border,
      gap: 6,
    },
    conditionsTitle: {
      ...fonts.captionStrong,
      color: c.neutral.text,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontSize: 11,
    },
    conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    conditionName: { ...fonts.body, color: c.neutral.text, flex: 1, fontSize: 15 },
    conditionPercent: { ...fonts.captionStrong, color: c.neutral.text, fontSize: 14 },
    conditionsNote: { ...fonts.caption, color: c.neutral.text, fontSize: 11, opacity: 0.75, marginTop: 2 },

    // Cost / hospital sections share the same inner-box treatment.
    innerBox: {
      marginTop: 10,
      padding: 12,
      borderRadius: radii.md,
      backgroundColor: c.neutral.background,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    innerTitle: { ...fonts.captionStrong, color: c.neutral.text, marginBottom: 4, fontSize: 15 },
    innerLine: { ...fonts.body, color: c.neutral.text, fontSize: 15 },
    innerNote: { ...fonts.caption, color: c.neutral.text, fontSize: 12, opacity: 0.8, marginTop: 2 },
    mapLink: { marginTop: 8, alignSelf: 'flex-start' },
    mapLinkText: { ...fonts.captionStrong, color: c.aiCard.text, textDecorationLine: 'underline' },

    disclaimer: {
      ...fonts.caption,
      color: c.aiCard.textMuted,
      fontSize: 12,
      marginTop: 10,
      lineHeight: 17,
    },

    feedbackBox: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.aiCard.border,
    },
    feedbackQuestion: { ...fonts.body, color: c.aiCard.text, fontSize: 14, marginBottom: 8 },
    starRow: { flexDirection: 'row', gap: 8 },
    star: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.aiCard.control,
      borderWidth: 1,
      borderColor: c.aiCard.border,
    },
    starText: { ...fonts.bodyStrong, color: c.aiCard.text, fontSize: 15 },
  });

export default ChatBubble;
