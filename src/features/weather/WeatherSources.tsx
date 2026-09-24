/**
 * Fontes e metodologia do contexto Clima.
 *
 * Temporariamente fora da interface — o espaço que ocupava no fim do painel de
 * clima passou para "Municípios seguidos". Mantido aqui, intacto, para voltar
 * (basta renderizar `<WeatherSources />` onde fizer sentido).
 */
import { Disclosure } from '@/components/Disclosure';

export function WeatherSources() {
  return (
    <Disclosure title="Fontes e metodologia" className="weather-sources-disclosure">
      <ul className="weather-methodology-list">
        <li className="weather-methodology-item">
          <strong>Clima e temperatura:</strong>{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          . Modelos numéricos de alta resolução e estações meteorológicas em tempo real.
        </li>
        <li className="weather-methodology-item">
          <strong>Focos de calor:</strong>{' '}
          <a href="https://data.inpe.br/queimadas/" target="_blank" rel="noreferrer">
            INPE / Queimadas
          </a>
          . Deteções por satélite nas últimas 24h normalizadas por área territorial.
        </li>
        <li className="weather-methodology-item">
          <strong>Quantidade de chuva:</strong>{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          . Precipitação acumulada em 24h e probabilidade estimada por modelo numérico e estações de
          superfície.
        </li>
        <li className="weather-methodology-item">
          <strong>Avisos meteorológicos:</strong>{' '}
          <a href="https://portal.inmet.gov.br/" target="_blank" rel="noreferrer">
            INMET
          </a>
          . Chuva intensa, tempestade, vento, baixa umidade e ondas de calor — severidades e
          instruções oficiais vigentes.
        </li>
        <li className="weather-methodology-item">
          <strong>Risco geo-hidrológico:</strong>{' '}
          <a href="https://www.gov.br/cemaden/pt-br" target="_blank" rel="noreferrer">
            CEMADEN
          </a>
          . Inundação, enxurrada, alagamento e deslizamento por município, complementar aos avisos
          do INMET — os dois podem aparecer juntos na mesma área.
        </li>
        <li className="weather-methodology-item">
          <strong>Hidrografia:</strong>{' '}
          <a href="https://www.snirh.gov.br/" target="_blank" rel="noreferrer">
            ANA / SNIRH
          </a>
          . Cursos e massas d'água principais.
        </li>
        <li className="weather-methodology-item">
          <strong>Clima e previsão:</strong>{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          . Modelos numéricos de alta resolução e estações de superfície.
        </li>
      </ul>
    </Disclosure>
  );
}
