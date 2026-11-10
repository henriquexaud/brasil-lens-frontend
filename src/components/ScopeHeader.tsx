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
        {onBack && name !== 'Brasil' && <p className="scope-kicker">Municípios de</p>}
        <AnimatedText key={name} as="h1" className="scope-title" text={name} />
      </div>
      {/* No Brasil, voltar só fecharia o território aberto: o × do detalhe já faz isso. */}
      {onBack && name !== 'Brasil' && (
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
