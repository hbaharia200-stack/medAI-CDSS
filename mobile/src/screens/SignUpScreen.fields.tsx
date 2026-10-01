import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { fonts, radii, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { FloatingLabelInput } from '../components/common/FloatingLabelInput';

export function RoleCard({ icon, title, desc, onPress }: { icon: string; title: string; desc: string; onPress: () => void }) {
  const { colors: c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radii.md, borderWidth: 2, borderColor: c.neutral.border, backgroundColor: c.neutral.surface, marginBottom: spacing.sm }}>
      <Text style={{ fontSize: 32, marginRight: spacing.md }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ ...fonts.h3, color: c.neutral.text }}>{title}</Text>
        <Text style={{ ...fonts.body, color: c.neutral.textMuted }}>{desc}</Text>
      </View>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry, error, autoCapitalize }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'number-pad';
  secureTextEntry?: boolean; error?: string | null;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <FloatingLabelInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'words')}
      error={error ?? null}
    />
  );
}
