export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
export type Api = <T = any>(path: string, body?: unknown) => Promise<T>;
export function createApi(getToken: () => Promise<string | null>): Api {
  if (process.env.EXPO_PUBLIC_UI_PREVIEW === 'true') return previewApi;
  return async <T,>(path: string, body?: unknown): Promise<T> => {
    if (!apiUrl || !/^https:\/\//.test(apiUrl)) throw Error('Configure an HTTPS app API URL first.');
    const token = await getToken();
    const response = await fetch(`${apiUrl}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'omit',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    let result;
    try { result = await response.json(); } catch { throw Error('The server could not respond. Try again.'); }
    if (!response.ok) throw Error(result.error || `Request failed (${response.status}).`);
    return result as T;
  };
}
import { previewApi } from './preview/api';
