import { fetchApi } from './client';
import type { ProjectSummary } from '../types';

export function getProjects() {
  return fetchApi<ProjectSummary[]>('/projects');
}

export function getProjectDetail(project: string) {
  return fetchApi<ProjectSummary>(`/projects/${encodeURIComponent(project)}`);
}
