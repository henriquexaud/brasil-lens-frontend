import type { ReactNode } from 'react';
import { AnimatedText } from './AnimatedText';
import { Glyph } from './Icon';

/** Cabeçalho de algo aberto no painel (território, instituição): o mesmo em todos os contextos. */
export function DetailHeader({
  kicker,
  title,
  placeholder = 'Carregando local…',
  onClose,
  closeLabel = 'Fechar detalhe',
  children,
}: {
  kicker?: ReactNode;
  /** Ausente enquanto o nome não chega: entra o `placeholder`. */
  title?: string | null;
  placeholder?: string;
  onClose: () => void;
  closeLabel?: string;
  /** Linha de apoio sob o título. */
  children?: ReactNode;
}) {
  return (
    <header className="detail-header">
      <div>
        {title ? (
          <>
            {kicker && <p className="detail-kicker">{kicker}</p>}
            <AnimatedText as="h2" className="detail-title" text={title} />
            {children}
          </>
        ) : (
          <span role="status">{placeholder}</span>
        )}
      </div>
      <button type="button" className="icon-button" onClick={onClose} aria-label={closeLabel}>
        <Glyph name="close" size={14} />
      </button>
    </header>
  );
}
