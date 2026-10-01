/**
 * Preventive-care asset manifest — 7 real JPG photographs, in order 1..7.
 *
 * Source of truth: the 7 manually-uploaded JPGs in
 * assets/preventive-care/images/, wired via static require() calls below.
 *
 * The carousel that renders this list should ping-pong through it:
 *   1→2→3→4→5→6→7→6→5→4→3→2→1→2→3…  (never jumps 7 straight back to 1)
 * 4 seconds per photo, 7 dots. Use `nextPingPongIndex` below to drive that.
 *
 * Out of scope (do not resurrect without an explicit ask):
 * - The old preventive-01..09 SVG cartoon scenes. Archived, unused.
 * - Video slots 8–9. Videos were deleted; no video logic runs here.
 */

export interface PreventiveMediaItem {
  /** 1-based display order (1..7) */
  order: number;
  type: 'image';
  source: any;
  durationMs: number;
  accessibilityLabel: string;
}

// NOTE: Metro (the RN/Expo bundler) statically scans source for require(...)
// calls to build its asset graph, so every argument MUST be a string literal
// written directly at the call site — no variables, no wrapper function like
// the old safeRequire(path). A dynamic require(path) fails to even parse as
// far as Metro's transform step is concerned, which is the
// "Invalid call at line 29: require(path)" error.
//
// The flip side: because resolution happens at bundle time, a literal
// require() for a file that doesn't exist on disk yet will fail the build
// with "Unable to resolve module ..." — there's no try/catch that can defer
// that to runtime. All 7 JPGs below need to actually exist at these paths
// before `expo start` will build. If any are still missing, comment out
// that one line + its entry in PREVENTIVE_ITEMS below rather than leaving a
// dangling require().

const DURATION_MS = 4000;

const photo1 = require('../../../assets/preventive-care/images/preventive-01-elderly-checkup.jpg');
const photo2 = require('../../../assets/preventive-care/images/preventive-02-medical-team.jpg');
const photo3 = require('../../../assets/preventive-care/images/preventive-03-bp-check.jpg');
const photo4 = require('../../../assets/preventive-care/images/preventive-04-patient-consult.jpg');
const photo5 = require('../../../assets/preventive-care/images/preventive-05-community-outreach.jpg');
const photo6 = require('../../../assets/preventive-care/images/preventive-06-heart-checkup.jpg');
const photo7 = require('../../../assets/preventive-care/images/preventive-07-child-checkup.jpg');

export const PREVENTIVE_ITEMS: PreventiveMediaItem[] = [
  { order: 1, type: 'image', source: photo1, durationMs: DURATION_MS, accessibilityLabel: 'Preventive care photo 1: elderly health checkup' },
  { order: 2, type: 'image', source: photo2, durationMs: DURATION_MS, accessibilityLabel: 'Preventive care photo 2: medical team' },
  { order: 3, type: 'image', source: photo3, durationMs: DURATION_MS, accessibilityLabel: 'Preventive care photo 3: blood pressure check' },
  { order: 4, type: 'image', source: photo4, durationMs: DURATION_MS, accessibilityLabel: 'Preventive care photo 4: patient consultation' },
  { order: 5, type: 'image', source: photo5, durationMs: DURATION_MS, accessibilityLabel: 'Preventive care photo 5: community outreach' },
  { order: 6, type: 'image', source: photo6, durationMs: DURATION_MS, accessibilityLabel: 'Preventive care photo 6: heart checkup' },
  { order: 7, type: 'image', source: photo7, durationMs: DURATION_MS, accessibilityLabel: 'Preventive care photo 7: child checkup' },
];

/**
 * Given the current index into PREVENTIVE_ITEMS and the direction of travel,
 * returns the next { index, direction } for a ping-pong sequence:
 *   0→1→2→3→4→5→6→5→4→3→2→1→0→1…
 * Bounces at both ends instead of wrapping, so the far end is never skipped.
 */
export function nextPingPongStep(
  index: number,
  direction: 1 | -1,
  length: number = PREVENTIVE_ITEMS.length,
): { index: number; direction: 1 | -1 } {
  if (length <= 1) return { index: 0, direction: 1 };
  let nextDirection = direction;
  if (index + direction < 0 || index + direction >= length) {
    nextDirection = (direction * -1) as 1 | -1;
  }
  return { index: index + nextDirection, direction: nextDirection };
}

export default PREVENTIVE_ITEMS;