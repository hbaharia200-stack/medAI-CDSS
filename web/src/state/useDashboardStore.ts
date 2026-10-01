// Zustand store for the Doctor Dashboard (and shared connectivity state).
import { create } from 'zustand';
import type {
  AIRecommendation,
  FeedbackRecord,
  QueueCase,
  RecommendationFeedback,
} from '../types';
import {
  getConnectivity,
  subscribeConnectivity,
} from '../services/connectivity';
import { getQueue, NetworkError as QueueNetworkError, confirmDiagnosis, submitRecommendationFeedback } from '../services/api/caseService';
import { getAIRecommendations } from '../services/api/aiService';
import {
  getCachedRecommendations,
  setCachedRecommendations,
} from '../services/cache';
import { sortQueue } from '../utils/queueSort';

type Connectivity = 'online' | 'offline';

interface DashboardState {
  connectivity: Connectivity;
  queue: QueueCase[];
  queueLoading: boolean;
  queueError: string | null;
  selectedCaseId: string | null;

  recommendations: Record<string, AIRecommendation[]>;
  loadingRecs: Record<string, boolean>;
  recError: string | null;
  recSource: 'live' | 'cache';

  orderedTests: Record<string, string[]>; // caseId -> ordered test ids
  decisions: FeedbackRecord[];
  completedCaseIds: string[];

  setConnectivity: (c: Connectivity) => void;
  loadQueue: () => Promise<void>;
  selectCase: (id: string | null) => void;
  loadRecommendations: (caseId: string) => Promise<void>;
  toggleOrderTest: (caseId: string, testId: string) => void;
  confirmDiagnosis: (caseId: string, idx: number, diseaseName: string) => Promise<void>;
  adjustRecommendation: (caseId: string, idx: number, diseaseName: string) => Promise<void>;
  submitFeedback: (
    caseId: string,
    diseaseName: string,
    feedback: RecommendationFeedback,
  ) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  connectivity: getConnectivity(),
  queue: [],
  queueLoading: false,
  queueError: null,
  selectedCaseId: null,

  recommendations: {},
  loadingRecs: {},
  recError: null,
  recSource: 'live',

  orderedTests: {},
  decisions: [],
  completedCaseIds: [],

  setConnectivity: (c) => set({ connectivity: c }),

  loadQueue: async () => {
    set({ queueLoading: true, queueError: null });
    try {
      const queue = await getQueue();
      set({ queue, queueLoading: false });
      // Preselect the top of the clinically-sorted queue (urgent pinned
      // first, then earliest arrival) so the layout opens on the most
      // urgent patient and is never empty.
      if (!get().selectedCaseId && queue.length > 0) {
        set({ selectedCaseId: sortQueue(queue)[0].case.id });
      }
    } catch (e) {
      set({
        queueLoading: false,
        queue: [],
        queueError: e instanceof QueueNetworkError ? 'offline-no-cache' : 'unknown',
      });
    }
  },

  selectCase: (id) =>
    set({
      selectedCaseId: id,
      // Selecting another case resets recError so the panel can retry live.
      recError: null,
    }),

  loadRecommendations: async (caseId) => {
    if (get().loadingRecs[caseId]) return;
    set((s) => ({ loadingRecs: { ...s.loadingRecs, [caseId]: true }, recError: null }));
    try {
      const recs = await getAIRecommendations(caseId);
      setCachedRecommendations(caseId, recs);
      set((s) => ({
        recommendations: { ...s.recommendations, [caseId]: recs },
        loadingRecs: { ...s.loadingRecs, [caseId]: false },
        recError: null,
        recSource: 'live',
      }));
    } catch {
      // Offline: fall back to the last-known recommendations for this case.
      const cached = getCachedRecommendations(caseId);
      set((s) => ({
        recommendations: cached
          ? { ...s.recommendations, [caseId]: cached }
          : s.recommendations,
        loadingRecs: { ...s.loadingRecs, [caseId]: false },
        recError: cached ? null : 'offline-no-cache',
        recSource: cached ? 'cache' : s.recSource,
      }));
    }
  },

  toggleOrderTest: (caseId, testId) =>
    set((s) => {
      const current = s.orderedTests[caseId] ?? [];
      const next = current.includes(testId)
        ? current.filter((i) => i !== testId)
        : [...current, testId];
      return { orderedTests: { ...s.orderedTests, [caseId]: next } };
    }),

  confirmDiagnosis: async (caseId, idx, diseaseName) => {
    await confirmDiagnosis(caseId, diseaseName); // mocked "server" call
    set((s) => ({
      decisions: [
        ...s.decisions,
        {
          caseId,
          recommendationIndex: idx,
          diseaseName,
          decision: 'confirmed',
          timestamp: new Date().toISOString(),
        },
      ],
      completedCaseIds: [...s.completedCaseIds, caseId],
    }));
  },

  adjustRecommendation: async (caseId, idx, diseaseName) => {
    set((s) => ({
      decisions: [
        ...s.decisions,
        {
          caseId,
          recommendationIndex: idx,
          diseaseName,
          decision: 'adjusted',
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  },

  submitFeedback: async (caseId, diseaseName, feedback) => {
    await submitRecommendationFeedback(caseId, diseaseName, feedback); // mocked
    set((s) => ({
      decisions: s.decisions.map((d) =>
        d.caseId === caseId && d.decision === 'confirmed'
          ? { ...d, feedback }
          : d,
      ),
    }));
  },
}));

/** Bridge the connectivity module into the store. */
subscribeConnectivity((c) => useDashboardStore.getState().setConnectivity(c));

export default useDashboardStore;