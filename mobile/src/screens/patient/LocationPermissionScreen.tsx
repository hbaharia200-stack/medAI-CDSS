import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { AppHeader } from '../../components/common/AppHeader';
import { Button } from '../../components/common/Button';
import { AlertBanner } from '../../components/common/AlertBanner';
import { ProgressSteps } from '../../components/common/ProgressSteps';
import { fonts } from '../../theme/tokens';
import { useTheme, type ThemeColors } from '../../theme/ThemeProvider';
import { useCaseStore } from '../../state/useCaseStore';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'LocationPermission'>;

export default function LocationPermissionScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const updateDraft = useCaseStore((state) => state.updateDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const continueWithoutLocation = () => navigation.navigate('BasicDetails');

  const captureLocation = async () => {
    setLoading(true);
    setError(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError(true);
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      updateDraft({
        location: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          capturedAt: new Date(current.timestamp).toISOString(),
        },
      });
      navigation.navigate('BasicDetails');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader />
      {/* Back control: aligned with the progress/title content and given a real
          touch target, so it no longer floats tight against the top edge. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        hitSlop={8}
      >
        <ChevronLeft size={20} color={colors.primary} strokeWidth={2.5} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>
      <ProgressSteps current={0} />
      <Text style={styles.title}>{t('location.title')}</Text>
      <Text style={styles.subtitle}>{t('location.description')}</Text>
      {error ? <AlertBanner text={t('location.denied')} variant="warning" /> : null}
      {/* Lucide MapPin replaces the previous emoji push-pin, so it matches the
          rest of the MedAI icon set and inherits light/dark contrast from the
          theme. Behaviour is unchanged. */}
      <Button
        label={t('location.allow')}
        onPress={() => void captureLocation()}
        loading={loading}
        icon={<MapPin size={20} color={colors.neutral.textOnPrimary} strokeWidth={2} />}
        testID="location-allow"
      />
      <Button label={t('location.continueManual')} variant="outline" onPress={continueWithoutLocation} />
    </ScreenContainer>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    // Horizontal padding matches ProgressSteps, so the control lines up with the
    // content below it instead of sitting flush against the screen edge.
    back: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      minHeight: 40,
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginLeft: 4,
    },
    backPressed: { opacity: 0.7 },
    backText: { ...fonts.bodyStrong, color: c.primary, fontSize: 16 },
    title: { ...fonts.h1, color: c.neutral.text, marginTop: 16 },
    subtitle: { ...fonts.bodyLarge, color: c.neutral.textMuted, marginTop: 8, marginBottom: 24 },
  });
