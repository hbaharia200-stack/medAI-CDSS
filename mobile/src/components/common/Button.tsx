import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fonts, radii, touchTarget } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { useGlowAnimation } from '../../hooks/useGlowAnimation';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  // Either an emoji string (existing call sites) or a Lucide icon element.
  // Never icon-only: an icon is always paired with a visible text label.
  icon?: string | React.ReactNode;
  testID?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const bg = {
    primary: colors.primary,
    secondary: colors.neutral.surface,
    outline: 'transparent',
    danger: colors.danger,
  }[variant];

  const border = {
    primary: colors.primary,
    secondary: colors.neutral.border,
    outline: colors.primary,
    danger: colors.danger,
  }[variant];

  const { glowAnimatedStyle, onPressIn, onPressOut, onHoverIn, onHoverOut } = useGlowAnimation(border);

  const fg = {
    primary: colors.neutral.textOnPrimary,
    secondary: colors.neutral.text,
    outline: colors.primary,
    danger: colors.neutral.textOnPrimary,
  }[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor: border },
        glowAnimatedStyle,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon
            ? typeof icon === 'string'
              ? <Text style={[styles.icon, { color: fg }]}>{icon}</Text>
              : <View style={styles.iconNode}>{icon}</View>
            : null}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20, marginRight: 8 },
  iconNode: { marginRight: 8 },
  label: { ...fonts.bodyStrong, fontSize: 18 },
});

export default Button;