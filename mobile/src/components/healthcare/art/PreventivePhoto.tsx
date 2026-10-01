import React from 'react';
import { View } from 'react-native';

/**
 * Offline React Native rendition of each preventive-care scene (slots 1-9).
 * The matching REAL local artworks live under
 * assets/preventive-care/images/*.svg and are wired via static require()
 * calls in ../preventiveItems.ts (surfaced as web <img> overlays by
 * PreventiveMediaCell). This RN layer guarantees the blob is never blank
 * on native, where raw .svg cannot be rasterised without a transformer
 * (none installed — none added).
 */
const PALETTES = [
  { sky: '#DCEBF9', ground: '#B9D6EE', subject: '#8D5524', accent: '#0A5CB8' },
  { sky: '#DFF2E4', ground: '#BFE3C9', subject: '#C68642', accent: '#1E7E34' },
  { sky: '#E7E4FB', ground: '#CFC8FF', subject: '#F1C27D', accent: '#6C5CE7' },
  { sky: '#DFF7F3', ground: '#B9ECE4', subject: '#E8A87C', accent: '#00B894' },
  { sky: '#FDEBD8', ground: '#F6CFA5', subject: '#8D5524', accent: '#E17055' },
  { sky: '#FBE4E6', ground: '#F3B9C0', subject: '#C68642', accent: '#C5221F' },
  { sky: '#FFF4D6', ground: '#F3DFA8', subject: '#F1C27D', accent: '#B26A00' },
  { sky: '#E0EDFB', ground: '#AFCBF0', subject: '#5D6D7E', accent: '#0A5CB8' },
  { sky: '#ECE9FD', ground: '#C9C2F5', subject: '#8D5524', accent: '#6C5CE7' },
];

function Fg({ skin = '#8D5524', shirt = '#0A5CB8', coat = false, small = false }: { skin?: string; shirt?: string; coat?: boolean; small?: boolean }) {
  const hs = small ? 24 : 32;
  const bw = small ? 36 : 46;
  const bh = small ? 34 : 44;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ zIndex: 2, width: hs, height: hs, borderRadius: hs / 2, backgroundColor: skin }}>
        <View style={{ position: 'absolute', top: -2, left: -2, right: -2, height: hs * 0.45, borderRadius: 6, backgroundColor: '#222' }} />
      </View>
      <View style={{ marginTop: -5, width: bw, height: bh, borderRadius: 11, backgroundColor: coat ? '#fff' : shirt }}>
        {coat ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: bw / 2 - 4, width: 8, backgroundColor: shirt }} /> : null}
      </View>
    </View>
  );
}

