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
 *
 * Também é aqui que mora a pausa por fonte externa (ver "Fontes externas"
 * abaixo): várias camadas consultam a mesma fonte em paralelo, e só o cliente
 * enxerga todas as requisições para decidir que ela precisa de um tempo.
 */
import type { ApiErrorBody } from './types';

const BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:8000/api/v1'
).replace(/\/$/, '');

/** Fonte externa que a API consulta sob demanda para responder a rota. */
export type ExternalSource = 'weather' | 'fire' | 'hydrography';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  /** Fonte externa por trás da rota, quando há uma. */
  source?: ExternalSource;
  /**
   * Quando a fonte volta a ser consultada automaticamente (epoch ms). `null`
   * significa que só uma ação do usuário libera a próxima tentativa.
   */
  retryAt?: number | null;

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

  /** Cota da fonte esgotada: insistir não ajuda, só esperar (ou o usuário pedir). */
  get isRateLimited(): boolean {
    return this.code === 'provider_rate_limited';
  }
}

/**
 * Falha que vale repetir logo em seguida: rede instável ou o servidor que não
 * respondeu (gateway, reinício). Erros de domínio — validação, 404, fonte
 * externa fora do ar ou sem cota — não mudam em um segundo e ficam de fora.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof ApiError) return error.code === 'http_error' && error.status >= 500;
  return error instanceof TypeError; // `fetch` sem conexão
}

/* ------------------------------------------------------- fontes externas --
 *
 * Quando uma fonte externa falha, todas as rotas que dependem dela são
 * pausadas no próprio navegador: as requisições seguintes falham na hora, com
 * o mesmo erro, em vez de irem à rede. Sem isso, lotes, viewport, seleção e
 * prefetch continuavam consultando uma fonte que já não respondia.
 *
 * - Fonte indisponível (`provider_error`): pausa automática com espera
 *   crescente (30 s, 1 min, 2 min… até 5 min). Ao fim dela, quem assina
 *   `onSourceRecovered` refaz as consultas.
 * - Cota esgotada (`provider_rate_limited`): pausa até o usuário pedir uma
 *   nova tentativa (`clearSourcePauses`). Tentar sozinho só gastaria a cota.
 */
const SOURCE_BACKOFF_MS = 30_000;
const SOURCE_MAX_BACKOFF_MS = 5 * 60_000;

interface SourcePause {
  error: ApiError;
  timer?: ReturnType<typeof setTimeout>;
}

const pauses = new Map<ExternalSource, SourcePause>();
const consecutiveFailures = new Map<ExternalSource, number>();
const recoveryListeners = new Set<(source: ExternalSource) => void>();

function sourceOf(path: string): ExternalSource | undefined {
  // Só as rotas que consultam a Open-Meteo; avisos e contornos vêm do banco.
  if (/^\/weather\/(current|capitals|municipalities|state|viewport)\b/.test(path)) return 'weather';
  if (path.startsWith('/fire-hotspots')) return 'fire';
  if (path.startsWith('/hydrography')) return 'hydrography';
  return undefined;
}

function pauseSource(source: ExternalSource, error: ApiError) {
  error.source = source;
  const current = pauses.get(source);
  // Uma rajada de falhas da mesma queda (lotes em paralelo) conta como uma só.
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

/** Libera as fontes pausadas — a nova tentativa pedida pelo usuário. */
export function clearSourcePauses() {
  for (const { timer } of pauses.values()) if (timer) clearTimeout(timer);
  pauses.clear();
  consecutiveFailures.clear();
}

/** Avisa quando a pausa automática de uma fonte termina. Devolve o cancelamento. */
export function onSourceRecovered(listener: (source: ExternalSource) => void): () => void {
  recoveryListeners.add(listener);
  return () => recoveryListeners.delete(listener);
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
  /** Corpo JSON das escritas. Ausente nos GET e nos DELETE. */
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
    let message = `O servidor não respondeu corretamente (HTTP ${response.status}).`;
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
    const error = new ApiError(response.status, code, message, details);
    if (source && (code === 'provider_error' || code === 'provider_rate_limited')) {
      pauseSource(source, error);
    }
    throw error;
  }

  if (source) consecutiveFailures.delete(source);
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
