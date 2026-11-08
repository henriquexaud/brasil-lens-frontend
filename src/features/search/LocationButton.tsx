import { useEffect, useRef, useState } from 'react';
import { apiPost } from '@/api/client';
import type { TerritoryDetail } from '@/api/types';

export interface LocatedMunicipality {
  territory: TerritoryDetail;
  latitude: number;
  longitude: number;
}

export interface DevicePosition {
  latitude: number;
  longitude: number;
  /** Raio de incerteza, em metros. */
  accuracy: number;
}

export function readDevicePosition(precise: boolean): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Localização indisponível neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: precise,
      maximumAge: precise ? 10000 : 60000,
      timeout: precise ? 15000 : 12000,
    });
  });
}

export function locationErrorMessage(cause: unknown): string {
  const code = (cause as GeolocationPositionError)?.code;
  return code === 1
    ? 'Permita a localização no navegador ou use a busca.'
    : code === 2 || code === 3
      ? 'Não foi possível obter sua localização. Tente novamente.'
      : cause instanceof Error
        ? cause.message
        : 'Não foi possível localizar seu município.';
}

// Com `onPosition`, entrega o ponto exato do aparelho, sem procurar o município.
export function LocationButton({
  onLocated,
  onPosition,
}: {
  onLocated?: (location: LocatedMunicipality) => void;
  onPosition?: (position: DevicePosition) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  async function locate() {
    const id = ++request.current;
    setError(null);
    setBusy(true);
    try {
      const position = await readDevicePosition(Boolean(onPosition));
      if (request.current !== id) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (onPosition) {
        onPosition({ latitude, longitude, accuracy });
        return;
      }
      const territory = await apiPost<TerritoryDetail>('/territories/locate', {
        latitude,
        longitude,
      });
      if (request.current === id) onLocated?.({ territory, latitude, longitude });
    } catch (cause) {
      if (request.current !== id) return;
      setError(locationErrorMessage(cause));
    } finally {
      if (request.current === id) setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`location-button${busy ? ' is-locating' : ''}`}
        title="Minha localização"
        aria-label="Minha localização"
        aria-busy={busy}
        disabled={busy}
        onClick={() => void locate()}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="5.5" />
          <circle cx="10" cy="10" r="1.6" />
          <path d="M10 1v3M10 16v3M1 10h3M16 10h3" strokeLinecap="round" />
        </svg>
      </button>
      {error && (
        <p className="location-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
