// Zustand store: patient intake state, nurse console state, connectivity mirror.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '../services/api/client';
import type {
  ConnectivityStatus,
  FollowUpAnswer,
  FollowUpQuestion,
  PatientIntakeDraft,
  QueueCase,
  RecommendedTestItem,
  SubmittedCaseReceipt,
  Symptom,
  VitalSigns,
} from '../types';
import { setLanguage as setI18nLanguage, type AppLanguage } from '../i18n';
import { getConnectivity, subscribeConnectivity } from '../services/connectivity';
import {
  getVitalsQueue,
  sendToDoctor,
  submitIntake as submitIntakeFromService,
  submitVitals,
} from '../services/api/caseService';
import { generateFollowUpQuestions } from '../services/api/symptomExtraction';
import { getRecommendedTests, acknowledgeAssignment, completeAssignment } from '../services/api/recommendationService';
import * as authService from '../services/api/authService';
import type { AuthUser, Role } from '../types/auth';

// Re-exported for any callers that imported them from this module.
export type { AuthUser, Role } from '../types/auth';

const EMPTY_DRAFT: PatientIntakeDraft = { name: '', age: '', sex: null, phone: '' };
const SUBMITTED_CASE_KEY = '@medai_submitted_case_v1:';
let pendingSubmission: Promise<SubmittedCaseReceipt> | null = null;

const QUEUE_CACHE_KEY = '@medai_cached_queue_v1';

interface CaseStoreState {
  language: AppLanguage;
  role: Role;
  draft: PatientIntakeDraft;
  symptoms: Symptom[];
  followUpQuestions: FollowUpQuestion[];
  followUpAnswers: FollowUpAnswer[];
  submittedReceipt: SubmittedCaseReceipt | null;

  connectivity: ConnectivityStatus;
  hasBeenOffline: boolean;
  queue: QueueCase[];
  queueLastUpdated: string | null;
  selectedCaseId: string | null;
  recommendedTests: RecommendedTestItem[];

  setRole: (role: Role) => void;
  setLanguage: (lng: AppLanguage) => void;
  updateDraft: (patch: Partial<PatientIntakeDraft>) => void;
  setSymptoms: (
    symptoms: Symptom[] | ((prev: Symptom[]) => Symptom[]),
  ) => void;
  addFollowUpAnswer: (answer: FollowUpAnswer) => void;
  submitIntake: () => Promise<SubmittedCaseReceipt>;
  resetIntake: () => void;

  setConnectivity: (status: ConnectivityStatus) => void;
  refreshQueue: () => Promise<void>;
  loadCachedQueue: () => Promise<void>;
  refreshRecommendedTests: () => Promise<void>;
  selectCase: (id: string | null) => void;
  toggleUrgent: (caseId: string) => void;
  submitVitals: (vitals: VitalSigns, urgentFlag: boolean) => Promise<{ synced: boolean }>;
  sendToDoctor: (caseId?: string) => Promise<{ synced: boolean }>;
  setSelectedUrgent: (flag: boolean) => void;

    sendTestToPatient: (id: string) => Promise<void>;
  completeRecommendedTest: (id: string) => Promise<void>;
  // Auth state. The session itself lives in Flask + the token store; these
  // fields are the client-side mirror of /api/auth/me.
  user: AuthUser | null;
  isAuthenticated: boolean;
  register: (data: Omit<AuthUser, 'id' | 'language'> & { password?: string }) => Promise<void>;
  login: (identifier: string, secret: string, role: 'patient' | 'nurse') => Promise<boolean>;
  logout: () => void;
  updateProfile: (patch: Partial<AuthUser>) => void;
}

