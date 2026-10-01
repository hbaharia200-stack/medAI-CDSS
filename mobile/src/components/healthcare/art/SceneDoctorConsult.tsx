import React from 'react';
import { View } from 'react-native';
import { SceneShell } from './SceneShell';
import { Figure } from './Figure';
import { CrossBadge } from './parts';

// Scene 3: Doctor examining / consulting (stethoscope + chart board)
export function SceneDoctorConsult() {
  return (
    <SceneShell tint="#6C5CE7" tintSoft="#EDE9FD">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
        <View style={{ marginRight: 22 }}>
          <Figure skin="#F1C27D" hair="#4A2C2A" hairStyle="short" shirt="#6C5CE7" coat />
          <View style={{ marginTop: 3, alignItems: 'center' }}>
            <View style={{ width: 44, height: 20, borderRadius: 10, borderWidth: 2.5, borderColor: '#1B1F24', borderTopWidth: 0, borderLeftWidth: 2.5, borderRightWidth: 2.5 }} />
            <View style={{ marginTop: -8, width: 12, height: 12, borderRadius: 6, backgroundColor: '#1B1F24' }} />
          </View>
        </View>
        <View style={{ width: 66, height: 88, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CFC8FF', padding: 7, marginRight: 22 }}>
          <View style={{ width: 20, height: 6, borderRadius: 3, backgroundColor: '#6C5CE7', marginBottom: 6 }} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 34 }}>
              <View style={{ width: 8, height: 16, borderRadius: 3, backgroundColor: '#6C5CE7', opacity: 0.5, marginRight: 4 }} />
              <View style={{ width: 8, height: 26, borderRadius: 3, backgroundColor: '#6C5CE7', marginRight: 4 }} />
              <View style={{ width: 8, height: 20, borderRadius: 3, backgroundColor: '#1E7E34', opacity: 0.8, marginRight: 4 }} />
              <View style={{ width: 8, height: 30, borderRadius: 3, backgroundColor: '#0A5CB8', opacity: 0.7 }} />
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: '#D9E0E8' }} />
            <View style={{ height: 4, borderRadius: 2, backgroundColor: '#D9E0E8', marginRight: 12 }} />
          </View>
        </View>
        <View>
          <Figure skin="#8D5524" hair="#0F0F0F" hairStyle="long" shirt="#E17055" />
        </View>
      </View>
      <CrossBadge top={16} left={44} bg="#6C5CE7" />
    </SceneShell>
  );
}
