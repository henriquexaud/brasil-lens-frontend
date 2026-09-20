import { AnimatedText } from './AnimatedText';

export function ScopeHeader({ name, onBack }: { name: string; onBack?: () => void }) {
  return (
    <header className="scope">
      <div className="scope-text">
        {onBack && <p className="scope-kicker">Municípios de</p>}
        <AnimatedText key={name} as="h1" className="scope-title" text={name} />
      </div>
      {onBack && (
        <button className="ghost-button" onClick={onBack} aria-label="Voltar ao Brasil">
          Brasil
        </button>
      )}
    </header>
  );
}
