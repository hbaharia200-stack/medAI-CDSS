// Rule-based clinical guardrails — NOT AI and NOT a mock dataset.
//
// These evaluate the *real* case records returned by `GET /api/cases/queue`, so
// they flag exactly the patients currently in the database.
import type { Case } from '../types';

const DANGER_SYMPTOMS = ['chest pain', 'shortness of breath', 'severe bleeding'];

/**
 * Deterministic red-flag guardrail: an already-urgent case that also reports a
 * danger symptom or tachycardia. Presented above the dashboard so a clinician
 * cannot miss it. Kept separate from the AI panel on purpose — this is a rule,
 * not a model prediction.
 */
export function isEmergencyCase(record: Case): boolean {
  const hasDanger = record.symptoms.some((symptom) =>
    DANGER_SYMPTOMS.some((danger) => symptom.label.toLowerCase().includes(danger)),
  );
  const tachycardia = (record.vitals?.heartRate ?? 0) >= 120;
  return record.urgent && (hasDanger || tachycardia);
}
