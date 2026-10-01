import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { fonts, noOutline, radii } from '../../theme/tokens';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';

interface FloatingLabelInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'number-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'name' | 'tel' | 'email' | 'off' | 'password' | 'username' | 'cc-number';
  maxLength?: number;
  error?: string | null;
  testID?: string;
  accessibilityLabel?: string;
}

export function FloatingLabelInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry,
  autoCapitalize,
  autoComplete,
  maxLength,
  error,
  testID,
  accessibilityLabel,
}: FloatingLabelInputProps) {
  const { t } = useTranslation();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const floatAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;
  const prevError = useRef<string | null>(null);

  const floated = focused || value.length > 0;

  useEffect(() => {
    Animated.timing(floatAnim, {
      toValue: floated ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [floated, floatAnim]);

  useEffect(() => {
    const target = error ? 2 : focused || hovered ? 1 : 0;
    Animated.timing(borderAnim, {
      toValue: target,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [error, focused, hovered, borderAnim]);

  useEffect(() => {
    if (error && prevError.current !== error) {
      prevError.current = error;
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
    if (!error) prevError.current = null;
  }, [error, shakeAnim]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [colors.neutral.border, colors.primary, colors.danger],
  });

  const shadowOpacity = borderAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 0.3, 0],
  });

  const labelTop = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [17, -9] });
  const labelFontSize = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 12] });

  return (
    <View style={styles.wrap}>
      <Pressable onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
        <Animated.View
          style={[
            styles.box,
            {
              borderColor,
              transform: [{ translateX: shakeAnim }],
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 10,
              shadowOpacity,
            },
          ]}
        >
        <Animated.Text
          style={[
            styles.label,
            {
              top: labelTop,
              fontSize: labelFontSize,
              color: error ? colors.danger : focused ? colors.primary : colors.neutral.textMuted,
              backgroundColor: colors.neutral.surface,
            },
          ]}
          pointerEvents="none"
        >
          {label}
        </Animated.Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={floated ? placeholder : undefined}
          placeholderTextColor={colors.neutral.textMuted}
          keyboardType={keyboardType}
          secureTextEntry={!!secureTextEntry && !passwordVisible}
          autoCapitalize={secureTextEntry ? 'none' : autoCapitalize}
          autoCorrect={secureTextEntry ? false : undefined}
          autoComplete={autoComplete}
          maxLength={maxLength}
          style={[styles.input, secureTextEntry && styles.passwordInput, noOutline]}
          keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
          accessibilityLabel={accessibilityLabel ?? label}
          testID={testID}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(passwordVisible ? 'auth.hidePassword' : 'auth.showPassword')}
            accessibilityState={{ checked: passwordVisible }}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={({ pressed }) => [styles.visibilityButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            {passwordVisible
              ? <EyeOff size={20} strokeWidth={1.8} color={colors.neutral.textMuted} />
              : <Eye size={20} strokeWidth={1.8} color={colors.neutral.textMuted} />}
          </Pressable>
        ) : null}
        </Animated.View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { marginBottom: 16 },
    box: {
      borderWidth: 1.5,
      borderRadius: radii.lg,
      backgroundColor: c.neutral.surface,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 14,
      minHeight: 60,
      justifyContent: 'center',
    },
    label: {
      position: 'absolute',
      left: 12,
      paddingHorizontal: 4,
      fontWeight: '600',
    },
    input: { ...fonts.body, fontSize: 16, lineHeight: 24, color: c.neutral.text, padding: 0 },
    passwordInput: { paddingRight: 42 },
    visibilityButton: { position: 'absolute', right: 6, top: 7, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    error: { ...fonts.caption, fontSize: 13, color: c.danger, marginTop: 6 },
  });

export function Field(props: FloatingLabelInputProps) {
  return <FloatingLabelInput {...props} />;
}

export default FloatingLabelInput;