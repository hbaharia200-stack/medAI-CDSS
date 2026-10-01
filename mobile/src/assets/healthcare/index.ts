/**
 * Healthcare illustration asset registry.
 *
 * NOTE: Illustrations are 100% LOCAL + OFFLINE vector scenes rendered with
 * React Native Views (no remote URLs, no internet, no new native deps).
 * See src/components/healthcare/art/* — six scenes:
 *  patient-doctor, nurse-care, doctor-consultation,
 *  digital-health, preventive-care, community-health.
 * The carousel renders them via HealthcareIllustration (Image-free).
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