function Heart({ s = 30, c = '#E63946', x, y }: { s?: number; c?: string; x: number; y: number }) {
  const d = s * 0.52;
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: s, height: s }}>
      <View style={{ position: 'absolute', left: 0, top: d * 0.35, width: d, height: d, borderRadius: d / 2, backgroundColor: c }} />
      <View style={{ position: 'absolute', right: 0, top: d * 0.35, width: d, height: d, borderRadius: d / 2, backgroundColor: c }} />
      <View style={{ position: 'absolute', left: s * 0.18, top: s * 0.3, width: s * 0.64, height: s * 0.64, backgroundColor: c, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

export function PreventivePhoto({ slot, video }: { slot: number; video?: boolean }) {
  const p = PALETTES[slot % PALETTES.length];
  return (
    <View style={{ flex: 1, backgroundColor: p.sky, overflow: 'hidden' }} testID={`preventive-photo-${slot + 1}`}>
      <SlotScene slot={slot} accent={p.accent} ground={p.ground} />
      {/* Committed SVG twins / future JPGs overlay via PreventiveMediaCell CoverAsset. */}
      {(video || slot === 7 || slot === 8) && (
        <View style={{ position: 'absolute', bottom: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ marginLeft: 2, borderLeftWidth: 10, borderLeftColor: '#fff', borderTopWidth: 6, borderTopColor: 'transparent', borderBottomWidth: 6, borderBottomColor: 'transparent' }} />
        </View>
      )}
    </View>
  );
}

function SlotScene({ slot, accent, ground }: { slot: number; accent: string; ground: string }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: ground }} />
      <View style={{ position: 'absolute', top: 10, right: 14, width: 26, height: 26, borderRadius: 13, backgroundColor: '#F7CE46', opacity: 0.9 }} />
      <View style={{ position: 'absolute', top: 30, left: 12, width: 84, height: 52, borderRadius: 6, backgroundColor: '#fff' }}>
        <View style={{ height: 11, backgroundColor: accent, opacity: 0.85, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
      </View>
      {slot === 0 && (
        <View style={{ position: 'absolute', left: 108, bottom: 24, flexDirection: 'row', alignItems: 'flex-end' }}>
          <Fg skin="#8D5524" shirt="#7A6C5D" small />
          <View style={{ width: 4, height: 54, borderRadius: 2, backgroundColor: '#5A4A3A', marginHorizontal: 5 }} />
          <View style={{ marginLeft: 12 }}><Fg skin="#C68642" shirt="#1E7E34" coat /></View>
        </View>
      )}
      {slot === 1 && (
        <View style={{ position: 'absolute', left: 104, bottom: 24, flexDirection: 'row', alignItems: 'flex-end' }}>
          <Fg skin="#8D5524" shirt="#0A5CB8" coat />
          <View style={{ marginLeft: 8 }}><Fg skin="#F1C27D" shirt="#1E7E34" /></View>
          <View style={{ marginLeft: 8 }}><Fg skin="#C68642" shirt="#6C5CE7" small /></View>
        </View>
      )}
      {slot === 2 && (
        <View style={{ position: 'absolute', left: 104, bottom: 22, flexDirection: 'row', alignItems: 'center' }}>
          <Fg skin="#8D5524" shirt="#E17055" />
          <View style={{ marginLeft: 10, width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', borderWidth: 3, borderColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent }} />
          </View>
        </View>
      )}
      {slot === 3 && (
        <View style={{ position: 'absolute', left: 102, bottom: 24, flexDirection: 'row', alignItems: 'flex-end' }}>
          <Fg skin="#F1C27D" shirt="#0A5CB8" coat />
          <View style={{ marginHorizontal: 8, width: 50, height: 58, borderRadius: 6, backgroundColor: '#fff', padding: 6 }}>
            <View style={{ height: 5, borderRadius: 2, backgroundColor: accent }} />
            <View style={{ marginTop: 5, height: 5, borderRadius: 2, backgroundColor: accent, opacity: 0.5 }} />
          </View>
          <Fg skin="#8D5524" shirt="#E17055" />
        </View>
      )}
      {slot === 4 && (
        <View style={{ position: 'absolute', left: 100, bottom: 20, alignItems: 'center' }}>
          <View style={{ width: 106, height: 32, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: '#fff' }} />
          <View style={{ flexDirection: 'row', marginTop: -2 }}>
            <Fg skin="#8D5524" shirt="#F39C12" small />
            <View style={{ marginHorizontal: 6 }}><Fg skin="#F1C27D" shirt="#0A5CB8" small /></View>
            <Fg skin="#C68642" shirt="#1E7E34" small />
          </View>
        </View>
      )}
      {slot >= 5 && <GenericPair slot={slot} accent={accent} />}
      {slot === 0 && <Heart s={20} x={210} y={60} />}
      {slot === 5 && <Heart s={44} c="#C5221F" x={104} y={80} />}
    </View>
  );
}

function GenericPair({ slot, accent }: { slot: number; accent: string }) {
  if (slot === 5) {
    return (
      <View style={{ position: 'absolute', left: 160, bottom: 24, flexDirection: 'row', alignItems: 'flex-end' }}>
        <Fg skin="#C68642" shirt="#fff" coat small />
        <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'flex-end', height: 34 }}>
          {[10, 20, 12, 30].map((h, i) => (
            <View key={i} style={{ width: 5, height: h, borderRadius: 2, backgroundColor: '#C5221F', marginRight: 3 }} />
          ))}
        </View>
      </View>
    );
  }
  if (slot === 6) {
    return (
      <View style={{ position: 'absolute', left: 106, bottom: 24, flexDirection: 'row', alignItems: 'flex-end' }}>
        <Fg skin="#F1C27D" shirt="#B26A00" />
        <View style={{ marginLeft: 10 }}><Fg skin="#8D5524" shirt="#0A5CB8" small /></View>
      </View>
    );
  }
  if (slot === 7) {
    return (
      <View style={{ position: 'absolute', left: 104, bottom: 22, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 58, height: 58, borderRadius: 10, backgroundColor: '#10161E', borderWidth: 2, borderColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: accent }} />
        </View>
        <View style={{ marginLeft: 10 }}><Fg skin="#E8A87C" shirt="#0A5CB8" /></View>
      </View>
    );
  }
  return (
    <View style={{ position: 'absolute', left: 104, bottom: 24, flexDirection: 'row', alignItems: 'flex-end' }}>
      <Fg skin="#8D5524" shirt="#6C5CE7" coat />
      <View style={{ marginLeft: 10 }}><Fg skin="#F1C27D" shirt="#E17055" small /></View>
    </View>
  );
}

export const PREVENTIVE_PHOTO_COUNT = 9;

export default PreventivePhoto;
