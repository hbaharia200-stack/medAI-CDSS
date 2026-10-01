import React from 'react';
import { View } from 'react-native';
import { SceneShell } from './SceneShell';
import { Figure } from './Figure';
import { CrossBadge, VectorHeart } from './parts';

// Scene 1: Patient talking with a doctor (consultation desk + clipboard)
export function ScenePatientDoctor() {
  return (
    <SceneShell tint="#0A5CB8" tintSoft="#E3EEFA">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 }}>
        <View style={{ alignItems: 'center', marginRight: 26 }}>
          <Figure skin="#8D5524" hair="#1B1F24" hairStyle="short" shirt="#F4A259" />
          <View style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9E0E8' }}>
            <View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: '#0A5CB8', opacity: 0.7 }} />
          </View>
        </View>
        <View style={{ width: 74, height: 60, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#C9D6E5', alignItems: 'center', paddingTop: 8, marginRight: 26 }}>
          <View style={{ width: 44, height: 30, borderRadius: 4, backgroundColor: '#0A5CB8' }}>
            <View style={{ margin: 5 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: '#fff', opacity: 0.95 }} />
              <View style={{ marginTop: 4, height: 4, borderRadius: 2, backgroundColor: '#fff', opacity: 0.6, marginRight: 10 }} />
              <View style={{ marginTop: 4, height: 4, borderRadius: 2, backgroundColor: '#fff', opacity: 0.6, marginRight: 4 }} />
            </View>
          </View>
          <View style={{ marginTop: 4, width: 60, height: 6, borderRadius: 3, backgroundColor: '#8B5E34' }} />
        </View>
        <View>
          <Figure skin="#E8A87C" hair="#3B2F2F" hairStyle="short" shirt="#0A5CB8" coat />
        </View>
      </View>
      <CrossBadge top={18} left={36} />
      <VectorHeart size={20} top={30} right={52} />
    </SceneShell>
  );
}
