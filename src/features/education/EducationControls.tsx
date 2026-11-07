import type { EducationKind, EducationNetwork, Indicator } from '@/api/types';
import { LayerMetadata, type DataSource } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  COVERAGE_KEY,
  DAYCARE_OPTIONS,
  KIND_OPTIONS,
  LEVEL_OPTIONS,
  NETWORK_OPTIONS,
  SCHOOL_OPTIONS,
  basicIndicatorKey,
  indicatorKey,
  type EducationLevel,
  type EducationPreferences,
} from './education';

interface Pill {
  value: string;
  label: string;
  title: string;
  next: EducationPreferences;
}

function PillRow({
  label,
  pills,
  value,
  onChange,
  onIntent,
}: {
  label: string;
  pills: Pill[];
  value: string;
  onChange: (next: EducationPreferences) => void;
  onIntent?: (next: EducationPreferences) => void;
}) {
  return (
    <div className="indicator-pills-row" role="group" aria-label={label}>
      {pills.map((pill) => {
        const active = pill.value === value;
        return (
          <button
            key={pill.value}
            type="button"
            className={`indicator-pill-btn ${active ? 'is-active' : ''}`}
            aria-pressed={active}
            title={pill.title}
            onMouseEnter={() => onIntent?.(pill.next)}
            onPointerDown={() => onIntent?.(pill.next)}
            onClick={() => onChange(pill.next)}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}

export function EducationControls({
  preferences,
  onChange,
  indicators,
  onIntent,
}: {
  preferences: EducationPreferences;
  onChange: (next: EducationPreferences) => void;
  indicators?: Indicator[];
  // A escolha sob o cursor ou o dedo: o mapa dela começa a vir antes do clique.
  onIntent?: (next: EducationPreferences) => void;
}) {
  const byKey = (key: string) => indicators?.find((item) => item.key === key);
  const find = (network: EducationNetwork, kind: EducationKind) =>
    byKey(indicatorKey(network, kind));
  const basicKey = basicIndicatorKey(preferences);
  const indicator = basicKey ? byKey(basicKey) : find(preferences.network, preferences.kind);
  // Só aparece o tipo que a rede tem: não há instituto estadual nem municipal.
  const kinds = KIND_OPTIONS.filter(
    (option) => option.value === 'all' || find(preferences.network, option.value)?.latestYear,
  );
  const withNetwork = (network: EducationNetwork): EducationPreferences => ({
    ...preferences,
    network,
    kind: find(network, preferences.kind)?.latestYear ? preferences.kind : 'all',
  });
  const withLevel = (level: EducationLevel): EducationPreferences => ({ ...preferences, level });
  const years = indicator?.availableYears ?? [];
  const latestLabel = indicator?.latestYear
    ? `${indicator.latestYear} · Último`
    : 'Último disponível';
  const metric =
    preferences.level === 'daycare'
      ? DAYCARE_OPTIONS.find((option) => option.value === preferences.daycare)
      : preferences.level === 'schools'
        ? SCHOOL_OPTIONS.find((option) => option.value === preferences.schools)
        : undefined;
  const sources: DataSource[] = [
    { label: 'INEP', description: indicator?.description ?? undefined },
  ];
  // A cobertura divide as matrículas do INEP pelas crianças do Censo do IBGE.
  if (basicKey === COVERAGE_KEY)
    sources.push({ label: 'IBGE', description: 'População de 0 a 3 anos, Censo 2022' });
  return (
    <section className="panel-section indicator-controls" aria-label="Educação no mapa">
      <SegmentedControl
        className="indicator-segmented-control"
        label="Etapas de ensino"
        value={preferences.level}
        options={LEVEL_OPTIONS.map((option) => ({
          ...option,
          onIntent: () => onIntent?.(withLevel(option.value)),
        }))}
        onChange={(value) => onChange(withLevel(value as EducationLevel))}
      />
      {preferences.level === 'higher' && (
        <>
          <PillRow
            label="Redes públicas de ensino superior"
            value={preferences.network}
            pills={NETWORK_OPTIONS.map((option) => ({
              ...option,
              title: `Instituições ${option.label.toLowerCase()}`,
              next: withNetwork(option.value),
            }))}
            onChange={onChange}
            onIntent={onIntent}
          />
          {kinds.length > 2 && (
            <PillRow
              label="Tipo de instituição"
              value={preferences.kind}
              pills={kinds.map((option) => ({
                ...option,
                next: { ...preferences, kind: option.value },
              }))}
              onChange={onChange}
              onIntent={onIntent}
            />
          )}
        </>
      )}
      {preferences.level === 'daycare' && (
        <PillRow
          label="Creches públicas no mapa"
          value={preferences.daycare}
          pills={DAYCARE_OPTIONS.map((option) => ({
            ...option,
            next: { ...preferences, daycare: option.value },
          }))}
          onChange={onChange}
          onIntent={onIntent}
        />
      )}
      {preferences.level === 'schools' && (
        <PillRow
          label="Escolas públicas no mapa"
          value={preferences.schools}
          pills={SCHOOL_OPTIONS.map((option) => ({
            ...option,
            next: { ...preferences, schools: option.value },
          }))}
          onChange={onChange}
          onIntent={onIntent}
        />
      )}
      <LayerMetadata sources={sources} unit={metric?.unit ?? 'matrículas presenciais'}>
        {years.length > 1 ? (
          <select
            id="year"
            className="indicator-year-select"
            aria-label="Ano do Censo"
            value={preferences.year}
            onChange={(event) => onChange({ ...preferences, year: event.target.value })}
          >
            <option value="latest">{latestLabel}</option>
            {[...years]
              .sort((a, b) => b - a)
              .map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
          </select>
        ) : (
          <span className="indicator-year-label">{years.length ? latestLabel : 'Sem dados'}</span>
        )}
      </LayerMetadata>
    </section>
  );
}
