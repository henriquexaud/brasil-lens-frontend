import type { DataContext } from '@/api/types';
import type { MapScopeState } from '@/features/map/useMapScope';

export const SESSION_STORAGE_KEY = 'brasil_lens_session_v2';
const LEGACY_STORAGE_KEY = 'brasil_lens_session_v1';

export interface AppSessionState {
  context?: DataContext;
  scope?: MapScopeState;
  selectedCode?: string | null;
  indicatorKey?: string;
  year?: string;
  showWeatherAlerts?: boolean;
  showHydrography?: boolean;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSessionState(): AppSessionState {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as AppSessionState;
      }
    }
    // Migração de v1 para v2: preserva estado anterior e assegura avisos do INMET ativos por default
    const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (typeof parsed === 'object' && parsed !== null) {
        const migrated: AppSessionState = {
          ...parsed,
          showWeatherAlerts: true,
        };
        storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(migrated));
        storage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    }
    return {};
  } catch {
    return {};
  }
}

export function saveSessionState(patch: Partial<AppSessionState>): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const current = loadSessionState();
    const next: AppSessionState = { ...current, ...patch };
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Falhas de cota ou navegação anônima são ignoradas silenciosamente.
  }
}

export function clearSessionState(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignorado silenciosamente.
  }
}
