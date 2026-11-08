import { useCallback, useEffect, useReducer, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Place } from '@/api/types';
import type { DevicePosition } from '@/features/search/LocationButton';
import type { SearchResult } from '@/features/search/SearchBox';
import { describeError } from '@/components/Feedback';
import { emptyPlan, fromPlace, hasPoint, planReducer, routePoints, type RoutePlan } from './model';
import { reversePlace, territoryPoint, useRoute } from './queries';
import type { MapFocus } from './RouteLayer';

// A rota sobrevive à troca de contexto (o app desmonta o Transporte), não ao recarregar.
let remembered: { plan: RoutePlan; device: DevicePosition | null } | null = null;

function zoomFor(accuracy: number) {
  return accuracy <= 80 ? 16 : accuracy <= 400 ? 15 : accuracy <= 1500 ? 14 : 13;
}

const PLACE_ZOOM = 15;

export function useRoutePlan({
  onTerritoryView,
}: {
  /** Território escolhido sem outro ponto: o mapa o mostra como a busca normal. */
  onTerritoryView: (result: SearchResult) => void;
}) {
  const queryClient = useQueryClient();
  const [plan, dispatch] = useReducer(
    planReducer,
    undefined,
    () => remembered?.plan ?? emptyPlan(),
  );
  const [device, setDevice] = useState<DevicePosition | null>(() => remembered?.device ?? null);
  const [picking, setPicking] = useState<number | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    remembered = { plan, device };
  }, [plan, device]);

  const points = routePoints(plan);
  const query = useRoute(plan.profile, points);
  const route = points ? query.data : undefined;

  // Com um só ponto, o mapa vai até ele; com dois ou mais, enquadra a rota quando ela chegar.
  const place = useCallback(
    (index: number, waypoint: Omit<RoutePlan['waypoints'][number], 'key'>, zoom = PLACE_ZOOM) => {
      const others = plan.waypoints.filter((item, i) => i !== index && hasPoint(item)).length;
      dispatch({ type: 'set', index, waypoint });
      if (others === 0)
        setFocus({
          latitude: waypoint.latitude!,
          longitude: waypoint.longitude!,
          zoom,
          at: Date.now(),
        });
      else setFitRequest((n) => n + 1);
    },
    [plan.waypoints],
  );

  const labelFromMap = useCallback(
    async (key: string, latitude: number, longitude: number) => {
      try {
        const found = await reversePlace(queryClient, latitude, longitude);
        if (!found) return;
        // Só troca o rótulo se o ponto ainda for aquele (o usuário pode ter mudado).
        dispatch({
          type: 'label',
          key,
          latitude,
          longitude,
          label: found.name,
          detail: found.detail,
        });
      } catch {
        // Sem endereço, fica "Ponto no mapa": a rota não depende do rótulo.
      }
    },
    [queryClient],
  );

  const onSelectPlace = useCallback(
    (index: number, found: Place) => place(index, fromPlace('', found)),
    [place],
  );

  // Estado vai até a capital e município até a sede: o ponto vem da API e chega depois.
  const onSelectTerritory = useCallback(
    async (index: number, result: SearchResult) => {
      const key = plan.waypoints[index]?.key;
      if (!key) return;
      const others = plan.waypoints.filter((item, i) => i !== index && hasPoint(item)).length;
      setNotice(null);
      dispatch({
        type: 'set',
        index,
        waypoint: {
          label: result.name,
          detail: result.level === 'state' ? 'Estado' : result.parentName,
          latitude: null,
          longitude: null,
          territory: result.ibgeCode,
        },
      });
      if (others === 0) onTerritoryView(result);
      try {
        const point = await territoryPoint(queryClient, result.ibgeCode);
        dispatch({
          type: 'resolve',
          key,
          territory: result.ibgeCode,
          label: result.level === 'state' ? `${result.name} · ${point.name}` : point.name,
          detail: point.detail,
          latitude: point.latitude,
          longitude: point.longitude,
        });
        if (others > 0) setFitRequest((n) => n + 1);
      } catch (cause) {
        setNotice(describeError(cause).message);
      }
    },
    [plan.waypoints, queryClient, onTerritoryView],
  );

  const onPosition = useCallback(
    (position: DevicePosition, index: number) => {
      setDevice(position);
      setPicking(null);
      // O botão ao lado da caixa marca a partida; se ela já tem outro lugar, só mostra o ponto.
      const current = plan.waypoints[index];
      if (index === 0 && current && hasPoint(current) && !current.device) {
        setFocus({ ...position, zoom: zoomFor(position.accuracy), at: Date.now() });
        return;
      }
      const waypoint = {
        label: 'Minha localização',
        detail: null,
        latitude: position.latitude,
        longitude: position.longitude,
        device: true,
      };
      const others = plan.waypoints.filter((item, i) => i !== index && hasPoint(item)).length;
      dispatch({ type: 'set', index, waypoint });
      if (others === 0) setFocus({ ...position, zoom: zoomFor(position.accuracy), at: Date.now() });
      else setFitRequest((n) => n + 1);
    },
    [plan.waypoints],
  );

  const onPickPoint = useCallback(
    (latitude: number, longitude: number) => {
      if (picking === null) return;
      const key = plan.waypoints[picking]?.key;
      const others = plan.waypoints.filter((item, i) => i !== picking && hasPoint(item)).length;
      dispatch({
        type: 'set',
        index: picking,
        waypoint: { label: 'Ponto no mapa', detail: null, latitude, longitude },
      });
      if (others > 0) setFitRequest((n) => n + 1);
      setPicking(null);
      if (key) void labelFromMap(key, latitude, longitude);
    },
    [picking, plan.waypoints, labelFromMap],
  );

  const onDrag = useCallback(
    (index: number, latitude: number, longitude: number) => {
      const key = plan.waypoints[index]?.key;
      dispatch({
        type: 'set',
        index,
        waypoint: { label: 'Ponto no mapa', detail: null, latitude, longitude },
      });
      if (key) void labelFromMap(key, latitude, longitude);
    },
    [plan.waypoints, labelFromMap],
  );

  // Inverter, trocar o meio ou tirar uma parada muda a rota inteira: enquadra de novo.
  const dispatchPlan = useCallback((action: Parameters<typeof dispatch>[0]) => {
    dispatch(action);
    if (action.type === 'reverse' || action.type === 'profile' || action.type === 'remove')
      setFitRequest((n) => n + 1);
    if (action.type === 'reset') setPicking(null);
  }, []);

  return {
    plan,
    dispatch: dispatchPlan,
    route,
    routeLoading: Boolean(points) && query.isFetching,
    routeError: points ? query.error : null,
    stale: query.isPlaceholderData,
    device,
    picking,
    setPicking,
    focus,
    fitRequest,
    onSelectPlace,
    onSelectTerritory,
    notice,
    onPosition,
    onPickPoint,
    onDrag,
  };
}
