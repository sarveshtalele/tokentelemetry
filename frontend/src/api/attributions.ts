import { fetchApi } from './client';
import type { Attribution } from '../types';

export function getAttributions() {
  return fetchApi<Attribution[]>('/attributions');
}
