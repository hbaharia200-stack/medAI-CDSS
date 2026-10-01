import React from 'react';
import { View } from 'react-native';
import { SceneShell } from './SceneShell';
import { PreventiveCareCarousel } from './PreventiveCareCarousel';

// Scene 5: Preventive Care — ping-pong photo+video carousel inside the
// UNCHANGED peach blob. Title/subtitle/shape/colors/position untouched;
// only the inner media + rotation logic changed (see PreventiveCareCarousel).
export function ScenePreventive({ visible = true }: { visible?: boolean }) {
  return (
    <SceneShell tint="#E17055" tintSoft="#FDF0EC">
      <View style={{ position: 'absolute', top: 16, left: 10, right: 10, bottom: 16, borderRadius: 74, overflow: 'hidden' }}>
        <PreventiveCareCarousel visible={visible} />
      </View>
    </SceneShell>
  );
}
