import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radii } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';

export const BODY_REGIONS = [
  { key: 'head', icon: '🫀' },
  { key: 'chest', icon: '👐' },
  { key: 'stomach', icon: '🫃' },
  { key: 'back', icon: '🟤' },
  { key: 'arms', icon: '💪' },
  { key: 'legs', icon: '🦵' },
  { key: 'whole', icon: '🧍' },
] as const;

export type BodyRegionKey = (typeof BODY_REGIONS)[number]['key'];

interface BodyMapPickerProps {
  selected: BodyRegionKey[] | string[];
  onToggle: (region: string, labelKey: string) => void;
}

/** Icon-based body map: tapping a region adds a structured symptom. */
export function BodyMapPicker({ selected, onToggle }: BodyMapPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.grid}>
      {BODY_REGIONS.map((region) => {
        const isSelected = selected.includes(region.key);
        return (
          <Pressable
            key={region.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${t(`symptom.bodyRegions.${region.key}`)}`}
            onPress={() => onToggle(region.key, `symptom.bodyRegions.${region.key}`)}
            style={[styles.cell, isSelected && styles.cellSelected]}
          >
            <Text style={styles.icon}>{region.icon}</Text>
            <Text
              numberOfLines={1}
              style={[styles.label, isSelected && styles.labelSelected]}
            >
              {t(`symptom.bodyRegions.${region.key}`)}
            </Text>
            {isSelected ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cell: {
      width: '31%',
      minWidth: 88, // comfortable touch target on small Android screens
      aspectRatio: 1.15,
      borderRadius: radii.md,
      borderWidth: 2,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.surface,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
    },
    cellSelected: { borderColor: c.primary, backgroundColor: c.primaryLight },
    icon: { fontSize: 28 },
    label: {
      ...fonts.caption,
      fontSize: 13,
      textAlign: 'center',
      color: c.neutral.text,
      marginTop: 2,
    },
    labelSelected: { color: c.primaryDark, ...fonts.captionStrong },
    check: { position: 'absolute', top: 4, right: 6, color: c.primary, fontWeight: '900' },
  });

export default BodyMapPicker;