/**
 * Polígonos de alerta meteorológico.
 *
 * A cor vem de `properties.color` — a convenção oficial de severidade da
 * própria fonte (o INMET já publica a cor do aviso). Não é sobreposta pela
 * paleta do produto: aqui a cor é dado, não apresentação nossa (diferente da
 * coroplética, onde a API nunca manda cor — ver `docs/COLOR_SYSTEM.md`).
 */
import type { PathOptions } from 'leaflet';
import { GeoJSON, Popup } from 'react-leaflet';

import type { WeatherAlertCollection, WeatherAlertFeature } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { formatRelativeTime } from '@/lib/format';

/** Só usada se a fonte não mandar `color` — não deveria acontecer com o INMET. */
const FALLBACK_COLOR = '#c9461c';

function styleFor(feature: WeatherAlertFeature): PathOptions {
  return {
    color: '#ffffff',
    weight: 1,
    fillColor: feature.properties.color ?? FALLBACK_COLOR,
    fillOpacity: 0.35,
  };
}

function formatWindow(onset: string, expires: string): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  return `${format(onset)} até ${format(expires)}`;
}

interface Props {
  collection: WeatherAlertCollection | undefined;
}

export function AlertsLayer({ collection }: Props) {
  if (!collection) return null;

  return (
    <>
      {collection.features.map((feature) => (
        <GeoJSON key={feature.id} data={feature} style={() => styleFor(feature)}>
          <Popup>
            <AnimatedText as="strong" text={feature.properties.event} />
            <div>{feature.properties.severity}</div>
            <div>Válido: {formatWindow(feature.properties.onset, feature.properties.expires)}</div>
            {feature.properties.risks.map((risk, index) => (
              <p key={index}>{risk}</p>
            ))}
            {feature.properties.instructions.length > 0 && (
              <ul>
                {feature.properties.instructions.map((instruction, index) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ul>
            )}
            <div>Emitido {formatRelativeTime(feature.properties.onset)}</div>
          </Popup>
        </GeoJSON>
      ))}
    </>
  );
}