export const useCaseStore = create<CaseStoreState>((set, get) => ({
  language: 'sw',
  role: null,
  draft: { ...EMPTY_DRAFT },
  symptoms: [],
  followUpQuestions: [],
  followUpAnswers: [],
  submittedReceipt: null,

  connectivity: getConnectivity(),
  hasBeenOffline: false,
  queue: [],
  queueLastUpdated: null,
  selectedCaseId: null,
  recommendedTests: [],

  // Auth initial state
  user: null,
  isAuthenticated: false,

  setRole: (role) => set({ role }),

  setLanguage: (lng) => {
    setI18nLanguage(lng);
    set({ language: lng });
  },

  updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

  setSymptoms: (value) =>
    set((s) => {
      // Accepts an updater fn so multiple synchronous calls in one handler
      // (e.g. batch symptom extraction) never clobber each other.
      const next = typeof value === 'function' ? value(s.symptoms) : value;
      return {
        symptoms: next,
        // Deterministic, non-clinical questionnaire generated from what was shared.
        followUpQuestions: generateFollowUpQuestions(next),
        followUpAnswers: [],
      };
    }),

  addFollowUpAnswer: (answer) =>
    set((s) => ({
      followUpAnswers: [
        ...s.followUpAnswers.filter((a) => a.questionId !== answer.questionId),
        answer,
      ],
    })),

  submitIntake: async () => {
    if (pendingSubmission) return pendingSubmission;
    const { draft, language, symptoms, followUpAnswers, submittedReceipt, isAuthenticated } = get();
    if (submittedReceipt?.synced) return submittedReceipt;
    pendingSubmission = (async () => {
      // Intake collects the account secret on BasicDetails. If the session
      // lapsed (e.g. a fresh Expo Web sessionStorage), register-or-sign-in with
      // the saved secret first so POST /cases always carries a JWT.
      //
      // The account the backend returns is kept: the receipt below is cached
      // under that user id, which is what lets a refresh restore the patient's
      // confirmed case. Discarding it (the previous behaviour) lost the
      // confirmation on every page reload.
      let session = get().user;
      if (!isAuthenticated && draft.phone.trim() && (draft.password ?? '').length >= 4) {
        const secret = draft.password as string;
        try {
          session = await authService.register(
            { name: draft.name.trim(), phone: draft.phone.trim(), role: 'patient', password: secret },
            language,
          );
        } catch (registerError) {
          const isConflict =
            registerError instanceof ApiError &&
            (registerError.status === 409 || registerError.code === 'conflict');
          if (!isConflict) throw registerError;
          session = (await authService.login(draft.phone.trim(), secret, 'patient')) ?? session;
        }
        set({ user: session, isAuthenticated: true, role: session?.role ?? 'patient' });
      }
      const receipt = await submitIntakeFromService(draft, language, symptoms, followUpAnswers);
      set({ submittedReceipt: receipt });
      // A cache failure must never turn a successful POST into a retry/duplicate.
      if (session) {
        try {
          await AsyncStorage.setItem(`${SUBMITTED_CASE_KEY}${session.id}`, JSON.stringify(receipt));
        } catch { /* The confirmed case remains in memory and on the backend. */ }
      }
      return receipt;
    })();
    try { return await pendingSubmission; }
    finally { pendingSubmission = null; }
  },

  resetIntake: () => {
    const userId = get().user?.id;
    if (userId) void AsyncStorage.removeItem(`${SUBMITTED_CASE_KEY}${userId}`).catch(() => {});
    set({
      draft: { ...EMPTY_DRAFT },
      symptoms: [],
      followUpQuestions: [],
      followUpAnswers: [],
      submittedReceipt: null,
    });
  },

  setConnectivity: (status) =>
    set((s) => ({
      connectivity: status,
      hasBeenOffline: s.hasBeenOffline || status === 'offline',
    })),

  refreshQueue: async () => {
    const queue = await getVitalsQueue();
    set({ queue, queueLastUpdated: new Date().toISOString() });
    try {
      await AsyncStorage.setItem(QUEUE_CACHE_KEY, JSON.stringify(queue));
    } catch {
      // Cache write is best-effort.
    }
  },

  loadCachedQueue: async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as QueueCase[];
        set((s) => ({ queue: s.queue.length ? s.queue : cached }));
      }
    } catch {
      // No cache available — screen shows its empty state.
    }
  },

    refreshRecommendedTests: async () => {
    // Assignments remain separate from initial patient visibility.
    const items = await getRecommendedTests();
    set({ recommendedTests: items });
  },

  sendTestToPatient: async (id: string) => {
    // Real lifecycle write: the backend stores `acknowledged` and the list is
    // re-read afterwards so the badge can never disagree with the database.
    const assignmentId = id.split(':', 1)[0];
    await acknowledgeAssignment(assignmentId);
    set({ recommendedTests: await getRecommendedTests() });
  },

  completeRecommendedTest: async (id: string) => {
    // Terminal state. The doctor sees `completed` (and completedAt) on refresh.
    const assignmentId = id.split(':', 1)[0];
    await completeAssignment(assignmentId);
    set({ recommendedTests: await getRecommendedTests() });
  },

  selectCase: (id) => set({ selectedCaseId: id }),

  toggleUrgent: (caseId) =>
    set((s) => ({
      queue: s.queue.map((q) =>
        q.case.id === caseId ? { ...q, case: { ...q.case, urgent: !q.case.urgent } } : q,
      ),
    })),

  submitVitals: async (vitals, urgentFlag) => {
    const selected = get().selectedCaseId;
    if (!selected) throw new Error('No patient selected');
    const result = await submitVitals(selected, vitals, urgentFlag);
    set((s) => ({
      queue: s.queue.map((q) =>
        q.case.id === selected
          ? { ...q, case: { ...q.case, vitals, urgent: urgentFlag } }
          : q,
      ),
    }));
    return result;
  },

  sendToDoctor: async (caseId) => {
    const id = caseId ?? get().selectedCaseId;
    if (!id) throw new Error('No patient selected');
    const result = await sendToDoctor(id);
    set((s) => ({
      queue: s.queue.filter((q) => q.case.id !== id),
      selectedCaseId: s.selectedCaseId === id ? null : s.selectedCaseId,
    }));
    return result;
  },

  setSelectedUrgent: (flag) =>
    set((s) => ({
      queue: s.queue.map((q) =>
        q.case.id === s.selectedCaseId
          ? { ...q, case: { ...q.case, urgent: flag } }
          : q,
      ),
    })),

  // Auth actions. These delegate to authService, which talks to the real
  // Flask /api/auth endpoints and stores the returned JWTs.
  register: async (data) => {
    const user = await authService.register(data, get().language);
    // Keep the intake secret in memory so Review/Confirm can re-establish a
    // session if Expo Web storage was cleared mid-flow.
    if (data.role === 'patient' && data.password) {
      set((s) => ({ draft: { ...s.draft, password: data.password } }));
    }
    // Set the role alongside the session so the correct role-gated screen set
    // (nurse → PatientQueue, patient → patient flow) mounts in the navigator.
    set({ user, isAuthenticated: true, role: user.role });
  },

  login: async (identifier, secret, role) => {
    const user = await authService.login(identifier, secret, role);
    if (!user) return false;
    if (role === 'patient') {
      set((s) => ({ draft: { ...s.draft, password: secret } }));
    }
    set({ user, isAuthenticated: true, role: user.role });
    return true;
  },

  logout: () => {
    void authService.logout();
    set({ user: null, isAuthenticated: false, role: null, draft: { ...EMPTY_DRAFT },
      symptoms: [], followUpQuestions: [], followUpAnswers: [], submittedReceipt: null,
      queue: [], recommendedTests: [], selectedCaseId: null });
  },

  updateProfile: (patch) =>
    set((s) => {
      if (!s.user) return {};
      return { user: { ...s.user, ...patch } };
    }),
}));

