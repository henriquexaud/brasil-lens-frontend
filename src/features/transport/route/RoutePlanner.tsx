import { Glyph } from '@/components/Icon';
import { useEffect, useId, useLayoutEffect, useRef, useState, type Dispatch } from 'react';
import { useTerritorySearch } from '@/api/queries';
import type { Place, RouteProfile, RouteResult } from '@/api/types';
import {
  LocationButton,
  locationErrorMessage,
  readDevicePosition,
  type DevicePosition,
} from '@/features/search/LocationButton';
import type { SearchResult } from '@/features/search/SearchBox';
import { describeError } from '@/components/Feedback';
import {
  MAX_WAYPOINTS,
  PROFILE_LABELS,
  emptyWaypoint,
  formatDistance,
  formatDuration,
  hasPoint,
  type PlanAction,
  type RoutePlan,
} from './model';
import { MIN_PLACE_QUERY, usePlaceSearch } from './queries';

interface Props {
  plan: RoutePlan;
  dispatch: Dispatch<PlanAction>;
  route: RouteResult | undefined;
  routeLoading: boolean;
  routeError: unknown;
  notice: string | null;
  near: { latitude: number; longitude: number } | null;
  picking: number | null;
  onPick: (index: number | null) => void;
  onSelectPlace: (index: number, place: Place) => void;
  onSelectTerritory: (index: number, result: SearchResult) => void;
  onPosition: (position: DevicePosition, index: number) => void;
}

type Option =
  | { kind: 'device' }
  | { kind: 'map' }
  | { kind: 'territory'; result: SearchResult }
  | { kind: 'place'; place: Place };

const PROFILES: RouteProfile[] = ['car', 'bike', 'foot'];
const MAX_TERRITORIES = 4;

