// Read only recommendations already stored by the clinical backend.
// Case viewing never substitutes mock conditions or invokes model generation.
import type { AIRecommendation } from '../../types';
import { getConnectivity } from '../connectivity';
import { apiFetch } from './client';

export class NetworkError extends Error {
  constructor() {
    super('network-offline');
    this.name = 'NetworkError';
  }
}

export async function getAIRecommendations(caseId: string): Promise<AIRecommendation[]> {
  if (getConnectivity() === 'offline') throw new NetworkError();
  const response = await apiFetch<{ data: AIRecommendation[] }>(
    `/cases/${encodeURIComponent(caseId)}/recommendations`,
  );
  return response.data;
}
