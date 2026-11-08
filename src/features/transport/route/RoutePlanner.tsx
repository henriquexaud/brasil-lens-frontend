import { useEffect, useId, useRef, useState, type Dispatch } from 'react';
import type { Place, RouteProfile, RouteResult } from '@/api/types';
import {
  LocationButton,
  locationErrorMessage,
  readDevicePosition,
  type DevicePosition,
} from '@/features/search/LocationButton';
import { describeError } from '@/components/Feedback';
import {
  MAX_WAYPOINTS,
  emptyWaypoint,
  PROFILE_LABELS,
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
  near: { latitude: number; longitude: number } | null;
  picking: number | null;
  onPick: (index: number | null) => void;
  onSelectPlace: (index: number, place: Place) => void;
  onPosition: (position: DevicePosition, index: number) => void;
}

type Option = { kind: 'device' } | { kind: 'map' } | { kind: 'place'; place: Place };

const PROFILES: RouteProfile[] = ['car', 'bike', 'foot'];

function placeholder(index: number, total: number) {
  if (index === 0) return 'Partida';
  if (index === total - 1) return 'Destino';
  return 'Parada';
}

function ProfileIcon({ profile }: { profile: RouteProfile }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (profile === 'car')
    return (
      <svg {...common}>
        <path d="M3.5 13.5V10l1.6-4.2A1.5 1.5 0 0 1 6.5 4.8h7a1.5 1.5 0 0 1 1.4 1L16.5 10v3.5" />
        <path d="M3.5 10h13M3.5 13.5h13" />
        <circle cx="6.5" cy="15.2" r="1.3" />
        <circle cx="13.5" cy="15.2" r="1.3" />
      </svg>
    );
  if (profile === 'bike')
    return (
      <svg {...common}>
        <circle cx="5" cy="13" r="3" />
        <circle cx="15" cy="13" r="3" />
        <path d="M5 13l3-6h5l2 6M8 7l2.5 6H5M12 4.5h2" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="10.5" cy="3.6" r="1.5" />
      <path d="M9.5 6.5 7.5 11l2.5 1.5V17M9.5 6.5l3 2.5 2 .5M10 12.5l3 4.5M7.5 11 5.5 10" />
    </svg>
  );
}

