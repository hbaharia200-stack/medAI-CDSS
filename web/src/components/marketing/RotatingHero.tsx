/**
 * Rotating hero photo carousel with smooth crossfade.
 *
 * Uses the real local medical photos in src/assets/marketing. The sequence
 * ping-pongs (1→2→…→N→N-1→…→1→2→…) so the last image never jumps straight
 * back to the first. Supports any number of supplied images.
 */
import { useEffect, useState } from 'react';

export const ROTATE_INTERVAL_MS = 6000;

interface RotatingHeroProps {
  /** Local image URLs to rotate through (order defines the sequence). */
  images: string[];
  /** Accessible label prefix; the visible index is appended (1-based). */
  altPrefix: string;
  /** Rotation interval in ms (default 6000 — within the 5–7s requirement). */
  intervalMs?: number;
}

export function nextPingPongIndex(
  current: number,
  count: number,
  direction: 1 | -1,
): { index: number; direction: 1 | -1 } {
  if (count <= 1) return { index: 0, direction: 1 };
  if (direction === 1) {
    if (current >= count - 1) return { index: current - 1, direction: -1 };
    return { index: current + 1, direction: 1 };
  }
  if (current <= 0) return { index: current + 1, direction: 1 };
  return { index: current - 1, direction: -1 };
}

export default function RotatingHero({ images, altPrefix, intervalMs = ROTATE_INTERVAL_MS }: RotatingHeroProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => {
        const next = nextPingPongIndex(current, images.length, direction);
        setDirection(next.direction);
        return next.index;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
    // `direction` is intentionally read inside the updater via closure state:
    // re-subscribe whenever it flips so the ping-pong turn is honoured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, intervalMs, direction]);

  return (
    <>
      {images.map((src, i) => {
        const isVisible = i === index;
        return (
          <div
            key={src}
            className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Single sharp layer — fills its container edge-to-edge, fully visible */}
            <img
              src={src}
              alt={isVisible ? `${altPrefix} ${i + 1}` : ''}
              aria-hidden={isVisible ? undefined : true}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: 'center' }}
            />
          </div>
        );
      })}
    </>
  );
}
