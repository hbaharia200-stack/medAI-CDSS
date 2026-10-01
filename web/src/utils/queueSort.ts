import type { QueueCase } from '../types';

/**
 * Canonical clinical queue order: urgent patients pinned to the top,
 * then by arrival time (earliest first). Used by the queue list AND the
 * initial case preselect so the dashboard opens on the most urgent patient.
 */
export function sortQueue(queue: QueueCase[]): QueueCase[] {
  return [...queue].sort((a, b) => {
    if (a.case.urgent !== b.case.urgent) return a.case.urgent ? -1 : 1;
    return new Date(a.case.createdAt).getTime() - new Date(b.case.createdAt).getTime();
  });
}