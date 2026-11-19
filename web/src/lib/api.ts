// Thin JSON client for the CLAIRE server. Token lives in localStorage `cc_token`.
export const TOKEN_KEY = 'cc_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: session stays in memory only */
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
/** Called when the server rejects our token (401) — the session store logs out. */
export function onUnauthorized(fn: UnauthorizedListener) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const m = b.error ?? b.message ?? b.msg;
    if (typeof m === 'string' && m) return m;
  }
  if (typeof body === 'string' && body && body.length < 200) return body;
  if (status === 0) return 'No connection. Check your internet and try again.';
  if (status >= 500) return 'The server had a problem. Please try again.';
  return `Request failed (${status})`;
}

async function request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const url = path.startsWith('http') || path.startsWith('/') ? path : `/${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, messageFrom(null, 0));
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    if (res.status === 401 && token) unauthorizedListeners.forEach((fn) => fn());
    throw new ApiError(res.status, messageFrom(data, res.status), data);
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T = any>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T = any>(path: string) => request<T>('DELETE', path),
  upload: <T = any>(path: string, form: FormData) => request<T>('POST', path, form, true),
};

export type Api = typeof api;

/** Human-readable message for any thrown value. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong');
