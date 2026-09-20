import { useRef, useState, type ReactNode } from 'react';

/** Conteúdo secundário montado ao abrir, com as interações nativas do navegador. */
export function Disclosure({
  title,
  children,
  className = '',
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className={`disclosure ${className}`}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && ref.current?.open) {
          event.stopPropagation();
          ref.current.open = false;
          ref.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className="disclosure-trigger">
        <span>{title}</span>
        <span className="disclosure-chevron" aria-hidden="true" />
      </summary>
      {open && <div className="disclosure-content">{children}</div>}
    </details>
  );
}
