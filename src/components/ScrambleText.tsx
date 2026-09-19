/**
 * Texto que "decodifica" na primeira vez que aparece na tela.
 *
 * Mesmo efeito do hover no mapa (`features/map/scrambleReveal.ts`), mas
 * genérico para qualquer label do produto, disparado uma vez por montagem —
 * não a cada troca de valor. Diferença deliberada em relação ao hover: lá o
 * efeito recomeça a cada território sobrevoado (ver o porquê no arquivo
 * citado); aqui, um label que já apareceu só atualiza o texto direto se o
 * valor mudar por baixo dele, sem decodificar de novo — é "primeira
 * aparição", não "toda mudança". Quando o *lugar* na tela é que é novo (uma
 * troca de território, por exemplo), o chamador já força isso com `key`, e
 * este componente remonta e decodifica de novo naturalmente.
 */
import { useEffect, useRef } from 'react';

import { scrambleReveal } from '@/features/map/scrambleReveal';

type Tag = 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'dd' | 'dt' | 'strong';

interface Props {
  text: string;
  as?: Tag;
  className?: string;
  title?: string;
}

export function ScrambleText({ text, as = 'span', className, title }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const hasRevealedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (hasRevealedRef.current) {
      // Já apareceu antes nesta montagem: o valor mudou por baixo, mas não é
      // uma primeira aparição — atualiza direto, sem decodificar de novo.
      el.textContent = text;
    } else {
      hasRevealedRef.current = true;
      scrambleReveal(el, text);
    }
  }, [text]);

  const Element = as;
  return <Element ref={ref as never} className={className} title={title} />;
}
