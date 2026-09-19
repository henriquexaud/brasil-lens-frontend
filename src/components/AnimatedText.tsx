import { useEffect, useRef } from 'react';

import { revealText, type RevealMode } from '@/lib/revealText';

type Tag = 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'dd' | 'dt' | 'strong';

interface Props {
  text: string;
  as?: Tag;
  className?: string;
  title?: string;
  mode?: RevealMode;
}

export function AnimatedText({ text, as = 'span', className, title, mode = 'text' }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ref.current) return revealText(ref.current, text, mode);
  }, [text, mode]);

  const Element = as;
  return <Element ref={ref as never} className={className} title={title} />;
}
