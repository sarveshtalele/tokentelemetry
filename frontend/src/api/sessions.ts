import { fetchApi } from './client';
import type { SessionRow } from '../types';

export function getSessions() {
  return fetchApi<SessionRow[]>('/sessions');
}
