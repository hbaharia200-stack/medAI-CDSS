import React from 'react';
import { View } from 'react-native';
import { SceneShell } from './SceneShell';
import { Figure } from './Figure';
import { CrossBadge, VectorHeart } from './parts';

// Scene 6: Community healthcare (worker + two people + tent cross)
export function SceneCommunity() {
  return (
    <SceneShell tint="#F39C12" tintSoft="#FEF8E7">
      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <View style={{ width: 120, height: 44, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#F3D9A4', borderBottomWidth: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#C5221F', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 14, height: 5, borderRadius: 2, backgroundColor: '#fff' }} />
            <View style={{ position: 'absolute', width: 5, height: 14, borderRadius: 2, backgroundColor: '#fff' }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: -8 }}>
          <View style={{ marginRight: 14 }}>
            <Figure skin="#8D5524" hair="#111111" hairStyle="hijab" shirt="#F39C12" />
          </View>
          <View style={{ marginRight: 14 }}>
            <Figure skin="#F1C27D" hair="#5A3A1A" hairStyle="bun" shirt="#0A5CB8" coat={false} />
          </View>
          <View>
            <Figure skin="#C68642" hair="#222222" hairStyle="short" shirt="#1E7E34" />
          </View>
        </View>
      </View>
      <CrossBadge top={18} left={36} bg="#F39C12" />
      <VectorHeart size={18} top={26} right={48} />
    </SceneShell>
  );
}
