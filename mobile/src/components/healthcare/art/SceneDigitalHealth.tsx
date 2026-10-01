import React from 'react';
import { View } from 'react-native';
import { SceneShell } from './SceneShell';
import { Figure } from './Figure';
import { CrossBadge, VectorHeart } from './parts';

// Scene 4: Digital / AI-assisted healthcare (phone + signal + spark)
export function SceneDigitalHealth() {
  return (
    <SceneShell tint="#00B894" tintSoft="#E0F7F3">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <View style={{ marginRight: 20 }}>
          <Figure skin="#E8A87C" hair="#222222" hairStyle="short" shirt="#00B894" />
        </View>
        <View style={{ width: 76, height: 120, borderRadius: 14, backgroundColor: '#10161E', padding: 6, borderWidth: 2, borderColor: '#0A5CB8', marginRight: 20 }}>
          <View style={{ flex: 1, borderRadius: 9, backgroundColor: '#FFFFFF', overflow: 'hidden', padding: 6 }}>
            <View style={{ width: 26, height: 6, borderRadius: 3, backgroundColor: '#0A5CB8', marginBottom: 5 }} />
            <View style={{ flexDirection: 'row', marginBottom: 5 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#00B894', marginRight: 4 }} />
              <View style={{ flex: 1 }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: '#D9E0E8' }} />
                <View style={{ marginTop: 3, height: 4, borderRadius: 2, backgroundColor: '#D9E0E8', marginRight: 8 }} />
              </View>
            </View>
            <View style={{ height: 30, borderRadius: 6, backgroundColor: '#E3EEFA', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 22, height: 4, borderRadius: 2, backgroundColor: '#0A5CB8' }} />
              <View style={{ marginTop: 3, width: 30, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: '#00B894' }} />
            </View>
            <View style={{ marginTop: 5, height: 14, borderRadius: 7, backgroundColor: '#0A5CB8', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 24, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ width: 5, height: 10, borderRadius: 2, backgroundColor: '#00B894', marginRight: 3 }} />
            <View style={{ width: 5, height: 16, borderRadius: 2, backgroundColor: '#00B894', marginRight: 3 }} />
            <View style={{ width: 5, height: 22, borderRadius: 2, backgroundColor: '#0A5CB8' }} />
          </View>
          <View style={{ marginTop: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: '#0A5CB8', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
            <View style={{ position: 'absolute', width: 6, height: 18, borderRadius: 3, backgroundColor: '#fff' }} />
          </View>
        </View>
      </View>
      <CrossBadge top={16} right={40} bg="#00B894" />
      <VectorHeart size={18} top={34} left={50} />
    </SceneShell>
  );
}