function fieldName(index: number, total: number) {
  if (index === 0) return 'Partida';
  if (index === total - 1) return 'Destino';
  return 'Parada';
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function optionKey(option: Option) {
  if (option.kind === 'territory') return `t${option.result.ibgeCode}`;
  if (option.kind === 'place') return `p${option.place.id}`;
  return option.kind;
}

function FieldIcon({ role }: { role: 'origin' | 'stop' | 'destination' }) {
  if (role === 'origin')
    return (
      <svg className="search-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10Zm4.6-.9 3 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  if (role === 'stop')
    return (
      <svg className="search-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  return (
    <svg className="search-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M8 14.2s4.3-3.9 4.3-7.4a4.3 4.3 0 1 0-8.6 0c0 3.5 4.3 7.4 4.3 7.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6.8" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ProfileIcon({ profile }: { profile: RouteProfile }) {
  return (
    <Glyph name={profile === 'car' ? 'car' : profile === 'bike' ? 'bike' : 'walk'} size={16} />
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function RoutePlanner({
  plan,
  dispatch,
  route,
  routeLoading,
  routeError,
  notice: routeNotice,
  near,
  picking,
  onPick,
  onSelectPlace,
  onSelectTerritory,
  onPosition,
}: Props) {
  const { waypoints } = plan;
  const [active, setActive] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [enterPending, setEnterPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const listId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(draft.trim()), 220);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => setHighlight(0), [query, active]);
  useEffect(() => setEnterPending(false), [draft, active]);

  const typing = draft.trim().length > 0;
  const territories = useTerritorySearch(query, active !== null, MAX_TERRITORIES);
  const places = usePlaceSearch(query, near, active !== null);
  const territoryResults: SearchResult[] = (territories.data?.territories ?? []).map((row) => ({
    ibgeCode: row.ibgeCode,
    name: row.name,
    level: row.level,
    abbreviation: row.abbreviation,
    parentCode: row.parent?.ibgeCode ?? null,
    parentName: row.parent?.name ?? null,
  }));
  // A cidade e o estado também vêm do OSM (só com a UF de detalhe); com o território na
  // lista, o item do OSM sobra.
  const covered = new Set(territoryResults.map((item) => normalize(item.name)));
  const placeResults = (query.length >= MIN_PLACE_QUERY ? (places.data?.places ?? []) : []).filter(
    (place) => {
      const parts = place.detail?.split(', ') ?? [];
      return !(parts.length <= 1 && covered.has(normalize(place.name)));
    },
  );
  const options: Option[] = !typing
    ? [{ kind: 'device' }, { kind: 'map' }]
    : [
        ...territoryResults.map((result) => ({ kind: 'territory' as const, result })),
        ...placeResults.map((place) => ({ kind: 'place' as const, place })),
      ];
  const searching = territories.isFetching || places.isFetching;
  // Resultados de uma consulta anterior ainda na tela: Enter espera os da atual.
  const settled = !typing || (query === draft.trim() && !searching && !places.isPlaceholderData);

  useEffect(() => {
    if (active === null) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setActive(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [active]);

  // No celular, tema e Pix ficam abaixo da busca: descem junto com o que a rota acrescenta.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const app = root?.closest<HTMLElement>('.app');
    if (!root || !app) return;
    const update = () =>
      app.style.setProperty('--route-stack-extra', `${Math.max(0, root.offsetHeight - 32)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => {
      observer.disconnect();
      app.style.removeProperty('--route-stack-extra');
    };
  }, []);

  function focusKey(key: string | undefined) {
    if (key) requestAnimationFrame(() => inputs.current.get(key)?.focus());
  }

  function blurField(index: number) {
    const key = waypoints[index]?.key;
    if (key) inputs.current.get(key)?.blur();
  }

  // Depois de escolher, o cursor segue para o próximo campo vazio, como num formulário.
  function advanceFrom(index: number) {
    const next = waypoints.findIndex((item, i) => i !== index && !item.label);
    setActive(null);
    setDraft('');
    if (next > 0) focusKey(waypoints[next]?.key);
    else blurField(index);
  }

  async function locateDevice(index: number) {
    setLocating(true);
    setNotice(null);
    try {
      const { coords } = await readDevicePosition(true);
      onPosition(
        { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy },
        index,
      );
      advanceFrom(index);
    } catch (cause) {
      setNotice(locationErrorMessage(cause));
    } finally {
      setLocating(false);
    }
  }

  function choose(option: Option, index: number) {
    if (option.kind === 'device') void locateDevice(index);
    else if (option.kind === 'map') {
      onPick(index);
      setActive(null);
      setDraft('');
      blurField(index);
    } else if (option.kind === 'territory') {
      onSelectTerritory(index, option.result);
      advanceFrom(index);
    } else {
      onSelectPlace(index, option.place);
      advanceFrom(index);
    }
  }

  const latest = useRef({ choose, options });
  latest.current = { choose, options };
  useEffect(() => {
    if (!enterPending || !settled || active === null) return;
    setEnterPending(false);
    const first = latest.current.options[0];
    if (first) latest.current.choose(first, active);
  }, [enterPending, settled, active]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setActive(null);
      setDraft('');
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Enter' && typing && !settled) {
      event.preventDefault();
      setEnterPending(true);
      return;
    }
    if (!options.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[highlight];
      if (option) choose(option, index);
    }
  }

  const filled = waypoints.filter(hasPoint).length;
  const anyContent = waypoints.some((item) => item.label);
  const showSummary =
    active === null && filled >= 2 && Boolean(route || routeLoading || routeError);
  const message = notice ?? routeNotice;

  function dropdown(index: number) {
    if (active !== index) return null;
    if (options.length > 0)
      return (
        <ul className="search-results route-dropdown" id={listId} role="listbox">
          {options.map((option, i) => (
            <li key={optionKey(option)} role="presentation">
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                className={`search-result${i === highlight ? ' is-active' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option, index)}
              >
                {option.kind === 'territory' ? (
                  <>
                    <span className="search-result-name">{option.result.name}</span>
                    <span className="search-result-meta">
                      {option.result.level === 'state'
                        ? index === 0
                          ? 'Estado'
                          : 'Estado · até a capital'
                        : (option.result.parentName ?? 'Município')}
                    </span>
                  </>
                ) : option.kind === 'place' ? (
                  <>
                    <span className="search-result-name">{option.place.name}</span>
                    {option.place.detail && (
                      <span className="search-result-meta">{option.place.detail}</span>
                    )}
                  </>
                ) : (
                  <span className="search-result-name route-option-action">
                    {option.kind === 'device'
                      ? locating
                        ? 'Localizando…'
                        : 'Minha localização'
                      : 'Escolher no mapa'}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      );
    if (typing && query.length >= 2 && query === draft.trim())
      return (
        <p className="search-empty route-dropdown" role="status">
          {searching
            ? 'Buscando lugares…'
            : places.isError
              ? describeError(places.error).message
              : 'Nada encontrado no Brasil'}
        </p>
      );
    return null;
  }

  function row(index: number) {
    const item = waypoints[index];
    if (!item) return null;
    const total = waypoints.length;
    const role = index === 0 ? 'origin' : index === total - 1 ? 'destination' : 'stop';
    const editing = active === index;
    const name = fieldName(index, total);
    const pending = Boolean(item.territory) && !hasPoint(item);
    return (
      <div key={item.key} className="route-row">
        <div className="search-tools">
          <div className={`search-box${picking === index ? ' is-picking' : ''}`}>
            <FieldIcon role={role} />
            <input
              ref={(node) => {
                if (node) inputs.current.set(item.key, node);
                else inputs.current.delete(item.key);
              }}
              type="text"
              className={`search-input${pending ? ' is-pending' : ''}`}
              placeholder={
                picking === index
                  ? 'Toque no mapa…'
                  : index === 0
                    ? 'Buscar estado ou município'
                    : name
              }
              aria-label={index === 0 ? `${name}: buscar estado, município ou endereço` : name}
              value={editing ? draft : item.label}
              title={item.detail ? `${item.label} · ${item.detail}` : undefined}
              onFocus={(event) => {
                const input = event.target;
                const initial = item.label && !item.device ? item.label : '';
                setActive(index);
                setDraft(initial);
                setNotice(null);
                if (picking !== null) onPick(null);
                // Seleciona para substituir com um toque, sem engolir o que já foi digitado.
                requestAnimationFrame(() => {
                  if (initial && input.value === initial) input.select();
                });
              }}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              role="combobox"
              aria-expanded={editing && options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                editing && options[highlight] ? `${listId}-${highlight}` : undefined
              }
            />
            {(role === 'stop' || item.label || (editing && draft)) && (
              <button
                type="button"
                className="search-clear"
                aria-label={role === 'stop' ? 'Remover parada' : `Limpar ${name.toLowerCase()}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (editing && draft && role !== 'stop') {
                    setDraft('');
                    return;
                  }
                  dispatch({ type: role === 'stop' ? 'remove' : 'clear', index });
                  if (role === 'stop') setActive(null);
                  else focusKey(item.key);
                }}
              >
                <ClearIcon />
              </button>
            )}
          </div>
          {index === 0 ? (
            <LocationButton onPosition={(position) => onPosition(position, 0)} />
          ) : role === 'destination' ? (
            <button
              type="button"
              className="location-button"
              title="Inverter o sentido"
              aria-label="Inverter partida e destino"
              onClick={() => {
                setActive(null);
                dispatch({ type: 'reverse' });
              }}
            >
              <Glyph name="swap" size={15} />
            </button>
          ) : (
            <span className="route-column" aria-hidden="true" />
          )}
        </div>
        {dropdown(index)}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="search-slot route-slot">
      {row(0)}
      <div className="route-extra">
        {waypoints.slice(1).map((_, i) => row(i + 1))}
        <div className="route-toolbar">
          <div className="route-profiles" role="radiogroup" aria-label="Meio de transporte">
            {PROFILES.map((profile) => (
              <button
                key={profile}
                type="button"
                role="radio"
                aria-checked={plan.profile === profile}
                className={`route-profile${plan.profile === profile ? ' is-active' : ''}`}
                title={PROFILE_LABELS[profile]}
                aria-label={PROFILE_LABELS[profile]}
                onClick={() => dispatch({ type: 'profile', profile })}
              >
                <ProfileIcon profile={profile} />
              </button>
            ))}
          </div>
          <div className="route-actions">
            {waypoints.length < MAX_WAYPOINTS && (
              <button
                type="button"
                className="route-text-button"
                onClick={() => {
                  const stop = emptyWaypoint();
                  dispatch({ type: 'addStop', waypoint: stop });
                  focusKey(stop.key);
                }}
              >
                + Parada
              </button>
            )}
            {anyContent && (
              <button
                type="button"
                className="route-text-button"
                onClick={() => {
                  setActive(null);
                  onPick(null);
                  dispatch({ type: 'reset' });
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {message && (
          <p className="search-empty" role="alert">
            {message}
          </p>
        )}
        {picking !== null && (
          <p className="search-empty route-hint" role="status">
            Toque no mapa para marcar {fieldName(picking, waypoints.length).toLowerCase()}.
            <button type="button" className="route-text-button" onClick={() => onPick(null)}>
              Cancelar
            </button>
          </p>
        )}
        {showSummary && (
          <div className={`route-summary${routeLoading ? ' is-loading' : ''}`} aria-live="polite">
            {routeError && !routeLoading ? (
              <p className="route-summary-error">{describeError(routeError).message}</p>
            ) : route ? (
              <>
                <p className="route-summary-main">
                  <strong>{formatDuration(route.durationS)}</strong>
                  <span>{formatDistance(route.distanceM)}</span>
                </p>
                {route.legs.length === 1 && route.legs[0]?.summary && (
                  <p className="route-summary-via">via {route.legs[0].summary}</p>
                )}
                {route.legs.length > 1 && (
                  <ol className="route-legs">
                    {route.legs.map((leg, i) => (
                      <li key={i}>
                        <span className="route-leg-index">{i + 1}</span>
                        <span className="route-leg-via">{leg.summary ?? `Trecho ${i + 1}`}</span>
                        <span className="route-leg-value">
                          {formatDistance(leg.distanceM)} · {formatDuration(leg.durationS)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <p className="route-summary-via">Calculando rota…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
