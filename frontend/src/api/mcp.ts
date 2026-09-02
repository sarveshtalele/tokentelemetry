import { fetchApi } from './client';
import type { McpServer } from '../types';

export function getMcpServers() {
  return fetchApi<McpServer[]>('/mcp');
}
