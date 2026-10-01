import React from 'react';
import { View } from 'react-native';

export function VectorHeart({ size = 22, color = '#E63946', top, left, right, bottom }: { size?: number; color?: string; top?: number; left?: number; right?: number; bottom?: number }) {
  const d = size * 0.52;
  return (
    <View style={{ position: 'absolute', top, left, right, bottom, width: size, height: size }}>
      <View style={{ position: 'absolute', left: 0, top: d * 0.35, width: d, height: d, borderRadius: d / 2, backgroundColor: color }} />
      <View style={{ position: 'absolute', right: 0, top: d * 0.35, width: d, height: d, borderRadius: d / 2, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: size * 0.18, top: size * 0.3, width: size * 0.64, height: size * 0.64, backgroundColor: color, transform: [{ rotate: '45deg' }], borderRadius: 3 }} />
    </View>
  );
}

export function CrossBadge({ top, left, right, bottom, bg = '#0A5CB8' }: { top?: number; left?: number; right?: number; bottom?: number; bg?: string }) {
  return (
    <View style={{ position: 'absolute', top, left, right, bottom, width: 34, height: 34, borderRadius: 17, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' }}>
      <View style={{ position: 'absolute', width: 16, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
      <View style={{ position: 'absolute', width: 6, height: 16, borderRadius: 3, backgroundColor: '#fff' }} />
    </View>
  );
}
