import { fetchApi } from './client';
import type { ClientStats } from '../types';

export function getClients() {
  return fetchApi<ClientStats[]>('/clients');
}
