import { fetchApi } from './client';
import type { SettingsInfo } from '../types';

export function getSettings() {
  return fetchApi<SettingsInfo>('/settings');
}

export function triggerReconcile() {
  return fetchApi<{ changed: number }>('/settings/reconcile', { method: 'POST' });
}
