import type { MapScopeState } from '@/features/map/useMapScope';

export const SESSION_STORAGE_KEY = 'brasil_lens_session_v3';
const LEGACY_STORAGE_KEYS = ['brasil_lens_session_v2', 'brasil_lens_session_v1'];

export interface AppSessionState {
  scope?: MapScopeState;
  selectedCode?: string | null;
  showWeatherAlerts?: boolean;
  showHydrography?: boolean;
  activeThematicLayer?: 'climate' | 'fire' | 'rainfall' | 'none';
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function climateState(value: unknown): AppSessionState {
  if (typeof value !== 'object' || value === null) return {};
  const source = value as Record<string, unknown>;
  const rawScope = source.scope as Partial<MapScopeState> | undefined;
  let scope: MapScopeState | undefined;
  if (rawScope?.level === 'state' && rawScope.parent == null) {
    scope = { level: 'state', parent: null, parentName: null };
  } else if (
    rawScope?.level === 'municipality' &&
    typeof rawScope.parent === 'string' &&
    /^\d{2}$/.test(rawScope.parent)
  ) {
    scope = {
      level: 'municipality',
      parent: rawScope.parent,
      parentName: typeof rawScope.parentName === 'string' ? rawScope.parentName : null,
    };
  }
  return {
    ...(scope ? { scope } : {}),
    ...((typeof source.selectedCode === 'string' && /^(\d{2}|\d{7})$/.test(source.selectedCode)) ||
    source.selectedCode === null
      ? { selectedCode: source.selectedCode }
      : {}),
    ...(typeof source.showWeatherAlerts === 'boolean'
      ? { showWeatherAlerts: source.showWeatherAlerts }
      : {}),
    ...(typeof source.showHydrography === 'boolean'
      ? { showHydrography: source.showHydrography }
      : {}),
    ...(['climate', 'fire', 'rainfall', 'none'].includes(String(source.activeThematicLayer))
      ? {
          activeThematicLayer: source.activeThematicLayer as AppSessionState['activeThematicLayer'],
        }
      : {}),
  };
}

export function loadSessionState(): AppSessionState {
  const storage = getStorage();
  if (!storage) return {};
  try {
    for (const key of [SESSION_STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        continue;
      }
      if (typeof value !== 'object' || value === null) continue;
      const migrated = climateState(value);
      if (key.endsWith('v1') && migrated.showWeatherAlerts === undefined) {
        migrated.showWeatherAlerts = true;
      }
      const clean = JSON.stringify(migrated);
      if (key !== SESSION_STORAGE_KEY || raw !== clean) storage.setItem(SESSION_STORAGE_KEY, clean);
      for (const legacyKey of LEGACY_STORAGE_KEYS) storage.removeItem(legacyKey);
      return migrated;
    }
    for (const legacyKey of LEGACY_STORAGE_KEYS) storage.removeItem(legacyKey);
    return {};
  } catch {
    return {};
  }
}

export function saveSessionState(patch: Partial<AppSessionState>): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const next = climateState({ ...loadSessionState(), ...patch });
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
    for (const legacyKey of LEGACY_STORAGE_KEYS) storage.removeItem(legacyKey);
  } catch {
    // Ignorado silenciosamente.
  }
}
