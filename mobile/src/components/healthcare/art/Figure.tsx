import React from 'react';
import { View } from 'react-native';

export function Figure({ skin = '#C68642', hair = '#222222', hairStyle = 'short', shirt = '#0A5CB8', coat = false }: { skin?: string; hair?: string; hairStyle?: 'short' | 'long' | 'bun' | 'cap' | 'hijab'; shirt?: string; coat?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ zIndex: 2, width: 44, height: 44, borderRadius: 22, backgroundColor: skin, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' }}>
        {hairStyle === 'long' ? <View style={{ position: 'absolute', top: -2, left: -4, right: -4, height: 30, borderRadius: 12, backgroundColor: hair }} /> : null}
        {hairStyle === 'bun' ? <View style={{ position: 'absolute', top: -8, left: 11, width: 20, height: 20, borderRadius: 10, backgroundColor: hair }} /> : null}
        {hairStyle === 'bun' ? <View style={{ position: 'absolute', top: 0, left: -2, right: -2, height: 20, borderRadius: 10, backgroundColor: hair }} /> : null}
        {hairStyle === 'hijab' ? <View style={{ position: 'absolute', top: -4, left: -5, right: -5, height: 34, borderRadius: 14, backgroundColor: hair }} /> : null}
        {hairStyle === 'cap' ? <View style={{ position: 'absolute', top: -3, left: -3, right: -3, height: 20, borderTopLeftRadius: 11, borderTopRightRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }} /> : null}
        {hairStyle === 'short' ? <View style={{ position: 'absolute', top: -2, left: -2, right: -2, height: 19, borderRadius: 9, backgroundColor: hair }} /> : null}
        <View style={{ position: 'absolute', top: 21, left: 11, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#1B1F24' }} />
        <View style={{ position: 'absolute', top: 21, right: 11, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#1B1F24' }} />
        <View style={{ position: 'absolute', top: 30, left: 16, width: 12, height: 6, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: 'rgba(0,0,0,0.35)' }} />
      </View>
      <View style={{ marginTop: -7, width: 58, height: 60, borderRadius: 17, backgroundColor: coat ? '#FFFFFF' : shirt, borderWidth: coat ? 1.5 : 0, borderColor: '#C9D6E5', overflow: 'hidden', alignItems: 'center' }}>
        {coat ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 25, width: 8, backgroundColor: shirt }} /> : null}
        {coat ? <View style={{ position: 'absolute', top: 6, left: 7, width: 13, height: 9, backgroundColor: shirt, opacity: 0.25, borderRadius: 3 }} /> : null}
        {coat ? <View style={{ position: 'absolute', top: 6, right: 7, width: 13, height: 9, backgroundColor: shirt, opacity: 0.25, borderRadius: 3 }} /> : null}
        {coat ? null : <View style={{ marginTop: 9, width: 22, height: 13, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.35)' }} />}
      </View>
    </View>
  );
}
