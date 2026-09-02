import { fetchApi } from './client';
import type { ToolStats } from '../types';

export function getTools() {
  return fetchApi<ToolStats[]>('/tools');
}
