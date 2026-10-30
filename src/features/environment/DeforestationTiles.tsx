import { useEffect } from 'react';
import type { WMSOptions } from 'leaflet';
import { Pane, useMap } from 'react-leaflet';

import { FireTileLayer } from '@/features/fire/fireTileLayer';
import { StateClippedTileLayer } from './clippedTileLayer';
import type { StateGeometry } from './stateClip';

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
// do INPE muda por bioma e some sobre o relevo. Como nos focos, o desenho abstrai pela escala: de
// longe o traço engrossa e cada desmate pequeno vira uma mancha visível; de perto volta fino e os
// polígonos aparecem com a forma real. O limite é o dos focos (1:5.000.000, ≈ zoom 6,8).
const AREA_COLOR = '#7C3D22';
const FAR_COLOR = '#5F2E1B';
const FAR_SCALE = 5_000_000;
const rule = (scale: string, color: string, width: number) =>
  `<Rule>${scale}<PolygonSymbolizer><Fill><CssParameter name="fill">${color}</CssParameter></Fill><Stroke><CssParameter name="stroke">${color}</CssParameter><CssParameter name="stroke-width">${width}</CssParameter></Stroke></PolygonSymbolizer></Rule>`;
const RULES = `${rule(`<MinScaleDenominator>${FAR_SCALE}</MinScaleDenominator>`, FAR_COLOR, 1)}${rule(`<MaxScaleDenominator>${FAR_SCALE}</MaxScaleDenominator>`, AREA_COLOR, 0.5)}`;
const AREA_SLD = `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">${WMS_LAYER_LIST.map(
  (name) =>
    `<NamedLayer><Name>${name}</Name><UserStyle><FeatureTypeStyle>${RULES}</FeatureTypeStyle></UserStyle></NamedLayer>`,
).join('')}</StyledLayerDescriptor>`;
// Quem decide quando os polígonos entram é o chamador, com o mesmo corte dos pontos de focos
// (`fireMode`): antes disso o mosaico municipal fala sozinho. No zoom 5 do país eram milhares de
// manchas sobre cada município, e cada tile leva ~10 s no zoom 4.
const ATTRIBUTION = 'Desmatamento: <a href="https://terrabrasilis.dpi.inpe.br/">INPE/PRODES</a>';

function Tiles({ year, outline }: { year: number; outline?: StateGeometry }) {
  const map = useMap();
  useEffect(() => {
    const Layer = outline ? StateClippedTileLayer : FireTileLayer;
    const layer = new Layer(WMS_URL, {
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
    if (outline && layer instanceof StateClippedTileLayer) layer.setOutline(outline);
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, year, outline]);
  return null;
}

// `outline` é o estado aberto: no Brasil não há recorte, dentro de um estado só o que cai nele.
export function DeforestationTiles({
  year,
  visible,
  outline,
}: {
  year: number;
  visible: boolean;
  outline?: StateGeometry;
}) {
  return (
    <Pane name="deforestation-areas" style={{ zIndex: 428, pointerEvents: 'none' }}>
      {visible && <Tiles year={year} outline={outline} />}
    </Pane>
  );
}
