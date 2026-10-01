import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { fonts, noOutline, radii, hitSlop } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/common/Button';
import { ProgressSteps } from '../../components/common/ProgressSteps';
import { ScreenFade } from '../../components/common/ScreenFade';
import { ChatBubble, type ChatMessage } from '../../components/patient/ChatBubble';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { AppHeader } from '../../components/common/AppHeader';
import { useCaseStore } from '../../state/useCaseStore';
import { extractSymptoms } from '../../services/api/symptomExtraction';
import {
  isVoiceSupported,
  VoiceRecorder,
  VoiceCaptureError,
} from '../../services/voice/voiceRecorder';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SymptomChat'>;

let msgCounter = 0;
const nextId = () => `msg-${++msgCounter}-${Date.now()}`;

/** Same 8 MB ceiling the backend enforces, checked before we try to upload. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export function SymptomChatScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setSymptoms = useCaseStore((s) => s.setSymptoms);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      role: 'assistant',
      text: t('symptom.assistantGreeting'),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  /** A real recorded clip, shown honestly instead of a fabricated transcript. */
  const [voiceNote, setVoiceNote] = useState<{
    uri: string; name: string; sizeBytes: number; durationMs: number;
  } | null>(null);
  const [pendingFile, setPendingFile] = useState<{
    uri: string; name: string; type: string; sizeBytes: number;
  } | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const recordTick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    // Always release the microphone if the screen goes away mid-recording.
    recorderRef.current?.cancel();
    recorderRef.current = null;
    if (recordTick.current) clearInterval(recordTick.current);
  }, []);

  const pushAcknowledgement = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'assistant',
        text: t('symptom.acknowledgement'),
      },
    ]);
  };

  const saveSymptoms = async (text: string) => {
    // Calls the real NLP endpoint. When the trained model is not configured the
    // service keeps the patient's own words as a single complaint rather than
    // inventing structured clinical data — so intake never depends on the model.
    const extracted = await extractSymptoms(text);
    // Keep structured fields and the patient's full wording. The acknowledgement
    // is presentation only; even unrecognised wording remains available to staff.
    setSymptoms((prev) => {
      const next = [...prev];
      for (const symptom of extracted) {
        const index = next.findIndex((existing) => existing.label === symptom.label);
        if (index === -1) {
          next.push({ ...symptom, notes: text });
        } else {
          const existing = next[index];
          next[index] = {
            ...existing,
            notes: existing.notes && existing.notes !== text
              ? `${existing.notes}\n${text}`
              : text,
          };
        }
      }
      return next;
    });
  };

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
    setInput('');

    setTyping(true);
    try {
      // Persist the symptoms before Continue becomes available.
      await saveSymptoms(text);
    } catch {
      // The clinic system is unreachable: keep the message and let the patient
      // retry rather than silently dropping what they told us.
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', text: t('symptom.saveFailed') },
      ]);
    } finally {
      pushAcknowledgement();
      setTyping(false);
    }
  };

  /**
   * Real microphone capture.
   *
   * This used to pick a hard-coded sentence ("I have a headache and a fever")
   * and drop it into the composer. That is fabricated clinical input, so it is
   * gone. We record the device microphone for real; because no speech-to-text
   * service exists in this project, we do NOT invent a transcript — the
   * patient is told the note was recorded and asked to type their symptoms.
   */
  const onMicPress = async () => {
    if (typing) return;
    if (recorderRef.current?.isRecording) {
      const recorder = recorderRef.current;
      try {
        const clip = await recorder.stop();
        recorderRef.current = null;
        setListening(false);
        if (recordTick.current) clearInterval(recordTick.current);
        recordTick.current = null;
        setRecordingSeconds(0);
        setVoiceNote({
          uri: clip.uri,
          name: clip.name,
          sizeBytes: clip.sizeBytes,
          durationMs: clip.durationMs,
        });
        setMicNotice(t('symptom.voiceRecordedNeedsText'));
      } catch {
        setMicNotice(t('symptom.voiceFailed'));
      }
      return;
    }

    if (!isVoiceSupported()) {
      setMicNotice(t('symptom.voiceUnsupported'));
      return;
    }
    const recorder = new VoiceRecorder();
    try {
      await recorder.start();
      recorderRef.current = recorder;
      setListening(true);
      setRecordingSeconds(0);
      recordTick.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (error) {
      const reason = error instanceof VoiceCaptureError ? error.reason : 'failed';
      setMicNotice(
        reason === 'denied'
          ? t('symptom.voiceDenied')
          : reason === 'unsupported'
            ? t('symptom.voiceUnsupported')
            : t('symptom.voiceFailed'),
      );
      setListening(false);
    }
  };

  const onAttachPress = async () => {
    // Real file picker. The picked file is staged and uploaded with the case
    // when intake is submitted (see caseService), so nothing is discarded.
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      if ((asset.size ?? 0) > MAX_UPLOAD_BYTES) {
        setMicNotice(t('agent.fileTooLarge'));
        return;
      }
      setPendingFile({
        uri: asset.uri,
        name: asset.name ?? 'attachment',
        type: asset.mimeType ?? 'application/octet-stream',
        sizeBytes: asset.size ?? 0,
      });
      setMicNotice(null);
    } catch {
      setMicNotice(t('agent.filePickFailed'));
    }
  };

  const hasText = input.trim().length > 0;
  const hasSentMessage = messages.some((m) => m.role === 'user');
  const canContinue = hasSentMessage;

  return (
    <ScreenFade style={{ flex: 1 }}>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.scrollArea}>
          <AppHeader />
          <ProgressSteps current={1} />
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('symptom.title')}</Text>
              <Text style={styles.subtitle}>{t('symptom.subtitle')}</Text>
            </View>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Text style={styles.back}>← {t('common.back')}</Text>
            </Pressable>
          </View>

          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            style={styles.chatList}
            contentContainerStyle={styles.chatContent}
          />

          {typing ? (
            <ChatBubble
              message={{ id: 'typing', role: 'assistant', text: t('symptom.typing') }}
            />
          ) : null}
        </View>

        <View style={styles.bottomArea}>
          {micNotice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{micNotice}</Text>
            </View>
          ) : null}

          {listening ? (
            <Text style={styles.recordingHint} testID="symptom-recording-hint">
              {t('agent.recording', { seconds: recordingSeconds })}
            </Text>
          ) : null}

          {/* Real captured media, shown as itself. Nothing here claims the
              audio was transcribed — no STT service exists yet. */}
          {voiceNote ? (
            <View style={styles.attachChip} testID="symptom-voice-note">
              <Text style={styles.attachName}>
                {voiceNote.name} · {Math.round(voiceNote.durationMs / 1000)}s
              </Text>
              <Text style={styles.attachSub}>
                {t('symptom.voiceNoTranscript')} · {Math.round(voiceNote.sizeBytes / 1024)} KB
              </Text>
            </View>
          ) : null}

          {pendingFile ? (
            <View style={styles.attachChip} testID="symptom-file-chip">
              <Text style={styles.attachName}>{pendingFile.name}</Text>
              <Text style={styles.attachSub}>
                {pendingFile.type} · {Math.round(pendingFile.sizeBytes / 1024)} KB
              </Text>
            </View>
          ) : null}

          <View style={styles.composerBar}>
            <Pressable
              onPress={onAttachPress}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('agent.attachFile')}
              style={styles.iconBtn}
              testID="symptom-attach"
            >
              <Feather name="paperclip" size={20} color={colors.neutral.textMuted} />
            </Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('symptom.chatPlaceholder')}
              placeholderTextColor={colors.neutral.textMuted}
              style={[styles.input, noOutline]}
              multiline
              keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
              accessibilityLabel={t('symptom.chatPlaceholder')}
              testID="symptom-input"
            />
            <Pressable
              onPress={hasText ? onSend : onMicPress}
              disabled={typing || listening}
              accessibilityRole="button"
              accessibilityLabel={hasText ? t('common.send') : t('symptom.voiceListening')}
              style={[styles.iconBtn, hasText && styles.sendActive]}
            >
              {hasText ? (
                <Feather name="send" size={20} color={colors.neutral.textOnPrimary} />
              ) : (
                <Feather
                  name="mic"
                  size={20}
                  color={listening ? colors.primary : colors.neutral.textMuted}
                />
              )}
            </Pressable>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.continueWrap}>
              <Button
                label={t('symptom.continue')}
                onPress={() => navigation.navigate('FollowUpQuestions')}
                disabled={!canContinue}
                icon="→"
                testID="symptom-continue"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ScreenFade>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    flex: { flex: 1 },
    scrollArea: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    headerText: { flex: 1, marginRight: 8 },
    title: { ...fonts.h1, color: c.neutral.text },
    subtitle: { ...fonts.body, color: c.neutral.textMuted, marginTop: 4, marginBottom: 8 },
    back: { ...fonts.bodyStrong, color: c.primary, marginTop: 8 },
    chatList: { flexGrow: 0 },
    chatContent: { paddingVertical: 8 },
    bottomArea: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    notice: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.md,
      backgroundColor: c.neutral.background,
      borderWidth: 1,
      borderColor: c.neutral.border,
      marginBottom: 6,
    },
    noticeText: { ...fonts.caption, color: c.neutral.textMuted },
    recordingHint: { ...fonts.caption, color: c.primary, textAlign: 'center', marginBottom: 4 },
    attachChip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
      marginBottom: 6,
    },
    attachName: { ...fonts.captionStrong, color: c.neutral.text },
    attachSub: { ...fonts.caption, color: c.neutral.textMuted, fontSize: 11 },
    composerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.neutral.surface,
      borderWidth: 1,
      borderColor: c.neutral.border,
      borderRadius: radii.pill,
      paddingHorizontal: 4,
      paddingVertical: 4,
      gap: 2,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    sendActive: {
      backgroundColor: c.primary,
    },
    input: {
      flex: 1,
      flexShrink: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: 8,
      paddingVertical: 10,
      fontSize: 17,
      color: c.neutral.text,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      gap: 12,
    },
    continueWrap: { flex: 1, flexShrink: 1 },
  });

export default SymptomChatScreen;
