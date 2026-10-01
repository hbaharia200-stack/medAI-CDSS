// Central connectivity state — services read this, the UI store mirrors it.
// Real detection is NetInfo; a manual dev toggle is also available for testing.
import NetInfo from '@react-native-community/netinfo';

export type ConnectivityStatus = 'online' | 'offline' | 'syncing';

let status: ConnectivityStatus = 'online';
const listeners = new Set<(s: ConnectivityStatus) => void>();

export function getConnectivity(): ConnectivityStatus {
  return status;
}

export function setConnectivity(next: ConnectivityStatus) {
  status = next;
  listeners.forEach((l) => l(next));
}

export function subscribeConnectivity(l: (s: ConnectivityStatus) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Manual dev toggle so offline behaviour can be tested without a device. */
export function forceConnectivityForDev(next: ConnectivityStatus) {
  setConnectivity(next);
}

let started = false;
export function startConnectivityMonitor() {
  if (started) return () => {};
  started = true;
  const unsub = NetInfo.addEventListener((state) => {
    setConnectivity(state.isConnected === false ? 'offline' : 'online');
  });
  return unsub;
}