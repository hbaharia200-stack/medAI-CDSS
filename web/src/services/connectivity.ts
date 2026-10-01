// Central connectivity state for the web app.
//
// This is a manual development toggle so offline behaviour can be exercised
// without a device. It is a UI affordance only: when the backend is reachable
// the queue/case services always read from Flask, and this flag is never treated
// as a source of truth.

let status: 'online' | 'offline' = 'online';
const listeners = new Set<(s: 'online' | 'offline') => void>();

export function getConnectivity(): 'online' | 'offline' {
  return status;
}

export function setConnectivity(next: 'online' | 'offline') {
  status = next;
  listeners.forEach((l) => l(next));
}

export function subscribeConnectivity(l: (s: 'online' | 'offline') => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}