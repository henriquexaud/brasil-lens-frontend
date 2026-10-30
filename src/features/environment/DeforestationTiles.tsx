import { useEffect, useState } from 'react';
import type { WMSOptions } from 'leaflet';
import { Pane, useMap, useMapEvents } from 'react-leaflet';

import { FireTileLayer } from '@/features/fire/fireTileLayer';

// Protótipo: polígonos do PRODES (um ano por vez) pelo WMS do TerraBrasilis/INPE, sobre o mosaico
// municipal. Seis biomas num só pedido (as camadas do painel têm nomes diferentes por bioma).
const WMS_URL = 'https://terrabrasilis.dpi.inpe.br/geoserver/ows';
const WMS_LAYER_LIST = [
  'prodes-amazon-nb:yearly_deforestation_biome',
  'prodes-cerrado-nb:yearly_deforestation',
  'prodes-caatinga-nb:yearly_deforestation',
  'prodes-mata-atlantica-nb:yearly_deforestation',
  'prodes-pampa-nb:yearly_deforestation',
  'prodes-pantanal-nb:yearly_deforestation',
];
const WMS_LAYERS = WMS_LAYER_LIST.join(',');
// Terra escura da escala do desmatamento (`earthDeforestation`), igual nos seis biomas: a cor padrão
// do INPE muda por bioma e some sobre o relevo. O traço mantém visíveis os polígonos pequenos.
const AREA_COLOR = '#7C3D22';
const AREA_SLD = `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">${WMS_LAYER_LIST.map(
  (name) =>
    `<NamedLayer><Name>${name}</Name><UserStyle><FeatureTypeStyle><Rule><PolygonSymbolizer><Fill><CssParameter name="fill">${AREA_COLOR}</CssParameter><CssParameter name="fill-opacity">0.9</CssParameter></Fill><Stroke><CssParameter name="stroke">${AREA_COLOR}</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke></PolygonSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer>`,
).join('')}</StyledLayerDescriptor>`;
// Com o filtro de ano, um tile leva ~1 s a partir do zoom 5 e ~10 s no zoom 4 (o país inteiro):
// abaixo disto quem fala é o mosaico municipal.
const MIN_ZOOM = 5;
const ATTRIBUTION = 'Desmatamento: <a href="https://terrabrasilis.dpi.inpe.br/">INPE/PRODES</a>';

function Tiles({ year }: { year: number }) {
  const map = useMap();
  useEffect(() => {
    const layer = new FireTileLayer(WMS_URL, {
      layers: WMS_LAYERS,
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      time: `${year}-01-01`,
      SLD_BODY: AREA_SLD,
      uppercase: true,
      pane: 'deforestation-areas',
      keepBuffer: 3,
      updateWhenIdle: false,
      attribution: ATTRIBUTION,
    } as WMSOptions);
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, year]);
  return null;
}

export function DeforestationTiles({ year }: { year: number }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return (
    <Pane name="deforestation-areas" style={{ zIndex: 428, pointerEvents: 'none' }}>
      {zoom >= MIN_ZOOM && <Tiles year={year} />}
    </Pane>
  );
}
