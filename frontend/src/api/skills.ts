import { fetchApi } from './client';
import type { SkillStats } from '../types';

export function getSkills() {
  return fetchApi<SkillStats[]>('/skills');
}
