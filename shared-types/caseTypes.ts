// TODO: extract to a proper shared package once both apps stabilize
// Copy of the shared types — mobile/src/types and web/src/types re-export these.

export type Sex = 'M' | 'F';

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: Sex;
  phone: string;
  language: 'sw' | 'en';
}

export interface VitalSigns {
  temperatureC?: number; // °C
  bloodPressureSystolic?: number; // mmHg
  bloodPressureDiastolic?: number; // mmHg
  heartRate?: number; // bpm
  respiratoryRate?: number; // breaths/min
  oxygenSaturation?: number; // SpO2 percentage
  bloodGlucoseMgDl?: number; // mg/dL
  weightKg?: number;
  recordedAt?: string; // ISO timestamp
}

export interface VitalsReading {
  id: string;
  patientId: string;
  vitals: VitalSigns;
  urgentFlag: boolean;
  recordedBy?: string;
  recordedAt: string; // ISO timestamp
}

export type SymptomConsistency =
  | 'yes'
  | 'no'
  | 'sometimes'
  | 'unknown';

export interface Symptom {
  id: string;
  label: string; // plain-language name (localized in UI)
  bodyRegion?: string;
  severity?: 1 | 2 | 3 | 4 | 5; // 1 = mild, 5 = severe
  durationDays?: number;
  notes?: string;
}

export interface FollowUpAnswer {
  questionId: string;
  question: string;
  answer: boolean | number | null; // boolean for yes/no, number 1–5 for scale, null = not sure
}

export interface Case {
  id: string;
  patient: Patient;
  chiefComplaint: string; // free-text from patient
  symptoms: Symptom[];
  followUpAnswers: FollowUpAnswer[];
  vitals?: VitalSigns;
  urgent: boolean;
  status:
    | 'submitted'
    | 'ai_assessed'
    | 'doctor_reviewing'
    | 'sent_to_nurse'
    | 'tests_in_progress'
    | 'tests_completed'
    | 'doctor_final_review'
    | 'treatment'
    | 'doctor_unavailable'
    | 'appointment_required'
    | 'follow_up'
    | 'intake_pending'
    | 'vitals_pending'
    | 'awaiting_review'
    | 'in_review'
    | 'completed';
  createdAt: string; // ISO timestamp
  history?: string[]; // relevant past history snippets
}

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export type RecommendedTestType = 'lab' | 'vital';

export interface RecommendedTest {
  id: string;
  name: string;
  type?: RecommendedTestType;
}

export interface AIRecommendation {
  diseaseName: string;
  confidence: ConfidenceLevel;
  confidenceScore?: number; // optional, secondary display only
  topSymptomsSummary: string; // one line
  reasoningFactors: string[]; // shown in the "Why?" drawer
  recommendedTests: RecommendedTest[];
}

export type RecommendationFeedback =
  | 'accurate'
  | 'partially_accurate'
  | 'not_accurate';

export interface FeedbackRecord {
  caseId: string;
  recommendationIndex: number;
  diseaseName: string;
  decision: 'confirmed' | 'adjusted';
  feedback?: RecommendationFeedback;
  timestamp: string;
}

export interface QueueCase {
  case: Case;
  arrivalOrder: number;
}

export type QueueStatus = 'connected' | 'offline' | 'syncing';