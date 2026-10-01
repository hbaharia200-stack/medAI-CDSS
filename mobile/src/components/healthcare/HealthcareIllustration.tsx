import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScenePatientDoctor } from './art/ScenePatientDoctor';
import { SceneNurseCare } from './art/SceneNurseCare';
import { SceneDoctorConsult } from './art/SceneDoctorConsult';
import { SceneDigitalHealth } from './art/SceneDigitalHealth';
import { ScenePreventive } from './art/ScenePreventive';
import { SceneCommunity } from './art/SceneCommunity';
import { useTheme } from '../../theme/ThemeProvider';

interface Props { imageKey: string; style?: any; title?: string; subtitle?: string; visible?: boolean; }
const SCENES: Record<string, (props?: any) => React.JSX.Element> = {
  'patient-doctor': ScenePatientDoctor,
  'nurse-care': SceneNurseCare,
  'doctor-consultation': SceneDoctorConsult,
  'digital-health': SceneDigitalHealth,
  'preventive-care': ScenePreventive,
  'community-health': SceneCommunity,
};
export function HealthcareIllustration({ imageKey, style, title, subtitle, visible = true }: Props) {
  const { colors } = useTheme();
  const Scene = SCENES[imageKey] ?? ScenePatientDoctor;
  return (
    <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel={title ? `${title}. ${subtitle ?? ''}` : imageKey}>
      <View style={[styles.stage]}>
        <Scene visible={visible} />
      </View>
      {title ? (
        <View style={styles.caption}>
          <Text style={[styles.title, { color: colors.neutral.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.sub, { color: colors.neutral.textMuted }]}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  stage: { width: '100%', height: 200, overflow: 'hidden', backgroundColor: 'transparent' },
  caption: { marginTop: 8, alignItems: 'center', paddingHorizontal: 12 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 2 },
});
export default HealthcareIllustration;

