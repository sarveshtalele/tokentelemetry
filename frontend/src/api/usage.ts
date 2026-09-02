import { fetchApi } from './client';
import type { UsageRow, TimelinePoint } from '../types';

export function getUsage(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  return fetchApi<UsageRow[]>(`/usage${q}`);
}

export function getUsageTimeline(days = 30) {
  return fetchApi<TimelinePoint[]>(`/usage/timeline?days=${days}`);
}

export function getUsageByProject(project: string) {
  return fetchApi<UsageRow[]>(`/usage/project/${encodeURIComponent(project)}`);
}
