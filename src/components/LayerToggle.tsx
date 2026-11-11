import type { ReactNode } from 'react';
import { SourceTag, type DataSource } from './LayerMetadata';

export function LayerToggle({
  label,
  sources,
  checked,
  onChange,
  status,
}: {
  label: string;
  sources: DataSource[];
  checked: boolean;
  onChange: (checked: boolean) => void;
  status?: ReactNode;
}) {
  return (
    <div className="weather-layer-card">
      <label className="weather-layer-label weather-toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="weather-layer-title">
          <span>{label}</span>
          <span className="layer-sources">
            {sources.map((source) => (
              <SourceTag key={source.label} {...source} />
            ))}
          </span>
        </span>
      </label>
      {checked && status}
    </div>
  );
}
