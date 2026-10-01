// Deterministic follow-up question generation for the patient intake.
//
// This is a fixed, non-clinical questionnaire: the same question bank is asked
// of every patient in the same order. It is NOT an AI service and it invents no
// clinical content — the answers are stored verbatim on the case and read by the
// doctor.
import type { FollowUpQuestion, Symptom } from '../../types';

// AI_INTEGRATION_POINT — symptom extraction.
//
// The trained clinical NLP model is NOT connected yet, so `POST /api/nlp/extract`
// honestly answers 503 `nlp_model_not_configured`. This module calls that real
// endpoint first; when the model is unavailable it keeps the patient's OWN words
// as a single unstructured complaint. That is deliberate:
//
//   * no structured symptom, body region, severity or duration is invented, so
//     the doctor never sees fabricated clinical data attributed to a model;
//   * the patient can still complete intake and the case is created, because no
//     core workflow may depend on the AI being available.
//
// When the model is connected, the backend response is used verbatim and the
// `modelBacked` flag decides whether structured fields appear.
import { ApiError, apiFetch } from './client';

interface ExtractResponse {
  symptoms: Array<{
    id?: string;
    label: string;
    bodyRegion?: string | null;
    severity?: number | null;
    durationDays?: number | null;
    notes?: string | null;
  }>;
  meta?: { modelBacked?: boolean; method?: string; disclaimer?: string };
}

/** True when the backend refused because no NLP model is configured. */
function isModelUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 503 ||
      error.code === 'nlp_model_not_configured' ||
      error.code === 'ai_model_not_configured')
  );
}

/**
 * The patient's free text, preserved verbatim.
 *
 * Used when extraction is unavailable so the clinical record still contains what
 * the patient actually said. `severity`/`durationDays` stay unset rather than
 * being guessed.
 */
export function unparsedSymptom(freeText: string): Symptom {
  return {
    id: `patient-reported-${Date.now()}`,
    label: freeText.trim().slice(0, 120) || 'Patient-reported complaint',
    notes: freeText.trim(),
  };
}

/**
 * Extracts structured symptoms from the patient's free text.
 *
 * Returns the patient's raw text as a single entry when the NLP model is not
 * available, so intake never blocks on the model.
 */
export async function extractSymptoms(freeText: string): Promise<Symptom[]> {
  const text = freeText.trim();
  if (!text) return [unparsedSymptom(freeText)];

  try {
    const response = await apiFetch<{ data: ExtractResponse }>('/nlp/extract', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    const extracted = response.data.symptoms ?? [];
    if (extracted.length === 0) return [unparsedSymptom(freeText)];
    return extracted.map((row, index) => ({
      id: row.id ?? `nlp-symptom-${index}-${Date.now()}`,
      label: row.label,
      bodyRegion: row.bodyRegion ?? undefined,
      severity: (row.severity ?? undefined) as Symptom['severity'],
      durationDays: row.durationDays ?? undefined,
      notes: row.notes ?? text,
    }));
  } catch (error) {
    if (isModelUnavailable(error)) return [unparsedSymptom(freeText)];
    // Network / auth problems are not "no model": surface them so the screen
    // can tell the patient the clinic system is unreachable.
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Follow-up questionnaire (deterministic, non-clinical)
// ---------------------------------------------------------------------------

const QUESTION_BANK: Array<{ key: string; type: 'yesno' | 'scale' }> = [
  { key: 'duration', type: 'scale' },
  { key: 'severity', type: 'scale' },
  { key: 'fever', type: 'yesno' },
  { key: 'dailyActivities', type: 'yesno' },
  { key: 'worsening', type: 'yesno' },
  { key: 'sleep', type: 'yesno' },
];

/**
 * 3-6 questions depending on how much the patient shared. The ids are unique per
 * invocation so answers are not confused between two intakes in one session.
 */
export function generateFollowUpQuestions(symptoms: Symptom[]): FollowUpQuestion[] {
  const count = Math.min(6, Math.max(3, symptoms.length + 2));
  const stamp = Date.now();
  return QUESTION_BANK.slice(0, count).map((q, i) => ({
    id: `fq-${stamp}-${i}`,
    question: `followup.questions.${q.key}`,
    type: q.type,
  }));
}
