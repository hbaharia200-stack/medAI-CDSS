import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  CircleUser,
  FileAudio,
  FileText,
  Globe,
  History,
  LogOut,
  Menu,
  Mic,
  Moon,
  Paperclip,
  Send,
  Settings,
  SquarePen,
  Sun,
  X,
} from 'lucide-react-native';
import { fonts, hitSlop, noOutline, radii, spacing, touchTarget } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble, type ChatMessage } from '../../components/patient/ChatBubble';
import { ScreenFade } from '../../components/common/ScreenFade';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { useCaseStore } from '../../state/useCaseStore';
import { fetchAgentHistory, sendAgentMessage, submitAgentFeedback, type StoredAgentMessage } from '../../services/api/agentService';
import { uploadAttachment } from '../../services/api/profileService';
import {
  isVoiceSupported,
  VoiceRecorder,
  VoiceCaptureError,
  type RecordedClip,
} from '../../services/voice/voiceRecorder';
import { useGlowAnimation } from '../../hooks/useGlowAnimation';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'MedAIAgent'>;

let agentMsgCounter = 0;
const nextAgentId = () => `agent-${++agentMsgCounter}-${Date.now()}`;

type SidebarView = 'chat' | 'settings' | 'history' | 'account';

/** A file the patient picked, not yet uploaded. */
type PendingAttachment = {
  localId: string;
  uri: string;
  name: string;
  type: string;
  sizeBytes: number;
  isAudio: boolean;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MedAIAgentScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, scheme, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const submittedReceipt = useCaseStore((s) => s.submittedReceipt);
  const user = useCaseStore((s) => s.user);
  const isAuth = useCaseStore((s) => s.isAuthenticated);
  const setLanguage = useCaseStore((s) => s.setLanguage);
  const language = useCaseStore((s) => s.language);
  const logout = useCaseStore((s) => s.logout);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextAgentId(), role: 'assistant', text: t('agent.comingSoon') },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>('chat');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const recordTick = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Guards against a double-tap submitting the same rating twice. */
  const ratedRef = useRef(false);

  const SIDEBAR_WIDTH = 264;
  const sidebarAnim = useRef(new Animated.Value(0)).current;

  /** The case this conversation belongs to, when one has been submitted. */
  const caseId = submittedReceipt?.caseId ?? null;

  // The transcript belongs to the signed-in patient and lives in the database.
  // Loading it here is what makes history survive refresh and sign-out/in.
  useEffect(() => {
    let cancelled = false;
    if (!isAuth) return undefined;
    void (async () => {
      try {
        const rows: StoredAgentMessage[] = await fetchAgentHistory();
        if (cancelled || rows.length === 0) return;
        setMessages(
          rows.map((m) => ({
            id: m.id,
            role: m.role === 'patient' ? 'user' : 'assistant',
            text: m.text ?? '',
            meta: m.attachment
              ? `${m.attachment.filename} · ${formatBytes(m.attachment.sizeBytes)}`
              : undefined,
          })),
        );
      } catch {
        // Offline or unauthenticated: keep the local greeting rather than
        // showing an error the patient cannot act on.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuth]);

  // Always release the microphone when leaving the screen.
  useEffect(
    () => () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
      if (recordTick.current) clearInterval(recordTick.current);
    },
    [],
  );

  // Drive the overlay animation whenever sidebarOpen changes.
  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: sidebarOpen ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen, sidebarAnim]);

  // Glow instances for top-bar icon buttons and menu toggle.
  const themeGlow = useGlowAnimation();
  const accountGlow = useGlowAnimation();
  const menuGlow = useGlowAnimation();

  const onSend = async () => {
    const text = input.trim();
    if ((!text && !pending) || typing || uploading) return;
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void (async () => {
        let attachmentId: string | null = null;
        try {
          // Upload first so the message can genuinely own the file. If the
          // upload fails the send is aborted rather than silently dropping it.
          if (pending) {
            setUploading(true);
            const uploaded = await uploadAttachment(
              { uri: pending.uri, name: pending.name, type: pending.type },
              caseId,
            );
            attachmentId = uploaded.id;
            setPending(null);
          }
          if (text) setInput('');

          // The patient's selected language travels with the request so the
          // backend can instruct the provider to answer in that language.
          // Front-end translation keys alone can never localize AI prose.
          const response = await sendAgentMessage(text, caseId, attachmentId, language);
          setMessages((prev) => [
            ...prev,
            ...(text
              ? [{ id: nextAgentId(), role: 'user' as const, text }]
              : []),
            {
              id: nextAgentId(),
              role: 'assistant' as const,
              text: response.reply,
              response: { ...response, onRate: (rating: number) => void onRate(rating) },
              meta: pending
                ? `${pending.name} · ${formatBytes(pending.sizeBytes)}`
                : undefined,
            },
          ]);
          setNotice(null);
        } catch (error) {
          const code = (error as { code?: string } | null)?.code;
          setNotice(
            code === 'network_unavailable'
              ? t('agent.offlineNotice')
              : t('agent.sendFailed'),
          );
        } finally {
          setUploading(false);
          setTyping(false);
        }
      })();
    }, 300);
  };

  /**
   * Record the patient's 1-5 service rating. This is a real POST to the real
   * endpoint; nothing is shown or stored locally if it fails, and the rating is
   * never sent again.
   */
  const onRate = async (rating: number) => {
    if (ratedRef.current) return;
    ratedRef.current = true;
    try {
      await submitAgentFeedback(rating, caseId, language);
    } catch {
      ratedRef.current = false; // let them try again if the network failed
    }
  };

  /**
   * Real microphone capture. The previous version typed a canned sentence into
   * the composer after 900ms; that was a demo stub and is gone. We now ask for
   * a real permission, record the microphone, and attach the real audio.
   */
  const onMicPress = async () => {
    if (typing || uploading) return;
    if (recorderRef.current?.isRecording) {
      const recorder = recorderRef.current;
      try {
        const clip: RecordedClip = await recorder.stop();
        recorderRef.current = null;
        setListening(false);
        if (recordTick.current) clearInterval(recordTick.current);
        recordTick.current = null;
        setRecordingSeconds(0);
        setPending({
          localId: nextAgentId(),
          uri: clip.uri,
          name: clip.name,
          type: clip.type,
          sizeBytes: clip.sizeBytes,
          isAudio: true,
        });
        setNotice(t('agent.voiceAttached'));
      } catch {
        setNotice(t('agent.voiceFailed'));
      }
      return;
    }

    if (!isVoiceSupported()) {
      setNotice(t('agent.voiceUnsupported'));
      return;
    }
    const recorder = new VoiceRecorder();
    try {
      await recorder.start();
      recorderRef.current = recorder;
      setListening(true);
      setRecordingSeconds(0);
      recordTick.current = setInterval(
        () => setRecordingSeconds((s) => s + 1),
        1000,
      );
    } catch (error) {
      const reason = error instanceof VoiceCaptureError ? error.reason : 'failed';
      setNotice(
        reason === 'denied'
          ? t('agent.voiceDenied')
          : reason === 'unsupported'
            ? t('agent.voiceUnsupported')
            : t('agent.voiceFailed'),
      );
      setListening(false);
    }
  };

  /**
   * Real file attachment. Opens the system/browser picker via Expo Document
   * Picker (which supports web and native) and stages the real file. Nothing
   * is claimed to have been analysed — only uploaded.
   */
  const onAttachPress = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      const size = asset.size ?? 0;
      if (size > MAX_UPLOAD_BYTES) {
        setNotice(t('agent.fileTooLarge'));
        return;
      }
      setPending({
        localId: nextAgentId(),
        uri: asset.uri,
        name: asset.name ?? 'attachment',
        type: asset.mimeType ?? 'application/octet-stream',
        sizeBytes: size,
        isAudio: false,
      });
      setNotice(null);
    } catch {
      setNotice(t('agent.filePickFailed'));
    }
  };

  const onRemoveAttachment = () => setPending(null);

  const onSignOut = () => {
    setSidebarOpen(false);
    // Clears the session only; the patient's server-side data is untouched.
    logout();
    navigation.navigate('Home');
  };


  const onNewChat = () => {
    // Clears only the composer and any staged attachment. The patient's
    // persisted transcript and profile are server-side state and are never
    // wiped here.
    setInput('');
    setPending(null);
    setNotice(null);
    setSidebarView('chat');
    setSidebarOpen(false);
  };

  const openAccount = () => {
    setSidebarOpen(false);
    navigation.navigate('MyAccount');
  };

  const hasText = input.trim().length > 0;
  const isDark = scheme === 'dark';

    const renderSidebarBody = () => {
    if (sidebarView === 'settings') {
      return (
        <View>
          <Pressable accessibilityRole="button" onPress={toggleTheme} style={styles.sidebarRow}>
            {isDark
              ? <Sun size={18} color={colors.neutral.textMuted} strokeWidth={1.75} />
              : <Moon size={18} color={colors.neutral.textMuted} strokeWidth={1.75} />}
            <Text style={styles.sidebarRowLabel}>
              {isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLanguage(language === 'en' ? 'sw' : 'en')}
            style={styles.sidebarRow}
          >
            <Globe size={18} color={colors.neutral.textMuted} strokeWidth={1.75} />
            <Text style={styles.sidebarRowLabel}>
              {language === 'en' ? 'SW' : 'EN'} · {t('account.language')}
            </Text>
          </Pressable>
          <Text style={styles.sidebarNote}>{t('agent.settingsNote')}</Text>
        </View>
      );
    }
    if (sidebarView === 'history') {
      // The transcript is server-side state for this signed-in patient.
      const turns = messages.filter((m) => m.role !== 'assistant' || m.text);
      return turns.length === 0 ? (
        <Text style={styles.sidebarNote}>{t('agent.historyEmpty')}</Text>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={styles.sidebarNote}>{t('agent.historyCount', { count: turns.length })}</Text>
          {turns.slice(-6).reverse().map((m) => (
            <View key={m.id} style={styles.historyItem}>
              <Text numberOfLines={2} style={styles.historyText}>
                {m.role === 'user' ? m.text : t('agent.modelUnavailableShort')}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    if (sidebarView === 'account') {
      return (
        <View style={{ gap: 6 }}>
          <Text style={styles.sidebarNote}>{t('agent.accountTitle')}</Text>
          <Text style={styles.historyText}>{user?.name ?? '—'}</Text>
          {user?.phone ? <Text style={styles.sidebarNote}>{user.phone}</Text> : null}
          {caseId ? (
            <Text style={styles.sidebarNote}>
              {t('account.caseReference')}: {caseId.slice(0, 8)}…
            </Text>
          ) : null}
        </View>
      );
    }
    return <Text style={styles.sidebarNote}>{t('agent.subtitle')}</Text>;
  };

  const topBar = (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
        hitSlop={hitSlop}
        onPress={toggleTheme}
        style={[styles.topIconBtn, themeGlow.glowAnimatedStyle]}
        onPressIn={themeGlow.onPressIn}
        onPressOut={themeGlow.onPressOut}
        onHoverIn={themeGlow.onHoverIn}
        onHoverOut={themeGlow.onHoverOut}
      >
        {isDark
          ? <Sun size={20} color={colors.neutral.text} strokeWidth={1.75} />
          : <Moon size={20} color={colors.neutral.text} strokeWidth={1.75} />}
      </Pressable>
      <Text style={styles.wordmark}>
        <Text style={{ color: colors.neutral.text }}>Med</Text>
        <Text style={{ color: colors.primary }}>AI</Text>
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('agent.account')}
        hitSlop={hitSlop}
        onPress={() => {
          if (isAuth) openAccount();
          else navigation.navigate('SignUp');
        }}
        style={[styles.topIconBtn, accountGlow.glowAnimatedStyle]}
        onPressIn={accountGlow.onPressIn}
        onPressOut={accountGlow.onPressOut}
        onHoverIn={accountGlow.onHoverIn}
        onHoverOut={accountGlow.onHoverOut}
        testID="agent-account-link"
      >
        <CircleUser size={20} color={colors.neutral.text} strokeWidth={1.75} />
      </Pressable>
    </View>
  );

  const menuBar = (
    <View style={styles.menuRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sidebarOpen ? t('agent.closeSidebar') : t('agent.openSidebar')}
        hitSlop={hitSlop}
        onPress={() => setSidebarOpen((v) => !v)}
        testID="agent-menu-toggle"
        style={[styles.topIconBtn, menuGlow.glowAnimatedStyle]}
        onPressIn={menuGlow.onPressIn}
        onPressOut={menuGlow.onPressOut}
        onHoverIn={menuGlow.onHoverIn}
        onHoverOut={menuGlow.onHoverOut}
      >
        <Menu size={20} color={colors.neutral.text} strokeWidth={1.75} />
      </Pressable>
        <Text style={styles.menuTitle}>{t('agent.title')}</Text>
      <View style={styles.menuSpacer} />
    </View>
  );

  return (
    <ScreenFade style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {topBar}
          {menuBar}
          <AgentBody
            sidebarOpen={sidebarOpen}
            sidebarAnim={sidebarAnim}
            sidebarWidth={SIDEBAR_WIDTH}
            sidebarView={sidebarView}
            onSelectView={setSidebarView}
            onNewChat={onNewChat}
            onOpenAccount={openAccount}
            onSignOut={onSignOut}
            sidebarBody={renderSidebarBody()}
            messages={messages}
            typing={typing}
            typingText={t('agent.typing')}
            input={input}
            onChangeInput={setInput}
            placeholder={t('agent.placeholder')}
            sendLabel={t('agent.send')}
            voiceLabel={listening
              ? t('agent.recording', { seconds: recordingSeconds })
              : t('agent.startRecording')}
            hasText={hasText || !!pending}
            typingBusy={typing || uploading}
            listening={listening}
            notice={notice}
            pendingAttachment={pending}
            onRemoveAttachment={onRemoveAttachment}
            onSend={onSend}
            onMic={onMicPress}
            onAttach={onAttachPress}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenFade>
  );
}

export default MedAIAgentScreen;

function AgentBody(props: {
  sidebarOpen: boolean;
  sidebarAnim: Animated.Value;
  sidebarWidth: number;
  sidebarView: SidebarView;
  onSelectView: (v: SidebarView) => void;
  onNewChat: () => void;
  onOpenAccount: () => void;
  onSignOut: () => void;
  sidebarBody: React.ReactNode;
  messages: ChatMessage[];
  typing: boolean;
  typingText: string;
  input: string;
  onChangeInput: (v: string) => void;
  placeholder: string;
  sendLabel: string;
  voiceLabel: string;
  hasText: boolean;
  typingBusy: boolean;
  listening: boolean;
  notice: string | null;
  pendingAttachment: PendingAttachment | null;
  onRemoveAttachment: () => void;
  onSend: () => void;
  onMic: () => void;
  onAttach: () => void;
  onCloseSidebar: () => void;
}) {
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // One glow instance per sidebar row (all rows always mounted — safe hooks).
  const newGlow = useGlowAnimation();
  const settingsGlow = useGlowAnimation();
  const historyGlow = useGlowAnimation();
  const accountGlow = useGlowAnimation();

  const sidebarTranslateX = props.sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-props.sidebarWidth, 0],
  });

  return (
    <View style={styles.body}>
      {/* Always-full-width chat pane — never squeezed by the sidebar. */}
            <View style={styles.chatPane}>
        <FlatList
          data={props.messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={styles.chatContent}
        />
        {props.typing ? (
          <ChatBubble message={{ id: 'agent-typing', role: 'assistant', text: props.typingText }} />
        ) : null}
        {props.notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{props.notice}</Text>
          </View>
        ) : null}

        {/* Staged file/voice attachment — removable before sending. */}
        {props.pendingAttachment ? (
          <View style={styles.attachChip} testID="agent-attachment-chip">
            {props.pendingAttachment.isAudio ? (
              <FileAudio size={16} color={colors.primary} strokeWidth={1.75} />
            ) : (
              <FileText size={16} color={colors.primary} strokeWidth={1.75} />
            )}
            <View style={styles.attachMeta}>
              <Text numberOfLines={1} style={styles.attachName}>
                {props.pendingAttachment.name}
              </Text>
              <Text style={styles.attachSub}>
                {props.pendingAttachment.type || 'file'} ·{' '}
                {formatBytes(props.pendingAttachment.sizeBytes)}
              </Text>
            </View>
            <Pressable
              onPress={props.onRemoveAttachment}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('agent.removeAttachment')}
              testID="agent-attachment-remove"
            >
              <X size={16} color={colors.neutral.textMuted} strokeWidth={1.75} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composerBar}>
          <Pressable
            onPress={props.onAttach}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('agent.attachFile')}
            style={styles.iconBtn}
            testID="agent-attach"
          >
            <Paperclip size={20} color={colors.neutral.textMuted} strokeWidth={1.75} />
          </Pressable>
          <TextInput
            value={props.input}
            onChangeText={props.onChangeInput}
            placeholder={props.placeholder}
            placeholderTextColor={colors.neutral.textMuted}
            style={[styles.input, noOutline]}
            multiline
            keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
            accessibilityLabel={props.placeholder}
            testID="agent-input"
          />
          <Pressable
            onPress={props.hasText ? props.onSend : props.onMic}
            disabled={props.typingBusy}
            accessibilityRole="button"
            accessibilityLabel={props.hasText ? props.sendLabel : props.voiceLabel}
            style={[styles.iconBtn, props.hasText && styles.sendActive]}
            testID={props.hasText ? 'agent-send' : 'agent-mic'}
          >
            {props.hasText ? (
              <Send size={20} color={colors.neutral.textOnPrimary} strokeWidth={1.75} />
            ) : (
              <Mic
                size={20}
                color={props.listening ? colors.primary : colors.neutral.textMuted}
                strokeWidth={1.75}
              />
            )}
          </Pressable>
        </View>
        {props.listening ? (
          <Text style={styles.recordingHint} testID="agent-recording-hint">
            {props.voiceLabel}
          </Text>
        ) : null}
      </View>

      {/* Dimming backdrop — taps close the sidebar. */}
      <Animated.View
        pointerEvents={props.sidebarOpen ? 'auto' : 'none'}
        style={[styles.backdropPress, { opacity: props.sidebarAnim }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('agent.closeSidebar')}
          accessibilityHint={t('agent.closeSidebar')}
          onPress={props.onCloseSidebar}
          style={styles.backdropFill}
        />
      </Animated.View>

      {/* Sliding sidebar overlay. */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            width: props.sidebarWidth,
            transform: [{ translateX: sidebarTranslateX }],
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('agent.newChat')}
          onPress={props.onNewChat}
          style={[styles.sidebarRow, newGlow.glowAnimatedStyle]}
          onPressIn={newGlow.onPressIn}
          onPressOut={newGlow.onPressOut}
          onHoverIn={newGlow.onHoverIn}
          onHoverOut={newGlow.onHoverOut}
          testID="agent-new-chat"
        >
          <SquarePen size={18} color={colors.neutral.textMuted} strokeWidth={1.75} />
          <Text style={styles.sidebarRowLabel}>{t('agent.newChat')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('agent.settings')}
          onPress={() => props.onSelectView('settings')}
          testID="agent-sidebar-settings"
          style={[styles.sidebarRow, settingsGlow.glowAnimatedStyle]}
          onPressIn={settingsGlow.onPressIn}
          onPressOut={settingsGlow.onPressOut}
          onHoverIn={settingsGlow.onHoverIn}
          onHoverOut={settingsGlow.onHoverOut}
        >
          <Settings size={18} color={colors.neutral.textMuted} strokeWidth={1.75} />
          <Text style={styles.sidebarRowLabel}>{t('agent.settings')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('agent.chatHistory')}
          onPress={() => props.onSelectView('history')}
          testID="agent-sidebar-history"
          style={[styles.sidebarRow, historyGlow.glowAnimatedStyle]}
          onPressIn={historyGlow.onPressIn}
          onPressOut={historyGlow.onPressOut}
          onHoverIn={historyGlow.onHoverIn}
          onHoverOut={historyGlow.onHoverOut}
        >
          <History size={18} color={colors.neutral.textMuted} strokeWidth={1.75} />
          <Text style={styles.sidebarRowLabel}>{t('agent.chatHistory')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('agent.account')}
          onPress={() => props.onSelectView('account')}
          testID="agent-sidebar-account"
          style={[styles.sidebarRow, accountGlow.glowAnimatedStyle]}
          onPressIn={accountGlow.onPressIn}
          onPressOut={accountGlow.onPressOut}
          onHoverIn={accountGlow.onHoverIn}
          onHoverOut={accountGlow.onHoverOut}
        >
          <CircleUser size={18} color={colors.neutral.textMuted} strokeWidth={1.75} />
          <Text style={styles.sidebarRowLabel}>{t('agent.account')}</Text>
        </Pressable>
        <View style={styles.sidebarDivider} />
        {props.sidebarBody}
        {props.sidebarView === 'account' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('agent.account')}
            onPress={props.onOpenAccount}
            style={styles.sidebarAccountBtn}
            testID="agent-open-account"
          >
            <Text style={styles.sidebarAccountText}>{t('agent.account')}</Text>
          </Pressable>
        ) : null}
        {/* Sign Out lives at the end of the sidebar, where a session action
            belongs — it clears the JWTs and never deletes patient data. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('account.logout')}
          onPress={props.onSignOut}
          style={styles.sidebarRow}
          testID="agent-sign-out"
        >
          <LogOut size={18} color={colors.danger} strokeWidth={1.75} />
          <Text style={[styles.sidebarRowLabel, { color: colors.danger }]}>
            {t('account.logout')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    flex: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
        topIconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 0,
    },
    topIcon: { fontSize: 20 },
    wordmark: { ...fonts.h2, fontSize: 22, color: c.neutral.text },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 8,
      gap: 12,
    },
    menuTitle: { ...fonts.bodyStrong, color: c.neutral.text },
    menuSpacer: { width: 44 },
        body: { flex: 1 },
    backdropPress: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
      zIndex: 1,
    },
    backdropFill: { flex: 1 },
    sidebar: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      backgroundColor: c.neutral.surface,
      padding: 12,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      zIndex: 2,
    },
        sidebarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: touchTarget,
      paddingHorizontal: 8,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.surface,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 0,
    },
    sidebarRowIcon: { fontSize: 18 },
    sidebarRowLabel: { ...fonts.body, color: c.neutral.text },
    sidebarDivider: { height: 1, backgroundColor: c.neutral.border, marginVertical: 8 },
    sidebarNote: { ...fonts.body, color: c.neutral.textMuted, marginTop: 8 },
    historyItem: {
      padding: 8,
      borderRadius: radii.md,
      backgroundColor: c.neutral.background,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    historyText: { ...fonts.caption, color: c.neutral.text },
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
    recordingHint: { ...fonts.caption, color: c.primary, textAlign: 'center', marginTop: 4 },
    attachChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
      marginBottom: 6,
    },
    attachMeta: { flex: 1 },
    attachName: { ...fonts.captionStrong, color: c.neutral.text },
    attachSub: { ...fonts.caption, color: c.neutral.textMuted, fontSize: 11 },
    sentTests: { marginTop: 12, gap: 8 },
    sentTestCard: { padding: 12, gap: 4 },
    sentTestName: { ...fonts.body, color: c.neutral.text },
    sidebarAccountBtn: {
      marginTop: 12,
      borderWidth: 1.5,
      borderColor: c.primary,
      borderRadius: radii.pill,
      paddingVertical: 10,
      alignItems: 'center',
    },
    sidebarAccountText: { ...fonts.bodyStrong, color: c.primary },
    chatPane: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },
    chatContent: { paddingVertical: 8 },
    composerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.neutral.surface,
      borderWidth: 1,
      borderColor: c.neutral.border,
      borderRadius: radii.pill,
      paddingHorizontal: 4,
      paddingVertical: 4,
      marginTop: 8,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    sendActive: { backgroundColor: c.primary },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: 8,
      paddingVertical: 10,
      fontSize: 17,
      color: c.neutral.text,
    },
    accountHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 12,
    },
    accountTitle: { ...fonts.h2, color: c.neutral.text },
    accountBody: { padding: spacing.md, paddingBottom: 32 },
  });
