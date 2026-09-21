import type { RevealMode } from '@/lib/revealText';

type Tag = 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'dd' | 'dt' | 'strong';

interface Props {
  text: string;
  as?: Tag;
  className?: string;
  title?: string;
  mode?: RevealMode;
}

/**
 * Renderiza textos e métricas de forma limpa, direta e com alta performance.
 * Números recebem alinhamento tabular (tabular-nums) para visual sério e moderno.
 */
export function AnimatedText({ text, as: Element = 'span', className, title, mode = 'text' }: Props) {
  const modeClass = mode === 'number' ? 'tabular-nums' : '';
  const combinedClass = [className, modeClass].filter(Boolean).join(' ') || undefined;

  return (
    <Element className={combinedClass} title={title}>
      {text}
    </Element>
  );
}
