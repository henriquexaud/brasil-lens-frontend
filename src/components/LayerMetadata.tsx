import type { ReactNode } from 'react';

export interface DataSource {
  label: string;
  description?: string;
}

export function SourceTag({ label, description }: DataSource) {
  return (
    <span className="source-tag" title={description}>
      {label}
    </span>
  );
}

export function LayerMetadata({
  sources,
  unit,
  children,
}: {
  sources: DataSource[];
  unit?: string;
  children?: ReactNode;
}) {
  return (
    <div className="layer-metadata">
      <div className="layer-metadata-left">
        {sources.map((source) => (
          <SourceTag key={source.label} {...source} />
        ))}
        {unit && <span className="layer-metadata-unit">{unit}</span>}
      </div>
      {children}
    </div>
  );
}
