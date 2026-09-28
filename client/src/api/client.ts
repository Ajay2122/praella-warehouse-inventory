const TOKEN_KEY = 'praella_wms_tokens';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function getTokens(): TokenPair | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as TokenPair) : null;
}

export function setTokens(tokens: TokenPair | null): void {
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

// In local dev (Vite proxy) and the Docker build (nginx proxies /api to the
// api container), the frontend and API share an origin, so a relative path
// is enough. Hosted separately (Vercel frontend, Railway backend - different
// origins), VITE_API_URL must be set to the backend's full URL at build
// time; falling back to relative would silently call the frontend's own
// origin instead of the API.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path, API_BASE_URL || window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return API_BASE_URL ? url.toString() : url.pathname + url.search;
}

async function rawRequest<T>(path: string, opts: RequestOptions, accessToken?: string): Promise<T> {
  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const json = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code ?? 'UNKNOWN', json?.error?.message ?? res.statusText);
  }
  return json as T;
}

// De-duped so concurrent 401s (e.g. several widgets fetching at once)
// trigger exactly one refresh call, not one per failed request.
let refreshPromise: Promise<TokenPair | null> | null = null;

async function refreshTokens(): Promise<TokenPair | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  try {
    const res = await rawRequest<{ data: TokenPair }>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: tokens.refreshToken },
    });
    setTokens(res.data);
    return res.data;
  } catch {
    setTokens(null);
    return null;
  }
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const tokens = getTokens();
  try {
    return await rawRequest<T>(path, opts, tokens?.accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && tokens) {
      refreshPromise ??= refreshTokens().finally(() => {
        refreshPromise = null;
      });
      const refreshed = await refreshPromise;
      if (refreshed) return rawRequest<T>(path, opts, refreshed.accessToken);
      window.location.assign('/login');
    }
    throw err;
  }
}