/** Bridges the connectivity module into the store, one subscription. */
let bound = false;
export function bindConnectivityToStore() {
  if (bound) return;
  bound = true;
  subscribeConnectivity((status) => useCaseStore.getState().setConnectivity(status));
}

// Restore auth state from storage on module load.
export async function restoreAuthState() {
  try {
    const user = await authService.restoreSession();
    if (user) {
      // Restore the role as well, so a persisted nurse session re-mounts the
      // nurse interface (PatientQueue) rather than leaving the wrong stack.
      useCaseStore.setState({ user, isAuthenticated: true, role: user.role });
      const raw = await AsyncStorage.getItem(`${SUBMITTED_CASE_KEY}${user.id}`);
      if (raw) {
        const receipt = JSON.parse(raw) as SubmittedCaseReceipt;
        const submitted = receipt.submittedCase;
        if (receipt.synced && submitted?.id === receipt.caseId && submitted.patient.id === user.id) {
          useCaseStore.setState({
            submittedReceipt: receipt,
            draft: { name: submitted.patient.name, age: String(submitted.patient.age),
              sex: submitted.patient.sex, phone: submitted.patient.phone ?? '', location: submitted.location },
            symptoms: submitted.symptoms,
            followUpAnswers: submitted.followUpAnswers,
          });
        }
      }
    }
  } catch {
    // No stored auth
  }
}

export default useCaseStore;
