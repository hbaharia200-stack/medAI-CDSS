import React from 'react';
import { View } from 'react-native';
import { SceneShell } from './SceneShell';
import { Figure } from './Figure';
import { CrossBadge, VectorHeart } from './parts';

// Scene 2: Nurse caring for a patient (bed + nurse with cap)
export function SceneNurseCare() {
  return (
    <SceneShell tint="#1E7E34" tintSoft="#E5F4E9">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 18 }}>
        <View style={{ alignItems: 'center', marginRight: 18 }}>
          <Figure skin="#C68642" hair="#111111" hairStyle="cap" shirt="#1E7E34" coat={false} />
          <View style={{ marginTop: 2, width: 58, height: 18, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFE3C9', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 30, height: 5, borderRadius: 2.5, backgroundColor: '#E63946' }} />
          </View>
        </View>
        <View style={{ width: 150, height: 64, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#BFE3C9', overflow: 'hidden' }}>
          <View style={{ height: 22, backgroundColor: '#1E7E34', opacity: 0.12 }} />
          <View style={{ position: 'absolute', top: 10, left: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: '#8D5524' }} />
          <View style={{ position: 'absolute', top: 40, left: 10, right: 10, height: 14, borderRadius: 7, backgroundColor: '#7DB4FF', opacity: 0.5 }} />
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, backgroundColor: '#1E7E34', opacity: 0.2 }} />
        </View>
      </View>
      <VectorHeart size={22} top={24} left={60} />
      <CrossBadge top={18} right={38} bg="#1E7E34" />
    </SceneShell>
  );
}
