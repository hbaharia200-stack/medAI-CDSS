import React from 'react';
import { View } from 'react-native';

export function SceneShell({ tintSoft, tint, children }: { tintSoft: string; tint: string; children: React.ReactNode }) {
  return (
    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 320, height: 200, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 300, height: 168, borderRadius: 84, backgroundColor: tintSoft }} />
        <View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, right: 8, top: 4, backgroundColor: tint, opacity: 0.22 }} />
        <View style={{ position: 'absolute', bottom: 12, width: 250, height: 16, borderRadius: 8, backgroundColor: '#0A5CB8', opacity: 0.1 }} />
        {children}
      </View>
    </View>
  );
}
