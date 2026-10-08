export function DrillDownButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="drill-button" onClick={onClick}>
      Ver municípios <span aria-hidden="true">→</span>
    </button>
  );
}
