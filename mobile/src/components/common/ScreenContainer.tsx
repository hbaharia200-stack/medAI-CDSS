import React, { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { ScreenFade } from './ScreenFade';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/**
 * Shared screen shell: safe area + soft background + optional scroll and the
 * persistent offline status pill. Never blocks on connectivity errors.
 */
export function ScreenContainer({
  children,
  scroll = true,
  style,
  contentStyle,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

    const body = (
    <ScreenFade>
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </ScreenFade>
  );

  return (
    <SafeAreaView style={[styles.safe, style]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    flex: { flex: 1 },
    scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 32 },
    content: { flexGrow: 1 },
  });

export default ScreenContainer;