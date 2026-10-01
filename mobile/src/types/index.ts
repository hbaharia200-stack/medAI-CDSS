// TODO: extract to a proper shared package once both apps stabilize
// This is a physical copy of shared-types/caseTypes.ts (Metro cannot bundle
// outside the project root yet). Keep the two copies in sync.

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
  location?: PatientIntakeDraft['location'];
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

export type ConnectivityStatus = 'online' | 'offline' | 'syncing';

// Fields captured in the patient intake flow (before a Case id exists).
export interface PatientIntakeDraft {
  name: string;
  age: string; // raw input, parsed before submit
  sex: Sex | null;
  phone: string;
  /** Patient account secret, held in memory only for auto sign-in at submit. */
  password?: string;
  location?: {
    latitude: number;
    longitude: number;
    capturedAt: string;
  };
}

export interface FollowUpQuestion {
  id: string;
  question: string; // localization key
  type: 'yesno' | 'scale';
  options?: { low: string; high: string }; // localization keys
}

export interface SubmittedCaseReceipt {
  submittedCase?: Case;
  caseId: string;
  queueNumber: string;
  estimatedWaitMinutes: number;
  synced: boolean;
}

// ---------------------------------------------------------------------------
// Recommended Tests — the Doctor -> Nurse assignment contract.
// These originate from the Doctor/Admin (web) workflow, never created manually
// by the nurse. The nurse only sees them and performs the work. They are read
// from `GET /api/nurses/me/recommendations` and updated through
// `PATCH /api/nurses/assignments/<id>/status`.
// ---------------------------------------------------------------------------

export type RecommendedTestStatus = 'recommended' | 'ordered' | 'in_progress' | 'completed';

export interface RecommendedTestItem {
  id: string;
  assignmentId?: string;
  caseId: string;
  patientName: string;
  testName: string;
  type?: RecommendedTestType;
  /** Origin of the recommendation — Doctor/Admin workflow (or AI assist). */
  recommendationSource: 'doctor' | 'ai';
  status: RecommendedTestStatus;
  createdAt: string; // ISO timestamp
  /** Whether the nurse has sent this test recommendation to the patient's view. */
  sentToPatient: boolean;
  /** ISO timestamp when the test was sent to the patient (if applicable). */
  sentAt?: string;
}