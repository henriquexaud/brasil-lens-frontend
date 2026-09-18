/**
 * Cliente HTTP da API.
 *
 * Único lugar do frontend que conhece URLs. Traduz o envelope de erro do
 * backend (`{ error: { code, message } }`) em uma exceção tipada, para que a
 * interface possa reagir ao `code` em vez de comparar strings de mensagem.
 *
 * As quatro funções exportadas cobrem os quatro métodos que a aplicação usa:
 * `apiGet` para as projeções de leitura e `apiPost`/`apiPut`/`apiDelete` para
 * as visualizações salvas, a única entidade escrita pelo usuário.
 */
import type { ApiErrorBody } from './types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Território ou indicador inexistente: a UI trata como estado, não como falha. */
  get isNotFound(): boolean {
    return this.status === 404;
  }
}

type QueryValue = string | number | boolean | null | undefined;

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

interface RequestOptions {
  params?: Record<string, QueryValue>;
  /** Corpo JSON das escritas. Ausente nos GET e nos DELETE. */
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  { params, body, signal }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(buildUrl(path, params), {
    method,
    headers:
      body === undefined
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let code = 'http_error';
    let message = `A API respondeu ${response.status}.`;
    let details: Record<string, unknown> | undefined;
    try {
      const errorBody = (await response.json()) as ApiErrorBody;
      if (errorBody?.error) {
        code = errorBody.error.code;
        message = errorBody.error.message;
        details = errorBody.error.details;
      }
    } catch {
      // Resposta sem corpo JSON: mantém a mensagem genérica.
    }
    throw new ApiError(response.status, code, message, details);
  }

  // 204 (DELETE) não tem corpo: chamar .json() aqui estouraria.
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
