import { AnimatedText } from './AnimatedText';

export interface ScopeHeaderProps {
  name: string;
  onBack?: () => void;
  backLabel?: string;
  backAriaLabel?: string;
}

export function ScopeHeader({
  name,
  onBack,
  backLabel = 'Brasil',
  backAriaLabel,
}: ScopeHeaderProps) {
  return (
    <header className="scope">
      <div className="scope-text">
        {onBack && <p className="scope-kicker">Municípios de</p>}
        <AnimatedText key={name} as="h1" className="scope-title" text={name} />
      </div>
      {onBack && (
        <button
          className="ghost-button"
          onClick={onBack}
          aria-label={backAriaLabel ?? `Voltar ao ${backLabel}`}
        >
          {backLabel}
        </button>
      )}
    </header>
  );
}
