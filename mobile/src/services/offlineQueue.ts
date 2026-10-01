// AsyncStorage-backed pending-actions queue. Every write made while offline is
// recorded here, in order, and replayed by syncManager when connectivity returns.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Case, VitalSigns } from '../types';

export type PendingActionType =
  | 'submit_intake'
  | 'submit_vitals'
  | 'send_to_doctor';

export interface PendingAction {
  id: string;
  type: PendingActionType;
  payload: {
    intakeCase?: Case; // submit_intake
    caseId?: string; // submit_vitals / send_to_doctor
    vitals?: VitalSigns;
    urgentFlag?: boolean;
  };
  createdAt: string;
  lastError?: string;
}

const STORAGE_KEY = '@medai_pending_actions_v1';

async function readAll(): Promise<PendingAction[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingAction[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: PendingAction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Non-fatal: in-memory list is still used for this session.
  }
}

let memoryActions: PendingAction[] | null = null;
async function ensureLoaded(): Promise<PendingAction[]> {
  if (memoryActions === null) {
    memoryActions = await readAll();
  }
  return memoryActions;
}

export async function enqueueAction(
  type: PendingActionType,
  payload: PendingAction['payload'],
): Promise<PendingAction> {
  const item: PendingAction = {
    id: `${type}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  const all = await ensureLoaded();
  all.push(item);
  memoryActions = all;
  await writeAll(all);
  return item;
}

export async function getPendingActions(): Promise<PendingAction[]> {
  return [...(await ensureLoaded())];
}

export async function removeAction(id: string): Promise<void> {
  const all = await ensureLoaded();
  const next = all.filter((a) => a.id !== id);
  memoryActions = next;
  await writeAll(next);
}

export async function markActionError(id: string, error: string): Promise<void> {
  const all = await ensureLoaded();
  memoryActions = all.map((a) =>
    a.id === id ? { ...a, lastError: error } : a,
  );
  await writeAll(memoryActions);
}

export async function clearPendingActions(): Promise<void> {
  memoryActions = [];
  await writeAll([]);
}