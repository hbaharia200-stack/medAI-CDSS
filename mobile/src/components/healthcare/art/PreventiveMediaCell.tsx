import React, { useEffect, useRef } from 'react';
import { Image, Animated, Platform, StyleSheet } from 'react-native';
import { PREVENTIVE_ITEMS } from '../preventiveItems';

const CROSSFADE_MS = 400;
const KEN_BURNS_MS = 4200;

/**
 * Resolve a displayable URI from a statically-required local asset using
 * only react-native (already a dependency). Returns null if it cannot map.
 */
function webUriFor(source: any): string | null {
  try {
    const resolver = (Image as any)?.resolveAssetSource;
    if (typeof resolver === 'function') {
      const resolved = resolver(source);
      if (resolved?.uri && typeof resolved.uri === 'string') return resolved.uri;
    }
  } catch {}
  if (typeof source === 'string') return source;
  const fallback = source?.default ?? source?.uri;
  return typeof fallback === 'string' ? fallback : null;
}

/**
 * ONE photo cell. Renders THE REAL JPG for its item only.
 * `active` drives the crossfade (opacity 0<->1) and the Ken Burns zoom.
 * No cartoon, no SVG, no video, no fallback — item.source is the only media.
 */
export function PreventivePhotoCell({ itemIndex, active }: { itemIndex: number; active: boolean }) {
  const item = PREVENTIVE_ITEMS[itemIndex];
  if (!item) return null;
  const src = item.source;
  const opacity = useRef(new Animated.Value(active ? 1 : 0)).current;
  const zoom = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: active ? 1 : 0,
      duration: CROSSFADE_MS,
      useNativeDriver: true,
    }).start();
  }, [active, opacity]);

  useEffect(() => {
    zoom.setValue(1);
    if (!active) return;
    const anim = Animated.timing(zoom, {
      toValue: 1.08,
      duration: KEN_BURNS_MS,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [active, itemIndex, zoom]);

  // Dev-time mapping proof: which real JPG is this cell bound to?
  if (__DEV__) {
    const probe = Platform.OS === 'web' ? webUriFor(src) : String(src);
    console.log(`[PreventiveCell #${itemIndex + 1} active=${active}] ${item.accessibilityLabel} src=${probe}`);
  }

  const webSrc = Platform.OS === 'web' ? webUriFor(src) : null;

  return (
    <Animated.View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}
      pointerEvents="none"
      accessibilityRole="image"
      accessibilityLabel={item.accessibilityLabel}
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={{ flex: 1, transform: [{ scale: zoom }] }}>
        {Platform.OS === 'web' && webSrc ? (
          <img
            src={webSrc}
            alt={item.accessibilityLabel}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : Platform.OS !== 'web' ? (
          <Image
            source={src}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessible={false}
          />
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

export default PreventivePhotoCell;
