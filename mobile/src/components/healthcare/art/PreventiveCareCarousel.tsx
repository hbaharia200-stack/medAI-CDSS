import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { PREVENTIVE_ITEMS } from '../preventiveItems';
import { PreventivePhotoCell } from './PreventiveMediaCell';

/**
 * Nested ping-pong photo carousel rendered INSIDE the unchanged
 * preventive-care blob/stage. Sequence: 1..7..1..7 forever (no 7->1 jump).
 *
 *   let index = 0; let direction = 1;
 *   advance(): at last -> direction=-1; at 0 -> direction=+1; index+=direction
 *
 * Photos advance after IMAGE_MS (4s). Crossfade ~400ms. Dots (7) track the
 * active index in both directions. ONLY the active photo (plus the fading
 * previous one) is mounted — never all 7. No cartoon/SVG/video.
 */

function advancePingPong(index: number, direction: 1 | -1): { index: number; direction: 1 | -1 } {
  const last = PREVENTIVE_ITEMS.length - 1;
  let dir = direction;
  if (index === last) dir = -1;
  else if (index === 0) dir = 1;
  return { index: index + dir, direction: dir };
}

declare const require: any;
let assetModule: any = null;
try {
  // Literal-string require: statically analysable, safe for Metro/Web.
  assetModule = require('expo-asset');
} catch {
  assetModule = null;
}

export function PreventiveCareCarousel({ visible = true }: { visible?: boolean }) {
  // Single authoritative state: current index + direction (+ prev index for crossfade).
  const [[index, direction, prevIndex], setState] = useState<[number, 1 | -1, number]>([0, 1, 0]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const step = useCallback((fromIndex: number, fromDir: 1 | -1) => {
    const next = advancePingPong(fromIndex, fromDir);
    // prev=fromIndex so the old photo fades out while the new one fades in.
    setState([next.index, next.direction, fromIndex]);
  }, []);

  const schedule = useCallback((fromIndex: number, fromDir: 1 | -1) => {
    clearTimer();
    const myGen = ++genRef.current;
    const item = PREVENTIVE_ITEMS[fromIndex];
    const delay = item.durationMs; // 4000ms
    timerRef.current = setTimeout(() => {
      if (genRef.current !== myGen) return;
      step(fromIndex, fromDir);
    }, delay);
  }, [step]);

  useEffect(() => {
    if (!visible) {
      clearTimer();
      return;
    }
    schedule(index, direction);
    return clearTimer;
  }, [index, direction, visible, schedule]);

  // Preload next image to avoid flicker on crossfade.
  useEffect(() => {
    const ahead = advancePingPong(index, direction).index;
    const nextImg = PREVENTIVE_ITEMS[ahead]?.source;
    if (typeof nextImg === 'number') {
      try {
        const Asset = assetModule?.Asset;
        Asset?.fromModule?.(nextImg)?.downloadAsync?.().catch(() => {});
      } catch {}
    }
  }, [index, direction]);

  useEffect(() => () => clearTimer(), []);

  // Mount ONLY active + previous (during fade). Empty at mount to avoid a
  // brief double-flash of the same cell.
  const cells = prevIndex === index ? [index] : [prevIndex, index];

  return (
    <View style={styles.fill} testID="preventive-care-carousel">
      {cells.map((ci) => (
        <PreventivePhotoCell key={PREVENTIVE_ITEMS[ci].order} itemIndex={ci} active={ci === index} />
      ))}
      <View style={styles.dots} testID="preventive-care-dots">
        {PREVENTIVE_ITEMS.map((item, i) => (
          <View key={item.order} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(120,120,130,0.55)',
    marginHorizontal: 2.5,
  },
  dotActive: {
    backgroundColor: '#0A5CB8',
    width: 18,
    borderRadius: 9,
  },
});

export default PreventiveCareCarousel;
export { advancePingPong };