export function RoutePlanner({
  plan,
  dispatch,
  route,
  routeLoading,
  routeError,
  near,
  picking,
  onPick,
  onSelectPlace,
  onPosition,
}: Props) {
  const { waypoints } = plan;
  const [active, setActive] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const listId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(draft.trim()), 220);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => setHighlight(0), [query, active]);

  const search = usePlaceSearch(query, near, active !== null);
  const typing = draft.trim().length > 0;
  const options: Option[] = !typing
    ? [{ kind: 'device' }, { kind: 'map' }]
    : query.length >= MIN_PLACE_QUERY
      ? (search.data?.places ?? []).map((place) => ({ kind: 'place', place }))
      : [];
  const open = active !== null;
  // Resultados de uma consulta anterior ainda na tela: Enter espera os da atual.
  const settled =
    !typing || (query === draft.trim() && !search.isPlaceholderData && !search.isFetching);
  const [enterPending, setEnterPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setActive(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function focusField(index: number) {
    const key = waypoints[index]?.key;
    if (key) requestAnimationFrame(() => inputs.current.get(key)?.focus());
  }

  function blurField(index: number) {
    const key = waypoints[index]?.key;
    if (key) inputs.current.get(key)?.blur();
  }

  // Depois de escolher, o cursor segue para o próximo campo vazio, como num formulário.
  function advanceFrom(index: number) {
    const next = waypoints.findIndex((item, i) => i !== index && !hasPoint(item));
    setActive(null);
    setDraft('');
    if (next >= 0) focusField(next);
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
    } else {
      onSelectPlace(index, option.place);
      advanceFrom(index);
    }
  }

  const chooseLatest = useRef(choose);
  chooseLatest.current = choose;
  const firstPlace = search.data?.places[0];
  useEffect(() => {
    if (!enterPending || !settled || active === null) return;
    setEnterPending(false);
    if (firstPlace) chooseLatest.current({ kind: 'place', place: firstPlace }, active);
  }, [enterPending, settled, active, firstPlace]);
  useEffect(() => setEnterPending(false), [draft, active]);

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
      if (!settled) {
        setEnterPending(true);
        return;
      }
      const option = options[highlight];
      if (option) choose(option, index);
    }
  }

  const filled = waypoints.filter(hasPoint).length;
  const anyContent = waypoints.some((item) => item.label);
  const canAddStop = waypoints.length < MAX_WAYPOINTS;
  const showSummary = !open && filled >= 2 && Boolean(route || routeLoading || routeError);

  return (
    <div ref={rootRef} className="search-slot route-slot">
      <div className="search-tools">
        <div className={`route-box${picking !== null ? ' is-picking' : ''}`}>
          <div className="route-rows">
            <ol className="route-fields">
              {waypoints.map((item, index) => {
                const last = index === waypoints.length - 1;
                const role = index === 0 ? 'origin' : last ? 'destination' : 'stop';
                const editing = active === index;
                const isStop = role === 'stop';
                return (
                  <li key={item.key} className="route-field">
                    <span className={`route-dot is-${role}`} aria-hidden="true" />
                    <input
                      ref={(node) => {
                        if (node) inputs.current.set(item.key, node);
                        else inputs.current.delete(item.key);
                      }}
                      type="text"
                      className="search-input"
                      placeholder={
                        picking === index ? 'Toque no mapa…' : placeholder(index, waypoints.length)
                      }
                      aria-label={placeholder(index, waypoints.length)}
                      value={editing ? draft : item.label}
                      title={item.detail ? `${item.label} · ${item.detail}` : undefined}
                      onFocus={(event) => {
                        setActive(index);
                        setDraft(item.label && !item.device ? item.label : '');
                        setNotice(null);
                        if (picking !== null) onPick(null);
                        const input = event.target;
                        const initial = item.label && !item.device ? item.label : '';
                        // Seleciona para substituir com um toque, sem engolir o que já foi digitado.
                        requestAnimationFrame(() => {
                          if (input.value === initial && initial) input.select();
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
                    {(isStop || item.label || (editing && draft)) && (
                      <button
                        type="button"
                        className="search-clear route-clear"
                        aria-label={isStop ? 'Remover parada' : 'Limpar campo'}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (editing && draft && !isStop) {
                            setDraft('');
                            return;
                          }
                          dispatch({ type: isStop ? 'remove' : 'clear', index });
                          if (!isStop) focusField(index);
                          else setActive(null);
                        }}
                      >
                        <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                          <path
                            d="M4 4l8 8M12 4l-8 8"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              className="route-swap"
              title="Inverter o sentido"
              aria-label="Inverter partida e destino"
              onClick={() => {
                setActive(null);
                dispatch({ type: 'reverse' });
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 3v14M7 3 4 6M7 3l3 3M13 17V3M13 17l-3-3M13 17l3-3" />
              </svg>
            </button>
          </div>
          <div className="route-footer">
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
              {canAddStop && (
                <button
                  type="button"
                  className="route-text-button"
                  onClick={() => {
                    const stop = emptyWaypoint();
                    dispatch({ type: 'addStop', waypoint: stop });
                    requestAnimationFrame(() => inputs.current.get(stop.key)?.focus());
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
        </div>
        <LocationButton onPosition={(position) => onPosition(position, 0)} />
      </div>

      {open && options.length > 0 && (
        <ul className="search-results" id={listId} role="listbox">
          {options.map((option, i) => (
            <li
              key={option.kind === 'place' ? option.place.id + i : option.kind}
              role="presentation"
            >
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                className={`search-result route-option${i === highlight ? ' is-active' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => active !== null && choose(option, active)}
              >
                {option.kind === 'place' ? (
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
      )}
      {open && typing && query.length >= MIN_PLACE_QUERY && !options.length && (
        <p className="search-empty" role="status">
          {search.isFetching
            ? 'Buscando endereços…'
            : search.isError
              ? describeError(search.error).message
              : 'Nada encontrado no Brasil'}
        </p>
      )}
      {notice && (
        <p className="search-empty" role="alert">
          {notice}
        </p>
      )}
      {picking !== null && (
        <p className="search-empty route-hint" role="status">
          Toque no mapa para marcar {placeholder(picking, waypoints.length).toLowerCase()}.{' '}
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
  );
}
