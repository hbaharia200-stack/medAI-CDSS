// Last-known-queue cache so a brief simulated outage doesn't blank the screen.
import type { AIRecommendation, QueueCase } from '../types';

const QUEUE_KEY = 'medai.web.queue.api.v2';
const RECS_PREFIX = 'medai.web.recs.api.v2.';

function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/blocked — non-fatal.
  }
}

export function setCachedQueue(queue: QueueCase[]): void {
  safeSet(QUEUE_KEY, queue);
}

export function getCachedQueue(): QueueCase[] | null {
  return safeGet<QueueCase[]>(QUEUE_KEY);
}

export function setCachedRecommendations(caseId: string, recs: AIRecommendation[]): void {
  safeSet(`${RECS_PREFIX}${caseId}`, recs);
}

export function getCachedRecommendations(caseId: string): AIRecommendation[] | null {
  return safeGet<AIRecommendation[]>(`${RECS_PREFIX}${caseId}`);
}