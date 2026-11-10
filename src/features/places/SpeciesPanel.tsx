import type { SpeciesGroup, SpeciesSummary } from '@/api/types';
import { ApiError } from '@/api/client';
import { AnimatedText } from '@/components/AnimatedText';
import { SourceTag } from '@/components/LayerMetadata';
import { ScrollList } from '@/components/ScrollList';
import { SPECIES_GROUPS, THREAT_LABEL, formatCount } from './places';

function message(error: Error): string {
  if (error instanceof ApiError && error.status === 404)
    return 'O GBIF não tem um recorte equivalente a este território.';
  return 'Os registros de espécies estão indisponíveis agora.';
}

export function SpeciesPanel({
  group,
  onGroup,
  data,
  loading,
  error,
}: {
  group: SpeciesGroup;
  onGroup: (group: SpeciesGroup) => void;
  data?: SpeciesSummary;
  loading: boolean;
  error: Error | null;
}) {
  const option = SPECIES_GROUPS.find((item) => item.value === group) ?? SPECIES_GROUPS[0]!;
  const current = data?.group === group ? data : undefined;
  // Sem a enumeração das espécies (país inteiro, ou milhares delas), o destaque
  // passa a ser o número de registros.
  const enumerated = current ? current.speciesCount !== null : true;
  const value = current
    ? formatCount(current.speciesCount ?? current.records)
    : loading
      ? 'Carregando…'
      : 'Sem dados';
  return (
    <div className="places-species">
      <div className="indicator-pills-row" role="group" aria-label="Grupo de espécies">
        {SPECIES_GROUPS.map((item) => {
          const active = item.value === group;
          return (
            <button
              key={item.value}
              type="button"
              className={`indicator-pill-btn ${active ? 'is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onGroup(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <dl
        className="featured-indicator"
        title="Espécies com registro de ocorrência no território; lugares pouco estudados têm poucos registros."
      >
        <dt className="indicator-label">
          {enumerated ? 'Espécies registradas' : 'Registros de ocorrência'}
          <span className="indicator-year">{option.noun}</span>
        </dt>
        <AnimatedText
          as="dd"
          mode="number"
          className={`featured-value${current ? '' : ' is-missing'}`}
          text={value}
        />
        {current && enumerated && (
          <dd className="places-summary">
            {formatCount(current.records)} {current.records === 1 ? 'registro' : 'registros'}
          </dd>
        )}
      </dl>
      {error && !current && <p className="source-note">{message(error)}</p>}
      {current && current.species.length > 0 && (
        <ScrollList
          className="places-species-list"
          items={current.species}
          label={`${option.label} com mais registros`}
          render={(item) => (
            <li key={item.key}>
              <span className="places-species-name">
                {item.commonName ?? <i>{item.scientificName}</i>}
                {item.commonName && <small>{item.scientificName}</small>}
              </span>
              {item.threat && (
                <span
                  className={`places-threat is-${item.threat.toLowerCase()}`}
                  title={`${THREAT_LABEL[item.threat]} (Lista Vermelha da IUCN)`}
                >
                  {item.threat}
                </span>
              )}
              <strong title="Registros no território">{formatCount(item.records)}</strong>
            </li>
          )}
        />
      )}
      {current && (
        <p className="places-species-source">
          <SourceTag label={current.source.label} description={current.source.description} />
          <span>mais registradas · não é um inventário</span>
        </p>
      )}
    </div>
  );
}
