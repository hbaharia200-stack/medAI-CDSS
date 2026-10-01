/**
 * Healthcare illustration asset registry.
 *
 * To use real illustrations:
 *   1. Drop image files into this folder (e.g., patient-doctor.png)
 *   2. Replace the null entries below with require() calls
 *
 * Example:
 *   export const healthcareImages = {
 *     'patient-doctor': require('./patient-doctor.png'),
 *     'nurse-care': require('./nurse-care.png'),
 *     ...
 *   };
 *
 * The carousel component reads from this registry — no other changes needed.
 */

export const healthcareImages: Record<string, any | null> = {
  'patient-doctor': null,
  'nurse-care': null,
  'doctor-consultation': null,
  'digital-health': null,
  'preventive-care': null,
  'community-health': null,
};

export type HealthcareImageKey = keyof typeof healthcareImages;

