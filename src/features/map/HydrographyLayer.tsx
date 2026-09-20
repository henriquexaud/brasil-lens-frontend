/**
 * Camada oficial de hidrografia (ANA / SNIRH).
 *
 * Renderizada no Pane zIndex 425 (sobre a coropleta territorial e abaixo de halos de seleção).
 * Apresenta rios, canais e corpos d'água com hierarquia visual baseada em área de bacia
 * e tooltips informativos no hover.
 */
import type { Feature, Geometry } from 'geojson';
import type { Layer, LeafletMouseEvent } from 'leaflet';
import { useCallback } from 'react';
import { GeoJSON, Pane } from 'react-leaflet';

import type { HydroFeature, HydroFeatureCollection, HydroFeatureProperties } from '@/api/types';
import { formatDrainageArea, getHydroStyle } from './hydroStyles';

interface Props {
  collection: HydroFeatureCollection | undefined;
}

export function HydrographyLayer({ collection }: Props) {
  const onEachFeature = useCallback(
    (feature: Feature<Geometry, HydroFeatureProperties>, layer: Layer) => {
      const props = feature.properties;
      const formattedArea = formatDrainageArea(props.drainageAreaKm2);

      const isRiver = props.category === 'river';
      const dominionLabel = props.dominion ? `Domínio ${props.dominion}` : null;
      const completeInfo =
        props.segmentCount && props.segmentCount > 1
          ? `Rio completo (${props.segmentCount} trechos)`
          : 'Curso contínuo';
      const typeLabel = isRiver
        ? `${dominionLabel ?? 'Curso d’água'} • ${completeInfo}`
        : (props.bodyType ? `Massa d’água (${props.bodyType})` : 'Corpo hídrico');

      const html = `
      <div class="hydro-tooltip-content">
        <span class="tooltip-name">${props.name}</span>
        <span class="tooltip-meta">${typeLabel}</span>
        ${formattedArea ? `<span class="tooltip-value">Bacia a montante: ${formattedArea} km²</span>` : ''}
        ${props.management ? `<span class="tooltip-meta" style="margin-top: 4px;">Gestão: ${props.management}</span>` : ''}
      </div>
    `;

      layer.bindTooltip(html, {
        sticky: true,
        className: 'map-tooltip hydro-tooltip',
        direction: 'top',
        offset: [0, -6],
      });

      // Os rios são informativos e visuais: nunca devem interceptar a navegação
      // territorial nem disparar o foco/seletor azul retangular do navegador.
      layer.on({
        mousedown: (event: LeafletMouseEvent) => {
          // Previne que o clique capture o foco e exiba a caixa delimitadora retangular
          event.originalEvent?.preventDefault();
        },
        click: (event: LeafletMouseEvent) => {
          // Repassa o clique para o território (estado/município) abaixo do rio
          const orig = event.originalEvent;
          if (orig && typeof document !== 'undefined' && document.elementsFromPoint) {
            const elements = document.elementsFromPoint(orig.clientX, orig.clientY);
            for (const el of elements) {
              if (el instanceof SVGElement && el.classList.contains('territory-shape')) {
                el.dispatchEvent(new MouseEvent('click', orig));
                break;
              }
            }
          }
        },
        dblclick: (event: LeafletMouseEvent) => {
          // Repassa também o duplo clique para drill-down territorial
          const orig = event.originalEvent;
          if (orig && typeof document !== 'undefined' && document.elementsFromPoint) {
            const elements = document.elementsFromPoint(orig.clientX, orig.clientY);
            for (const el of elements) {
              if (el instanceof SVGElement && el.classList.contains('territory-shape')) {
                el.dispatchEvent(new MouseEvent('dblclick', orig));
                break;
              }
            }
          }
        },
      });
    },
    [],
  );

  if (!collection || collection.features.length === 0) {
    return null;
  }

  return (
    <Pane name="hydrography" style={{ zIndex: 425 }}>
      {collection.features.map((feature: HydroFeature) => (
        <GeoJSON
          key={feature.id}
          data={feature}
          interactive={true}
          style={() => getHydroStyle(feature.properties)}
          onEachFeature={onEachFeature}
        />
      ))}
    </Pane>
  );
}

