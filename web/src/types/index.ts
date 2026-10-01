// TODO: extract to a proper shared package once both apps stabilize
// This is a physical copy of shared-types/caseTypes.ts for the web app.

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
  label: string;
  bodyRegion?: string;
  severity?: 1 | 2 | 3 | 4 | 5;
  durationDays?: number;
  notes?: string;
}

export interface FollowUpAnswer {
  questionId: string;
  question: string;
  answer: boolean | number | null;
}

export interface Case {
  id: string;
  patient: Patient;
  chiefComplaint: string;
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
  createdAt: string;
  history?: string[];
  location?: { latitude: number; longitude: number; capturedAt?: string } | null;
  nurseId?: string | null;
  doctorId?: string | null;
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

// ---------------------------------------------------------------------------
// Recommended Test Assignment contract
// ---------------------------------------------------------------------------
// This is the data contract between the Doctor (Web) and the Nurse (Mobile).
// The Web doctor selects tests in the AI recommendation card → clicks "Send to
// Nurse" → a RecommendedTestAssignment is created and stored locally. When a
// backend is added, the same shape flows through the API.

export type AssignmentStatus = 'pending' | 'sent' | 'acknowledged' | 'completed';

export interface RecommendedTestAssignment {
  id: string;
  caseId: string;
  patientId: string;
  nurseId?: string | null;
  doctorId: string;
  doctorName: string;
  tests: RecommendedTest[];
  status: AssignmentStatus;
  createdAt: string; // ISO
  /** Lifecycle timestamps recorded by the backend (ISO) or null. */
  sentAt?: string | null;
  acknowledgedAt?: string | null;
  completedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Doctor notification (for the bell badge count)
// ---------------------------------------------------------------------------

export interface DoctorNotification {
  id: string;
  type: 'new_patient' | 'new_recommendation' | 'recommended_test' | 'new_message' | 'upcoming_appointment';
  title: string;
  body: string;
  caseId?: string;
  read: boolean;
  createdAt: string; // ISO
}

export type QueueStatus = 'synced' | 'pending' | 'error';

export interface ClinicUser {
  id: string;
  name: string;
  role: 'doctor' | 'nurse' | 'admin' | 'staff' | 'patient';
  specialty?: string;
  active: boolean;
  lastActive: string;
}

export interface SystemHealth {
  uptimePercent: number;
  syncStatus: Array<{ deviceId: string; device: string; syncedAt: string; status: 'synced' | 'pending' | 'error' }>;
  errorCount24h: number;
  apiLatencyMs: number;
}

export interface DiseaseTrendPoint {
  month: string;
  malaria: number;
  pneumonia: number;
  typhoid: number;
  hypertension: number;
}

export interface RegionTrend {
  region: string;
  count: number;
}

export interface MonthlyGrowthPoint {
  month: string;
  patients: number;
}

export interface AgeBucket {
  bracket: string;
  count: number;
}

export interface GenderSlice {
  label: string;
  count: number;
}

export interface DiagnosisCount {
  category: string;
  count: number;
}

export interface PerformancePoint {
  week: string;
  acceptanceRate: number;
  avgTimeMin: number;
}

export interface SatisfactionSlice {
  rating: string;
  count: number;
}

export interface AuditLogEntry {
  id: string;
  user: string;
  role: string;
  patientRecordId: string;
  action: string;
  timestamp: string;
}

export interface AdminAnalytics {
  diseaseTrends: DiseaseTrendPoint[];
  byRegion: RegionTrend[];
  recommendationAcceptanceRate: number; // 0-100
  avgTimeToDecisionMin: number;
  recommendationCount: number;
  confirmedCount: number;
  patientGrowth: MonthlyGrowthPoint[];
  ageDistribution: AgeBucket[];
  genderSplit: GenderSlice[];
  diagnosisStats: DiagnosisCount[];
  performanceTrend: PerformancePoint[];
  patientSatisfaction: SatisfactionSlice[];
  patientSatisfactionAvg: number; // 0-5
}

// Recent system error feed for the System Health page (error monitoring).
export interface SystemErrorEvent {
  id: string;
  timestamp: string;
  level: 'error' | 'warning';
  source: string;
  message: string;
}

export { type Device, type DeviceStatus, type InspectionData, type DeviceStatistics, type MaintenanceRecord } from './device';