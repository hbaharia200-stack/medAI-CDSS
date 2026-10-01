// Flushes the offline queue in order when connectivity returns, marking each
// item synced (removed from the queue) or failed (kept for retry).
import { getConnectivity, setConnectivity, subscribeConnectivity } from './connectivity';
import { getPendingActions, markActionError, removeAction } from './offlineQueue';
import { replayAction } from './api/caseService';

let flushing = false;

export async function flushPendingQueue(): Promise<void> {
  if (flushing) return;
  const pending = await getPendingActions();
  if (pending.length === 0) return;

  flushing = true;
  const was = getConnectivity();
  setConnectivity('syncing');

  try {
    for (const action of pending) {
      try {
        await replayAction(action);
        await removeAction(action.id);
      } catch (e) {
        await markActionError(
          action.id,
          e instanceof Error ? e.message : 'unknown error',
        );
        // Keep going with the next item; failed ones stay queued for retry.
      }
    }
  } finally {
    flushing = false;
    setConnectivity(was === 'offline' ? 'online' : was);
  }
}

export const syncManager = {
  flushPendingQueue,
  start(): () => void {
    return subscribeConnectivity((status) => {
      if (status === 'online' || status === 'syncing') {
        void flushPendingQueue();
      }
    });
  },
};

export default syncManager;