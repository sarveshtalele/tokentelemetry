import { fetchApi } from './client';
import type { PluginStats, HookStats } from '../types';

export function getPlugins() {
  return fetchApi<{ plugins: PluginStats[]; hooks: HookStats[] }>('/plugins');
}
