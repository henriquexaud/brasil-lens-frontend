import type { ApiErrorBody } from './types';

const BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:8000/api/v1'
).replace(/\/$/, '');

export type ExternalSource = 'weather' | 'fire' | 'hydrography';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  source?: ExternalSource;
  retryAt?: number | null;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isRateLimited(): boolean {
    return this.code === 'provider_rate_limited';
  }
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof ApiError) return error.code === 'http_error' && error.status >= 500;
  return error instanceof TypeError;
}

const SOURCE_BACKOFF_MS = 30_000;
const SOURCE_MAX_BACKOFF_MS = 5 * 60_000;

interface SourcePause {
  error: ApiError;
  timer?: ReturnType<typeof setTimeout>;
}

const pauses = new Map<ExternalSource, SourcePause>();
const consecutiveFailures = new Map<ExternalSource, number>();
const recoveryListeners = new Set<(source: ExternalSource) => void>();
const authenticationListeners = new Set<() => void>();

export function onAuthenticationRequired(listener: () => void): () => void {
  authenticationListeners.add(listener);
  return () => {
    authenticationListeners.delete(listener);
  };
}

function sourceOf(path: string): ExternalSource | undefined {
  if (/^\/weather\/(current|municipalities|states?|viewport)\b/.test(path)) return 'weather';
  if (path.startsWith('/fire-hotspots')) return 'fire';
  if (path.startsWith('/hydrography')) return 'hydrography';
  return undefined;
}

function pauseSource(source: ExternalSource, error: ApiError) {
  error.source = source;
  const current = pauses.get(source);
  if (current && !error.isRateLimited) {
    const { retryAt } = current.error;
    if (retryAt === null || (retryAt !== undefined && retryAt > Date.now())) {
      error.retryAt = retryAt;
      return;
    }
  }
  if (current?.timer) clearTimeout(current.timer);

  if (error.isRateLimited) {
    error.retryAt = null;
    pauses.set(source, { error });
    return;
  }
  const failures = (consecutiveFailures.get(source) ?? 0) + 1;
  consecutiveFailures.set(source, failures);
  const delay = Math.min(SOURCE_BACKOFF_MS * 2 ** (failures - 1), SOURCE_MAX_BACKOFF_MS);
  error.retryAt = Date.now() + delay;
  const timer = setTimeout(() => {
    if (pauses.get(source)?.error !== error) return;
    pauses.delete(source);
    for (const listener of recoveryListeners) listener(source);
  }, delay);
  pauses.set(source, { error, timer });
}

function activePause(source: ExternalSource): ApiError | undefined {
  const pause = pauses.get(source);
  if (!pause) return undefined;
  const { retryAt } = pause.error;
  if (retryAt !== null && retryAt !== undefined && retryAt <= Date.now()) {
    if (pause.timer) clearTimeout(pause.timer);
    pauses.delete(source);
    return undefined;
  }
  return pause.error;
}

export function clearSourcePauses() {
  for (const { timer } of pauses.values()) if (timer) clearTimeout(timer);
  pauses.clear();
  consecutiveFailures.clear();
}

export function onSourceRecovered(listener: (source: ExternalSource) => void): () => void {
  recoveryListeners.add(listener);
  return () => recoveryListeners.delete(listener);
}

const FORCE_WEATHER_REFRESH_WINDOW_MS = 4_000;
let forceWeatherRefreshUntil = 0;

function isForceableWeatherPath(path: string): boolean {
  return /^\/weather\/(current|state|states|viewport)\b/.test(path);
}

export function requestForcedWeatherRefresh() {
  forceWeatherRefreshUntil = Date.now() + FORCE_WEATHER_REFRESH_WINDOW_MS;
}

type QueryValue = string | number | boolean | null | undefined;

export function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const baseOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';
  const url = new URL(`${BASE_URL}${path}`, baseOrigin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

interface RequestOptions {
  params?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  { params, body, signal }: RequestOptions = {},
): Promise<T> {
  const source = sourceOf(path);
  const paused = source && activePause(source);
  if (paused) throw paused;

  const effectiveParams =
    method === 'GET' && Date.now() < forceWeatherRefreshUntil && isForceableWeatherPath(path)
      ? { ...params, force: true }
      : params;

  const response = await fetch(buildUrl(path, effectiveParams), {
    method,
    credentials: 'include',
    headers:
      body === undefined
        ? {
            Accept: 'application/json',
            ...(method !== 'GET' ? { 'X-Brasil-Lens-Client': 'web' } : {}),
          }
        : {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Brasil-Lens-Client': 'web',
          },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let code = 'http_error';
    let message = `O servidor não respondeu corretamente (HTTP ${response.status}).`;
    let details: Record<string, unknown> | undefined;
    try {
      const errorBody = (await response.json()) as ApiErrorBody;
      if (errorBody?.error) {
        code = errorBody.error.code;
        message = errorBody.error.message;
        details = errorBody.error.details;
      }
    } catch {} // eslint-disable-line no-empty
    const error = new ApiError(response.status, code, message, details);
    if (response.status === 401 && path.startsWith('/me/')) {
      for (const listener of authenticationListeners) listener();
    }
    if (source && (code === 'provider_error' || code === 'provider_rate_limited')) {
      pauseSource(source, error);
    }
    throw error;
  }

  if (source) consecutiveFailures.delete(source);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function apiGet<T>(
  path: string,
  params?: Record<string, QueryValue>,
  signal?: AbortSignal,
): Promise<T> {
  return request<T>('GET', path, { params, signal });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, { body });
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PUT', path, { body });
}

export function apiDelete(path: string): Promise<void> {
  return request<void>('DELETE', path);
}
