const BASE_URL = '/api';

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getConfig: () => get<import('./types').ConfigResponse>('/api/config'),
  getLayers: () => get<import('./types').ConfigResponse>('/api/layers'),
  getEvents: (params?: Record<string, string>) => get<import('./types').EventsResponse>('/api/events', params),
  refreshLayers: (layers?: string[]) => post<import('./types').RefreshResponse>('/api/layers/refresh', { layers }),
};
